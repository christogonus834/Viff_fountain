// ══════════════════════════════════════════════════════════════
//  VIFF — teacher-dashboard.js
//  The whole teacher portal. Every value is inserted with textContent
//  through TFIS.h(); nothing here uses innerHTML. All data comes from
//  the backend through TeacherAPI — no direct database calls.
//
//  Checks in this file (score ranges, "fill both boxes", date limits)
//  are there to help the teacher, not to protect anything: the server
//  re-checks every one of them, plus who may touch which class and
//  subject, and whether a result is already published.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear;

  var S = {
    user: null, term: '', session: '',
    mustChange: false, overviewShown: false, current: 'overview',
    testId: null, busy: false,
  };

  var TITLES = {
    overview: 'Dashboard', scores: 'Enter Scores', attendance: 'Attendance', tests: 'CBT Tests', classes: 'My Classes',
    timetable: 'Timetable', notifications: 'Notifications', events: 'Events', payslips: 'Payslips', profile: 'My Profile', password: 'Change Password',
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function apiMessage(r, fallback) { return r && r.data && r.data.message ? r.data.message : fallback; }

  function toast(message) {
    var el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 4500);
  }

  // ── navigation ───────────────────────────────────────────────
  function navBtn(id) { return document.querySelector('.nav-item[data-page="' + id + '"]'); }
  function goTo(id) { global.showPage(id, navBtn(id)); }

  global.showPage = function (id, btn) {
    if (S.mustChange && id !== 'password') { toast('Please change your temporary password first.'); id = 'password'; btn = navBtn('password'); }
    S.current = id;
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
    var page = $('page-' + id); if (page) page.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    setText('page-title', TITLES[id] || id);
    global.closeSidebar();
    load(id);
  };
  global.openSidebar = function () { $('sidebar').classList.add('open'); $('sidebar-backdrop').classList.add('show'); };
  global.closeSidebar = function () { $('sidebar').classList.remove('open'); $('sidebar-backdrop').classList.remove('show'); };

  function load(id) {
    if (id === 'overview') { if (S.overviewShown) loadOverview(); }
    else if (id === 'scores') loadScores();
    else if (id === 'attendance') loadAttendance();
    else if (id === 'tests') loadTests();
    else if (id === 'classes') loadClasses();
    else if (id === 'timetable') loadTimetable();
    else if (id === 'notifications') loadNotifications();
    else if (id === 'events') loadEvents();
    else if (id === 'payslips') loadPayslips();
    else if (id === 'profile') renderProfile();
    else if (id === 'password') renderPassword();
  }

  // ── shared bits ──────────────────────────────────────────────
  function pageHead(title, subtitle, right) {
    return h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, title), subtitle ? h('p', null, subtitle) : null), right || null);
  }
  function showError(box, r, retry) {
    var msg = r.status === 403 ? apiMessage(r, 'You do not have access to this.') : r.status === 404 ? 'That could not be found.' : 'We could not load this page. Please try again.';
    clear(box).appendChild(P.errorBlock(msg, r.status === 403 ? null : retry));
  }
  function noAssignments(box, what) {
    clear(box).appendChild(h('div', { 'class': 'ui-card' }, h('div', { 'class': 'ui-card-body' },
      P.empty('No classes are assigned to you yet, so there is nothing to ' + what + '. Please ask the administrator to assign your classes and subjects.'))));
  }
  function applyUnread(count) {
    var badge = $('notif-badge'), bell = $('topbar-bell-count');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? '' : 'none'; }
    if (bell) { bell.textContent = count > 9 ? '9+' : count; bell.style.display = count > 0 ? '' : 'none'; }
  }
  function firstName(n) { return (n || '').trim().split(/\s+/)[0] || 'there'; }
  function hasAssignments() { return S.user && S.user.assignments.length > 0; }
  function uniqueClasses() { var seen = {}; return S.user.assignments.map(function (a) { return a.className; }).filter(function (c) { if (seen[c]) return false; seen[c] = 1; return true; }); }
  function previousSession(s) { var a = Number(String(s).split('/')[0]); return (a - 1) + '/' + a; }
  function gradeOf(total) { return total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : 'F'; }
  function lagosToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function shiftDate(iso, days) { var p = iso.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days)); return d.toISOString().slice(0, 10); }

  function field(label, id, props, tag) {
    return h('div', { 'class': 'form-group' }, h('label', { 'class': 'form-label', 'for': id }, label), h(tag || 'input', Object.assign({ 'class': 'form-control', id: id }, props)));
  }
  function select(id, label, options, value, onChange) {
    var sel = h('select', { 'class': 'form-control ui-toolsel', id: id, 'aria-label': label }, options.map(function (o) { return h('option', { value: o.value }, o.label); }));
    if (value !== undefined) sel.value = value;
    if (onChange) sel.addEventListener('change', onChange);
    return sel;
  }
  function tool(label, control) { return h('div', { 'class': 'ui-tool' }, h('label', { 'for': control.id }, label), control); }

  // ── OVERVIEW ─────────────────────────────────────────────────
  async function loadOverview() {
    var box = $('overview-body'); clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.dashboard();
    if (!r.ok) return showError(box, r, loadOverview);
    try {
      S.term = r.data.term.term; S.session = r.data.term.session;
      applyUnread(r.data.kpis.unreadNotifications);
      var chip = $('topbar-term'); if (chip) { chip.textContent = S.term + ' Term \u00B7 ' + S.session; chip.style.display = ''; }
      clear(box).appendChild(renderOverview(r.data));
    } catch (e) { clear(box).appendChild(P.errorBlock('Something went wrong showing this page. Please try again.', loadOverview)); }
  }

  function renderOverview(d) {
    var k = d.kpis;
    var head = pageHead(T.greeting() + ', ' + firstName(d.profile.user.name), S.term + ' Term, ' + S.session + ' \u00B7 ' + d.today.weekday);
    var kpis = h('div', { 'class': 'ui-kpis' },
      P.kpi('blue', 'cap', 'My classes', String(k.classes), k.assignments + (k.assignments === 1 ? ' subject' : ' subjects'), null, function () { goTo('classes'); }),
      P.kpi('purple', 'user', 'Students', String(k.students), 'across my classes', null, function () { goTo('classes'); }),
      P.kpi(k.attendanceExpected && k.attendanceMarked < k.attendanceExpected ? 'amber' : 'green', 'calendar', 'Attendance today',
        k.attendanceMarked + ' of ' + k.attendanceExpected, k.attendanceExpected && k.attendanceMarked < k.attendanceExpected ? 'Still to mark' : 'All marked', null, function () { goTo('attendance'); }),
      P.kpi('amber', 'test', 'CBT tests', String(k.testsPublished), k.testsDraft + (k.testsDraft === 1 ? ' draft' : ' drafts'), null, function () { goTo('tests'); }));

    var rows = d.classes.map(function (c) {
      var pct = c.studentCount ? Math.round((c.scoresEntered / c.studentCount) * 100) : 0;
      var bar = h('div', { 'class': 'ui-bar' }, h('span')); bar.firstChild.style.width = pct + '%';
      return h('tr', null,
        h('td', null, h('strong', null, c.className)), h('td', null, c.subject), h('td', { 'class': 'num' }, String(c.studentCount)),
        h('td', null, c.scoresEntered + ' / ' + c.studentCount, c.scoresPublished ? ' ' : null, c.scoresPublished ? P.badge('Published', 'green') : null, bar),
        h('td', null, P.badge(c.attendanceMarkedToday ? 'Marked' : 'Not yet', c.attendanceMarkedToday ? 'green' : 'amber')));
    });
    var classesCard = P.card('My classes and subjects \u2014 ' + S.term + ' term', P.link('Enter scores', function () { goTo('scores'); }),
      rows.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, 'Class'), h('th', null, 'Subject'), h('th', { 'class': 'num' }, 'Students'), h('th', null, 'Scores entered'), h('th', null, 'Attendance today'))),
        h('tbody', null, rows)))
        : P.empty('No classes are assigned to you yet. Please ask the administrator to assign your classes and subjects.'), 'flush');

    var lessons = P.card('Today\u2019s lessons \u2014 ' + d.today.weekday, P.link('Full timetable', function () { goTo('timetable'); }),
      d.todayLessons.length ? h('ul', { 'class': 'ui-tt' }, d.todayLessons.map(function (l) { return h('li', null, h('span', { 'class': 'time' }, l.period || '\u2014'), h('span', null, l.subject), h('span', { 'class': 'who' }, l.className)); }))
        : P.empty(d.today.weekday === 'Saturday' || d.today.weekday === 'Sunday' ? 'No lessons on ' + d.today.weekday + '.' : 'None of your lessons are on the timetable today.'));

    var tests = P.card('My tests', P.link('Manage', function () { goTo('tests'); }), d.tests.length
      ? h('ul', { 'class': 'ui-list' }, d.tests.map(function (t) {
        return h('li', null, h('div', { 'class': 'ui-li-ico tone-purple' }, icon('test')),
          h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, t.title), h('div', { 'class': 'ui-li-meta' }, t.className + ' \u00B7 ' + t.subject + ' \u00B7 ' + t.questionCount + ' questions')),
          h('div', { 'class': 'ui-li-end' }, P.badge(t.isPublished ? 'Published' : 'Draft', t.isPublished ? 'green' : 'gray'), t.attemptCount ? h('div', { 'class': 'ui-li-meta' }, t.attemptCount + ' taken') : null));
      }))
      : P.empty('No tests yet.'));

    var quick = P.card('Quick actions', null, h('div', { 'class': 'ui-quick' },
      [['scores', 'results', 'Enter scores'], ['attendance', 'calendar', 'Attendance'], ['tests', 'test', 'New test'], ['classes', 'user', 'My students'], ['timetable', 'clock', 'Timetable'], ['payslips', 'wallet', 'Payslips']].map(function (q) {
        return h('button', { type: 'button', onclick: function () { goTo(q[0]); } }, icon(q[1]), q[2]);
      })));

    return h('div', null, d.profile.user.isDemo ? T.demoNotice() : null, head, kpis,
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' }, classesCard, h('div', { 'class': 'ui-pair' }, lessons, tests)),
        h('div', { 'class': 'ui-stack' },
          P.card('Announcements', P.link('View all', function () { goTo('notifications'); }), P.noticeList(d.notifications)),
          P.card('Upcoming events', P.link('All events', function () { goTo('events'); }), P.eventList(d.events)), quick)));
  }

  // ── ENTER SCORES ─────────────────────────────────────────────
  var scoreState = { pick: 0, term: '', session: '' };

  async function loadScores() {
    var box = $('scores-body');
    if (!hasAssignments()) return noAssignments(box, 'enter scores for');
    clear(box).appendChild(P.skeleton());
    if (!S.term) { var cr = await global.TeacherAPI.classes(); if (!cr.ok) return showError(box, cr, loadScores); S.term = cr.data.term; S.session = cr.data.session; }
    if (!scoreState.term) { scoreState.term = S.term; scoreState.session = S.session; }
    drawScoreShell(box);
    await loadSheet();
  }

  function drawScoreShell(box) {
    var a = S.user.assignments;
    var sPick = select('sc-pick', 'Class and subject', a.map(function (x, i) { return { value: String(i), label: x.className + ' \u2014 ' + x.subject }; }), String(scoreState.pick), function () { scoreState.pick = Number($('sc-pick').value); loadSheet(); });
    var sTerm = select('sc-term', 'Term', ['First', 'Second', 'Third'].map(function (t) { return { value: t, label: t + ' term' }; }), scoreState.term, function () { scoreState.term = $('sc-term').value; loadSheet(); });
    var sSess = select('sc-session', 'Session', [S.session, previousSession(S.session)].map(function (s) { return { value: s, label: s }; }), scoreState.session, function () { scoreState.session = $('sc-session').value; loadSheet(); });
    clear(box).appendChild(h('div', null, pageHead('Enter Scores', 'Scores are saved as a draft until the school publishes the results.'),
      h('div', { 'class': 'ui-toolrow' }, tool('Class & subject', sPick), tool('Term', sTerm), tool('Session', sSess)),
      h('div', { id: 'sc-sheet' })));
  }

  var rows = [];
  async function loadSheet() {
    var wrap = $('sc-sheet'); if (!wrap) return;
    clear(wrap).appendChild(P.skeleton());
    var a = S.user.assignments[scoreState.pick];
    var r = await global.TeacherAPI.scoreSheet(a.className, a.subject, scoreState.term, scoreState.session);
    if (!r.ok) return showError(wrap, r, loadSheet);
    rows = [];
    var body = h('tbody');
    r.data.students.forEach(function (s, i) {
      var caIn = h('input', { type: 'number', 'class': 'form-control ui-score', min: '0', max: '40', step: '0.5', inputmode: 'decimal', 'aria-label': 'C.A for ' + s.name, value: s.ca === null ? '' : String(s.ca) });
      var exIn = h('input', { type: 'number', 'class': 'form-control ui-score', min: '0', max: '60', step: '0.5', inputmode: 'decimal', 'aria-label': 'Exam for ' + s.name, value: s.exam === null ? '' : String(s.exam) });
      if (s.locked) { caIn.disabled = true; exIn.disabled = true; }
      var total = h('td', { 'class': 'num' }, '\u2014'), grade = h('td', null, '\u2014');
      function refresh() {
        var c = caIn.value.trim(), e = exIn.value.trim();
        if (c === '' || e === '') { total.textContent = '\u2014'; clear(grade).appendChild(document.createTextNode('\u2014')); return; }
        var t = Number(c) + Number(e); total.textContent = T.fmtNumber(t, 1); clear(grade).appendChild(P.badge(gradeOf(t), T.gradeTone(gradeOf(t))));
      }
      caIn.addEventListener('input', refresh); exIn.addEventListener('input', refresh); refresh();
      rows.push({ studentId: s.studentId, name: s.name, ca: caIn, exam: exIn, locked: s.locked });
      body.appendChild(h('tr', null, h('td', null, String(i + 1)), h('td', null, h('strong', null, s.name), h('div', { 'class': 'ui-li-meta' }, s.admissionNumber)),
        h('td', null, caIn), h('td', null, exIn), total, grade, h('td', null, s.locked ? P.badge('Published', 'green') : '')));
    });
    clear(wrap);
    if (!r.data.students.length) { wrap.appendChild(P.card('Class list', null, P.empty('There are no approved students in ' + a.className + ' yet.'))); return; }
    var anyLocked = r.data.students.some(function (s) { return s.locked; });
    wrap.appendChild(P.card(a.className + ' \u2014 ' + a.subject, null, h('div', null,
      importBar(r.data.students), h('div', { id: 'sc-import' }),
      anyLocked ? h('div', { 'class': 'ui-fee-note' }, 'Rows marked \u201CPublished\u201D are final. Ask the administrator if a published score needs correcting.') : null,
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table ui-scores' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Student'), h('th', null, 'C.A (0\u201340)'), h('th', null, 'Exam (0\u201360)'), h('th', { 'class': 'num' }, 'Total'), h('th', null, 'Grade'), h('th', null, ''))), body)),
      h('div', { 'class': 'ui-actions ui-actions-end' }, h('span', { 'class': 'ui-hint', id: 'sc-hint' }, 'Leave a row empty to skip it. Enter 0 if a student scored nothing.'),
        h('button', { type: 'button', 'class': 'btn btn-gold', id: 'sc-save', onclick: saveScores }, 'Save scores'))), 'flush'));
  }


  // ── EXCEL / CSV UPLOAD (preview first, then the teacher presses Save as usual) ─────────
  var sheetStudents = [];
  function importBar(students) {
    sheetStudents = students;
    var file = h('input', { type: 'file', id: 'sc-file', accept: '.csv,.xlsx,.txt,text/csv', style: 'display:none' });
    file.style.display = 'none';
    file.addEventListener('change', function () { if (file.files && file.files[0]) onScoreFile(file.files[0]); file.value = ''; });
    var photo = h('input', { type: 'file', id: 'sc-photo', accept: 'image/*', style: 'display:none' });
    photo.setAttribute('capture', 'environment'); photo.style.display = 'none';
    photo.addEventListener('change', function () { if (photo.files && photo.files[0]) onPhotoFile(photo.files[0]); photo.value = ''; });
    return h('div', { 'class': 'ui-actions', style: 'margin-bottom:12px;flex-wrap:wrap;gap:8px;align-items:center' },
      h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: downloadTemplate }, '\u2193 Excel template'),
      h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: function () { file.click(); } }, '\u2191 Upload Excel / CSV'),
      h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: printSheet }, '\u2399 Print scoresheet'),
      h('button', { type: 'button', 'class': 'btn btn-gold btn-sm', id: 'sc-snap', onclick: function () { photo.click(); } }, '\uD83D\uDCF7 Snap / upload photo'),
      file, photo, aiBtnHolder(),
      h('span', { 'class': 'ui-hint' }, 'Fill the Excel template, or print the sheet, write the scores in the boxes and photograph it. You check everything before it is saved.'));
  }
  // ── OPTIONAL "Read with AI" (hidden unless a superadmin switched it on AND the server has a key; any failure = no button) ──
  function aiBtnHolder() {
    var holder = h('span', { id: 'sc-ai-holder' });
    try {
      var p = global.TeacherAPI.aiStatus();
      Promise.resolve(p).then(function (r) {
        if (!r || !r.ok || !r.data || r.data.available !== true) return;
        var inp = h('input', { type: 'file', id: 'sc-ai-photo', accept: 'image/jpeg,image/png', style: 'display:none' });
        inp.style.display = 'none'; inp.setAttribute('capture', 'environment');
        inp.addEventListener('change', function () { if (inp.files && inp.files[0]) onAiFile(inp.files[0]); inp.value = ''; });
        holder.appendChild(inp);
        holder.appendChild(h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', id: 'sc-ai', title: 'The photo and this class list are sent to the AI service to be read.', onclick: function () { inp.click(); } }, '\u2728 Read with AI'));
      }).catch(function () { /* no button */ });
    } catch (e) { /* no button */ }
    return holder;
  }
  // Keep the photo in colour (the AI reads it better than the black-and-white copy), upright and not too big.
  async function shrinkForAi(file) {
    var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    var s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not prepare the photo.')); }, 'image/jpeg', 0.85); });
  }
  async function onAiFile(file) {
    var panel = $('sc-import'); if (!panel) return;
    if (file.size > 25 * 1024 * 1024) { toast('That photo is too large. Take it again at a normal quality.'); return; }
    var a = S.user.assignments[scoreState.pick], blob;
    toast('Reading with AI\u2026 this can take up to a minute.');
    try { blob = await shrinkForAi(file); } catch (e) { toast(e && e.message ? e.message : 'Could not prepare the photo.'); return; }
    var r = await global.TeacherAPI.aiPreview({ className: a.className, subject: a.subject, term: scoreState.term, session: scoreState.session }, blob);
    if (!r.ok) { toast(apiMessage(r, 'The AI could not read this photo. Try the normal photo reader.')); return; }
    showImportReview(panel, r.data, 'photo', { photoUrl: URL.createObjectURL(blob) });
  }
  function escHtml(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  async function printSheet() {
    var a = S.user.assignments[scoreState.pick], w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to print the scoresheet.'); return; }
    var school = 'School';
    try { var ss = await global.getSiteSettings(); if (ss && ss.ok && ss.data.settings && ss.data.settings.school_name) school = ss.data.settings.school_name; } catch (e) { /* use the default */ }
    var trs = sheetStudents.map(function (st, i) { return '<tr><td>' + (i + 1) + '</td><td>' + escHtml(st.admissionNumber || '') + '</td><td>' + escHtml(st.name) + '</td><td class="b"></td><td class="b"></td></tr>'; }).join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Scoresheet</title><style>' +
      '@page{size:A4;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#000}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0;font-size:13px}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px}thead{display:table-header-group}tr{page-break-inside:avoid}' +
      'th,td{border:1.5px solid #000;padding:0 8px;height:11mm;font-size:15px;text-align:left}th{font-size:14px;background:#f2f2f2}td.b{width:24%}' +
      '.n{margin-top:10px;font-size:12px}</style></head><body><h1>SCORESHEET \u2013 ' + escHtml(school) + '</h1>' +
      '<p><b>Class:</b> ' + escHtml(a.className) + ' &nbsp; <b>Subject:</b> ' + escHtml(a.subject) + ' &nbsp; <b>Term:</b> ' + escHtml(scoreState.term) + ' &nbsp; <b>Session:</b> ' + escHtml(scoreState.session) + '</p>' +
      '<table><thead><tr><th style="width:6%">No</th><th style="width:22%">Admission Number</th><th>Student Name</th><th>C.A (0-40)</th><th>Exam (0-60)</th></tr></thead><tbody>' + trs + '</tbody></table>' +
      '<p class="n">Write each number clearly inside its box with a dark pen. Photograph the whole page flat, in good light, then upload it.</p>' +
      '<script>setTimeout(function(){window.print()},400)<\/script></body></html>');
    w.document.close();
  }
  async function onPhotoFile(file) {
    var panel = $('sc-import'); if (!panel) return;
    if (file.size > 25 * 1024 * 1024) { toast('That photo is too large. Take it again at a normal quality.'); return; }
    clear(panel).appendChild(h('div', { 'class': 'ui-hint' }, 'Reading the photo\u2026 this can take up to a minute.'));
    var blob;
    try { blob = await global.ScorePhoto.prepare(file); }
    catch (e) { clear(panel); toast(e && e.message ? e.message : 'Could not prepare the photo.'); return; }
    var a = S.user.assignments[scoreState.pick];
    var r = await global.TeacherAPI.photoPreview({ className: a.className, subject: a.subject, term: scoreState.term, session: scoreState.session }, blob);
    if (!r.ok) { clear(panel); toast(apiMessage(r, 'The photo could not be read.')); return; }
    showImportReview(panel, r.data, 'photo', { photoUrl: URL.createObjectURL(blob) });   // the cleaned page the reader saw
  }
  function downloadTemplate() {
    var a = S.user.assignments[scoreState.pick];
    var blob = new Blob([global.ScoreUpload.templateCsv(sheetStudents)], { type: 'text/csv;charset=utf-8' });
    var name = ('VIFF_Scores_' + a.className + '_' + a.subject + '_' + scoreState.term).replace(/[^A-Za-z0-9_-]+/g, '_') + '.csv';
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
  }
  async function onScoreFile(file) {
    var panel = $('sc-import'); if (!panel) return;
    if (file.size > 2 * 1024 * 1024) { toast('That file is too large (maximum 2 MB).'); return; }
    clear(panel).appendChild(P.skeleton());
    var parsed;
    try { parsed = global.ScoreUpload.toRows(await global.ScoreUpload.readFile(file)); }
    catch (e) { clear(panel); toast(e && e.message ? e.message : 'Could not read that file.'); return; }
    if (parsed.error) { clear(panel); toast(parsed.error); return; }
    if (parsed.rows.length > 500) { clear(panel); toast('The file has too many rows (maximum 500).'); return; }
    var a = S.user.assignments[scoreState.pick];
    var r = await global.TeacherAPI.importPreview({
      className: a.className, subject: a.subject, term: scoreState.term, session: scoreState.session,
      rows: parsed.rows.map(function (o) { return { line: o.line, admissionNumber: o.admissionNumber == null ? null : String(o.admissionNumber), name: o.name == null ? null : String(o.name), ca: o.ca, exam: o.exam }; }),
    });
    if (!r.ok) { clear(panel); toast(apiMessage(r, 'Could not check the file.')); return; }
    showImportReview(panel, r.data, file.name);
  }
  var IMPORT_TONE = { ok: ['Ready', 'green'], unchanged: ['No change', 'gray'], error: ['Fix', 'red'], locked: ['Published', 'amber'], skipped: ['Empty', 'gray'] };
  function photoThumb(url) {                       // blob: URLs are set directly (the h() helper only allows http/https links)
    var img = h('img', { alt: 'The cleaned photo the system read', style: 'max-height:200px;max-width:100%;border:1px solid #ddd;border-radius:8px;margin:6px 0' });
    img.src = url;
    var link = h('a', { target: '_blank', rel: 'noopener' }, img); link.href = url;
    return link;
  }
  function showImportReview(panel, d, fileName, opts) {
    opts = opts || {};
    var c = d.counts, ready = d.rows.filter(function (x) { return x.status === 'ok'; });
    var body = h('tbody');
    d.rows.forEach(function (x) {
      var t = (x.status === 'ok' && x.check) ? ['Check', 'amber'] : (IMPORT_TONE[x.status] || ['', 'gray']);
      var was = x.existing && x.status === 'ok' ? h('div', { 'class': 'ui-li-meta' }, 'was ' + T.fmtNumber(x.existing.ca, 1) + ' / ' + T.fmtNumber(x.existing.exam, 1)) : null;
      body.appendChild(h('tr', null, h('td', null, String(x.line)),
        h('td', null, h('strong', null, x.name || '\u2014'), h('div', { 'class': 'ui-li-meta' }, x.admissionNumber || '')),
        h('td', { 'class': 'num' }, x.ca === null ? '\u2014' : T.fmtNumber(x.ca, 1)), h('td', { 'class': 'num' }, x.exam === null ? '\u2014' : T.fmtNumber(x.exam, 1)),
        h('td', null, P.badge(t[0], t[1]), x.message ? h('div', { 'class': 'ui-li-meta' }, x.message) : null, was)));
    });
    var summary = ready.length + ' ready \u00B7 ' + c.unchanged + ' unchanged \u00B7 ' + c.error + ' to fix \u00B7 ' + c.locked + ' published' + (d.missing.length ? ' \u00B7 ' + d.missing.length + ' student(s) not in the file' : '');
    var missingNote = d.missing.length ? h('div', { 'class': 'ui-fee-note' }, 'Not in the file: ' + d.missing.slice(0, 8).map(function (m) { return m.name; }).join(', ') + (d.missing.length > 8 ? ' and ' + (d.missing.length - 8) + ' more' : '') + '. They are left as they are.') : null;
    var applyBtn = h('button', { type: 'button', 'class': 'btn btn-gold btn-sm', id: 'sc-apply', onclick: function () { applyImport(panel, ready); } },
      ready.length ? 'Place ' + ready.length + ' score' + (ready.length === 1 ? '' : 's') + ' on the sheet' : 'Nothing to place');
    if (!ready.length) applyBtn.disabled = true;
    clear(panel).appendChild(h('div', { 'class': 'ui-fee-note', style: 'margin:0 0 12px;background:#fffaf0' },
      h('strong', null, opts.photoUrl ? 'Check what was read from your photo' : 'Check ' + fileName), h('div', { 'class': 'ui-hint', id: 'sc-import-summary' }, summary),
      opts.photoUrl ? h('div', { 'class': 'ui-hint', style: 'color:#92400e' }, 'Handwriting can be misread. Compare every row with your sheet before you save.') : null,
      opts.photoUrl ? photoThumb(opts.photoUrl) : null,
      c.error ? h('div', { 'class': 'ui-hint' }, 'Rows marked \u201CFix\u201D are skipped. Correct them in the file and upload again, or type them on the sheet.') : null,
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, 'Line'), h('th', null, 'Student'), h('th', { 'class': 'num' }, 'C.A'), h('th', { 'class': 'num' }, 'Exam'), h('th', null, 'Check'))), body)),
      missingNote,
      h('div', { 'class': 'ui-actions', style: 'margin-top:10px;gap:8px;flex-wrap:wrap' }, applyBtn,
        h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: function () { clear(panel); } }, 'Cancel'))));
  }
  function applyImport(panel, ready) {
    var byId = {}; rows.forEach(function (r) { byId[r.studentId] = r; });
    var n = 0;
    ready.forEach(function (x) {
      var r = byId[x.studentId]; if (!r || r.locked) return;
      r.ca.value = String(x.ca); r.exam.value = String(x.exam);
      [r.ca, r.exam].forEach(function (el) { el.style.background = '#fff7e0'; el.dispatchEvent(new Event('input')); });
      n++;
    });
    clear(panel);
    toast('Placed ' + n + ' score' + (n === 1 ? '' : 's') + ' on the sheet. Check them, then press \u201CSave scores\u201D.');
    var save = $('sc-save'); if (save && save.scrollIntoView) save.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function saveScores() {
    var out = [], problems = [];
    rows.forEach(function (r) {
      if (r.locked) return;
      var c = r.ca.value.trim(), e = r.exam.value.trim();
      if (c === '' && e === '') return;
      if (c === '' || e === '') { problems.push(r.name + ': enter both C.A and Exam (use 0 if the student scored nothing).'); return; }
      var ca = Number(c), ex = Number(e);
      if (!isFinite(ca) || ca < 0 || ca > 40) { problems.push(r.name + ': C.A must be between 0 and 40.'); return; }
      if (!isFinite(ex) || ex < 0 || ex > 60) { problems.push(r.name + ': Exam must be between 0 and 60.'); return; }
      out.push({ studentId: r.studentId, ca: ca, exam: ex });
    });
    if (problems.length) { toast(problems[0] + (problems.length > 1 ? ' (+' + (problems.length - 1) + ' more)' : '')); return; }
    if (!out.length) { toast('Enter at least one score first.'); return; }
    if (S.busy) return; S.busy = true; var btn = $('sc-save'); btn.disabled = true;
    var a = S.user.assignments[scoreState.pick];
    var r = await global.TeacherAPI.saveScores({ className: a.className, subject: a.subject, term: scoreState.term, session: scoreState.session, scores: out });
    S.busy = false; btn.disabled = false;
    if (!r.ok) { toast(apiMessage(r, 'Could not save the scores.')); return; }
    toast('Saved ' + r.data.saved + ' score' + (r.data.saved === 1 ? '' : 's') + (r.data.changed !== r.data.saved ? ' (' + r.data.changed + ' changed)' : '') + '.');
    loadSheet();
  }

  // ── ATTENDANCE ───────────────────────────────────────────────
  var attState = { className: '', date: '' };
  var STATUSES = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']];

  async function loadAttendance() {
    var box = $('attendance-body');
    if (!hasAssignments()) return noAssignments(box, 'take attendance for');
    var today = lagosToday();
    if (!attState.className) attState.className = uniqueClasses()[0];
    if (!attState.date) attState.date = today;
    var sCls = select('at-class', 'Class', uniqueClasses().map(function (c) { return { value: c, label: c }; }), attState.className, function () { attState.className = $('at-class').value; loadRegister(); });
    var dIn = h('input', { type: 'date', 'class': 'form-control ui-toolsel', id: 'at-date', min: shiftDate(today, -14), max: today, value: attState.date });
    dIn.addEventListener('change', function () { if (dIn.value) { attState.date = dIn.value; loadRegister(); } });
    clear(box).appendChild(h('div', null, pageHead('Attendance', 'You can take today\u2019s register or correct the last 14 days.'),
      h('div', { 'class': 'ui-toolrow' }, tool('Class', sCls), tool('Date', dIn)), h('div', { id: 'at-sheet' })));
    await loadRegister();
  }

  var attRows = [];
  async function loadRegister() {
    var wrap = $('at-sheet'); if (!wrap) return;
    clear(wrap).appendChild(P.skeleton());
    var r = await global.TeacherAPI.register(attState.className, attState.date);
    if (!r.ok) return showError(wrap, r, loadRegister);
    attRows = [];
    var body = h('tbody');
    r.data.students.forEach(function (s, i) {
      var sel = h('select', { 'class': 'form-control ui-status', 'aria-label': 'Status for ' + s.name }, STATUSES.map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      sel.value = s.status || 'present';
      var note = h('input', { type: 'text', 'class': 'form-control', maxlength: '300', placeholder: 'Optional note', 'aria-label': 'Note for ' + s.name, value: s.note || '' });
      attRows.push({ studentId: s.studentId, status: sel, note: note });
      body.appendChild(h('tr', null, h('td', null, String(i + 1)), h('td', null, h('strong', null, s.name), h('div', { 'class': 'ui-li-meta' }, s.admissionNumber)), h('td', null, sel), h('td', null, note),
        h('td', null, s.status ? P.badge('Saved', 'green') : P.badge('Not yet', 'gray'))));
    });
    clear(wrap);
    if (!r.data.students.length) { wrap.appendChild(P.card('Register', null, P.empty('There are no approved students in ' + attState.className + ' yet.'))); return; }
    var allBtn = h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: function () { attRows.forEach(function (x) { x.status.value = 'present'; }); } }, 'Mark everyone present');
    wrap.appendChild(P.card(attState.className + ' \u2014 ' + T.fmtDate(attState.date), allBtn, h('div', null,
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Student'), h('th', null, 'Status'), h('th', null, 'Note'), h('th', null, ''))), body)),
      h('div', { 'class': 'ui-actions ui-actions-end' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'at-save', onclick: saveRegister }, 'Save attendance'))), 'flush'));
  }

  async function saveRegister() {
    if (S.busy) return; S.busy = true; var btn = $('at-save'); btn.disabled = true;
    var r = await global.TeacherAPI.saveRegister({
      className: attState.className, date: attState.date,
      entries: attRows.map(function (x) { return { studentId: x.studentId, status: x.status.value, note: x.note.value.trim() }; }),
    });
    S.busy = false; btn.disabled = false;
    if (!r.ok) { toast(apiMessage(r, 'Could not save attendance.')); return; }
    toast('Attendance saved for ' + r.data.saved + ' student' + (r.data.saved === 1 ? '' : 's') + '.');
    loadRegister();
  }

  // ── CBT TESTS ────────────────────────────────────────────────
  async function loadTests() {
    if (S.testId) return openTest(S.testId);
    var box = $('tests-body'); if (!hasAssignments()) return noAssignments(box, 'create tests for');
    clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.tests();
    if (!r.ok) return showError(box, r, loadTests);
    var list = r.data.tests;

    var a = S.user.assignments;
    var pick = select('nt-pick', 'Class and subject', a.map(function (x, i) { return { value: String(i), label: x.className + ' \u2014 ' + x.subject }; }));
    var form = h('div', { 'class': 'ui-form-row' },
      h('div', { 'class': 'ui-tool ui-grow' }, h('label', { 'for': 'nt-title' }, 'Test title'), h('input', { 'class': 'form-control', id: 'nt-title', type: 'text', maxlength: '150', placeholder: 'e.g. Mid-term test' })),
      tool('Class & subject', pick),
      h('div', { 'class': 'ui-tool' }, h('label', { 'for': 'nt-dur' }, 'Minutes'), h('input', { 'class': 'form-control ui-score', id: 'nt-dur', type: 'number', min: '1', max: '240', value: '30' })),
      h('button', { type: 'button', 'class': 'btn btn-gold', id: 'nt-create', onclick: createTest }, 'Create test'));

    var table = list.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', null, 'Class'), h('th', { 'class': 'num' }, 'Questions'), h('th', { 'class': 'num' }, 'Taken'), h('th', null, 'Status'), h('th', null, ''))),
      h('tbody', null, list.map(function (t) {
        return h('tr', null, h('td', null, h('strong', null, t.title), h('div', { 'class': 'ui-li-meta' }, t.subject + ' \u00B7 ' + t.durationMinutes + ' min')), h('td', null, t.className),
          h('td', { 'class': 'num' }, String(t.questionCount)), h('td', { 'class': 'num' }, String(t.attemptCount)), h('td', null, P.badge(t.isPublished ? 'Published' : 'Draft', t.isPublished ? 'green' : 'gray')),
          h('td', null, h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: function () { openTest(t.id); } }, 'Manage')));
      })))) : P.empty('No tests yet \u2014 create one above.');

    clear(box).appendChild(h('div', null, pageHead('CBT Tests', 'Computer-based tests your students take on their own dashboard.'),
      P.card('New test', null, form), h('div', { 'class': 'ui-gap' }), P.card('My tests', null, table, 'flush')));
  }

  async function createTest() {
    var title = $('nt-title').value.trim(), a = S.user.assignments[Number($('nt-pick').value)], dur = Number($('nt-dur').value);
    if (!title) { toast('Give the test a title.'); return; }
    if (!isFinite(dur) || dur < 1 || dur > 240) { toast('Duration must be between 1 and 240 minutes.'); return; }
    if (S.busy) return; S.busy = true; $('nt-create').disabled = true;
    var r = await global.TeacherAPI.createTest({ title: title, subject: a.subject, className: a.className, durationMinutes: Math.round(dur) });
    S.busy = false; var b = $('nt-create'); if (b) b.disabled = false;
    if (!r.ok) { toast(apiMessage(r, 'Could not create the test.')); return; }
    toast('Test created. Now add questions.'); openTest(r.data.test.id);
  }

  async function openTest(id) {
    S.testId = id;
    var box = $('tests-body'); clear(box).appendChild(P.skeleton());
    var results = await Promise.all([global.TeacherAPI.test(id), global.TeacherAPI.attempts(id)]);
    var r = results[0], ar = results[1];
    if (!r.ok) { S.testId = null; toast(apiMessage(r, 'That test could not be found.')); return loadTests(); }
    var t = r.data.test, qs = r.data.questions, locked = r.data.locked, attempts = ar.ok ? ar.data.attempts : [];

    function back() { S.testId = null; loadTests(); }
    async function togglePublish() {
      var res = await global.TeacherAPI.setPublished(id, !t.isPublished);
      if (!res.ok) { toast(apiMessage(res, 'Could not change the test.')); return; }
      toast(apiMessage(res, 'Updated.')); openTest(id);
    }
    async function removeTest() {
      if (!global.confirm('Delete this test and all its questions? This cannot be undone.')) return;
      var res = await global.TeacherAPI.deleteTest(id);
      if (!res.ok) { toast(apiMessage(res, 'Could not delete the test.')); return; }
      toast('Test deleted.'); back();
    }

    var LETTERS = ['a', 'b', 'c', 'd'];
    var qList = qs.length ? h('ol', { 'class': 'ui-qlist' }, qs.map(function (q) {
      return h('li', null,
        h('div', { 'class': 'ui-q-text' }, q.questionText, h('span', { 'class': 'ui-li-meta' }, ' \u00B7 ' + q.marks + (q.marks === 1 ? ' mark' : ' marks'))),
        h('ul', { 'class': 'ui-opts' }, LETTERS.map(function (L) {
          return h('li', { 'class': q.correctOption === L ? 'correct' : '' }, h('b', null, L.toUpperCase() + '.'), ' ' + q['option' + L.toUpperCase()], q.correctOption === L ? h('span', { 'class': 'ui-tick' }, ' \u2713 correct') : null);
        })),
        locked ? null : h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: async function () {
          var res = await global.TeacherAPI.deleteQuestion(id, q.id);
          if (!res.ok) { toast(apiMessage(res, 'Could not remove the question.')); return; }
          openTest(id);
        } }, 'Remove'));
    })) : P.empty('No questions yet.');

    var addForm = locked
      ? h('div', { 'class': 'ui-fee-note' }, 'This test is published or has already been taken, so its questions can no longer be changed.' + (t.attemptCount ? '' : ' Unpublish it to edit.'))
      : h('div', { 'class': 'ui-form' },
        field('Question', 'q-text', { rows: '3', maxlength: '1000' }, 'textarea'),
        field('Option A', 'q-a', { type: 'text', maxlength: '300' }), field('Option B', 'q-b', { type: 'text', maxlength: '300' }),
        field('Option C', 'q-c', { type: 'text', maxlength: '300' }), field('Option D', 'q-d', { type: 'text', maxlength: '300' }),
        h('div', { 'class': 'ui-form-row' },
          tool('Correct answer', select('q-correct', 'Correct answer', LETTERS.map(function (L) { return { value: L, label: L.toUpperCase() }; }), 'a')),
          h('div', { 'class': 'ui-tool' }, h('label', { 'for': 'q-marks' }, 'Marks'), h('input', { 'class': 'form-control ui-score', id: 'q-marks', type: 'number', min: '1', max: '100', value: '1' }))),
        h('div', { 'class': 'ui-actions' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'q-add', onclick: async function () {
          var body = { questionText: $('q-text').value.trim(), optionA: $('q-a').value.trim(), optionB: $('q-b').value.trim(), optionC: $('q-c').value.trim(), optionD: $('q-d').value.trim(), correctOption: $('q-correct').value, marks: Math.round(Number($('q-marks').value) || 1) };
          if (!body.questionText || !body.optionA || !body.optionB || !body.optionC || !body.optionD) { toast('Fill in the question and all four options.'); return; }
          $('q-add').disabled = true;
          var res = await global.TeacherAPI.addQuestion(id, body);
          if (!res.ok) { $('q-add').disabled = false; toast(apiMessage(res, 'Could not add the question.')); return; }
          toast('Question added.'); openTest(id);
        } }, 'Add question')));

    var attTable = attempts.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null, h('th', null, 'Student'), h('th', { 'class': 'num' }, 'Score'), h('th', null, 'Submitted'))),
      h('tbody', null, attempts.map(function (a) { return h('tr', null, h('td', null, h('strong', null, a.studentName), h('div', { 'class': 'ui-li-meta' }, a.admissionNumber)), h('td', { 'class': 'num' }, a.score + ' / ' + a.totalMarks), h('td', null, T.fmtDate(a.submittedAt))); }))))
      : P.empty('No student has taken this test yet.');

    clear(box).appendChild(h('div', null,
      pageHead(t.title, t.className + ' \u00B7 ' + t.subject + ' \u00B7 ' + t.durationMinutes + ' minutes \u00B7 ' + (t.isPublished ? 'Published' : 'Draft'),
        h('div', { 'class': 'ui-btnrow' },
          h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: back }, 'Back to tests'),
          h('button', { type: 'button', 'class': t.isPublished ? 'btn btn-outline btn-sm' : 'btn btn-gold btn-sm', onclick: togglePublish }, t.isPublished ? 'Unpublish' : 'Publish'),
          t.attemptCount ? null : h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', onclick: removeTest }, 'Delete'))),
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' }, P.card('Questions (' + qs.length + ')', null, qList), P.card('Student attempts (' + attempts.length + ')', null, attTable, 'flush')),
        h('div', { 'class': 'ui-stack' }, P.card(locked ? 'Editing locked' : 'Add a question', null, addForm)))));
  }

  // ── MY CLASSES ───────────────────────────────────────────────
  var clsPick = '';
  async function loadClasses() {
    var box = $('classes-body'); if (!hasAssignments()) return noAssignments(box, 'show');
    if (!clsPick) clsPick = uniqueClasses()[0];
    var sel = select('cl-class', 'Class', uniqueClasses().map(function (c) { return { value: c, label: c }; }), clsPick, function () { clsPick = $('cl-class').value; drawStudents(); });
    clear(box).appendChild(h('div', null, pageHead('My Classes', 'Students in the classes you teach'), h('div', { 'class': 'ui-toolrow' }, tool('Class', sel)), h('div', { id: 'cl-list' })));
    drawStudents();
  }
  async function drawStudents() {
    var wrap = $('cl-list'); clear(wrap).appendChild(P.skeleton());
    var r = await global.TeacherAPI.students(clsPick);
    if (!r.ok) return showError(wrap, r, drawStudents);
    var subs = S.user.assignments.filter(function (a) { return a.className === clsPick; }).map(function (a) { return a.subject; }).join(', ');
    clear(wrap).appendChild(P.card(clsPick + ' \u2014 ' + r.data.students.length + ' students', h('span', { 'class': 'ui-li-meta' }, 'You teach: ' + subs),
      r.data.students.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Student'), h('th', null, 'Admission no.'), h('th', null, 'Gender'), h('th', null, 'Parent / guardian'), h('th', null, 'Parent phone'))),
        h('tbody', null, r.data.students.map(function (s, i) {
          return h('tr', null, h('td', null, String(i + 1)), h('td', null, h('strong', null, s.name)), h('td', null, s.admissionNumber || '\u2014'), h('td', null, s.gender || '\u2014'), h('td', null, s.parentName || '\u2014'), h('td', null, s.parentPhone || '\u2014'));
        })))) : P.empty('No approved students in this class yet.'), 'flush'));
  }

  // ── TIMETABLE ────────────────────────────────────────────────
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  async function loadTimetable() {
    var box = $('timetable-body'); clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.timetable();
    if (!r.ok) return showError(box, r, loadTimetable);
    var lessons = r.data.lessons;
    var today = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'long' }).format(new Date());
    var days = DAYS.filter(function (d) { return lessons.some(function (l) { return l.day === d; }); });
    var slots = [];
    days.forEach(function (d) { lessons.filter(function (l) { return l.day === d; }).forEach(function (l) { if (slots.indexOf(l.period) === -1) slots.push(l.period); }); });
    var body = !slots.length ? P.empty('None of your lessons are on a class timetable yet.') : h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table ui-tt-grid' },
      h('thead', null, h('tr', null, h('th', null, 'Time'), days.map(function (d) { return h('th', { 'class': d === today ? 'is-today' : '' }, d); }))),
      h('tbody', null, slots.map(function (slot) {
        return h('tr', null, h('td', { 'class': 'time' }, slot), days.map(function (d) {
          var here = lessons.filter(function (l) { return l.day === d && l.period === slot; });
          return h('td', { 'class': d === today ? 'is-today' : '' }, here.map(function (l) { return h('div', null, l.subject, h('small', null, l.className)); }));
        }));
      }))));
    clear(box).appendChild(h('div', null, pageHead('Timetable', 'Only the lessons you teach'), P.card('My weekly timetable', null, body, 'flush')));
  }

  // ── NOTIFICATIONS / EVENTS ───────────────────────────────────
  async function loadNotifications() {
    var box = $('notifications-body'); clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.notifications();
    if (!r.ok) return showError(box, r, loadNotifications);
    var list = r.data.notifications;
    function unread() { return list.filter(function (n) { return !n.isRead; }).length; }
    applyUnread(unread());
    function draw() {
      clear(box).appendChild(h('div', null, pageHead('Notifications', unread() ? unread() + ' unread' : 'You are all caught up'),
        P.card('Announcements', null, P.noticeList(list, async function (n) {
          if (n.isRead) return;
          var mr = await global.TeacherAPI.markRead(n.id);
          if (mr.ok) { n.isRead = true; applyUnread(unread()); draw(); }
        }))));
    }
    draw();
  }

  async function loadEvents() {
    var box = $('events-body'); clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.events();
    if (!r.ok) return showError(box, r, loadEvents);
    clear(box).appendChild(h('div', null, pageHead('Events', 'School calendar'), P.card('All events', null, P.eventList(r.data.events))));
  }

  // ── PAYSLIPS ─────────────────────────────────────────────────
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  async function loadPayslips() {
    var box = $('payslips-body'); clear(box).appendChild(P.skeleton());
    var r = await global.TeacherAPI.payslips();
    if (!r.ok) return showError(box, r, loadPayslips);
    var list = r.data.payslips;
    var body = list.length ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null, h('th', null, 'Period'), h('th', { 'class': 'num' }, 'Basic'), h('th', { 'class': 'num' }, 'Allowances'), h('th', { 'class': 'num' }, 'Deductions'), h('th', { 'class': 'num' }, 'Net pay'))),
      h('tbody', null, list.map(function (p) {
        return h('tr', null, h('td', null, h('strong', null, (MONTHS[p.periodMonth - 1] || '') + ' ' + p.periodYear)), h('td', { 'class': 'num' }, T.fmtNaira(p.basicNaira)), h('td', { 'class': 'num' }, T.fmtNaira(p.allowancesNaira)),
          h('td', { 'class': 'num' }, T.fmtNaira(p.deductionsNaira)), h('td', { 'class': 'num' }, h('strong', null, T.fmtNaira(p.netNaira))));
      })))) : P.empty('No payslips yet. They appear here once the school finalises payroll.');
    clear(box).appendChild(h('div', null, pageHead('Payslips', 'Only you can see these'), P.card('My payslips', null, body, 'flush')));
  }

  // ── PROFILE / PASSWORD ───────────────────────────────────────
  function renderProfile() {
    var box = $('profile-body'), u = S.user;
    var form = h('div', { 'class': 'ui-form' },
      field('Full name', 'pf-name', { type: 'text', value: u.name, maxlength: '120', autocomplete: 'name' }),
      field('Phone', 'pf-phone', { type: 'tel', value: u.phone || '', maxlength: '30', autocomplete: 'tel' }),
      field('Email for notifications', 'pf-email', { type: 'email', value: u.contactEmail || '', maxlength: '255', autocomplete: 'email' }),
      u.staffId ? h('p', { 'class': 'ui-hint' }, 'Staff ID: ' + u.staffId) : null,
      h('div', { 'class': 'ui-actions' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'pf-save', onclick: saveProfile }, 'Save changes')));
    var mine = u.assignments.length ? h('ul', { 'class': 'ui-list' }, u.assignments.map(function (a) {
      return h('li', null, h('div', { 'class': 'ui-li-ico tone-navy' }, icon('cap')), h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, a.className), h('div', { 'class': 'ui-li-meta' }, a.subject)));
    })) : P.empty('No classes assigned yet.');
    clear(box).appendChild(h('div', null, pageHead('My Profile', 'Your contact details'),
      h('div', { 'class': 'ui-cols' }, h('div', { 'class': 'ui-stack' }, P.card('Contact details', null, form)), h('div', { 'class': 'ui-stack' }, P.card('My classes and subjects', null, mine)))));
  }

  async function saveProfile() {
    var name = $('pf-name').value.trim(), phone = $('pf-phone').value.trim(), email = $('pf-email').value.trim();
    if (name.length < 2) { toast('Please enter your full name.'); return; }
    var btn = $('pf-save'); btn.disabled = true;
    var r = await global.TeacherAPI.saveProfile(name, phone, email);
    btn.disabled = false;
    if (r.ok) { S.user.name = r.data.user.name; S.user.phone = r.data.user.phone; S.user.contactEmail = r.data.user.contactEmail; setText('t-name', S.user.name); setText('t-avatar', T.initials(S.user.name)); toast('Profile updated.'); }
    else toast(apiMessage(r, 'Could not update your profile.'));
  }

  function passwordProblem(cur, nw, cf) {
    if (!cur) return 'Enter your current password.';
    if (nw.length < 8) return 'New password must be at least 8 characters.';
    if (!/[a-z]/.test(nw)) return 'New password needs a lowercase letter.';
    if (!/[A-Z]/.test(nw)) return 'New password needs an uppercase letter.';
    if (!/[0-9]/.test(nw)) return 'New password needs a number.';
    if (nw !== cf) return 'The new passwords do not match.';
    return '';
  }
  function renderPassword() {
    var box = $('password-body');
    var banner = S.mustChange ? h('div', { 'class': 'ui-alert', role: 'alert' }, icon('alert'), h('div', null, 'You are signing in with a temporary password. Please choose a new password before you continue.')) : null;
    var form = h('div', { 'class': 'ui-form' },
      field('Current password', 'pw-cur', { type: 'password', autocomplete: 'current-password', maxlength: '128' }),
      field('New password', 'pw-new', { type: 'password', autocomplete: 'new-password', maxlength: '128' }),
      field('Confirm new password', 'pw-conf', { type: 'password', autocomplete: 'new-password', maxlength: '128' }),
      h('p', { 'class': 'ui-hint' }, 'At least 8 characters, with a lowercase letter, an uppercase letter and a number.'),
      h('div', { 'class': 'ui-actions' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'pw-save', onclick: savePassword }, 'Update password')));
    clear(box).appendChild(h('div', null, banner, pageHead('Change Password', 'Keep your account secure'), P.card('Password', null, form)));
  }
  async function savePassword() {
    var cur = $('pw-cur').value, nw = $('pw-new').value, cf = $('pw-conf').value;
    var problem = passwordProblem(cur, nw, cf); if (problem) { toast(problem); return; }
    var btn = $('pw-save'); btn.disabled = true;
    var r = await global.TeacherAPI.changePassword(cur, nw);
    btn.disabled = false;
    if (!r.ok) { toast(apiMessage(r, 'Could not change your password.')); return; }
    ['pw-cur', 'pw-new', 'pw-conf'].forEach(function (id) { $(id).value = ''; });
    toast('Password changed.');
    if (S.mustChange) { S.mustChange = false; S.user.mustChangePassword = false; S.overviewShown = true; goTo('overview'); }
  }

  // ── start-up ─────────────────────────────────────────────────
  async function boot() {
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.appendChild(icon(el.getAttribute('data-icon'))); });
    var session = await global.requireLogin();
    if (!session) return;
    var box = $('overview-body');
    var r = await global.TeacherAPI.profile();
    if (!r.ok) {
      if (r.status === 401) return;
      if (r.status === 403) { global.location.href = 'login.html'; return; }     // not a teacher account
      clear(box).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); }));
      return;
    }
    S.user = r.data.user;
    setText('t-name', S.user.name); setText('t-avatar', T.initials(S.user.name));
    if (S.user.mustChangePassword) { S.mustChange = true; goTo('password'); return; }
    await loadOverview();
    S.overviewShown = true;
  }

  global.addEventListener('load', boot);
})(window);
