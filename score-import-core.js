// Pure matching/validation for score files (Excel/CSV). No database, no network.
// Used by POST /teacher/scores/import-preview (and copied into the demo build).
// It only PREVIEWS: nothing is saved here. Saving still goes through POST /teacher/scores.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ScoreImport = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX_CA = 40, MAX_EXAM = 60;

  function normName(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function nameKey(s) { return normName(s).split(' ').filter(Boolean).sort().join(' '); }          // "Okafor Chidera" == "Chidera Okafor"
  function normAdm(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').replace(/[\\\-_.]/g, '/'); } // VIFF-2025-0001 == VIFF/2025/0001
  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }

  function parseScore(v, max, label) {
    if (isBlank(v)) return { blank: true };
    var t = v;
    if (typeof t === 'string') {
      t = t.trim().replace(',', '.');
      if (/^(abs|absent|-|n\/a|na)$/i.test(t)) return { blank: true };
      if (!/^\d+(\.\d+)?$/.test(t)) return { error: label + ' "' + String(v).trim().slice(0, 12) + '" is not a number.' };
      t = Number(t);
    }
    if (typeof t !== 'number' || !isFinite(t)) return { error: label + ' is not a number.' };
    if (t < 0 || t > max) return { error: label + ' must be between 0 and ' + max + '.' };
    return { value: Math.round(t * 10) / 10 };
  }

  // students: [{studentId, name, admissionNumber, ca, exam, locked}]   rows: [{line, admissionNumber, name, ca, exam}]
  function matchRows(students, rows) {
    var byAdm = {}, byName = {};
    students.forEach(function (s) {
      if (s.admissionNumber) byAdm[normAdm(s.admissionNumber)] = s;
      var k = nameKey(s.name); (byName[k] = byName[k] || []).push(s);
    });
    var out = [], seen = {}, counts = { total: 0, ok: 0, unchanged: 0, error: 0, locked: 0, skipped: 0 };

    rows.forEach(function (r, i) {
      var line = r.line || (i + 2);
      var adm = isBlank(r.admissionNumber) ? '' : String(r.admissionNumber).trim(), nm = isBlank(r.name) ? '' : String(r.name).trim();
      if (!adm && !nm && isBlank(r.ca) && isBlank(r.exam)) return;            // completely empty line: ignore
      var row = { check: !!r.check, line: line, fileAdmission: adm, fileName: nm, studentId: null, name: nm || adm, admissionNumber: adm, ca: null, exam: null, existing: null, status: 'ok', message: '' };
      var s = null, note = r.note || '';
      if (adm) {
        s = byAdm[normAdm(adm)] || null;
        if (!s && nm) { var m0 = byName[nameKey(nm)]; if (m0 && m0.length === 1) { s = m0[0]; note = 'Matched by name (admission number not found).'; } }
        if (!s) { row.status = 'error'; row.message = 'No student with admission number "' + adm + '" in this class.'; }
      } else if (nm) {
        var m = byName[nameKey(nm)];
        if (!m) { row.status = 'error'; row.message = 'No student named "' + nm + '" in this class.'; }
        else if (m.length > 1) { row.status = 'error'; row.message = 'More than one student is called "' + nm + '". Add the admission number.'; }
        else s = m[0];
      } else { row.status = 'error'; row.message = 'Add the admission number or the student name.'; }

      if (s) {
        row.studentId = s.studentId; row.name = s.name; row.admissionNumber = s.admissionNumber || '';
        row.existing = (s.ca === null || s.ca === undefined) ? null : { ca: s.ca, exam: s.exam };
        if (!note && adm && nm && nameKey(nm) !== nameKey(s.name)) note = 'Name in the file ("' + nm + '") differs from the class list.';
        var ca = parseScore(r.ca, MAX_CA, 'C.A'), ex = parseScore(r.exam, MAX_EXAM, 'Exam');
        if (s.locked) { row.status = 'locked'; row.message = 'Results are already published. Ask the administrator to change them.'; }
        else if (ca.error || ex.error) { row.status = 'error'; row.message = ca.error || ex.error; }
        else if (ca.blank && ex.blank) { row.status = 'skipped'; row.message = 'No scores in this row.'; }
        else if (ca.blank || ex.blank) { row.status = 'error'; row.message = 'Enter both C.A and Exam (use 0 if the student scored nothing).'; }
        else {
          row.ca = ca.value; row.exam = ex.value; row.message = note;
          if (row.existing && row.existing.ca === row.ca && row.existing.exam === row.exam) row.status = 'unchanged';
        }
        if (row.status !== 'locked' && row.status !== 'skipped') (seen[s.studentId] = seen[s.studentId] || []).push(row);
        else seen[s.studentId] = seen[s.studentId] || [];
      }
      out.push(row);
    });

    Object.keys(seen).forEach(function (id) {                                  // the same student on two lines
      if (seen[id].length > 1) seen[id].forEach(function (r) {
        r.status = 'error'; r.message = 'This student appears more than once (lines ' + seen[id].map(function (x) { return x.line; }).join(', ') + ').';
      });
    });
    out.forEach(function (r) { counts.total++; counts[r.status] = (counts[r.status] || 0) + 1; });
    var missing = students.filter(function (s) { return !s.locked && !seen[s.studentId]; })
      .map(function (s) { return { studentId: s.studentId, name: s.name, admissionNumber: s.admissionNumber || '' }; });
    return { rows: out, missing: missing, counts: counts };
  }

  return { matchRows: matchRows, parseScore: parseScore, MAX_CA: MAX_CA, MAX_EXAM: MAX_EXAM };
}));
