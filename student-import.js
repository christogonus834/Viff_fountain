// Reads a student list (Excel .xlsx or CSV) in the browser, and builds the login sheets afterwards. Needs score-upload.js (file reader).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./score-upload.js') : null); else root.StudentImport = factory(root.ScoreUpload);
}(typeof self !== 'undefined' ? self : this, function (SU) {
  'use strict';
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function detect(row) {
    var c = { adm: -1, name: -1, cls: -1, gender: -1, dob: -1, pName: -1, pPhone: -1, pEmail: -1 };
    row.forEach(function (cell, i) {
      var k = norm(cell); if (!k) return;
      if (/parent|guardian|father|mother/.test(k)) {
        if (/mail/.test(k)) { if (c.pEmail < 0) c.pEmail = i; } else if (/phone|tel|mobile|gsm|number|contact/.test(k)) { if (c.pPhone < 0) c.pPhone = i; } else if (c.pName < 0) c.pName = i;
      }
      else if (/admission|admno|regno|registration|matric|studentid/.test(k)) { if (c.adm < 0) c.adm = i; }
      else if (/^(class|classname|grade|level|classadmitted)$/.test(k) || /^class/.test(k)) { if (c.cls < 0) c.cls = i; }
      else if (/gender|sex/.test(k)) { if (c.gender < 0) c.gender = i; }
      else if (/dateofbirth|dob|birth/.test(k)) { if (c.dob < 0) c.dob = i; }
      else if (/name|student|pupil/.test(k)) { if (c.name < 0) c.name = i; }
    });
    return c;
  }
  function toRows(grid) {
    var h = -1, c = null;
    for (var i = 0; i < Math.min(grid.length, 12); i++) { var d = detect(grid[i] || []); if (d.name >= 0 && d.cls >= 0) { h = i; c = d; break; } }
    if (h < 0) return { error: 'Could not find the "Student Name" and "Class" columns. Download the template and keep its column titles.' };
    var rows = [];
    for (var r = h + 1; r < grid.length; r++) {
      var g = grid[r] || [], get = function (ix) { var v = ix >= 0 && g[ix] !== undefined ? g[ix] : null; return (typeof v === 'string' && v.trim() === '') ? null : v; };
      var o = { line: r + 1, admissionNumber: get(c.adm), name: get(c.name), className: get(c.cls), gender: get(c.gender), dateOfBirth: get(c.dob), parentName: get(c.pName), parentPhone: get(c.pPhone), parentEmail: get(c.pEmail) };
      if (!o.name && !o.className && !o.parentName && !o.admissionNumber) continue;
      ['admissionNumber', 'name', 'className', 'gender', 'dateOfBirth', 'parentName', 'parentPhone', 'parentEmail'].forEach(function (k) { if (o[k] !== null && typeof o[k] === 'number' && k !== 'dateOfBirth') o[k] = String(o[k]); });
      if (typeof o.dateOfBirth === 'number') o.dateOfBirth = excelDate(o.dateOfBirth);
      rows.push(o);
    }
    return rows.length ? { rows: rows } : { error: 'The file has no student rows under the column titles.' };
  }
  function excelDate(n) { if (n < 20000 || n > 80000) return String(n); var d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return d.toISOString().slice(0, 10); }   // Excel stores dates as day numbers
  function esc(v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv(rows) { return '\uFEFF' + rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n'); }
  function templateCsv(manual, firstClass) {
    var head = (manual ? ['Admission Number'] : []).concat(['Student Name', 'Class', 'Gender', 'Date of Birth', 'Parent Name', 'Parent Phone', 'Parent Email']);
    var sample = (manual ? ['OLD/2019/045'] : []).concat(['Ada Okafor', firstClass || 'JSS 1A', 'Female', '14/05/2014', 'Mrs Ngozi Okafor', '08031234567', 'ngozi@example.com']);
    return csv([head, sample]);
  }
  function credentialsCsv(results) {
    var rows = [['Class', 'Student', 'Student login (admission number)', 'Student temporary password', 'Parent login (email)', 'Parent temporary password']];
    results.filter(function (r) { return r.ok; }).forEach(function (r) { rows.push([r.className, r.name, r.admissionNumber, r.studentTemp, r.parentEmail || '', r.parentTemp || (r.parentEmail ? (r.parentError ? 'Parent login failed: ' + r.parentError : 'Uses existing parent login') : '')]); });
    return csv(rows);
  }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slipsHtml(results, school, loginUrl) {
    var list = results.filter(function (r) { return r.ok; }).sort(function (a, b) { return (a.className + a.name).localeCompare(b.className + b.name); });
    var slips = list.map(function (r) {
      var parent = r.parentEmail ? '<div class="blk"><b>Parent login</b><div>Email: <code>' + h(r.parentEmail) + '</code></div><div>Password: <code>' + h(r.parentTemp || '') + '</code>' + (r.parentTemp ? '' : '<i>use the parent\'s existing password</i>') + '</div></div>' : '';
      return '<div class="slip"><div class="sch">' + h(school) + '</div><div class="who">' + h(r.name) + ' <span>' + h(r.className) + '</span></div>' +
        '<div class="blk"><b>Student login</b><div>ID: <code>' + h(r.admissionNumber) + '</code></div><div>Password: <code>' + h(r.studentTemp) + '</code></div></div>' + parent +
        '<div class="note">Sign in at ' + h(loginUrl) + '. You will be asked to choose a new password the first time.</div></div>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Login slips</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;margin:0;color:#000}.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.slip{border:1.5px dashed #444;border-radius:6px;padding:10px 12px;break-inside:avoid;font-size:12px;line-height:1.45}.sch{font-weight:700;font-size:11px;letter-spacing:.03em;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:6px}' +
      '.who{font-size:14px;font-weight:700;margin-bottom:4px}.who span{font-weight:400;color:#555;font-size:12px}.blk{margin:4px 0}code{font-size:13px;font-weight:700;background:#f2f2f2;padding:1px 5px;border-radius:3px}.note{margin-top:6px;font-size:10px;color:#555}i{font-size:11px;color:#555}</style></head><body><div class="g">' +
      slips + '</div><script>setTimeout(function(){window.print()},400)<\/script></body></html>';
  }
  return { detect: detect, toRows: toRows, templateCsv: templateCsv, credentialsCsv: credentialsCsv, slipsHtml: slipsHtml, excelDate: excelDate, readFile: function (f) { return SU.readFile(f); } };
}));
