// ══════════════════════════════════════════════════════════════
//  VIFF — demo-layer.js   (load AFTER supabase-api.js)
//  Replaces every network call with an in-browser, hardcoded API.
//  Same {ok, status, data} shape the dashboards already expect.
// ══════════════════════════════════════════════════════════════
(function (g) {
  'use strict';
  var D = g.DEMO, SESSION = D.SESSION, TERM = D.TERM;
  // 2FA demo switch: open login.html?force2fa=1 to see mandatory two-factor (setup page, code step); ?force2fa=0 turns it off again.
  (function () { try { var m = /[?&]force2fa=(\d)/.exec(g.location.search); if (m) { g.localStorage.setItem('tfis_demo_force2fa', m[1]); if (m[1] === '0') { g.localStorage.removeItem('tfis_demo_mfa'); g.localStorage.removeItem('tfis_demo_aal2'); } } } catch (e) { } })();
  function ls(k) { try { return g.localStorage.getItem(k); } catch (e) { return null; } }
  function force2fa() { return ls('tfis_demo_force2fa') === '1'; }
  function db() { return D.db; }
  function J(x) { return JSON.parse(JSON.stringify(x)); }
  function R(data, status) { return { ok: true, status: status || 200, data: data }; }
  function E(msg, status) { return { ok: false, status: status || 400, data: { message: msg } }; }
  function uid() { try { return JSON.parse(g.localStorage.getItem('tfis_demo_session') || 'null'); } catch (e) { return null; } }
  function nextId(p) { return p + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }
  function find(arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; }
  function wait(v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 60); }); }
  function pad(n, w) { return ('0000' + n).slice(-w); }
  function weekday() {
    var w = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'long' }).format(new Date());
    return (w === 'Saturday' || w === 'Sunday') ? 'Monday' : w;   // weekends show Monday's lessons so the demo is never empty
  }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date()); }

  // ── shared builders (mirror the real backend's response shapes) ──
  function mapResult(r) {
    return { id: r.id, _id: r.id, className: r.class_name, term: r.term, session: r.session, average: r.average, overallGrade: r.overall_grade, position: r.class_position,
      classSize: r.total_students, totalStudents: r.total_students, isPublished: true, principalRemark: r.principal_remark || '', publishedAt: r.published_at, createdAt: r.created_at,
      subjects: r.subject_scores.map(function (s) { return { subject: s.subject, ca: s.ca, exam: s.exam, total: s.total, grade: s.grade }; }).sort(function (a, b) { return a.subject.localeCompare(b.subject); }) };
  }
  function results(sid, q) {
    q = q || {};
    return db().results.filter(function (r) { return r.student_id === sid && r.is_published && (!q.term || r.term === q.term) && (!q.session || r.session === q.session); })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); }).map(mapResult);
  }
  function attRows(sid) {
    return db().attendance.filter(function (a) { return a.student_id === sid; }).sort(function (a, b) { return b.date.localeCompare(a.date); })
      .map(function (a) { return { date: a.date, status: a.status, note: a.note || '' }; });
  }
  function summarise(rows) {
    var c = { present: 0, late: 0, absent: 0, excused: 0 }; rows.forEach(function (r) { c[r.status]++; });
    return Object.assign({ total: rows.length }, c, { rate: rows.length ? Math.round(((c.present + c.late) / rows.length) * 100) : null });
  }
  function notes(profileId, aud, cls) {
    var rd = db().reads[profileId] || [];
    return db().notifications.filter(function (n) { return aud.indexOf(n.audience) > -1 && (!n.target_class || (cls || []).indexOf(n.target_class) > -1); })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (n) { return { id: n.id, _id: n.id, title: n.title, message: n.message, type: n.type, audience: n.audience, createdAt: n.created_at, isRead: rd.indexOf(n.id) > -1 }; });
  }
  function markRead(profileId, id) { var d = db(); d.reads[profileId] = d.reads[profileId] || []; if (d.reads[profileId].indexOf(id) < 0) d.reads[profileId].push(id); D.save(); }
  function events(aud, fromDate, limit) {
    return db().events.filter(function (e) { return aud.indexOf(e.audience) > -1 && (!fromDate || e.date >= fromDate); }).sort(function (a, b) { return a.date.localeCompare(b.date); })
      .slice(0, limit || 100).map(function (e) { return { id: e.id, _id: e.id, title: e.title, description: e.description, category: e.category, date: e.date, time: e.time, location: e.location, audience: e.audience }; });
  }
  function timetable(cls) { return { className: cls || '', periods: (db().timetables[cls] || []).map(function (p) { return Object.assign({}, p); }) }; }
  function cbtFor(st) {
    return db().cbtExams.filter(function (e) { return e.class_name === st.class_name && e.is_published; }).map(function (e) {
      var a = db().cbtAttempts.filter(function (x) { return x.exam_id === e.id && x.student_id === st.id; })[0];
      return { id: e.id, _id: e.id, title: e.title, subject: e.subject, duration_minutes: e.duration_minutes, durationMinutes: e.duration_minutes,
        attemptStatus: a ? a.status : 'not_started', score: a ? a.score : null, totalMarks: a ? a.total_marks : null };
    });
  }
  function recentTests(sid) {
    return db().cbtAttempts.filter(function (a) { return a.student_id === sid && a.status === 'submitted'; }).map(function (a) {
      var e = find(db().cbtExams, a.exam_id) || {}; return { title: e.title || 'Test', subject: e.subject || '', score: a.score, totalMarks: a.total_marks, submittedAt: a.submitted_at };
    });
  }
  function classFee(name) { var c = db().classes.filter(function (x) { return x.name === name; })[0]; return c ? c.feeNaira : null; }
  var FEE_LABELS = { full: 'Paid in full', part: 'Part payment', not_paid: 'Not paid' };
  function studentOf(profileId) { return db().students.filter(function (s) { return s.profile_id === profileId; })[0]; }
  function childrenOf(pid) { return db().students.filter(function (s) { return s.parent_profile_id === pid; }); }
  function brief(c) { return { id: c.id, name: c.student_name, className: c.class_name, section: c.section || '', admissionNumber: c.admission_number, gender: c.gender }; }
  function userBlock(p) { return { id: p.id, _id: p.id, name: p.name, role: p.role, contactEmail: p.contact_email || '', phone: p.phone || '', mustChangePassword: false, isDemo: true }; }

  function studentDash(profile, st) {
    var res = results(st.id, {}), latest = res[0] || null, rows = attRows(st.id), att = summarise(rows), ns = notes(profile.id, ['all', 'students'], [st.class_name]), ex = cbtFor(st);
    return { profile: { user: userBlock(profile), student: { id: st.id, _id: st.id, studentName: st.student_name, className: st.class_name, section: st.section, admissionNumber: st.admission_number, gender: st.gender } },
      term: latest ? { term: latest.term, session: latest.session } : null,
      kpis: { average: latest ? latest.average : null, overallGrade: latest ? latest.overallGrade : null, position: latest ? latest.position : null, classSize: latest ? latest.classSize : null,
        attendanceRate: att.rate, pendingTests: ex.filter(function (e) { return e.attemptStatus !== 'submitted'; }).length, unreadNotifications: ns.filter(function (n) { return !n.isRead; }).length },
      latestResult: latest, attendance: Object.assign({}, att, { recent: rows.slice(0, 5) }),
      today: { weekday: weekday(), periods: timetable(st.class_name).periods.filter(function (p) { return p.day === weekday(); }) },
      recentTests: recentTests(st.id).slice(0, 5), notifications: ns.slice(0, 3), events: events(['all', 'students'], today(), 4),
      fees: { status: st.fee_status, label: FEE_LABELS[st.fee_status], classFeeNaira: classFee(st.class_name), paidAt: st.fee_paid_at, note: st.fee_note || '' } };
  }
  function parentDash(profile, kids, child) {
    var prof = { user: userBlock(profile), children: kids.map(brief) };
    if (!child) return { profile: prof, child: null, feeTerm: { term: TERM, session: SESSION } };
    var res = results(child.id, {}), latest = res[0] || null, rows = attRows(child.id), att = summarise(rows), ns = notes(profile.id, ['all', 'parents'], kids.map(function (k) { return k.class_name; }));
    var pays = db().payments.filter(function (p) { return p.studentId === child.id; }).map(function (p) { return { id: p.id, reference: p.reference, amountNaira: p.amountNaira, term: p.term, session: p.session, status: p.status, createdAt: p.createdAt }; });
    var termPaid = child.fee_status === 'full', fee = classFee(child.class_name);
    return { profile: prof, child: brief(child), term: latest ? { term: latest.term, session: latest.session } : null,
      kpis: { average: latest ? latest.average : null, overallGrade: latest ? latest.overallGrade : null, position: latest ? latest.position : null, classSize: latest ? latest.classSize : null, attendanceRate: att.rate,
        unreadNotifications: ns.filter(function (n) { return !n.isRead; }).length },
      latestResult: latest, attendance: Object.assign({}, att, { recent: rows.slice(0, 5) }),
      today: { weekday: weekday(), periods: timetable(child.class_name).periods.filter(function (p) { return p.day === weekday(); }) },
      notifications: ns.slice(0, 3), events: events(['all', 'parents'], today(), 4), recentTests: recentTests(child.id).slice(0, 5),
      fees: { status: child.fee_status, label: FEE_LABELS[child.fee_status], note: child.fee_note || '', paidAt: child.fee_paid_at, classFeeNaira: fee, recentPayments: pays.slice(0, 5),
        pay: { enabled: db().onlinePayments, canPay: db().onlinePayments && fee !== null && !termPaid } },
      feeTerm: { term: TERM, session: SESSION } };
  }

  // ── school documents (ID card / report card) ──
  function school() {
    var s = Object.assign({}, g.SITE_CONTENT_DEFAULTS || {}, db().siteSettings || {});
    return { name: s.school_name, shortName: s.school_short_name, logoUrl: s.logo_url || 'logo.png', primaryColor: s.primary_color, accentColor: s.accent_color, address: s.address, phone: s.phone, email: s.email };
  }
  function idCardSheet(st) {
    var c = db().idCards.filter(function (x) { return x.holder_id === st.id; })[0], ds = db().docSettings;
    return { school: school(), student: { name: st.student_name, admissionNumber: st.admission_number, className: st.class_name, session: SESSION, phone: st.parent_phone },
      card: { number: c ? c.card_number : 'VIFF-ID-' + pad(2000 + parseInt(st.id.split('-')[1], 10), 5), status: c ? c.status : 'active', photoUrl: '', issuedAt: c ? c.issued_at : D.nowISO(-30), expiresAt: c ? c.expires_at : D.nowISO(330) },
      verificationCode: 'VIFF-' + st.admission_number.replace(/\D/g, '') + '-' + st.id.toUpperCase(), termsText: ds.id_card_terms, validText: ds.id_card_valid_text, showQr: ds.show_qr_on_id_card };
  }
  function gradeFrom(total) { var b = db().gradeScale.filter(function (x) { return total >= x.min && total <= x.max; })[0]; return b || { grade: '-', remark: '' }; }
  function reportSheet(result, st) {
    var subjects = result.subject_scores.map(function (s) { var t = Math.round((s.ca + s.exam) * 10) / 10, g2 = gradeFrom(t); return { subject: s.subject, ca: s.ca, exam: s.exam, total: t, grade: g2.grade, remark: g2.remark }; }).sort(function (a, b) { return a.subject.localeCompare(b.subject); });
    var total = subjects.reduce(function (a, b) { return a + b.total; }, 0), ov = gradeFrom(result.average), traits = { affective: [], psychomotor: [], cocurricular: [] }, n = parseInt(st.id.split('-')[1], 10);
    db().traits.forEach(function (t, i) { traits[t.category].push({ id: t.id, name: t.name, score: ((n + i) % 3) + 3 }); });
    var rows = attRows(st.id), cnt = summarise(rows);
    return { school: school(), student: { name: st.student_name, admissionNumber: st.admission_number, className: result.class_name }, term: result.term, session: result.session, subjects: subjects,
      totals: { score: Math.round(total * 10) / 10, obtainable: subjects.length * 100, average: result.average, grade: ov.grade, remark: ov.remark, position: result.class_position, classSize: result.total_students, classAverage: 62.4 },
      traits: traits, teacherRemark: result.teacher_remark || '', principalRemark: result.principal_remark || '',
      attendance: { present: cnt.present + cnt.late, absent: cnt.absent, excused: cnt.excused, total: cnt.total, note: 'Covers recent school days on file.' },
      gradeScale: db().gradeScale, nextTermFeesNote: db().docSettings.next_term_fees_note, headOfSchoolName: db().docSettings.head_of_school_name, isPublished: true };
  }

  // ── teacher helpers ──
  function assignmentsOf(p) { return p.assignments || []; }
  function classNamesOf(p) { var o = []; assignmentsOf(p).forEach(function (a) { if (o.indexOf(a.className) < 0) o.push(a.className); }); return o; }
  function roster(cls) { return db().students.filter(function (s) { return s.class_name === cls && s.status === 'approved'; }); }
  function scoreKey(sid, ses, term, sub) { return [sid, ses, term, sub].join('|'); }
  function classRows(p) {
    return assignmentsOf(p).map(function (a) {
      var r = roster(a.className), entered = 0;
      r.forEach(function (s) { var sc = db().scores[scoreKey(s.id, SESSION, TERM, a.subject)]; if (sc && sc.ca != null && sc.exam != null) entered++; });
      var marked = db().attendance.filter(function (x) { return x.class_name === a.className && x.date === today(); }).length;
      return { className: a.className, subject: a.subject, studentCount: r.length, scoresEntered: entered, scoresPublished: 0, attendanceMarkedToday: marked > 0, attendanceCountToday: marked };
    });
  }
  function briefTest(e) {
    return { id: e.id, title: e.title, subject: e.subject, className: e.class_name, term: e.term, session: e.session, durationMinutes: e.duration_minutes, isPublished: !!e.is_published, createdAt: e.created_at,
      questionCount: (db().cbtQuestions[e.id] || []).length, attemptCount: db().cbtAttempts.filter(function (a) { return a.exam_id === e.id; }).length };
  }
  function teacherDash(p) {
    var rows = classRows(p), cls = classNamesOf(p), tests = db().cbtExams.map(briefTest), ns = notes(p.id, ['all', 'teachers'], cls);
    var lessons = teacherLessons(p);
    return { profile: { user: Object.assign(userBlock(p), { staffId: p.staff_id, assignments: assignmentsOf(p) }) }, term: { term: TERM, session: SESSION }, today: { weekday: weekday(), date: today() },
      kpis: { classes: cls.length, assignments: rows.length, students: cls.reduce(function (a, c) { return a + roster(c).length; }, 0), attendanceMarked: rows.filter(function (r) { return r.attendanceMarkedToday; }).length,
        attendanceExpected: cls.length, testsPublished: tests.filter(function (t) { return t.isPublished; }).length, testsDraft: tests.filter(function (t) { return !t.isPublished; }).length, unreadNotifications: ns.filter(function (n) { return !n.isRead; }).length },
      classes: rows, todayLessons: lessons.filter(function (l) { return l.day === weekday(); }), tests: tests.slice(0, 5), notifications: ns.slice(0, 3), events: events(['all', 'teachers'], today(), 4) };
  }
  function teacherLessons(p) {
    var out = []; classNamesOf(p).forEach(function (c) { (db().timetables[c] || []).forEach(function (t) { if (assignmentsOf(p).some(function (a) { return a.className === c && a.subject === t.subject; })) out.push({ className: c, day: t.day, period: t.period, subject: t.subject }); }); });
    return out;
  }
  function publishClass(body) {
    var d = db(), n = 0, term = body.term || TERM, session = body.session || SESSION, rows = [];
    roster(body.className).forEach(function (s) {
      var subs = (d.subjectsByClass[body.className] || []).map(function (sub) { var sc = d.scores[scoreKey(s.id, session, term, sub)]; if (!sc || sc.ca == null || sc.exam == null) return null; return { subject: sub, ca: sc.ca, exam: sc.exam, total: sc.ca + sc.exam, grade: D.gradeOf(sc.ca + sc.exam) }; }).filter(Boolean);
      if (!subs.length) return;
      rows.push({ s: s, subs: subs, avg: Math.round(subs.reduce(function (a, b) { return a + b.total; }, 0) / subs.length * 10) / 10 });
    });
    rows.sort(function (a, b) { return b.avg - a.avg; });
    rows.forEach(function (x, i) {
      d.results = d.results.filter(function (r) { return !(r.student_id === x.s.id && r.term === term && r.session === session); });
      d.results.push({ id: 'res-' + x.s.id + '-' + term + session, student_id: x.s.id, class_name: body.className, term: term, session: session, average: x.avg, overall_grade: D.gradeOf(x.avg), class_position: i + 1,
        total_students: rows.length, is_published: true, published_at: D.nowISO(0), created_at: D.nowISO(0), principal_remark: 'Well done. Keep working hard.', teacher_remark: 'Good effort this term.', subject_scores: x.subs });
      n++;
    });
    D.save(); return n;
  }

  // ═════════════════════ ROUTER ═════════════════════
  var routes = [];
  function on(method, re, fn) { routes.push({ m: method, re: new RegExp('^' + re + '$'), fn: fn }); }
  function ctxUser() { var s = uid(); if (!s) return null; return db().profiles[s.id] || null; }

  // shared
  ['student', 'parent', 'teacher'].forEach(function (role) {
    on('POST', '/' + role + '/password', function () { return R({ message: 'Password changed successfully (demo).' }); });
    on('POST', '/' + role + '/notifications/([^/]+)/read', function (c, m) { markRead(c.u.id, m[1]); return R({ message: 'Marked as read.' }); });
  });

  // student
  function needStudent(c) { var st = studentOf(c.u.id); return st || null; }
  on('GET', '/student/profile', function (c) { var st = needStudent(c); if (!st) return E('Student record not found.', 404); return R(studentDash(c.u, st).profile); });
  on('GET', '/student/dashboard', function (c) { var st = needStudent(c); return st ? R(studentDash(c.u, st)) : E('Student record not found.', 404); });
  on('GET', '/student/results', function (c) { return R({ results: results(needStudent(c).id, c.q) }); });
  on('GET', '/student/attendance', function (c) { var r = attRows(needStudent(c).id); return R({ attendance: r, attendanceRate: summarise(r).rate }); });
  on('GET', '/student/notifications', function (c) { return R({ notifications: notes(c.u.id, ['all', 'students'], [needStudent(c).class_name]) }); });
  on('GET', '/student/events', function () { return R({ events: events(['all', 'students']) }); });
  on('GET', '/student/timetable', function (c) { return R({ timetable: timetable(needStudent(c).class_name) }); });
  on('GET', '/student/cbt/exams', function (c) { return R({ exams: cbtFor(needStudent(c)) }); });
  on('GET', '/student/id-card', function (c) { return R(idCardSheet(needStudent(c))); });
  on('GET', '/student/report/([^/]+)', function (c, m) { var st = needStudent(c), r = find(db().results, m[1]); return r && r.student_id === st.id ? R(reportSheet(r, st)) : E('Not found.', 404); });

  // CBT attempts (student)
  on('POST', '/cbt/attempts/start', function (c) {
    var st = needStudent(c), e = find(db().cbtExams, c.b.examId); if (!e || e.class_name !== st.class_name) return E('Test not found.', 404);
    var prev = db().cbtAttempts.filter(function (a) { return a.exam_id === e.id && a.student_id === st.id; })[0];
    if (prev && prev.status === 'submitted') return E('You have already submitted this test.');
    return R({ exam: { id: e.id, title: e.title, subject: e.subject, durationMinutes: e.duration_minutes }, deadline: new Date(Date.now() + e.duration_minutes * 60000).toISOString(), previousAnswers: {},
      questions: (db().cbtQuestions[e.id] || []).map(function (q) { return { id: q.id, questionText: q.questionText, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD }; }) });
  });
  on('POST', '/cbt/attempts/submit', function (c) {
    var st = needStudent(c), qs = db().cbtQuestions[c.b.examId] || [], score = 0, total = 0;
    qs.forEach(function (q) { total += q.marks; if (c.b.answers && c.b.answers[q.id] === q.correctOption) score += q.marks; });
    db().cbtAttempts.push({ id: nextId('att'), exam_id: c.b.examId, student_id: st.id, status: 'submitted', score: score, total_marks: total, submitted_at: D.nowISO(0) }); D.save();
    return R({ score: score, totalMarks: total, message: 'Submitted.' });
  });

  // parent
  function kids(c) { return childrenOf(c.u.id); }
  function pickKid(c, id) { var k = kids(c); return (id && k.filter(function (x) { return x.id === id; })[0]) || null; }
  on('GET', '/parent/profile', function (c) { return R({ user: userBlock(c.u), children: kids(c).map(brief) }); });
  on('PUT', '/parent/profile', function (c) { var p = c.u, b = c.b; if (b.name) p.name = b.name; if (b.phone != null) p.phone = b.phone; if (b.contactEmail) p.contact_email = b.contactEmail; D.save(); return R({ message: 'Profile updated.', user: b }); });
  on('GET', '/parent/dashboard', function (c) { var k = kids(c), child = pickKid(c, c.q.child) || k[0] || null; return R(parentDash(c.u, k, child)); });
  on('GET', '/parent/notifications', function (c) { return R({ notifications: notes(c.u.id, ['all', 'parents'], kids(c).map(function (k) { return k.class_name; })) }); });
  on('GET', '/parent/events', function () { return R({ events: events(['all', 'parents']) }); });
  on('GET', '/parent/children/([^/]+)/results', function (c, m) { var k = pickKid(c, m[1]); return k ? R({ child: brief(k), results: results(k.id, c.q) }) : E('Not found.', 404); });
  on('GET', '/parent/children/([^/]+)/attendance', function (c, m) { var k = pickKid(c, m[1]); if (!k) return E('Not found.', 404); var r = attRows(k.id); return R({ child: brief(k), attendance: r, summary: summarise(r) }); });
  on('GET', '/parent/children/([^/]+)/timetable', function (c, m) { var k = pickKid(c, m[1]); return k ? R({ child: brief(k), timetable: timetable(k.class_name) }) : E('Not found.', 404); });
  on('GET', '/parent/children/([^/]+)/payments', function (c, m) { var k = pickKid(c, m[1]); return k ? R({ child: brief(k), payments: db().payments.filter(function (p) { return p.studentId === k.id; }) }) : E('Not found.', 404); });
  on('GET', '/parent/children/([^/]+)/id-card', function (c, m) { var k = pickKid(c, m[1]); return k ? R(idCardSheet(k)) : E('Not found.', 404); });
  on('GET', '/parent/children/([^/]+)/report/([^/]+)', function (c, m) { var k = pickKid(c, m[1]), r = find(db().results, m[2]); return k && r && r.student_id === k.id ? R(reportSheet(r, k)) : E('Not found.', 404); });
  on('POST', '/payments/initialize', function (c) { return R({ reference: 'DEMO-' + Date.now(), authorizationUrl: '', message: 'Online payment is simulated in the demo.' }); });
  on('POST', '/payments/verify', function (c) {
    var st = find(db().students, (db().payments[0] || {}).studentId); db().payments.push({ id: nextId('pay'), reference: c.b.reference, amountNaira: 95000, term: TERM, session: SESSION, status: 'success', createdAt: D.nowISO(0), studentId: (kids(c)[0] || {}).id }); D.save();
    return R({ status: 'success', message: 'Payment verified (demo).' });
  });
  on('GET', '/payments/history/([^/]+)', function (c, m) { return R({ payments: db().payments.filter(function (p) { return p.studentId === m[1]; }) }); });

  // teacher
  on('GET', '/teacher/profile', function (c) { return R({ user: teacherDash(c.u).profile.user }); });
  on('PUT', '/teacher/profile', function (c) { var p = c.u; if (c.b.name) p.name = c.b.name; if (c.b.phone != null) p.phone = c.b.phone; if (c.b.contactEmail) p.contact_email = c.b.contactEmail; D.save(); return R({ message: 'Profile updated.', user: c.b }); });
  on('GET', '/teacher/dashboard', function (c) { return R(teacherDash(c.u)); });
  on('GET', '/teacher/classes', function (c) { return R({ term: TERM, session: SESSION, classNames: classNamesOf(c.u), classes: classRows(c.u) }); });
  on('GET', '/teacher/students', function (c) {
    return R({ className: c.q.className, students: roster(c.q.className).map(function (s) { return { id: s.id, name: s.student_name, admissionNumber: s.admission_number, gender: s.gender, parentName: s.parent_name, parentPhone: s.parent_phone }; }) });
  });
  on('GET', '/teacher/scores', function (c) {
    var ses = c.q.session || SESSION, term = c.q.term || TERM;
    return R({ className: c.q.className, subject: c.q.subject, term: term, session: ses, students: roster(c.q.className).map(function (s) {
      var sc = db().scores[scoreKey(s.id, ses, term, c.q.subject)];
      return { studentId: s.id, name: s.student_name, admissionNumber: s.admission_number, ca: sc ? sc.ca : null, exam: sc ? sc.exam : null, locked: !!(sc && sc.locked) }; }) });
  });
  on('POST', '/teacher/scores', function (c) {
    var b = c.b, ses = b.session || SESSION, term = b.term || TERM, n = 0;
    (b.scores || []).forEach(function (s) { var k = scoreKey(s.studentId, ses, term, b.subject), old = db().scores[k]; if (old && old.locked) return; db().scores[k] = { ca: Number(s.ca), exam: Number(s.exam), locked: false }; n++; });
    D.save(); return R({ message: 'Saved ' + n + ' score(s).', saved: n, changed: n, term: term, session: ses });
  });
  on('POST', '/teacher/scores/import-preview', function (c) {
    var b = c.b, ses = b.session || SESSION, term = b.term || TERM;
    if (!classNamesOf(c.u).length || !assignmentsOf(c.u).some(function (a) { return a.className === b.className && a.subject === b.subject; })) return E('Not found.', 404);
    var students = roster(b.className).map(function (s) {
      var sc = db().scores[scoreKey(s.id, ses, term, b.subject)];
      return { studentId: s.id, name: s.student_name, admissionNumber: s.admission_number, ca: sc ? sc.ca : null, exam: sc ? sc.exam : null, locked: !!(sc && sc.locked) };
    });
    var out = g.ScoreImport.matchRows(students, b.rows || []);
    return R(Object.assign({ className: b.className, subject: b.subject, term: term, session: ses }, out));
  });
  on('GET', '/teacher/attendance', function (c) {
    return R({ className: c.q.className, date: c.q.date, students: roster(c.q.className).map(function (s) {
      var a = db().attendance.filter(function (x) { return x.student_id === s.id && x.date === c.q.date; })[0];
      return { studentId: s.id, name: s.student_name, admissionNumber: s.admission_number, status: a ? a.status : null, note: a ? a.note || '' : '' }; }) });
  });
  on('POST', '/teacher/attendance', function (c) {
    var b = c.b; (b.entries || []).forEach(function (e) {
      db().attendance = db().attendance.filter(function (x) { return !(x.student_id === e.studentId && x.date === b.date); });
      db().attendance.push({ id: nextId('att'), student_id: e.studentId, class_name: b.className, date: b.date, status: e.status, note: e.note || '' });
    }); D.save(); return R({ message: 'Attendance saved for ' + (b.entries || []).length + ' student(s).', saved: (b.entries || []).length, changed: (b.entries || []).length });
  });
  on('GET', '/teacher/tests', function () { return R({ tests: db().cbtExams.map(briefTest) }); });
  on('POST', '/teacher/tests', function (c) {
    var b = c.b, e = { id: nextId('cbt'), title: b.title, subject: b.subject, class_name: b.className, term: b.term || TERM, session: SESSION, duration_minutes: b.durationMinutes || 20, is_published: false, created_at: D.nowISO(0) };
    db().cbtExams.unshift(e); db().cbtQuestions[e.id] = []; D.save(); return R({ message: 'Test created. Add questions before publishing.', test: briefTest(e) }, 201);
  });
  on('GET', '/teacher/tests/([^/]+)', function (c, m) {
    var e = find(db().cbtExams, m[1]); if (!e) return E('Not found.', 404);
    return R({ test: briefTest(e), questions: db().cbtQuestions[e.id] || [], locked: !!e.is_published || briefTest(e).attemptCount > 0 });
  });
  on('POST', '/teacher/tests/([^/]+)/questions', function (c, m) {
    var b = c.b, list = db().cbtQuestions[m[1]] = db().cbtQuestions[m[1]] || [], q = { id: nextId('q'), position: list.length + 1, questionText: b.questionText, optionA: b.optionA, optionB: b.optionB, optionC: b.optionC, optionD: b.optionD, correctOption: b.correctOption, marks: b.marks || 2 };
    list.push(q); D.save(); return R({ message: 'Question added.', id: q.id }, 201);
  });
  on('DELETE', '/teacher/tests/([^/]+)/questions/([^/]+)', function (c, m) { db().cbtQuestions[m[1]] = (db().cbtQuestions[m[1]] || []).filter(function (q) { return q.id !== m[2]; }); D.save(); return R({ message: 'Question removed.' }); });
  on('PATCH', '/teacher/tests/([^/]+)/publish', function (c, m) { var e = find(db().cbtExams, m[1]); e.is_published = !!c.b.published; D.save(); return R({ message: e.is_published ? 'Test published — students can now see it.' : 'Test unpublished.' }); });
  on('DELETE', '/teacher/tests/([^/]+)', function (c, m) { db().cbtExams = db().cbtExams.filter(function (e) { return e.id !== m[1]; }); D.save(); return R({ message: 'Test deleted.' }); });
  on('GET', '/teacher/tests/([^/]+)/attempts', function (c, m) {
    return R({ attempts: db().cbtAttempts.filter(function (a) { return a.exam_id === m[1]; }).map(function (a) { var s = find(db().students, a.student_id) || {}; return { studentName: s.student_name, admissionNumber: s.admission_number, score: a.score, totalMarks: a.total_marks, status: a.status, submittedAt: a.submitted_at }; }) });
  });
  on('GET', '/teacher/timetable', function (c) { return R({ lessons: teacherLessons(c.u) }); });
  on('GET', '/teacher/notifications', function (c) { return R({ notifications: notes(c.u.id, ['all', 'teachers'], classNamesOf(c.u)) }); });
  on('GET', '/teacher/events', function () { return R({ events: events(['all', 'teachers']) }); });
  on('GET', '/teacher/payslips', function (c) {
    var s = db().salaries[c.u.id] || { basic_kobo: 0, allowances_kobo: 0, deductions_kobo: 0 }, b = s.basic_kobo / 100, a = s.allowances_kobo / 100, d = s.deductions_kobo / 100;
    return R({ payslips: [{ id: 'ps-1', periodMonth: 9, periodYear: 2026, basicNaira: b, allowancesNaira: a, deductionsNaira: d, netNaira: b + a - d, createdAt: D.nowISO(-22) }, { id: 'ps-2', periodMonth: 8, periodYear: 2026, basicNaira: b, allowancesNaira: a, deductionsNaira: d, netNaira: b + a - d, createdAt: D.nowISO(-52) }] });
  });

  // documents / overview (admin)
  on('GET', '/admin/documents/me', function (c) { return R({ user: { id: c.u.id, name: c.u.name, role: c.u.role, mfaEnrolled: ls('tfis_demo_mfa') === '1', mfaRequired: force2fa(), canConfigure: true } }); });
  on('GET', '/admins/2fa-status', function (c) {
    if (c.u.role !== 'superadmin') return E('You do not have permission to do this.', 403);
    return R({ admins: db().admins.map(function (a) { return { id: a.id, name: a.name, role: a.role, email: a.login_email, enrolled: a.id === c.u.id ? ls('tfis_demo_mfa') === '1' : a.id === 'adm-2' }; }) });
  });
  on('POST', '/admins/([^/]+)/reset-2fa', function (c, m) {
    if (c.u.role !== 'superadmin') return E('You do not have permission to do this.', 403);
    if (m[1] === c.u.id) return E('You cannot reset your own two-factor login. Ask another superadmin.');
    var a = find(db().admins, m[1]); return a ? R({ message: 'Two-factor login removed for ' + a.name + '. They must set it up again at their next sign-in.', removed: 1 }) : E('Administrator not found.', 404);
  });
  on('GET', '/admin/documents/settings', function () { return R({ settings: db().docSettings }); });
  on('PUT', '/admin/documents/settings', function (c) { Object.assign(db().docSettings, c.b); D.save(); return R({ message: 'Document settings saved.', settings: db().docSettings }); });
  on('GET', '/admin/documents/grade-scale', function () { return R({ bands: db().gradeScale }); });
  on('POST', '/admin/documents/grade-scale', function (c) { var b = c.b, x = { id: nextId('gs'), min: b.min, max: b.max, min_score: b.min, max_score: b.max, minScore: b.min, maxScore: b.max, grade: b.grade, remark: b.remark, position: db().gradeScale.length + 1 }; db().gradeScale.push(x); D.save(); return R({ message: 'Grade band added.', band: x }, 201); });
  on('PUT', '/admin/documents/grade-scale/reorder', function (c) { var m = {}; db().gradeScale.forEach(function (x) { m[x.id] = x; }); db().gradeScale = (c.b.orderedIds || c.b.ids || []).map(function (id) { return m[id]; }).filter(Boolean); D.save(); return R({ message: 'Order saved.', bands: db().gradeScale }); });
  on('PATCH', '/admin/documents/grade-scale/([^/]+)', function (c, m) { var x = find(db().gradeScale, m[1]); Object.assign(x, c.b); D.save(); return R({ message: 'Grade band updated.', band: x }); });
  on('DELETE', '/admin/documents/grade-scale/([^/]+)', function (c, m) { db().gradeScale = db().gradeScale.filter(function (x) { return x.id !== m[1]; }); D.save(); return R({ message: 'Grade band removed.' }); });
  on('GET', '/admin/documents/traits', function (c) { return R({ traits: db().traits.filter(function (t) { return !c.q.category || t.category === c.q.category; }) }); });
  on('POST', '/admin/documents/traits', function (c) { var t = { id: nextId('tr'), category: c.b.category, name: c.b.name, position: db().traits.length + 1 }; db().traits.push(t); D.save(); return R({ message: 'Trait added.', trait: t }, 201); });
  on('PUT', '/admin/documents/traits/reorder', function (c) { return R({ message: 'Order saved.', traits: db().traits }); });
  on('PATCH', '/admin/documents/traits/([^/]+)', function (c, m) { var t = find(db().traits, m[1]); Object.assign(t, c.b); D.save(); return R({ message: 'Trait updated.', trait: t }); });
  on('DELETE', '/admin/documents/traits/([^/]+)', function (c, m) { db().traits = db().traits.filter(function (t) { return t.id !== m[1]; }); D.save(); return R({ message: 'Trait removed.' }); });
  on('GET', '/admin/documents/students/([^/]+)/id-card', function (c, m) { var s = find(db().students, m[1]); return s ? R(idCardSheet(s)) : E('Not found.', 404); });
  on('GET', '/admin/documents/students/([^/]+)/report/([^/]+)', function (c, m) { var s = find(db().students, m[1]), r = find(db().results, m[2]); return s && r ? R(reportSheet(r, s)) : E('Not found.', 404); });
  on('GET', '/results/student/([^/]+)', function (c, m) { return R({ results: results(m[1], c.q) }); });
  on('GET', '/admin/overview', function () {
    var d = db(), appr = d.students.filter(function (s) { return s.status === 'approved'; }), by = {}, secOf = {}, t = today(), fee = { full: 0, part: 0, not_paid: 0, total: appr.length };
    d.classes.forEach(function (c) { secOf[c.name] = c.section; }); appr.forEach(function (s) { by[secOf[s.class_name] || 'Other'] = (by[secOf[s.class_name] || 'Other'] || 0) + 1; fee[s.fee_status]++; });
    var day = d.attendance.filter(function (a) { return a.date === t; }), ref = day.length ? day : d.attendance.filter(function (a) { return a.date === d.attendance.map(function (x) { return x.date; }).sort().pop(); });
    var cnt = { present: 0, late: 0, absent: 0, excused: 0 }; ref.forEach(function (a) { cnt[a.status]++; });
    return R({ kpis: { totalStudents: appr.length, totalStaff: d.teachers.length, totalClasses: d.classes.length, attendanceRateToday: ref.length ? Math.round((cnt.present + cnt.late) / ref.length * 100) : null, attendanceMarkedToday: ref.length },
      studentsBySection: Object.keys(by).map(function (k) { return { section: k, count: by[k] }; }), attendanceToday: Object.assign({}, cnt, { total: ref.length }), feeSnapshot: fee, recentActivity: d.activity });
  });

  // admin — people
  function teacherOut(p) { return Object.assign({ _id: p.id }, J(p)); }
  on('GET', '/teachers', function () { return R({ teachers: db().teachers.map(teacherOut) }); });
  on('POST', '/teachers', function (c) {
    var b = c.b, p = { id: nextId('tch'), name: b.name, role: 'teacher', staff_id: b.staffId || 'VIFF/T/' + pad(db().teachers.length + 1, 3), contact_email: b.email, login_email: b.email, phone: b.phone || '', assignments: [], must_change_password: false, permissions: [] };
    db().teachers.push(p); db().profiles[p.id] = p; D.save(); return R({ message: 'Teacher registered.', tempPassword: 'Welcome@123', teacher: teacherOut(p) }, 201);
  });
  on('PATCH', '/teachers/([^/]+)', function (c, m) { var p = find(db().teachers, m[1]); if (!p) return E('Not found.', 404); if (c.b.name) p.name = c.b.name; if (c.b.phone) p.phone = c.b.phone; if (c.b.staffId) p.staff_id = c.b.staffId; D.save(); return R({ message: 'Teacher updated.', teacher: teacherOut(p) }); });
  function studOut(s) { var o = J(s); o._id = s.id; o.parentName = s.parent_name || ''; return o; }
  on('GET', '/students', function (c) { return R({ students: db().students.filter(function (s) { return (!c.q.status || s.status === c.q.status) && (!c.q.className || s.class_name === c.q.className); }).map(studOut) }); });
  on('POST', '/students/enrol', function (c) {
    var b = c.b, n = db().students.length + 1, adm = b.admissionNumber || 'VIFF/2026/' + pad(n, 4), id = nextId('stu');
    var s = { id: id, profile_id: id, student_name: b.name, name: b.name, studentName: b.name, admission_number: adm, admissionNumber: adm, class_name: b.className, className: b.className, section: '', gender: b.gender || '', status: 'approved', parent_profile_id: null,
      parent_name: '', parent_phone: b.phone || '', phone: b.phone || '', contact_email: b.email, fee_status: 'not_paid', feeStatus: 'not_paid', session: SESSION };
    db().students.push(s); db().profiles[id] = { id: id, name: b.name, role: 'student', contact_email: b.email, phone: b.phone || '' }; D.save();
    return R({ message: 'Student enrolled.', tempPassword: 'Welcome@123', student: studOut(s) }, 201);
  });
  on('POST', '/students/promote', function (c) { var n = 0; db().students.forEach(function (s) { if ((c.b.studentIds || []).indexOf(s.id) > -1) { s.class_name = s.className = c.b.newClassName; n++; } }); D.save(); return R({ message: n + ' student(s) promoted.', students: db().students.filter(function (s) { return c.b.studentIds.indexOf(s.id) > -1; }).map(studOut) }); });
  // ── admission numbering, enrol, approve and bulk import: the REAL service code, running on the demo data ──
  routes = routes.filter(function (r) { var src = r.re.source.replace(/\\/g, ''); return !(r.m === 'POST' && (src.indexOf('/students/enrol') > -1 || src.indexOf('/decision') > -1)); });
  var NDEPS = { AppError: function (m, st) { var e = new Error(m); e.status = st; return e; }, syntheticEmail: function (n) { return n.replace(/\//g, '-').toLowerCase() + '@students.demo'; },
    tempPassword: function () { var c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', o = ''; for (var i = 0; i < 9; i++) o += c[Math.floor(Math.random() * c.length)]; return o + '#7'; } };
  function nCal() { return { year: new Date().getFullYear(), term: TERM, session: SESSION }; }
  function nDb() { g.DemoAdmissionDb.ensure(); return g.DemoAdmissionDb.db; }
  function nSettings() { return g.AdmissionService.getSettings(nDb(), 'VIFF'); }
  function nFail(e) { return E(e.message || 'Something went wrong.', e.status || 400); }
  on('GET', '/students/numbering', async function (c) {
    var st = await nSettings(), cal = nCal();
    return R({ settings: st, next: await g.AdmissionService.previewNext(nDb(), st, Object.assign({ className: 'JSS 1A' }, cal)), highestUsed: await g.AdmissionService.highestSeq(nDb()), calendar: cal, presets: g.AdmissionNumbers.PRESETS });
  });
  on('PUT', '/students/numbering', async function (c) {
    if (c.u.role !== 'superadmin') return E('You do not have permission to do this.', 403);
    try { var st = await g.AdmissionService.saveSettings(nDb(), c.u.id, c.b, NDEPS); return R({ message: 'Numbering saved. It applies to students added from now on.', settings: st, next: await g.AdmissionService.previewNext(nDb(), st, Object.assign({ className: 'JSS 1A' }, nCal())), highestUsed: await g.AdmissionService.highestSeq(nDb()) }); } catch (e) { return nFail(e); }
  });
  on('POST', '/students/import-preview', async function (c) {
    if (!c.b.rows || !c.b.rows.length) return E('The file has no student rows.'); if (c.b.rows.length > 1000) return E('The file has too many rows (maximum 1000).');
    var st = await nSettings(); return R(Object.assign({ mode: st.mode }, await g.AdmissionService.checkRows(nDb(), st, nCal(), c.b.rows)));
  });
  on('POST', '/students/import', async function (c) {
    if (!c.b.rows || !c.b.rows.length) return E('No rows.'); if (c.b.rows.length > 100) return E('Send at most 100 students at a time.');
    try { return R(await g.AdmissionService.runImport(nDb(), await nSettings(), nCal(), c.b.rows, NDEPS)); } catch (e) { return nFail(e); }
  });
  on('POST', '/students/enrol', async function (c) {
    var b = c.b; if (!b.name || !b.className) return E('Enter the name and class.');
    try {
      var d = await g.AdmissionService.createStudent(nDb(), await nSettings(), nCal(), { name: b.name, className: b.className, email: b.email || '', phone: b.phone || '', gender: b.gender || '', dateOfBirth: b.dateOfBirth || null,
        parentName: b.parentName || '', parentEmail: (b.parentEmail || '').toLowerCase(), parentPhone: b.phone || '', supplied: b.admissionNumber || '' }, NDEPS);
      return R({ message: 'Student enrolled.', tempPassword: d.studentTemp, parentTempPassword: d.parentTemp, parentExisting: d.parentExisting, parentError: d.parentError,
        student: { id: d.student.id, name: d.student.student_name, admissionNumber: d.admissionNumber, className: d.student.class_name } }, 201);
    } catch (e) { return nFail(e); }
  });
  on('POST', '/students/([0-9a-zA-Z-]+)/decision', async function (c, m) {
    var a = find(db().admissions, m[1]); if (!a) return E('Application not found.', 404);
    if (c.b.status === 'rejected') { a.status = 'rejected'; D.save(); return R({ message: 'Application rejected.' }); }
    try {
      var d = await g.AdmissionService.createStudent(nDb(), await nSettings(), nCal(), { name: a.studentName, className: a.classApplied, gender: a.gender, dateOfBirth: null,
        parentName: a.parentName, parentEmail: (a.parentEmail || '').toLowerCase(), parentPhone: a.parentPhone, supplied: c.b.admissionNumber || '' }, NDEPS);
      a.status = 'approved'; D.save();
      return R({ message: 'Application approved.', student: { id: d.student.id, admission_number: d.admissionNumber }, tempPasswords: { student: d.studentTemp, parent: d.parentTemp || undefined } });
    } catch (e) { return nFail(e); }
  });
  function classExists(n) { return db().classes.some(function (x) { return x.name === n; }); }
  on('GET', '/students/(?!pending$)([0-9a-zA-Z-]+)', function (c, m) {
    var s = find(db().students, m[1]); if (!s) return E('Student not found.', 404);
    var rows = attRows(s.id).slice(0, 90), cnt = summarise(rows), lr = results(s.id, {})[0] || null;
    return R({ student: { id: s.id, name: s.student_name, admissionNumber: s.admission_number, className: s.class_name, section: s.section || '', gender: s.gender || '', dateOfBirth: s.date_of_birth || '2013-05-14', admission: { term: s.admission_term || '', session: s.admission_session || '', className: s.admission_class || '' }, address: s.address || '12 Airport Road, Abuja', prevSchool: s.prev_school || 'Bright Stars Academy', status: s.status, createdAt: s.created_at || s.createdAt,
      parent: { name: s.parent_name, relationship: s.parent_rel || 'Parent', phone: s.parent_phone, email: s.parent_email || '' }, fee: { status: s.fee_status, note: s.fee_note || '', paidAt: s.fee_paid_at } },
      attendance: { days: rows.length, present: cnt.present, late: cnt.late, absent: cnt.absent, excused: cnt.excused, rate: cnt.rate },
      latestResult: lr ? { term: lr.term, session: lr.session, average: lr.average, grade: lr.overallGrade, position: lr.position, classSize: lr.classSize } : null });
  });
  on('PATCH', '/students/([0-9a-zA-Z-]+)', function (c, m) {
    var s = find(db().students, m[1]); if (!s) return E('Student not found.', 404); var b = c.b;
    if (!Object.keys(b).length) return E('Nothing to change.');
    if (b.className !== undefined && b.className !== s.class_name && !classExists(b.className)) return E('There is no class called "' + b.className + '". Create it first under Classes.');
    if (b.name) { s.student_name = s.name = s.studentName = b.name; if (db().profiles[s.id]) db().profiles[s.id].name = b.name; }
    if (b.className !== undefined) { s.class_name = s.className = b.className; }
    if (b.gender !== undefined) s.gender = b.gender; if (b.dateOfBirth !== undefined) s.date_of_birth = b.dateOfBirth || null; if (b.address !== undefined) s.address = b.address;
    if (b.parentName !== undefined) s.parent_name = b.parentName; if (b.parentRel !== undefined) s.parent_rel = b.parentRel; if (b.parentPhone !== undefined) { s.parent_phone = s.phone = b.parentPhone; }
    D.save(); return R({ message: 'Student updated.', student: { id: s.id, name: s.student_name, className: s.class_name } });
  });
  on('POST', '/students/([0-9a-zA-Z-]+)/transfer', function (c, m) {
    var s = find(db().students, m[1]); if (!s || s.status !== 'approved') return E('Only enrolled students can be transferred.', 404);
    if (!c.b.reason || c.b.reason.trim().length < 3) return E('Please give a short reason.');
    if (s.class_name === c.b.className) return E('The student is already in that class.', 409);
    if (!classExists(c.b.className)) return E('There is no class called "' + c.b.className + '". Create it first under Classes.');
    var from = s.class_name; s.class_name = s.className = c.b.className; D.save();
    return R({ message: s.student_name + ' moved from ' + from + ' to ' + c.b.className + '.', student: { id: s.id, name: s.student_name, className: s.class_name } });
  });
  on('GET', '/students/pending', function () { return R({ admissions: db().admissions.filter(function (a) { return a.status === 'pending'; }).map(function (a) { return Object.assign({ _id: a.id }, a); }) }); });
  on('POST', '/students/([^/]+)/decision', function (c, m) {
    var a = find(db().admissions, m[1]); if (!a) return E('Application not found.', 404); a.status = c.b.status;
    if (c.b.status === 'approved') {
      var n = db().students.length + 1, adm = 'VIFF/2026/' + pad(n, 4), id = nextId('stu'); a.__adm = adm;
      db().students.push({ id: id, profile_id: id, student_name: a.studentName, name: a.studentName, studentName: a.studentName, admission_number: adm, admissionNumber: adm, class_name: a.classApplied, className: a.classApplied, section: '', gender: a.gender, status: 'approved',
        parent_profile_id: null, parent_name: a.parentName, parent_phone: a.parentPhone, phone: a.parentPhone, fee_status: 'not_paid', feeStatus: 'not_paid', session: SESSION });
      db().profiles[id] = { id: id, name: a.studentName, role: 'student', contact_email: a.parentEmail, phone: a.parentPhone };
    }
    D.save(); return R({ message: 'Application ' + c.b.status + ' successfully.', student: { id: a.id, admission_number: a.__adm || '' }, tempPasswords: c.b.status === 'approved' ? { student: 'Welcome@123', parent: 'Welcome@123' } : undefined });
  });
  on('POST', '/public/admission', function (c) {
    var ref = 'VIFF-APP-' + pad(Math.floor(Math.random() * 999999), 6), b = c.b || {};
    db().admissions.push({ id: nextId('app'), studentName: b.studentName || b.name || 'Applicant', classApplied: b.classApplied || b.className || 'JSS 1A', gender: b.gender || '', parentName: b.parentName || '', parentEmail: b.parentEmail || '', parentPhone: b.parentPhone || '', parentRel: b.parentRel || '', prevSchool: b.prevSchool || '', dateOfBirth: b.dateOfBirth || '', referenceNumber: ref, status: 'pending', createdAt: D.nowISO(0) });
    D.save(); return R({ message: 'Application received.', referenceNumber: ref }, 201);
  });
  on('GET', '/admins', function () { return R({ admins: db().admins.map(function (a) { return Object.assign({ _id: a.id }, J(a)); }) }); });
  on('POST', '/admins', function (c) { var a = { id: nextId('adm'), name: c.b.name, role: 'admin', contact_email: c.b.email, login_email: c.b.email, phone: c.b.phone || '', permissions: [], must_change_password: false }; db().admins.push(a); db().profiles[a.id] = a; D.save(); return R({ message: 'Admin created.', tempPassword: 'Welcome@123' }, 201); });
  on('DELETE', '/admins/([^/]+)', function (c, m) { db().admins = db().admins.filter(function (a) { return a.id !== m[1]; }); D.save(); return R({ message: 'Admin removed.' }); });
  on('POST', '/admins/([^/]+)/reset-password', function () { return R({ message: 'Password reset.', tempPassword: 'Welcome@123' }); });
  on('GET', '/users-roles/permissions', function () { return R({ permissions: db().permissionDefs }); });
  on('GET', '/users-roles/users', function () { return R({ users: db().admins.concat(db().teachers).map(function (u) { return { id: u.id, _id: u.id, name: u.name, role: u.role, permissions: u.permissions || [], isRestricted: (u.permissions || []).length > 0 }; }) }); });
  on('PUT', '/users-roles/users/([^/]+)/permissions', function (c, m) { var u = db().profiles[m[1]]; if (u) u.permissions = c.b.permissions || []; D.save(); return R({ message: 'Permissions saved.', user: { id: m[1], permissions: c.b.permissions } }); });

  // admin — academics
  on('GET', '/classes', function () { return R({ classes: db().classes.map(function (x) { return Object.assign({ _id: x.id, studentCount: roster(x.name).length }, x); }) }); });
  on('POST', '/classes', function (c) { var b = c.b, x = { id: nextId('cls'), name: b.name, level: b.level, arm: b.arm, section: b.section, feeNaira: 0, fee_kobo: 0, formTeacher: '', form_teacher: '' }; db().classes.push(x); db().subjectsByClass[x.name] = db().subjectsByClass['JSS 1A']; D.save(); return R({ message: 'Class added.', class: x }, 201); });
  on('PATCH', '/classes/([^/]+)/form-teacher', function (c, m) { var x = find(db().classes, m[1]); x.formTeacher = x.form_teacher = c.b.formTeacher; D.save(); return R({ message: 'Form teacher assigned.', class: x }); });
  on('PATCH', '/classes/([^/]+)/fee', function (c, m) { var x = find(db().classes, m[1]); x.feeNaira = c.b.feeNaira; x.fee_kobo = c.b.feeNaira * 100; D.save(); return R({ message: 'Class fee updated.', class: x }); });
  on('DELETE', '/classes/([^/]+)', function (c, m) { db().classes = db().classes.filter(function (x) { return x.id !== m[1]; }); D.save(); return R({ message: 'Class removed.' }); });
  on('GET', '/classes/([^/]+)/timetable', function (c, m) { var n = decodeURIComponent(m[1]); return R({ timetable: { className: n, periods: db().timetables[n] || [] } }); });
  on('PUT', '/classes/([^/]+)/timetable', function (c, m) { var n = decodeURIComponent(m[1]); db().timetables[n] = c.b.periods || []; D.save(); return R({ message: 'Timetable saved.', timetable: { className: n, periods: db().timetables[n] } }); });
  on('GET', '/subjects', function () { return R({ subjects: db().subjects.map(function (x) { return Object.assign({ _id: x.id }, x); }) }); });
  on('POST', '/subjects', function (c) { var x = { id: nextId('sub'), name: c.b.name, category: c.b.category, level: c.b.level, compulsory: !!c.b.compulsory }; db().subjects.push(x); D.save(); return R({ message: 'Subject added.', subject: x }, 201); });
  on('DELETE', '/subjects/([^/]+)', function (c, m) { db().subjects = db().subjects.filter(function (x) { return x.id !== m[1]; }); D.save(); return R({ message: 'Subject removed.' }); });
  on('POST', '/results/publish', function (c) { var n = publishClass(c.b); return n ? R({ message: 'Results published for ' + n + ' student(s).', published: n }) : E('No complete scores found for that class and term yet. Enter CA and exam scores first.'); });
  on('GET', '/pins', function () { return R({ pins: db().pins.map(function (p) { return Object.assign({ _id: p.id }, p); }) }); });
  on('POST', '/pins', function (c) { var s = find(db().students, c.b.studentId), p = { id: nextId('pin'), code: 'TF-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), studentName: s ? s.student_name : '', studentId: c.b.studentId, term: c.b.term, session: c.b.session, maxUses: c.b.maxUses, usedCount: 0, isActive: true }; db().pins.push(p); D.save(); return R({ message: 'PIN generated.', pin: p }, 201); });
  on('DELETE', '/pins/([^/]+)', function (c, m) { db().pins = db().pins.filter(function (p) { return p.id !== m[1]; }); D.save(); return R({ message: 'PIN deleted.' }); });
  on('POST', '/notifications', function (c) { var n = { id: nextId('n'), title: c.b.title, message: c.b.message, type: c.b.type || 'info', audience: c.b.audience || 'all', target_class: c.b.targetClass || '', created_at: D.nowISO(0) }; db().notifications.push(n); D.save(); return R({ message: 'Notification sent.', notification: n }, 201); });
  on('GET', '/events', function () { return R({ events: db().events.map(function (e) { return Object.assign({}, e); }) }); });
  on('POST', '/events', function (c) { var e = Object.assign({ id: nextId('ev'), created_at: D.nowISO(0) }, c.b); db().events.push(e); D.save(); return R({ message: 'Event created.', event: e }, 201); });
  on('PATCH', '/events/([^/]+)', function (c, m) { var e = find(db().events, m[1]); Object.assign(e, c.b); D.save(); return R({ message: 'Event updated.', event: e }); });
  on('DELETE', '/events/([^/]+)', function (c, m) { db().events = db().events.filter(function (e) { return e.id !== m[1]; }); D.save(); return R({ message: 'Event deleted.' }); });
  on('GET', '/id-cards', function (c) { return R({ cards: db().idCards.filter(function (x) { return (!c.q.holderType || x.holder_type === c.q.holderType) && (!c.q.status || x.status === c.q.status); }).map(function (x) { return Object.assign({ _id: x.id }, x); }) }); });
  on('POST', '/id-cards', function (c) {
    var s = find(db().students, c.b.holderId) || find(db().teachers, c.b.holderId) || {}, n = 'VIFF-ID-' + pad(1000 + db().idCards.length + 1, 5);
    var x = { id: nextId('idc'), card_number: n, cardNumber: n, holder_type: c.b.holderType, holderType: c.b.holderType, holder_id: c.b.holderId, full_name: s.student_name || s.name, fullName: s.student_name || s.name, class_name: s.class_name || '', className: s.class_name || '', identifier: s.admission_number || s.staff_id || '', status: 'active', photo_url: '', issued_at: D.nowISO(0), expires_at: D.nowISO(365) };
    db().idCards.push(x); D.save(); return R({ message: 'ID card generated.', card: x }, 201);
  });
  on('PATCH', '/id-cards/([^/]+)/revoke', function (c, m) { var x = find(db().idCards, m[1]); x.status = 'revoked'; D.save(); return R({ message: 'ID card revoked.', card: x }); });
  on('DELETE', '/id-cards/([^/]+)', function (c, m) { db().idCards = db().idCards.filter(function (x) { return x.id !== m[1]; }); D.save(); return R({ message: 'ID card deleted.' }); });

  // admin — finance
  on('GET', '/fees', function () { return R({ students: db().students.filter(function (s) { return s.status === 'approved'; }).map(studOut) }); });
  on('PATCH', '/fees/([^/]+)', function (c, m) { var s = find(db().students, m[1]); s.fee_status = s.feeStatus = c.b.feeStatus; s.fee_note = s.feeNote = c.b.feeNote || ''; s.fee_paid_at = c.b.feeStatus === 'full' ? D.nowISO(0) : null; D.save(); return R({ message: 'Fee status updated.', student: studOut(s) }); });
  on('GET', '/finance/overview', function () {
    var per = db().classes.map(function (cl) {
      var r = roster(cl.name), f = { full: 0, part: 0, not_paid: 0 }; r.forEach(function (s) { f[s.fee_status]++; });
      return { className: cl.name, students: r.length, full: f.full, part: f.part, notPaid: f.not_paid, expectedNaira: r.length * cl.feeNaira };
    }).filter(function (x) { return x.students > 0; });
    var online = db().ledger.filter(function (e) { return e.source === 'online' && !e.voided; }).reduce(function (a, b) { return a + b.amountNaira; }, 0) + db().payments.reduce(function (a, b) { return a + b.amountNaira; }, 0);
    return R({ expectedNaira: per.reduce(function (a, b) { return a + b.expectedNaira; }, 0), collectedOnlineNaira: online, partCount: per.reduce(function (a, b) { return a + b.part; }, 0), notPaidCount: per.reduce(function (a, b) { return a + b.notPaid; }, 0), perClass: per });
  });
  on('GET', '/settings/online-payments', function () { return R({ enabled: db().onlinePayments }); });
  on('PUT', '/settings/online-payments', function (c) { db().onlinePayments = !!c.b.enabled; D.save(); return R({ message: db().onlinePayments ? 'Online payments enabled.' : 'Online payments disabled.', enabled: db().onlinePayments }); });
  function ledgerAll(q) {
    var manual = db().ledger.filter(function (e) { return (q.includeVoided === '1' || !e.voided) && (!q.from || e.date >= q.from) && (!q.to || e.date <= q.to); }).map(function (e) { return Object.assign({ source: 'manual' }, e); });
    var online = q.type === 'expense' ? [] : db().payments.filter(function (p) { var d = String(p.createdAt).slice(0, 10); return p.status === 'success' && (!q.from || d >= q.from) && (!q.to || d <= q.to); }).map(function (p) {
      var st = find(db().students, p.studentId) || {};
      return { id: p.id, source: 'online_payment', date: String(p.createdAt).slice(0, 10), type: 'income', category: 'Tuition (online)', description: 'Online payment - ' + (st.student_name || 'Student') + ' (' + p.term + ')', amountNaira: p.amountNaira, method: 'online', reference: p.reference, voided: false, voidReason: '' };
    });
    var all = manual.concat(online); if (q.type) all = all.filter(function (e) { return e.type === q.type; });
    return all.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  on('GET', '/ledger/categories', function () { return R({ categories: db().ledgerCategories }); });
  on('GET', '/ledger/summary', function (c) {
    var l = ledgerAll({ from: c.q.from, to: c.q.to }), i = 0, x = 0, on = 0, mn = 0;
    l.forEach(function (e) { if (e.type === 'income') i += e.amountNaira; else x += e.amountNaira; if (e.source === 'online_payment') on++; else mn++; });
    return R({ totalIncomeNaira: i, totalExpenseNaira: x, netBalanceNaira: i - x, onlinePaymentCount: on, manualEntryCount: mn });
  });
  on('GET', '/ledger', function (c) { return R({ entries: ledgerAll(c.q).map(function (e) { return Object.assign({ _id: e.id }, e); }) }); });
  on('POST', '/ledger', function (c) {
    var b = c.b; if (!(b.amountNaira > 0)) return E('Amount must be greater than zero.');
    var e = { id: nextId('led'), source: 'manual', type: b.entryType, entryType: b.entryType, category: b.category, description: b.description || '', amountNaira: b.amountNaira, method: b.method || 'cash', date: b.entryDate || today(), entryDate: b.entryDate || today(), voided: false, voidReason: '', reference: b.reference || '' };
    db().ledger.push(e); D.save(); return R({ message: 'Entry recorded.', entry: e }, 201);
  });
  on('POST', '/ledger/([^/]+)/void', function (c, m) {
    var e = find(db().ledger, m[1]); if (!e) return E('Entry not found (only manual entries can be voided here).', 404); if (e.voided) return E('This entry has already been voided.', 409);
    if (!c.b.reason || c.b.reason.trim().length < 3) return E('Say why this entry is being voided.');
    e.voided = true; e.voidReason = c.b.reason.trim(); D.save(); return R({ message: 'Entry voided.', entry: e });
  });

  // admin — transport & payroll
  on('GET', '/transport/routes', function () { return R({ routes: db().transportRoutes.map(function (r) { return Object.assign({ _id: r.id }, r); }) }); });
  on('POST', '/transport/routes', function (c) { var b = c.b, r = { id: nextId('rt'), name: b.name, description: b.description, driver_name: b.driverName, driver_phone: b.driverPhone, vehicle_plate: b.vehiclePlate, capacity: b.capacity, fee_kobo: (b.feeNaira || 0) * 100, is_active: true }; db().transportRoutes.push(r); D.save(); return R({ message: 'Route added.', route: r }, 201); });
  on('PATCH', '/transport/routes/([^/]+)/toggle-active', function (c, m) { var r = find(db().transportRoutes, m[1]); r.is_active = !r.is_active; D.save(); return R({ message: 'Route updated.', route: r }); });
  on('PATCH', '/transport/routes/([^/]+)', function (c, m) { var r = find(db().transportRoutes, m[1]); Object.assign(r, c.b); D.save(); return R({ message: 'Route updated.', route: r }); });
  on('DELETE', '/transport/routes/([^/]+)', function (c, m) { db().transportRoutes = db().transportRoutes.filter(function (r) { return r.id !== m[1]; }); D.save(); return R({ message: 'Route deleted.' }); });
  on('GET', '/transport/assignments', function (c) { return R({ assignments: db().transportAssignments.filter(function (a) { return !c.q.routeId || a.routeId === c.q.routeId; }).map(function (a) { return Object.assign({ _id: a.id }, a); }) }); });
  on('POST', '/transport/assignments', function (c) { var s = find(db().students, c.b.studentId) || {}, a = { id: nextId('ta'), routeId: c.b.routeId, studentId: c.b.studentId, pickupPoint: c.b.pickupPoint, studentName: s.student_name, className: s.class_name }; db().transportAssignments.push(a); D.save(); return R({ message: 'Student assigned.', assignment: a }, 201); });
  on('DELETE', '/transport/assignments/([^/]+)', function (c, m) { db().transportAssignments = db().transportAssignments.filter(function (a) { return a.id !== m[1]; }); D.save(); return R({ message: 'Assignment removed.' }); });
  on('GET', '/transport/assignments/mine/([^/]+)', function (c, m) {
    var a = db().transportAssignments.filter(function (x) { return x.studentId === m[1]; })[0], r = a ? find(db().transportRoutes, a.routeId) : null;
    return R({ assignment: r ? { routeName: r.name, driverName: r.driver_name, driverPhone: r.driver_phone, vehiclePlate: r.vehicle_plate, pickupPoint: a.pickupPoint } : null });
  });
  on('GET', '/payroll/staff', function () {
    return R({ staff: db().teachers.concat(db().admins).map(function (p) { var s = db().salaries[p.id]; return { profileId: p.id, id: p.id, name: p.name, role: p.role, salary: s || null }; }) });
  });
  on('PUT', '/payroll/staff/([^/]+)', function (c, m) { var b = c.b, s = db().salaries[m[1]] = { basic_kobo: b.basicNaira * 100, allowances_kobo: b.allowancesNaira * 100, deductions_kobo: b.deductionsNaira * 100, bank_name: b.bankName, bank_account: b.bankAccount }; D.save(); return R({ message: 'Salary saved.', salary: s }); });
  on('GET', '/payroll/runs', function () { return R({ runs: db().payrollRuns.map(function (r) { return Object.assign({ _id: r.id }, r); }) }); });
  on('POST', '/payroll/runs', function (c) { var r = { id: nextId('run'), period_month: c.b.periodMonth, period_year: c.b.periodYear, status: 'draft', created_at: D.nowISO(0) }; db().payrollRuns.push(r); D.save(); return R({ message: 'Payroll run created.', run: r }, 201); });
  on('PATCH', '/payroll/runs/([^/]+)/finalize', function (c, m) { var r = find(db().payrollRuns, m[1]); r.status = 'finalized'; D.save(); return R({ message: 'Payroll finalized.', run: r }); });
  on('GET', '/payroll/runs/([^/]+)/payslips', function () {
    return R({ payslips: db().teachers.map(function (t) { var s = db().salaries[t.id]; return { id: 'ps-' + t.id, profileId: t.id, name: t.name, basic_kobo: s.basic_kobo, allowances_kobo: s.allowances_kobo, deductions_kobo: s.deductions_kobo, net_kobo: s.basic_kobo + s.allowances_kobo - s.deductions_kobo }; }) });
  });
  on('GET', '/payroll/my-payslips', function (c) { return R({ payslips: [] }); });
  on('GET', '/settings/site-content', function () { return R({ settings: db().siteSettings || {} }); });
  on('PUT', '/settings/site-content', function (c) { db().siteSettings = Object.assign(db().siteSettings || {}, c.b); D.save(); return R({ message: 'Settings saved.', settings: db().siteSettings }); });
  on('GET', '/attendance/class/([^/]+)/([^/]+)', function (c, m) { return R({ attendance: db().attendance.filter(function (a) { return a.class_name === decodeURIComponent(m[1]) && a.date === m[2]; }) }); });
  on('GET', '/attendance/student/([^/]+)', function (c, m) { var r = attRows(m[1]); return R({ attendance: r, attendanceRate: summarise(r).rate }); });
  on('POST', '/attendance/mark', function (c) { var b = c.b; db().attendance = db().attendance.filter(function (x) { return !(x.student_id === b.studentId && x.date === b.date); }); var a = { id: nextId('att'), student_id: b.studentId, class_name: b.className, date: b.date, status: b.status, note: b.note || '' }; db().attendance.push(a); D.save(); return R({ message: 'Attendance marked.', attendance: a }); });

  // ═════════════════════ replace the network layer ═════════════════════
  g.apiRequest = async function (method, path, body) {
    var u = ctxUser();
    var isPublic = /^\/(public\/|settings\/site-content|events)/.test(path.split('?')[0]) && (method === 'GET' || /^\/public\//.test(path));
    if (!u && !isPublic) return E('Please sign in.', 401);
    if (u && (u.role === 'admin' || u.role === 'superadmin')) {                    // simulate the server's 2FA rules (only when switched on)
      var enrolled = ls('tfis_demo_mfa') === '1', isMe = path.split('?')[0] === '/admin/documents/me';
      if (enrolled && ls('tfis_demo_aal2') !== '1' && !isMe) { try { g.localStorage.removeItem('tfis_demo_session'); } catch (e) { } g.location.href = 'login.html?reason=mfa'; return E('Please complete two-factor verification.', 401); }
      if (force2fa() && !enrolled && !isMe) { g.location.href = 'setup-2fa.html'; return E('Two-factor login is required for administrators.', 403); }
    }
    var qi = path.indexOf('?'), p = qi > -1 ? path.slice(0, qi) : path, q = {};
    if (qi > -1) new URLSearchParams(path.slice(qi + 1)).forEach(function (v, k) { q[k] = v; });
    p = p.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i]; if (r.m !== method) continue; var m = r.re.exec(p);
      if (m) { try { return await wait(r.fn({ u: u, q: q, b: body || {} }, m)); } catch (e) { console.warn('[demo] handler error', method, path, e); return E('Demo data not available for this action.', 500); } }
    }
    console.warn('[demo] no hardcoded route for', method, path);
    return R({ message: 'Done (demo).' });
  };
  // Photo reading is SIMULATED in the demo (the real build reads the photo with Tesseract on the server).
  g.DEMO_UPLOAD = async function (path, fd) {
    var u = ctxUser(); if (!u) return E('Please sign in.', 401);
    if (path !== '/teacher/scores/photo-preview') return E('Not available in the demo.', 404);
    var className = fd.get('className'), subject = fd.get('subject'), ses = fd.get('session') || SESSION, term = fd.get('term') || TERM;
    if (!assignmentsOf(u).some(function (a) { return a.className === className && a.subject === subject; })) return E('Not found.', 404);
    await new Promise(function (res) { setTimeout(res, 1400); });
    var students = roster(className).map(function (s) {
      var sc = db().scores[scoreKey(s.id, ses, term, subject)];
      return { studentId: s.id, name: s.student_name, admissionNumber: s.admission_number, ca: sc ? sc.ca : null, exam: sc ? sc.exam : null, locked: !!(sc && sc.locked) };
    });
    var rows = students.map(function (s, i) { return { line: i + 2, admissionNumber: s.admissionNumber, name: s.name, ca: 18 + ((i * 7) % 22), exam: 25 + ((i * 11) % 34) }; });
    if (rows.length > 3) { rows[2].exam = '4?'; rows.pop(); }
    var out = g.ScoreImport.matchRows(students, rows);
    out.rows.forEach(function (r) { if (r.status === 'ok') r.check = true; });
    return R(Object.assign({ className: className, subject: subject, term: term, session: ses }, out, { ocr: { engine: 'demo-simulated' } }));
  };
  // direct-session helpers
  g.getUser = async function () { var u = ctxUser(); return u ? Object.assign({ _id: u.id }, u, { email: u.contact_email, mustChangePassword: false }) : null; };
  g.changePassword = async function () { return R({ message: 'Password changed successfully (demo).' }); };
  g.getMyStudentId = async function () { var u = ctxUser(), s = u && studentOf(u.id); return s ? R({ studentId: s.id }) : E('Student record not found.', 404); };
  g.getTeacherAssignments = async function (id) { var p = db().profiles[id]; return R({ assignments: (p && p.assignments) || [] }); };
  g.saveTeacherAssignments = async function (id, a) { var p = db().profiles[id]; if (p) p.assignments = a; D.save(); return R({ message: 'Assignments saved.', assignments: a }); };
  g.getStudentProfile = async function () { var u = ctxUser(), s = u && studentOf(u.id); return s ? R({ user: Object.assign({ _id: u.id }, u), student: Object.assign({ _id: s.id }, s) }) : E('Profile not found.', 404); };
  // CBT management (teacher/admin) – legacy direct-DB wrappers
  g.listCbtExams = async function (cls) { return R({ exams: db().cbtExams.filter(function (e) { return !cls || e.class_name === cls; }).map(function (e) { return Object.assign({ _id: e.id }, e); }) }); };
  g.getCbtExamQuestions = async function (id) { return R({ questions: (db().cbtQuestions[id] || []).map(function (q) { return Object.assign({ _id: q.id, question_text: q.questionText, option_a: q.optionA, option_b: q.optionB, option_c: q.optionC, option_d: q.optionD, correct_option: q.correctOption }, q); }) }); };
  g.getCbtExamAttempts = async function (id) { return R({ attempts: db().cbtAttempts.filter(function (a) { return a.exam_id === id; }).map(function (a) { var s = find(db().students, a.student_id) || {}; return Object.assign({ _id: a.id, students: { student_name: s.student_name, admission_number: s.admission_number } }, a); }) }); };
  g.toggleCbtExamPublished = async function (id, pub) { var e = find(db().cbtExams, id); if (e) e.is_published = !!pub; D.save(); return R(e); };
  g.deleteCbtExam = async function (id) { db().cbtExams = db().cbtExams.filter(function (e) { return e.id !== id; }); D.save(); return R({}); };
  g.getAvailableCbtExams = async function () { var u = ctxUser(), s = u && studentOf(u.id); return s ? R({ exams: cbtFor(s).map(function (e) { return Object.assign({ _id: e.id }, e); }) }) : E('Student record not found.', 404); };
  g.getSiteSettings = async function () { return R({ settings: Object.assign({}, g.SITE_CONTENT_DEFAULTS || {}, db().siteSettings || {}) }); };
  g.uploadSiteImage = async function () { return E('Image upload is disabled in the demo.'); };
  g.apiUpload = async function () { return E('File upload is disabled in the demo.'); };

  // ── demo conveniences ──
  g.demoReset = function () { try { g.localStorage.removeItem(D.STORE_KEY); } catch (e) { } g.location.reload(); };
  // Demo ribbon (bottom-left): shows demo mode + reset button
  if (g.document && g.document.addEventListener) g.document.addEventListener('DOMContentLoaded', function () {
    if (/login\.html$/.test(g.location.pathname)) return;
    var b = g.document.createElement('div');
    b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;background:#0b1f5c;color:#fff;font:600 11px Outfit,system-ui,sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.3);opacity:.92';
    b.innerHTML = 'DEMO MODE · hardcoded data &nbsp;<a href="#" style="color:#8dc63f" onclick="demoReset();return false">reset</a>';
    g.document.body.appendChild(b);
  });
})(window);
