// ══════════════════════════════════════════════════════════════
//  VIFF — demo-data.js   (HARDCODED DEMO DATASET — no server)
//  Everything the portal shows comes from here. Edit freely.
//  Changes made in the UI persist in this browser (localStorage);
//  open any page with  ?reset  on the URL to restore this data.
// ══════════════════════════════════════════════════════════════
// ── on-screen error reporter (so a blank page never fails silently) ──
(function (g) {
  var shown = 0;
  function box(msg) {
    if (shown++ > 2 || !g.document) return;
    function add() {
      var d = g.document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fee2e2;color:#7f1d1d;font:600 12px/1.4 monospace;padding:10px 12px;white-space:pre-wrap;word-break:break-all;border-bottom:3px solid #dc2626';
      d.textContent = 'VIFF demo error: ' + msg;
      (g.document.body || g.document.documentElement).appendChild(d);
    }
    if (g.document.body) add(); else g.document.addEventListener('DOMContentLoaded', add);
  }
  g.addEventListener('error', function (e) { box((e.message || 'error') + ' @ ' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '')); });
  g.addEventListener('unhandledrejection', function (e) { box('promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)); });
  g.addEventListener('load', function () { setTimeout(function () {
    if (g.document.body && g.document.body.innerText.replace(/\s/g, '').length < 20) box('page loaded but is empty. Re-copy ' + g.location.pathname.split('/').pop() + ' from the zip, then reload.');
  }, 2500); });
})(window);
(function (g) {
  'use strict';
  var STORE_KEY = 'tfis_demo_db_v2';
  var SESSION = '2026/2027', TERM = 'First';

  // ── DEMO LOGINS (shown on the login page) ────────────────────
  var LOGINS = [
    { role: 'Admin',      id: 'admin@viffacademy.edu.ng', pw: 'Admin@123' },
    { role: 'Super Admin',id: 'super@viffacademy.edu.ng', pw: 'Super@123' },
    { role: 'Teacher',    id: 'teacher@viffacademy.edu.ng  (or VIFF/T/001)', pw: 'Teacher@123' },
    { role: 'Parent',     id: 'parent@demo.com', pw: 'Parent@123' },
    { role: 'Student',    id: 'VIFF/2025/0001', pw: 'Student@123' }
  ];

  function seeded(seed) { var s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function pad(n, w) { return ('0000' + n).slice(-w); }
  function dayISO(offset) { var d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
  function nowISO(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return d.toISOString(); }
  function gradeOf(t) { return t >= 70 ? 'A' : t >= 60 ? 'B' : t >= 50 ? 'C' : t >= 45 ? 'D' : t >= 40 ? 'E' : 'F'; }
  function remarkOf(gr) { return { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', E: 'Pass', F: 'Fail' }[gr]; }

  function build() {
    var db = { v: 1, session: SESSION, term: TERM };

    // ── classes & subjects ─────────────────────────────────────
    var classDefs = [
      ['JSS 1A', 'JSS 1', 'A', 'Junior', 185000, 'Mrs. Grace Eweka'],
      ['JSS 2A', 'JSS 2', 'A', 'Junior', 190000, 'Mr. Daniel Osagie'],
      ['JSS 3A', 'JSS 3', 'A', 'Junior', 195000, 'Mrs. Grace Eweka'],
      ['SS 1A',  'SS 1',  'A', 'Senior', 220000, 'Mr. Daniel Osagie'],
      ['SS 2A',  'SS 2',  'A', 'Senior', 230000, 'Miss Blessing Idemudia']
    ];
    db.classes = classDefs.map(function (c, i) {
      return { id: 'cls-' + (i + 1), name: c[0], level: c[1], arm: c[2], section: c[3], feeNaira: c[4], fee_kobo: c[4] * 100,
        formTeacher: c[5], form_teacher: c[5] };
    });
    var jr = ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'Civic Education', 'Computer Studies', 'Christian Religious Studies', 'Business Studies'];
    var sr = ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Civic Education'];
    db.subjectsByClass = {};
    db.classes.forEach(function (c) { db.subjectsByClass[c.name] = c.section === 'Junior' ? jr : sr; });
    var subj = [], sid = 1;
    jr.concat(sr).filter(function (s, i, a) { return a.indexOf(s) === i; }).forEach(function (n) {
      var isJ = jr.indexOf(n) > -1, isS = sr.indexOf(n) > -1;
      subj.push({ id: 'sub-' + (sid++), name: n, category: ['English Language', 'Mathematics', 'Civic Education'].indexOf(n) > -1 ? 'Core' : 'General',
        level: isJ && isS ? 'All' : isJ ? 'Junior' : 'Senior', compulsory: ['English Language', 'Mathematics', 'Civic Education'].indexOf(n) > -1 });
    });
    db.subjects = subj;

    // ── staff ──────────────────────────────────────────────────
    var tDefs = [
      ['Mr. Daniel Osagie', 'VIFF/T/001', 'teacher@viffacademy.edu.ng', '08031110001', [['JSS 2A', 'Mathematics'], ['JSS 2A', 'Basic Science'], ['SS 1A', 'Mathematics']]],
      ['Mrs. Grace Eweka', 'VIFF/T/002', 'g.eweka@viffacademy.edu.ng', '08031110002', [['JSS 1A', 'English Language'], ['JSS 3A', 'English Language'], ['JSS 2A', 'English Language']]],
      ['Miss Blessing Idemudia', 'VIFF/T/003', 'b.idemudia@viffacademy.edu.ng', '08031110003', [['SS 2A', 'Biology'], ['SS 1A', 'Biology'], ['SS 2A', 'Chemistry']]],
      ['Mr. Samuel Iyamu', 'VIFF/T/004', 's.iyamu@viffacademy.edu.ng', '08031110004', [['JSS 3A', 'Computer Studies'], ['JSS 1A', 'Computer Studies'], ['SS 1A', 'Economics']]]
    ];
    db.profiles = {};
    db.teachers = tDefs.map(function (t, i) {
      var p = { id: 'tch-' + (i + 1), name: t[0], role: 'teacher', staff_id: t[1], staffId: t[1], contact_email: t[2], login_email: t[2], phone: t[3],
        assignments: t[4].map(function (a) { return { className: a[0], subject: a[1] }; }), must_change_password: false, mustChangePassword: false, permissions: ['manage_cbt'] };
      db.profiles[p.id] = p; return p;
    });
    db.admins = [
      { id: 'adm-1', name: 'Mrs. Funke Adeyemi', role: 'admin', contact_email: 'admin@viffacademy.edu.ng', login_email: 'admin@viffacademy.edu.ng', phone: '08030000001', permissions: [], must_change_password: false },
      { id: 'adm-0', name: 'Rev. Dr. Peter Omoregie', role: 'superadmin', contact_email: 'super@viffacademy.edu.ng', login_email: 'super@viffacademy.edu.ng', phone: '08030000000', permissions: [], must_change_password: false },
      { id: 'adm-2', name: 'Mr. Collins Eze', role: 'admin', contact_email: 'bursar@viffacademy.edu.ng', login_email: 'bursar@viffacademy.edu.ng', phone: '08030000002', permissions: ['manage_finance'], must_change_password: false }
    ];
    db.admins.forEach(function (a) { db.profiles[a.id] = a; });

    // ── students ───────────────────────────────────────────────
    var sDefs = [
      ['Chidera Okafor', 'JSS 2A', 'Female', 'par-1', 'full'], ['Tobenna Okafor', 'JSS 1A', 'Male', 'par-1', 'part'],
      ['Osamudiamen Bello', 'JSS 2A', 'Male', 'par-2', 'full'], ['Aisosa Igbinedion', 'JSS 2A', 'Female', '', 'full'],
      ['Emmanuel Ehigiator', 'JSS 2A', 'Male', '', 'part'], ['Favour Uwaifo', 'JSS 2A', 'Female', '', 'not_paid'],
      ['Ngozi Nwosu', 'JSS 2A', 'Female', '', 'full'], ['Peter Aghedo', 'JSS 1A', 'Male', '', 'full'],
      ['Ruth Oyakhilome', 'JSS 1A', 'Female', '', 'full'], ['Daniel Enabulele', 'JSS 1A', 'Male', '', 'not_paid'],
      ['Joy Osayande', 'JSS 3A', 'Female', '', 'full'], ['Samuel Ogbebor', 'JSS 3A', 'Male', '', 'part'],
      ['Esther Ekhator', 'JSS 3A', 'Female', '', 'full'], ['David Omoruyi', 'SS 1A', 'Male', '', 'full'],
      ['Mercy Edokpayi', 'SS 1A', 'Female', '', 'part'], ['Gabriel Ugiagbe', 'SS 1A', 'Male', '', 'full'],
      ['Victoria Asemota', 'SS 2A', 'Female', '', 'full'], ['Isaac Erhabor', 'SS 2A', 'Male', '', 'not_paid']
    ];
    var secOf = {}; db.classes.forEach(function (c) { secOf[c.name] = c.section; });
    db.students = sDefs.map(function (s, i) {
      var adm = 'VIFF/2025/' + pad(i + 1, 4), parts = s[0].split(' ');
      var st = { id: 'stu-' + (i + 1), profile_id: 'stu-' + (i + 1), student_name: s[0], name: s[0], studentName: s[0],
        admission_number: adm, admissionNumber: adm, class_name: s[1], className: s[1], section: secOf[s[1]], gender: s[2], status: 'approved',
        parent_profile_id: s[3] || null, parent_name: s[3] === 'par-1' ? 'Mrs. Ngozi Okafor' : s[3] === 'par-2' ? 'Mr. Adewale Bello' : 'Mr/Mrs ' + parts[1],
        parent_phone: '0803' + pad(2220000 + i * 37, 7), phone: '0803' + pad(2220000 + i * 37, 7), contact_email: parts[0].toLowerCase() + '@student.tfis.demo',
        fee_status: s[4], feeStatus: s[4], fee_note: s[4] === 'part' ? 'Balance to be cleared by mid-term' : '', feeNote: s[4] === 'part' ? 'Balance to be cleared by mid-term' : '',
        fee_paid_at: s[4] === 'full' ? dayISO(-40) : null, session: SESSION, createdAt: nowISO(-120 + i), created_at: nowISO(-120 + i) };
      db.profiles[st.id] = { id: st.id, name: s[0], role: 'student', contact_email: st.contact_email, phone: st.phone, must_change_password: false };
      return st;
    });
    db.parents = [
      { id: 'par-1', name: 'Mrs. Ngozi Okafor', role: 'parent', contact_email: 'parent@demo.com', login_email: 'parent@demo.com', phone: '08033330001', must_change_password: false },
      { id: 'par-2', name: 'Mr. Adewale Bello', role: 'parent', contact_email: 'bello@demo.com', login_email: 'bello@demo.com', phone: '08033330002', must_change_password: false }
    ];
    db.parents.forEach(function (p) { db.profiles[p.id] = p; });

    // admissions waiting for a decision
    db.admissions = [
      ['Oluwaseun Adebayo', 'JSS 1A', 'Male', 'Mr. Tunde Adebayo'], ['Amaka Eze', 'SS 1A', 'Female', 'Mrs. Chioma Eze'], ['Jeremiah Aigbe', 'JSS 3A', 'Male', 'Mr. Paul Aigbe']
    ].map(function (a, i) {
      return { id: 'adm-app-' + (i + 1), studentName: a[0], name: a[0], classApplied: a[1], className: a[1], gender: a[2], dateOfBirth: '2013-0' + (i + 3) + '-1' + i,
        parentName: a[3], parentEmail: 'applicant' + (i + 1) + '@demo.com', parentPhone: '0809000000' + i, parentRel: 'Parent', prevSchool: 'Bright Stars Academy',
        referenceNumber: 'VIFF-APP-' + pad(2026 * 10 + i, 6), status: 'pending', createdAt: nowISO(-i - 1) };
    });

    // ── published results (2 past terms per student) ───────────────
    db.results = [];
    db.scores = {};   // key: studentId|session|term|subject → {ca, exam, locked}
    var terms = [['2025/2026', 'Second', -190], ['2025/2026', 'Third', -100]];
    terms.forEach(function (T, ti) {
      db.classes.forEach(function (c) {
        var roster = db.students.filter(function (s) { return s.class_name === c.name; });
        var rows = roster.map(function (s) {
          var r = seeded(parseInt(s.id.split('-')[1], 10) * 31 + ti * 7 + 3), subs = db.subjectsByClass[c.name].map(function (n) {
            var base = 52 + Math.floor(r() * 40), ca = Math.min(40, Math.round(base * 0.4 + r() * 4)), ex = Math.min(60, Math.round(base * 0.6 + r() * 5)), t = ca + ex;
            return { subject: n, ca: ca, exam: ex, total: t, grade: gradeOf(t) };
          });
          var avg = Math.round(subs.reduce(function (a, b) { return a + b.total; }, 0) / subs.length * 10) / 10;
          return { s: s, subs: subs, avg: avg };
        });
        rows.sort(function (a, b) { return b.avg - a.avg; });
        rows.forEach(function (x, i) {
          x.subs.forEach(function (sc) { db.scores[[x.s.id, T[0], T[1], sc.subject].join('|')] = { ca: sc.ca, exam: sc.exam, locked: true }; });
          var og = gradeOf(x.avg);
          db.results.push({ id: 'res-' + x.s.id + '-' + ti, student_id: x.s.id, class_name: c.name, term: T[1], session: T[0], average: x.avg, overall_grade: og,
            class_position: i + 1, total_students: rows.length, is_published: true, published_at: nowISO(T[2]), created_at: nowISO(T[2]),
            principal_remark: x.avg >= 70 ? 'An outstanding performance. Keep it up!' : x.avg >= 55 ? 'A good result. Aim higher next term.' : 'There is room for improvement. Work harder.',
            teacher_remark: x.avg >= 60 ? 'A diligent and well-behaved student.' : 'Needs more focus and regular practice.', subject_scores: x.subs });
        });
      });
    });
    // current term (not yet published): a few scores already entered for teacher demo
    db.students.filter(function (s) { return s.class_name === 'JSS 2A'; }).forEach(function (s, i) {
      var r = seeded(i * 13 + 5);
      db.scores[[s.id, SESSION, TERM, 'Mathematics'].join('|')] = { ca: 22 + Math.floor(r() * 16), exam: 0, locked: false };
      if (i < 3) db.scores[[s.id, SESSION, TERM, 'English Language'].join('|')] = { ca: 25 + Math.floor(r() * 12), exam: 30 + Math.floor(r() * 25), locked: false };
    });
    db.scores = JSON.parse(JSON.stringify(db.scores));
    Object.keys(db.scores).forEach(function (k) { if (k.indexOf('Mathematics') > -1 && !db.scores[k].locked) db.scores[k].exam = null; });

    // ── attendance (last ~28 weekdays) ───────────────────────────
    db.attendance = []; var ar = seeded(77);
    for (var d = 0, made = 0; made < 28; d--) {
      var dt = new Date(); dt.setDate(dt.getDate() + d); var wd = dt.getDay(); if (wd === 0 || wd === 6) continue; made++;
      var iso = dt.toISOString().slice(0, 10);
      db.students.forEach(function (s) {
        var x = ar(), st = x < 0.88 ? 'present' : x < 0.93 ? 'late' : x < 0.97 ? 'absent' : 'excused';
        db.attendance.push({ id: 'att-' + db.attendance.length, student_id: s.id, class_name: s.class_name, date: iso, status: st, note: st === 'absent' ? 'Sick' : '' });
      });
    }

    // ── timetable (every class, Mon–Fri) ───────────────────────────
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], times = ['8:00-8:40', '8:40-9:20', '9:20-10:00', '10:30-11:10', '11:10-11:50', '11:50-12:30'];
    db.timetables = {};
    db.classes.forEach(function (c) {
      var list = db.subjectsByClass[c.name], periods = [];
      days.forEach(function (day, di) { times.forEach(function (tm, ti) {
        var sub = list[(di * 2 + ti) % list.length], t = db.teachers.filter(function (x) { return x.assignments.some(function (a) { return a.className === c.name && a.subject === sub; }); })[0];
        periods.push({ day: day, period: tm, subject: sub, teacher: t ? t.name : 'Staff' });
      }); });
      db.timetables[c.name] = periods;
    });

    // ── notifications, events ─────────────────────────────────────
    db.notifications = [
      { id: 'n-1', title: 'Welcome to the new Term', message: 'We welcome all students back for the First Term. Resumption is strictly 8:00 a.m. Please be punctual.', type: 'info', audience: 'all', target_class: '', created_at: nowISO(-30) },
      { id: 'n-2', title: 'Mid-term break', message: 'Mid-term break begins next week Thursday and ends Monday. Classes resume Tuesday.', type: 'info', audience: 'all', target_class: '', created_at: nowISO(-6) },
      { id: 'n-3', title: 'Fee reminder', message: 'Parents are kindly reminded to clear outstanding fees before the end of the month.', type: 'warning', audience: 'parents', target_class: '', created_at: nowISO(-4) },
      { id: 'n-4', title: 'Mathematics assignment', message: 'JSS 2A: complete exercises 4 and 5 on algebraic expressions. Submit on Friday.', type: 'info', audience: 'students', target_class: 'JSS 2A', created_at: nowISO(-2) },
      { id: 'n-5', title: 'Staff meeting', message: 'There will be a staff meeting on Friday at 2:00 p.m. in the staff room.', type: 'info', audience: 'teachers', target_class: '', created_at: nowISO(-1) },
      { id: 'n-6', title: 'Inter-house sports', message: 'Inter-house sports holds soon. Students should be in their house colours.', type: 'success', audience: 'all', target_class: '', created_at: nowISO(-3) }
    ];
    db.reads = {};
    db.events = [
      ['Mid-term Break', 'School closes for mid-term break.', 'holiday', 5, '', 'School', 'all'], ['Inter-House Sports', 'Annual inter-house sports competition.', 'sports', 12, '9:00 AM', 'School Field', 'all'],
      ['Parents-Teachers Meeting', 'Review of first-half-term progress.', 'meeting', 16, '10:00 AM', 'School Hall', 'parents'], ['Science Fair', 'Students showcase their science projects.', 'academic', 22, '10:00 AM', 'Science Lab', 'all'],
      ['Staff Training', 'Professional development workshop.', 'meeting', 9, '1:00 PM', 'Staff Room', 'teachers'], ['First Term Exams Begin', 'Examinations for all classes.', 'exam', 40, '8:00 AM', 'All Classrooms', 'all']
    ].map(function (e, i) { return { id: 'ev-' + (i + 1), title: e[0], description: e[1], category: e[2], date: dayISO(e[3]), time: e[4], location: e[5], audience: e[6], created_at: nowISO(-20) }; });

    // ── CBT ───────────────────────────────────────────────────────
    function q(i, t, a, b, c, d, ans) { return { id: 'q-' + i, position: i, questionText: t, optionA: a, optionB: b, optionC: c, optionD: d, correctOption: ans, marks: 2 }; }
    db.cbtExams = [
      { id: 'cbt-1', title: 'Algebra Quiz', subject: 'Mathematics', class_name: 'JSS 2A', term: TERM, session: SESSION, duration_minutes: 15, is_published: true, created_at: nowISO(-8), teacher: 'tch-1' },
      { id: 'cbt-2', title: 'Living Things Test', subject: 'Basic Science', class_name: 'JSS 2A', term: TERM, session: SESSION, duration_minutes: 20, is_published: true, created_at: nowISO(-5), teacher: 'tch-1' },
      { id: 'cbt-3', title: 'Linear Equations Draft', subject: 'Mathematics', class_name: 'SS 1A', term: TERM, session: SESSION, duration_minutes: 30, is_published: false, created_at: nowISO(-1), teacher: 'tch-1' }
    ];
    db.cbtQuestions = {
      'cbt-1': [q(1, 'Simplify 3x + 2x', '5x', '6x', '5x²', 'x', 'A'), q(2, 'If x + 4 = 10, what is x?', '4', '6', '14', '40', 'B'), q(3, 'What is 2(x + 3) when expanded?', '2x + 3', '2x + 6', 'x + 6', '2x + 5', 'B'), q(4, 'Value of 3² + 4?', '10', '13', '15', '25', 'B'), q(5, 'Which is a prime number?', '9', '15', '17', '21', 'C')],
      'cbt-2': [q(1, 'Which organelle makes food in plants?', 'Nucleus', 'Chloroplast', 'Ribosome', 'Vacuole', 'B'), q(2, 'The basic unit of life is the…', 'Tissue', 'Organ', 'Cell', 'Organism', 'C'), q(3, 'Which is a non-living thing?', 'Tree', 'Fish', 'Rock', 'Frog', 'C')],
      'cbt-3': [q(1, 'Solve 2x = 10', '2', '5', '10', '20', 'B')]
    };
    db.cbtAttempts = [{ id: 'att-1', exam_id: 'cbt-1', student_id: 'stu-1', status: 'submitted', score: 8, total_marks: 10, submitted_at: nowISO(-3) }];

    // ── finance ───────────────────────────────────────────────────
    db.ledgerCategories = ['Tuition (cash)', 'Tuition (bank)', 'Salaries', 'Utilities', 'Maintenance', 'Supplies', 'Transport', 'Other'];
    db.ledger = [
      ['income', 'Tuition (bank)', 'First term fees - JSS 2A batch', 1520000, 'bank_transfer', -38], ['income', 'Tuition (bank)', 'First term fees - SS 1A batch', 880000, 'bank_transfer', -36],
      ['income', 'Other', 'New admissions registration', 210000, 'cash', -30], ['expense', 'Salaries', 'September staff salaries', 1450000, 'bank_transfer', -20],
      ['expense', 'Utilities', 'Electricity and diesel', 185000, 'cash', -18], ['income', 'Other', 'School uniform sales', 164000, 'cash', -15],
      ['expense', 'Maintenance', 'Classroom repairs and painting', 240000, 'bank_transfer', -12], ['income', 'Other', 'PTA donation - library', 300000, 'cheque', -9],
      ['expense', 'Supplies', 'Exercise books and chalk', 96000, 'cash', -6], ['income', 'Tuition (cash)', 'Part payments received at the bursar office', 460000, 'cash', -3]
    ].map(function (e, i) { return { id: 'led-' + (i + 1), source: 'manual', type: e[0], entryType: e[0], category: e[1], description: e[2], amountNaira: e[3], method: e[4], date: dayISO(e[5]), entryDate: dayISO(e[5]), voided: false, voidReason: '', reference: 'REF' + pad(1000 + i, 4) }; });
    db.payments = [
      { id: 'pay-1', reference: 'VIFF-PAY-2201', amountNaira: 95000, term: 'Third', session: '2025/2026', status: 'success', createdAt: nowISO(-120), studentId: 'stu-1' },
      { id: 'pay-2', reference: 'VIFF-PAY-2202', amountNaira: 95000, term: 'First', session: SESSION, status: 'success', createdAt: nowISO(-40), studentId: 'stu-1' }
    ];
    db.onlinePayments = true;
    db.transportRoutes = [
      { id: 'rt-1', name: 'Ugbowo – Ring Road', description: 'Morning and afternoon pickup', driver_name: 'Mr. Jude', driver_phone: '08034440001', vehicle_plate: 'EDO-221-BN', capacity: 18, fee_kobo: 2500000, is_active: true },
      { id: 'rt-2', name: 'Sapele Road – GRA', description: 'Island route', driver_name: 'Mr. Ikponmwosa', driver_phone: '08034440002', vehicle_plate: 'EDO-514-KJ', capacity: 14, fee_kobo: 3000000, is_active: true }
    ];
    db.transportAssignments = [{ id: 'ta-1', routeId: 'rt-1', studentId: 'stu-1', pickupPoint: 'Ugbowo Junction', studentName: 'Chidera Okafor', className: 'JSS 2A' }];
    db.salaries = {}; db.teachers.forEach(function (t, i) { db.salaries[t.id] = { basic_kobo: (9000000 + i * 500000), allowances_kobo: 1500000, deductions_kobo: 600000, bank_name: 'GTBank', bank_account: '01234567' + (80 + i) }; });
    db.payrollRuns = [{ id: 'run-1', period_month: 9, period_year: 2026, status: 'finalized', created_at: nowISO(-22) }];
    db.pins = [
      { id: 'pin-1', code: 'TF-7K29-QX41', studentName: 'Chidera Okafor', studentId: 'stu-1', term: 'Third', session: '2025/2026', maxUses: 3, usedCount: 1, isActive: true },
      { id: 'pin-2', code: 'TF-3M88-ZP02', studentName: 'Osamudiamen Bello', studentId: 'stu-3', term: 'Third', session: '2025/2026', maxUses: 3, usedCount: 3, isActive: true }
    ];
    db.idCards = db.students.slice(0, 5).map(function (s, i) {
      return { id: 'idc-' + (i + 1), card_number: 'VIFF-ID-' + pad(1001 + i, 5), cardNumber: 'VIFF-ID-' + pad(1001 + i, 5), holder_type: 'student', holderType: 'student', holder_id: s.id,
        full_name: s.name, fullName: s.name, class_name: s.class_name, className: s.class_name, identifier: s.admission_number, status: 'active', photo_url: '', issued_at: nowISO(-60), expires_at: nowISO(300) };
    });

    // ── settings ──────────────────────────────────────────────────
    db.siteSettings = {};
    db.docSettings = { id_card_terms: 'This card remains the property of the school. If found, please return it to the school office. The bearer should present this card when requested by authorized officials.',
      id_card_valid_text: 'Valid while the bearer remains a registered student.', show_qr_on_id_card: true, head_of_school_name: 'Rev. Dr. Peter Omoregie', head_of_school_signature_url: '', next_term_fees_note: 'Next term fees: ₦190,000 (JSS) / ₦220,000 (SS). Pay before resumption.' };
    db.gradeScale = [[70, 100, 'A', 'Excellent'], [60, 69, 'B', 'Very Good'], [50, 59, 'C', 'Good'], [45, 49, 'D', 'Fair'], [40, 44, 'E', 'Pass'], [0, 39, 'F', 'Fail']].map(function (b, i) {
      return { id: 'gs-' + (i + 1), min: b[0], max: b[1], min_score: b[0], max_score: b[1], minScore: b[0], maxScore: b[1], grade: b[2], remark: b[3], position: i + 1 }; });
    var tr = { affective: ['Punctuality', 'Neatness', 'Politeness', 'Honesty', 'Leadership'], psychomotor: ['Handwriting', 'Sports', 'Drawing & Painting'], cocurricular: ['Debate Club', 'Drama Club', 'Choir'] }, tid = 1; db.traits = [];
    Object.keys(tr).forEach(function (cat) { tr[cat].forEach(function (n, i) { db.traits.push({ id: 'tr-' + (tid++), category: cat, name: n, position: i + 1 }); }); });
    db.permissionDefs = [{ key: 'manage_cbt', label: 'Manage CBT tests' }, { key: 'manage_finance', label: 'Manage finance & ledger' }, { key: 'manage_documents', label: 'Configure ID & report cards' }, { key: 'manage_students', label: 'Manage students' }];
    db.activity = [
      { description: 'Mr. Daniel Osagie entered Mathematics scores for JSS 2A', createdAt: nowISO(-0.1) }, { description: 'Admin approved 2 new admissions', createdAt: nowISO(-1) },
      { description: 'Fee payment received for Chidera Okafor', createdAt: nowISO(-2) }, { description: 'Attendance marked for SS 1A', createdAt: nowISO(-3) }
    ];
    return db;
  }

  function load() {
    var reset = /[?&]reset\b/.test(g.location ? g.location.search : '');
    try {
      if (reset) g.localStorage.removeItem(STORE_KEY);
      var raw = g.localStorage.getItem(STORE_KEY);
      if (raw) { var d = JSON.parse(raw); if (d && d.v === 1) return d; }
    } catch (e) { /* storage blocked: run from memory */ }
    return build();
  }

  g.DEMO = { LOGINS: LOGINS, SESSION: SESSION, TERM: TERM, STORE_KEY: STORE_KEY, db: load(), gradeOf: gradeOf, remarkOf: remarkOf,
    save: function () { try { g.localStorage.setItem(STORE_KEY, JSON.stringify(g.DEMO.db)); } catch (e) { /* ignore */ } },
    dayISO: dayISO, nowISO: nowISO };
  g.DEMO.save();
})(typeof window !== 'undefined' ? window : globalThis);
