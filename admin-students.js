// ══════════════════════════════════════════════════════════════
//  VIFF — admin-students.js   Student Management
//  Search, view, edit, add, approve/reject admissions, promote and transfer.
//  Backend only. Every value renders via TFIS.h (textContent), never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear, K = global.AMKit, A = global.AdminManageAPI;
  K.shell();
  function $(id) { return document.getElementById(id); }
  var FEE = { full: ['Paid in full', 'green'], part: ['Part payment', 'amber'], not_paid: ['Not paid', 'red'] };
  var S = { tab: 'students', students: [], pending: [], classes: [], q: '', cls: '', fee: '', limit: 200, num: null, role: '', school: 'School',
    imp: { step: 'start', rows: [], preview: null, results: [], fileName: '', busy: false, progress: '' } };
  var root;

  function classNames() { return S.classes.map(function (c) { return c.name; }); }
  function feeBadge(s) { var f = FEE[s] || [s || '\u2014', 'gray']; return P.badge(f[0], f[1]); }
  function fmtDay(d) { return d ? T.fmtDate(d) : '\u2014'; }
  function btn(label, cls, fn) { return h('button', { 'class': 'am-btn ' + cls, type: 'button', onclick: fn }, label); }

  // ── data ──
  async function loadAll() {
    clear(root).appendChild(P.skeleton());
    var res = await Promise.all([A.students({ status: 'approved' }), A.pending(), A.classes(), A.numbering()]);
    var bad = res.slice(0, 3).find(function (r) { return !r.ok; });
    if (bad) { clear(root).appendChild(P.errorBlock(bad.status === 403 ? K.apiMessage(bad, 'You do not have access to this.') : 'We could not load the students. Please try again.', bad.status === 403 ? null : loadAll)); return; }
    S.students = res[0].data.students || []; S.pending = res[1].data.admissions || []; S.classes = res[2].data.classes || []; S.num = res[3].ok ? res[3].data : null;
    render();
  }
  async function refreshStudents() { var r = await A.students({ status: 'approved' }); if (r.ok) S.students = r.data.students || []; var n = await A.numbering(); if (n.ok) S.num = n.data; }
  async function refreshPending() { var r = await A.pending(); if (r.ok) S.pending = r.data.admissions || []; }

  // ── layout ──
  function render() {
    var notPaid = S.students.filter(function (s) { return s.feeStatus === 'not_paid'; }).length;
    clear(root).appendChild(h('div', null,
      h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, 'Student Management'), h('p', null, 'Search, view and edit students, handle admissions, promote and transfer.')),
        h('div', { 'class': 'am-actions am-noprint' }, btn('+ Add student', 'gold', addStudent), btn('Export CSV', 'line', exportCsv))),
      h('div', { 'class': 'ui-kpis' },
        P.kpi('blue', 'user', 'Enrolled students', String(S.students.length), null),
        P.kpi('amber', 'doc', 'Pending admissions', String(S.pending.length), S.pending.length ? 'Waiting for a decision' : 'All dealt with'),
        P.kpi('navy', 'cap', 'Classes', String(S.classes.length), null),
        P.kpi('red', 'wallet', 'Fees not paid', String(notPaid), 'students')),
      K.tabs([{ id: 'students', label: 'All students' }, { id: 'admissions', label: 'Admissions', count: S.pending.length }, { id: 'import', label: 'Import' }, { id: 'promote', label: 'Promote class' }, { id: 'numbering', label: 'Numbering' }], S.tab, function (t) { S.tab = t; render(); }),
      h('div', { id: 'sm-panel' }, S.tab === 'students' ? studentsPanel() : S.tab === 'admissions' ? admissionsPanel() : S.tab === 'import' ? importPanel() : S.tab === 'numbering' ? numberingPanel() : promotePanel())));
  }

  // ── tab 1: all students ──
  function filtered() {
    var q = S.q.trim().toLowerCase();
    return S.students.filter(function (s) {
      if (S.cls && s.className !== S.cls) return false;
      if (S.fee && s.feeStatus !== S.fee) return false;
      return !q || (s.name + ' ' + s.admissionNumber + ' ' + (s.parentName || '') + ' ' + (s.phone || '')).toLowerCase().indexOf(q) > -1;
    });
  }
  function studentsPanel() {
    var search = K.input({ placeholder: 'Search name, admission number, parent or phone', value: S.q, id: 'sm-q' });
    search.setAttribute('aria-label', 'Search students');
    search.addEventListener('input', K.debounce(function () { S.q = search.value; S.limit = 200; drawTable(); }, 180));
    var cls = K.select([{ value: '', label: 'All classes' }].concat(classNames().map(function (n) { return { value: n, label: n }; })), S.cls);
    cls.addEventListener('change', function () { S.cls = cls.value; S.limit = 200; drawTable(); });
    var fee = K.select([{ value: '', label: 'Any fee status' }, { value: 'full', label: 'Paid in full' }, { value: 'part', label: 'Part payment' }, { value: 'not_paid', label: 'Not paid' }], S.fee);
    fee.addEventListener('change', function () { S.fee = fee.value; S.limit = 200; drawTable(); });
    var wrap = h('div', null, h('div', { 'class': 'am-toolbar am-noprint' }, h('div', { 'class': 'am-grow' }, search), cls, fee), h('div', { id: 'sm-table' }));
    setTimeout(drawTable, 0);
    return wrap;
  }
  function drawTable() {
    var box = $('sm-table'); if (!box) return;
    var rows = filtered(), shown = rows.slice(0, S.limit);
    if (!rows.length) { clear(box).appendChild(P.empty(S.students.length ? 'No students match your search.' : 'No students have been enrolled yet.')); return; }
    var body = h('tbody');
    shown.forEach(function (s) {
      var tr = h('tr', { 'class': 'am-row-btn', tabindex: '0', role: 'button', 'aria-label': 'View ' + s.name },
        h('td', null, h('strong', null, s.name), h('div', { 'class': 'am-muted' }, s.admissionNumber)),
        h('td', null, s.className), h('td', null, s.gender || '\u2014'),
        h('td', null, s.parentName || '\u2014', h('div', { 'class': 'am-muted' }, s.phone && s.phone !== '\u2014' ? s.phone : '')),
        h('td', null, feeBadge(s.feeStatus)));
      tr.addEventListener('click', function () { viewStudent(s.id); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viewStudent(s.id); } });
      body.appendChild(tr);
    });
    clear(box).appendChild(h('div', null,
      h('div', { 'class': 'am-muted', style: 'margin:0 0 8px' }, 'Showing ' + shown.length + ' of ' + rows.length + ' student' + (rows.length === 1 ? '' : 's')),
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Student'), h('th', null, 'Class'), h('th', null, 'Gender'), h('th', null, 'Parent / guardian'), h('th', null, 'Fees'))), body)),
      rows.length > shown.length ? h('div', { style: 'margin-top:10px' }, btn('Show more', 'line', function () { S.limit += 200; drawTable(); })) : null));
  }
  function exportCsv() {
    var rows = [['Name', 'Admission number', 'Class', 'Gender', 'Parent', 'Parent phone', 'Fee status']];
    filtered().forEach(function (s) { rows.push([s.name, s.admissionNumber, s.className, s.gender, s.parentName, s.phone, (FEE[s.feeStatus] || [s.feeStatus])[0]]); });
    K.csvDownload('students.csv', rows);
  }

  // ── view / edit / transfer ──
  async function viewStudent(id) {
    var holder = h('div', null, P.skeleton()), m = K.modal('Student', holder);
    var r = await A.student(id);
    if (!r.ok) { clear(holder).appendChild(P.errorBlock(K.apiMessage(r, 'Could not load this student.'), null)); return; }
    var s = r.data.student, a = r.data.attendance, lr = r.data.latestResult;
    var kv = function (k, v) { return h('div', null, h('b', null, k), v || '\u2014'); };
    clear(holder).appendChild(h('div', { style: 'display:grid;gap:14px' },
      h('div', null, h('h3', { style: 'margin:0 0 2px;color:#0b1f5c' }, s.name), h('div', { 'class': 'am-muted' }, s.admissionNumber + ' \u00B7 ' + (s.className || 'No class')), h('div', { style: 'margin-top:6px' }, feeBadge(s.fee.status))),
      h('div', { 'class': 'am-kv' }, kv('Gender', s.gender), kv('Date of birth', fmtDay(s.dateOfBirth)), kv('Address', s.address), kv('Previous school', s.prevSchool), kv('Enrolled', fmtDay(s.createdAt)), kv('Admitted', s.admission && s.admission.session ? s.admission.term + ' term ' + s.admission.session + ' \u00B7 ' + (s.admission.className || '') : '')),
      h('div', null, h('b', { style: 'font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:#5b6478' }, 'Parent / guardian'),
        h('div', { 'class': 'am-kv', style: 'margin-top:6px' }, kv('Name', s.parent.name), kv('Relationship', s.parent.relationship), kv('Phone', s.parent.phone), kv('Email', s.parent.email))),
      h('div', { 'class': 'am-kv' },
        kv('Attendance (last ' + a.days + ' days)', a.rate === null ? 'No records yet' : a.rate + '%  (' + a.present + ' present, ' + a.late + ' late, ' + a.absent + ' absent)'),
        kv('Latest published result', lr ? lr.term + ' term ' + lr.session + ': ' + T.fmtNumber(lr.average, 1) + '% (' + lr.grade + '), position ' + lr.position + ' of ' + lr.classSize : 'None yet')),
      s.fee.note ? h('div', { 'class': 'ui-fee-note' }, 'Fee note: ' + s.fee.note) : null,
      h('div', { 'class': 'am-actions' }, btn('Edit details', 'gold', function () { m.close(); editStudent(s); }), btn('Transfer to another class', 'line', function () { m.close(); transferStudent(s); }), btn('Close', 'line', m.close))));
  }
  function editStudent(s) {
    var f = { name: K.input({ value: s.name, maxlength: 120 }), cls: K.select([{ value: '', label: '(no class)' }].concat(classNames().map(function (n) { return { value: n, label: n }; })), s.className),
      gender: K.select([{ value: '', label: 'Not set' }, 'Male', 'Female'], s.gender), dob: K.input({ type: 'date', value: s.dateOfBirth || '' }), addr: K.input({ value: s.address, maxlength: 200 }),
      pName: K.input({ value: s.parent.name, maxlength: 120 }), pRel: K.input({ value: s.parent.relationship, maxlength: 40 }), pPhone: K.input({ value: s.parent.phone, maxlength: 30 }) };
    var form = h('div', { style: 'display:grid;gap:12px' }, K.field('Student name', f.name),
      h('div', { 'class': 'am-grid2' }, K.field('Class', f.cls), K.field('Gender', f.gender)),
      h('div', { 'class': 'am-grid2' }, K.field('Date of birth', f.dob), K.field('Address', f.addr)),
      h('div', { 'class': 'am-grid2' }, K.field('Parent / guardian name', f.pName), K.field('Relationship', f.pRel)),
      K.field('Parent phone', f.pPhone, 'Login email, password and admission number cannot be changed here.'));
    K.formModal('Edit ' + s.name, form, 'Save changes', async function (close, setError, setBusy) {
      var want = { name: f.name.value.trim(), className: f.cls.value, gender: f.gender.value, dateOfBirth: f.dob.value, address: f.addr.value.trim(), parentName: f.pName.value.trim(), parentRel: f.pRel.value.trim(), parentPhone: f.pPhone.value.trim() };
      var was = { name: s.name, className: s.className, gender: s.gender, dateOfBirth: s.dateOfBirth || '', address: s.address, parentName: s.parent.name, parentRel: s.parent.relationship, parentPhone: s.parent.phone };
      var body = {}; Object.keys(want).forEach(function (k) { if (want[k] !== was[k]) body[k] = want[k]; });
      if (!want.name || want.name.length < 2) return setError('Enter the student\u2019s name.');
      if (!Object.keys(body).length) return setError('Nothing has been changed.');
      if (body.className === '') return setError('Choose a class, or use Transfer to move the student.');
      setBusy(true); var r = await A.editStudent(s.id, body); setBusy(false);
      if (!r.ok) return setError(K.apiMessage(r, 'Could not save the changes.'));
      close(); K.toast('Student updated.'); await refreshStudents(); render();
    });
  }
  function transferStudent(s) {
    var others = classNames().filter(function (n) { return n !== s.className; });
    if (!others.length) { K.toast('There is no other class to move this student to.'); return; }
    var cls = K.select(others, others[0]), why = K.input({ placeholder: 'e.g. Moved to the science class', maxlength: 200 });
    K.formModal('Transfer ' + s.name, h('div', { style: 'display:grid;gap:12px' }, h('p', { style: 'margin:0' }, 'Currently in ', h('strong', null, s.className || 'no class'), '.'), K.field('Move to', cls), K.field('Reason (kept in the audit log)', why)),
      'Transfer student', async function (close, setError, setBusy) {
        if (why.value.trim().length < 3) return setError('Please give a short reason.');
        setBusy(true); var r = await A.transfer(s.id, { className: cls.value, reason: why.value.trim() }); setBusy(false);
        if (!r.ok) return setError(K.apiMessage(r, 'Could not transfer the student.'));
        close(); K.toast(r.data.message); await refreshStudents(); render();
      });
  }
  function credentialBox(title, lines) {
    var text = lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
    var body = h('div', { style: 'display:grid;gap:12px' }, h('p', { style: 'margin:0' }, 'Give these logins to the family now. The passwords are shown only once. They will be asked to change them.'),
      h('div', { 'class': 'am-cred' }, lines.map(function (l) { return h('div', null, l[0] + ': ', h('code', null, l[1])); })),
      h('div', { 'class': 'am-actions' }, btn('Copy', 'line', function () { K.copyText(text); })));
    var m = K.modal(title, body, { sticky: true });
    body.appendChild(h('div', { 'class': 'am-actions' }, btn('Done', 'gold', m.close)));
  }
  function numMode() { return S.num && S.num.settings ? S.num.settings.mode : 'auto'; }
  function previewNumber(className) {
    if (!S.num || numMode() !== 'auto') return null;
    var st = S.num.settings, cal = S.num.calendar, seq = Math.max(st.startAt || 1, (S.num.highestUsed || 0) + 1);
    return global.AdmissionNumbers.format(st, { year: cal.year, term: cal.term, className: className, seq: seq });
  }
  function addStudent() {
    if (!classNames().length) { K.toast('Create a class first (Full Admin Panel \u2192 Classes).'); return; }
    var manual = numMode() === 'manual';
    var f = { name: K.input({ maxlength: 120 }), cls: K.select(classNames(), classNames()[0]), gender: K.select([{ value: '', label: 'Not set' }, 'Male', 'Female'], ''), phone: K.input({ maxlength: 30, placeholder: 'optional' }),
      pName: K.input({ maxlength: 120, placeholder: 'optional' }), pEmail: K.input({ type: 'email', maxlength: 255, placeholder: 'creates the parent login' }), adm: K.input({ maxlength: 40, placeholder: 'e.g. OLD/2019/045' }) };
    var hint = h('div', { 'class': 'am-hint' });
    function setHint() { var n = previewNumber(f.cls.value); hint.textContent = manual ? 'Manual numbering is on: type the number the school already uses.' : (n ? 'Admission number is automatic. This student will get ' + n + '.' : 'Admission number is automatic.'); }
    f.cls.addEventListener('change', setHint); setHint();
    var fields = h('div', { style: 'display:grid;gap:12px' }, K.field('Full name', f.name), h('div', { 'class': 'am-grid2' }, K.field('Class', f.cls), K.field('Gender', f.gender)),
      manual ? K.field('Admission number', f.adm) : null, h('div', { 'class': 'am-field' }, hint),
      h('div', { 'class': 'am-grid2' }, K.field('Parent / guardian name', f.pName), K.field('Parent phone', f.phone)), K.field('Parent email', f.pEmail, 'A parent login is created from this email. Brothers and sisters with the same email share one login.'));
    K.formModal('Add a student', fields, 'Enrol student', async function (close, setError, setBusy) {
      if (f.name.value.trim().length < 2) return setError('Enter the student\u2019s full name.');
      if (manual && !f.adm.value.trim()) return setError('Enter the admission number.');
      setBusy(true);
      var r = await A.enrol({ name: f.name.value.trim(), className: f.cls.value, gender: f.gender.value, phone: f.phone.value.trim(), parentName: f.pName.value.trim(), parentEmail: f.pEmail.value.trim(), admissionNumber: manual ? f.adm.value.trim() : '' });
      setBusy(false);
      if (!r.ok) return setError(K.apiMessage(r, 'Could not enrol the student.'));
      close(); await refreshStudents(); render();
      var d = r.data, lines = [['Name', d.student.name], ['Admission number', d.student.admissionNumber], ['Student login', d.student.admissionNumber], ['Student temporary password', d.tempPassword]];
      if (f.pEmail.value.trim()) { lines.push(['Parent login (email)', f.pEmail.value.trim()]); lines.push(['Parent temporary password', d.parentTempPassword || (d.parentError ? 'Parent login failed: ' + d.parentError : 'Uses the existing parent login')]); }
      credentialBox('Student enrolled', lines);
    });
  }

  // ── tab 2: admissions ──
  function admissionsPanel() {
    if (!S.pending.length) return P.card('Admissions', null, P.empty('No applications are waiting. New online applications appear here.'));
    return h('div', { 'class': 'am-cards' }, S.pending.map(function (a) {
      var kv = function (k, v) { return h('div', null, h('b', null, k), v || '\u2014'); };
      return h('div', { 'class': 'am-app' },
        h('div', { 'class': 'am-app-head' }, h('strong', { style: 'font-size:1.02rem' }, a.studentName), h('span', { 'class': 'am-muted' }, (a.referenceNumber || '') + ' \u00B7 applied ' + fmtDay(a.created_at || a.createdAt))),
        h('div', { 'class': 'am-kv' }, kv('Class applied', a.classApplied), kv('Gender', a.gender), kv('Date of birth', fmtDay(a.dateOfBirth)), kv('Previous school', a.prevSchool),
          kv('Parent', (a.parentName || '') + (a.parentRel ? ' (' + a.parentRel + ')' : '')), kv('Phone', a.parentPhone), kv('Email', a.parentEmail)),
        h('div', { 'class': 'am-actions' }, btn('Approve', 'green', function () { decide(a, 'approved'); }), btn('Reject', 'red', function () { decide(a, 'rejected'); })));
    }));
  }
  function decide(a, status) {
    var ok = status === 'approved';
    if (ok && numMode() === 'manual') {                                                    // manual numbering: the admin types the number now
      var num = K.input({ maxlength: 40, placeholder: 'e.g. OLD/2019/045' });
      return K.formModal('Approve ' + a.studentName, h('div', { style: 'display:grid;gap:12px' }, K.field('Admission number', num, 'Manual numbering is on. This number is also the student\u2019s login and cannot be changed later.')), 'Approve', async function (close, setError, setBusy) {
        if (!num.value.trim()) return setError('Enter the admission number.');
        setBusy(true); var r = await A.decide(a.id, 'approved', num.value.trim()); setBusy(false);
        if (!r.ok) return setError(K.apiMessage(r, 'Could not approve.'));
        close(); await Promise.all([refreshPending(), refreshStudents()]); render(); approvedBox(a, r);
      }, 'green');
    }
    K.confirmBox(ok ? 'Approve application' : 'Reject application',
      ok ? 'Approve ' + a.studentName + ' for ' + (a.classApplied || 'the chosen class') + '? Student and parent logins are created now.' : 'Reject ' + a.studentName + '\u2019s application? This cannot be undone.',
      ok ? 'Approve' : 'Reject', async function () {
        var r = await A.decide(a.id, status); if (!r.ok) return K.apiMessage(r, 'Could not save the decision.');
        await Promise.all([refreshPending(), refreshStudents()]); render();
        if (ok) approvedBox(a, r); else K.toast('Application rejected.');
      }, ok ? 'green' : 'red');
  }

  function approvedBox(a, r) {
    var tp = r.data.tempPasswords || {}, lines = [['Student', a.studentName], ['Login (admission number)', (r.data.student && (r.data.student.admission_number || r.data.student.admissionNumber)) || '\u2014']];
    if (tp.student) lines.push(['Student temporary password', tp.student]);
    if (tp.parent) { lines.push(['Parent login (email)', a.parentEmail || '\u2014']); lines.push(['Parent temporary password', tp.parent]); }
    credentialBox('Application approved', lines);
  }

  // ── tab: import ──
  function importPanel() {
    var I = S.imp, manual = numMode() === 'manual';
    var box = h('div', null);
    if (I.step === 'start') {
      var file = h('input', { type: 'file', accept: '.csv,.xlsx,.txt', style: 'display:none' }); file.style.display = 'none';
      file.addEventListener('change', function () { if (file.files && file.files[0]) readImport(file.files[0]); file.value = ''; });
      box.appendChild(P.card('Import students from Excel or CSV', null, h('div', { style: 'display:grid;gap:12px' },
        h('p', { style: 'margin:0' }, 'Fill the template (one row per student), upload it, check the list, then create everything in one go. Student logins and parent logins are created for you.'),
        h('ul', { style: 'margin:0;padding-left:20px;line-height:1.7' },
          h('li', null, manual ? 'Manual numbering is on: every row needs its Admission Number.' : 'Admission numbers are automatic: leave that column out. The next one is ' + (previewNumber(classNames()[0] || 'JSS 1A') || '\u2014') + '.'),
          h('li', null, 'The Class must already exist (' + (classNames().join(', ') || 'none yet') + ').'),
          h('li', null, 'Brothers and sisters with the same Parent Email share ONE parent login.')),
        h('div', { 'class': 'am-actions' }, btn('\u2193 Download template', 'line', function () { K.csvDownloadRaw('student-import-template.csv', global.StudentImport.templateCsv(manual, classNames()[0])); }), btn('\u2191 Upload Excel / CSV', 'gold', function () { file.click(); }), file),
        I.busy ? h('div', { 'class': 'am-muted' }, I.progress || 'Reading the file\u2026') : null)));
    } else if (I.step === 'review') {
      var pv = I.preview, c = pv.counts, body = h('tbody');
      pv.rows.forEach(function (x) {
        var tone = x.status === 'ok' ? ['Ready', 'green'] : x.status === 'duplicate' ? ['Skip', 'gray'] : ['Fix', 'red'];
        body.appendChild(h('tr', null, h('td', null, String(x.line)), h('td', null, h('strong', null, x.name || '\u2014'), h('div', { 'class': 'am-muted' }, x.className || '')),
          h('td', null, x.parentName || '\u2014', h('div', { 'class': 'am-muted' }, x.parentEmail || '')), h('td', null, x.admissionNumber || '\u2014'),
          h('td', null, P.badge(tone[0], tone[1]), x.message ? h('div', { 'class': 'am-muted' }, x.message) : null)));
      });
      var go = btn(c.ok ? 'Create ' + c.ok + ' student' + (c.ok === 1 ? '' : 's') + ' and logins' : 'Nothing to create', 'gold', commitImport); if (!c.ok || I.busy) go.disabled = true;
      box.appendChild(P.card('Check ' + I.fileName, null, h('div', null,
        h('p', { 'class': 'ui-hint', id: 'imp-summary' }, c.ok + ' ready \u00B7 ' + c.duplicate + ' already enrolled / repeated \u00B7 ' + c.error + ' to fix \u00B7 about ' + pv.parentLogins + ' parent login' + (pv.parentLogins === 1 ? '' : 's') + ' to create'),
        c.error ? h('p', { 'class': 'ui-hint' }, 'Rows marked \u201CFix\u201D are skipped. Correct them in the file and upload again if you want them included.') : null,
        !manual ? h('p', { 'class': 'ui-hint' }, 'The numbers shown are what each student will receive, in file order.') : null,
        h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Line'), h('th', null, 'Student'), h('th', null, 'Parent'), h('th', null, 'Admission no.'), h('th', null, 'Check'))), body)),
        h('div', { 'class': 'am-actions', style: 'margin-top:12px' }, go, btn('Cancel', 'line', function () { S.imp = { step: 'start', rows: [], preview: null, results: [], fileName: '', busy: false, progress: '' }; render(); }),
          I.busy ? h('span', { 'class': 'am-muted', id: 'imp-progress' }, I.progress) : null))));
    } else {
      var rs = I.results, made = rs.filter(function (r) { return r.ok; }), failed = rs.filter(function (r) { return !r.ok && !r.skipped; }), parents = made.filter(function (r) { return r.parentTemp; }).length;
      var fb = h('tbody'); rs.filter(function (r) { return !r.ok; }).forEach(function (r) { fb.appendChild(h('tr', null, h('td', null, String(r.line)), h('td', null, r.name), h('td', null, r.message || ''))); });
      box.appendChild(P.card('Import finished', null, h('div', { style: 'display:grid;gap:12px' },
        h('div', { 'class': 'ui-fee-note', style: 'margin:0' }, h('strong', null, made.length + ' student' + (made.length === 1 ? '' : 's') + ' created'), h('div', null, parents + ' new parent login' + (parents === 1 ? '' : 's') + (failed.length ? ' \u00B7 ' + failed.length + ' row(s) failed' : '') + '.')),
        h('div', { 'class': 'am-cred' }, h('div', null, 'Download or print the logins now. For safety the temporary passwords are shown only once, and cannot be shown again after you leave this page.')),
        h('div', { 'class': 'am-actions' }, btn('\u2193 Download logins (CSV)', 'gold', function () { K.csvDownloadRaw('student-logins.csv', global.StudentImport.credentialsCsv(rs)); }), btn('\u2399 Print login slips', 'line', printSlips), btn('Done', 'line', function () { S.imp = { step: 'start', rows: [], preview: null, results: [], fileName: '', busy: false, progress: '' }; S.tab = 'students'; render(); })),
        fb.children.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Line'), h('th', null, 'Student'), h('th', null, 'Not created because'))), fb)) : null)));
    }
    return box;
  }
  async function readImport(f) {
    var I = S.imp; I.busy = true; I.progress = 'Reading the file\u2026'; render();
    try {
      if (f.size > 4 * 1024 * 1024) throw new Error('That file is too large (maximum 4 MB).');
      var parsed = global.StudentImport.toRows(await global.ScoreUpload.readFile(f)); if (parsed.error) throw new Error(parsed.error);
      I.rows = parsed.rows; I.fileName = f.name;
      var r = await A.importPreview(parsed.rows); if (!r.ok) throw new Error(K.apiMessage(r, 'Could not check the file.'));
      I.preview = r.data; I.step = 'review';
    } catch (e) { K.toast(e && e.message ? e.message : 'Could not read that file.'); }
    I.busy = false; render();
  }
  async function commitImport() {
    var I = S.imp, ok = I.preview.rows.filter(function (x) { return x.status === 'ok'; }).map(function (x) { return { line: x.line, admissionNumber: x.admissionNumber && numMode() === 'manual' ? x.admissionNumber : undefined, name: x.name, className: x.className, gender: x.gender, dateOfBirth: x.dateOfBirth, parentName: x.parentName, parentPhone: x.parentPhone, parentEmail: x.parentEmail }; });
    ok.forEach(function (x) { Object.keys(x).forEach(function (k) { if (x[k] === undefined || x[k] === null || x[k] === '') delete x[k]; }); });
    I.busy = true; I.results = []; render();
    for (var i = 0; i < ok.length; i += 50) {
      I.progress = 'Creating students ' + Math.min(i + 50, ok.length) + ' of ' + ok.length + '\u2026'; var pr = $('imp-progress'); if (pr) pr.textContent = I.progress;
      var r = await A.importCommit(ok.slice(i, i + 50));
      if (!r.ok) { I.results = I.results.concat(ok.slice(i, i + 50).map(function (x) { return { line: x.line, name: x.name, className: x.className, ok: false, message: K.apiMessage(r, 'This group could not be created.') }; })); break; }
      I.results = I.results.concat(r.data.results);
    }
    I.results = I.results.concat(I.preview.rows.filter(function (x) { return x.status !== 'ok'; }).map(function (x) { return { line: x.line, name: x.name, className: x.className, ok: false, skipped: x.status === 'duplicate', message: x.message }; }));
    I.busy = false; I.step = 'done'; await refreshStudents(); render();
  }
  function printSlips() {
    var w = global.open('', '_blank'); if (!w) { K.toast('Please allow pop-ups to print.'); return; }
    w.document.write(global.StudentImport.slipsHtml(S.imp.results, S.school, global.location.origin + '/login.html')); w.document.close();
  }

  // ── tab: numbering ──
  function numberingPanel() {
    if (!S.num) return P.card('Numbering', null, P.empty('Could not load the numbering settings.'));
    var canEdit = S.role === 'superadmin', st = S.num.settings, nf = { mode: st.mode, prefix: st.prefix, pattern: st.pattern, seqPad: st.seqPad, startAt: st.startAt };
    var AN = global.AdmissionNumbers, cal = S.num.calendar, top = S.num.highestUsed || 0, sample = classNames()[0] || 'JSS 1A';
    var presetIds = AN.PRESETS.map(function (p) { return p.pattern; });
    var modeAuto = h('input', { type: 'radio', name: 'nmode', value: 'auto', 'class': 'am-check' }), modeMan = h('input', { type: 'radio', name: 'nmode', value: 'manual', 'class': 'am-check' });
    (nf.mode === 'auto' ? modeAuto : modeMan).checked = true;
    var prefix = K.input({ value: nf.prefix, maxlength: 12 }), start = K.input({ type: 'number', min: '1', value: nf.startAt });
    var preset = K.select(AN.PRESETS.map(function (p) { return { value: p.pattern, label: p.label }; }).concat([{ value: '__custom', label: 'Custom pattern' }]), presetIds.indexOf(nf.pattern) > -1 ? nf.pattern : '__custom');
    var custom = K.input({ value: nf.pattern, maxlength: 60 }), pad = K.select([3, 4, 5, 6].map(function (n) { return { value: String(n), label: n + ' digits' }; }), String(nf.seqPad));
    var preview = h('div', { 'class': 'ui-fee-note', style: 'margin:0', 'aria-live': 'polite' }), err = h('div', { 'class': 'am-err', role: 'alert' });
    var autoBox = h('div', { style: 'display:grid;gap:12px' }, h('div', { 'class': 'am-grid2' }, K.field('School code', prefix, 'Letters or numbers, up to 12.'), K.field('Digits in the running number', pad)),
      K.field('Number format', preset), h('div', { id: 'nf-custom' }, K.field('Custom pattern', custom, 'Parts: {PREFIX} {YEAR} {TERM} {CLASS} {SEQ}. {SEQ} is required.')),
      K.field('Running number starts at', start, 'Only matters when it is higher than the last number used. Use it if you already number students outside this system.'));
    function read() { nf.mode = modeAuto.checked ? 'auto' : 'manual'; nf.prefix = prefix.value.trim(); nf.pattern = preset.value === '__custom' ? custom.value.trim() : preset.value; nf.seqPad = Number(pad.value); nf.startAt = Math.max(1, parseInt(start.value, 10) || 1); }
    function redraw() {
      read(); autoBox.style.display = nf.mode === 'auto' ? 'grid' : 'none'; $('nf-custom').style.display = preset.value === '__custom' ? 'block' : 'none';
      var bad = nf.mode === 'auto' ? AN.validatePattern(nf.pattern) : ''; err.textContent = bad;
      if (nf.mode === 'manual') { preview.textContent = 'Manual numbering: whoever adds a student, approves an application or imports a file types the admission number themselves.'; return; }
      if (bad || !/^[A-Za-z0-9]{1,12}$/.test(nf.prefix)) { preview.textContent = bad || 'The school code must be 1 to 12 letters or numbers.'; return; }
      var seq = Math.max(nf.startAt, top + 1), f = function (y, t, q) { return AN.format(nf, { year: y, term: t, className: sample, seq: q }); };
      clear(preview).appendChild(h('div', null, h('strong', null, 'Next student: '), h('code', null, f(cal.year, cal.term, seq)), h('div', { 'class': 'am-muted' }, 'After that: ', f(cal.year, cal.term, seq + 1), ' \u00B7 In ' + (cal.year + 2) + ': ', f(cal.year + 2, 'First', seq + 2), '. The year changes, the running number keeps going.')));
    }
    [modeAuto, modeMan, prefix, preset, custom, pad, start].forEach(function (el) { el.addEventListener(el === prefix || el === custom || el === start ? 'input' : 'change', redraw); });
    var save = btn('Save numbering', 'gold', async function () {
      read(); if (nf.mode === 'auto' && AN.validatePattern(nf.pattern)) { err.textContent = AN.validatePattern(nf.pattern); return; }
      save.disabled = true; var r = await A.saveNumbering(nf); save.disabled = false;
      if (!r.ok) { err.textContent = K.apiMessage(r, 'Could not save.'); return; }
      K.toast(r.data.message); var n = await A.numbering(); if (n.ok) S.num = n.data; render();
    });
    if (!canEdit) { [modeAuto, modeMan, prefix, preset, custom, pad, start].forEach(function (el) { el.disabled = true; }); save.style.display = 'none'; }
    var wrap = P.card('Admission numbering', null, h('div', { style: 'display:grid;gap:14px' },
      h('p', { 'class': 'ui-hint', style: 'margin:0' }, 'Rules: the running number never restarts, the year follows the calendar year of admission, and the class and term are the ones the student is admitted into (they stay on the number after promotion).'),
      h('label', { style: 'display:flex;gap:10px;align-items:flex-start' }, modeAuto, h('span', null, h('strong', null, 'Automatic'), h('div', { 'class': 'am-muted' }, 'The system gives each new student the next number.'))),
      h('label', { style: 'display:flex;gap:10px;align-items:flex-start' }, modeMan, h('span', null, h('strong', null, 'Manual'), h('div', { 'class': 'am-muted' }, 'You type the admission number yourself (for example numbers the school already uses).'))),
      autoBox, preview, err, canEdit ? save : h('p', { 'class': 'am-muted', style: 'margin:0' }, 'Only a superadmin can change the numbering.'),
      h('p', { 'class': 'am-muted', style: 'margin:0' }, 'The admission number is also the student\u2019s login name and cannot be edited later. Changes here apply to students added from now on.')));
    setTimeout(redraw, 0);
    return wrap;
  }

  // ── tab 3: promote ──
  var promoteSel = { from: '', to: '', ids: {} };
  function promotePanel() {
    var names = classNames();
    if (!names.length) return P.card('Promote', null, P.empty('Create classes first.'));
    if (!promoteSel.from) promoteSel.from = names[0];
    var from = K.select(names, promoteSel.from), to = K.select([{ value: '', label: 'Choose the new class' }].concat(names.map(function (n) { return { value: n, label: n }; })), promoteSel.to);
    from.addEventListener('change', function () { promoteSel.from = from.value; promoteSel.ids = {}; render(); });
    to.addEventListener('change', function () { promoteSel.to = to.value; drawPromoteBtn(); });
    var roster = S.students.filter(function (s) { return s.className === promoteSel.from; });
    var all = h('input', { type: 'checkbox', 'class': 'am-check', 'aria-label': 'Select all' });
    all.addEventListener('change', function () { roster.forEach(function (s) { promoteSel.ids[s.id] = all.checked; }); document.querySelectorAll('.sm-pick').forEach(function (c) { c.checked = all.checked; }); drawPromoteBtn(); });
    var body = h('tbody');
    roster.forEach(function (s) {
      var c = h('input', { type: 'checkbox', 'class': 'am-check sm-pick', 'aria-label': 'Select ' + s.name }); c.checked = !!promoteSel.ids[s.id];
      c.addEventListener('change', function () { promoteSel.ids[s.id] = c.checked; drawPromoteBtn(); });
      body.appendChild(h('tr', null, h('td', null, c), h('td', null, h('strong', null, s.name), h('div', { 'class': 'am-muted' }, s.admissionNumber)), h('td', null, feeBadge(s.feeStatus))));
    });
    setTimeout(drawPromoteBtn, 0);
    return P.card('Promote a class', null, h('div', null,
      h('div', { 'class': 'am-toolbar' }, K.field('From class', from), K.field('Move to', to)),
      roster.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', { style: 'width:44px' }, all), h('th', null, 'Student'), h('th', null, 'Fees'))), body)) : P.empty('No students in ' + promoteSel.from + '.'),
      h('div', { id: 'sm-promote-act', style: 'margin-top:12px' }), h('p', { 'class': 'am-muted' }, 'To move just one student during the term, open the student and use Transfer.')));
  }
  function drawPromoteBtn() {
    var box = $('sm-promote-act'); if (!box) return;
    var ids = Object.keys(promoteSel.ids).filter(function (k) { return promoteSel.ids[k]; }), ok = ids.length && promoteSel.to && promoteSel.to !== promoteSel.from;
    var b = btn(ids.length ? 'Move ' + ids.length + ' student' + (ids.length === 1 ? '' : 's') + (promoteSel.to ? ' to ' + promoteSel.to : '') : 'Select students to move', 'gold', function () {
      K.confirmBox('Promote students', 'Move ' + ids.length + ' student' + (ids.length === 1 ? '' : 's') + ' from ' + promoteSel.from + ' to ' + promoteSel.to + '?', 'Move students', async function () {
        var r = await A.promote(ids, promoteSel.to); if (!r.ok) return K.apiMessage(r, 'Could not move the students.');
        K.toast(r.data.message); promoteSel.ids = {}; await refreshStudents(); render();
      }, 'gold');
    });
    if (!ok) b.disabled = true; clear(box).appendChild(b);
  }

  async function boot() {
    root = $('students-body');
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.appendChild(icon(el.getAttribute('data-icon'))); });
    var session = await global.requireLogin(); if (!session) return;
    var r = await A.me();
    if (!r.ok) { if (r.status === 401) return; if (r.status === 403) { global.location.href = 'login.html'; return; } clear(root).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); })); return; }
    S.role = r.data.user.role; $('a-name').textContent = r.data.user.name; $('a-avatar').textContent = T.initials(r.data.user.name); $('a-role').textContent = P.cap(r.data.user.role);
    try { var ss = await global.getSiteSettings(); if (ss && ss.ok && ss.data.settings && ss.data.settings.school_name) S.school = ss.data.settings.school_name; } catch (e) { /* default */ }
    await loadAll();
  }
  global.addEventListener('load', boot);
})(window);
