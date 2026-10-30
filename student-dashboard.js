// ══════════════════════════════════════════════════════════════
//  VIFF — student-dashboard.js
//  Renders the student Overview from ONE backend call
//  (GET /api/student/dashboard). Every value is inserted with
//  textContent through TFIS.h(), never innerHTML.
//
//  Nothing here is invented: if the school has not entered a
//  result, timetable or event yet, that card says so plainly.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var T = global.TFIS;
  var h = T.h, icon = T.icon;

  // ── navigation helper (uses the page's own showPage) ─────────
  function goTo(id) {
    var btn = document.querySelector('.nav-item[data-page="' + id + '"]');
    global.showPage(id, btn);
  }

  function linkButton(label, page) {
    return h('button', { type: 'button', 'class': 'ui-link', onclick: function () { goTo(page); } }, label, icon('arrow'));
  }

  function card(title, headRight, body, extraBodyClass) {
    return h('section', { 'class': 'ui-card' },
      h('div', { 'class': 'ui-card-head' }, h('h3', null, title), headRight || null),
      h('div', { 'class': 'ui-card-body' + (extraBodyClass ? ' ' + extraBodyClass : '') }, body));
  }

  function empty(text) { return h('div', { 'class': 'ui-empty' }, text); }

  // A KPI tile. When `page` is given the tile is a real <button>
  // (keyboard-focusable) that jumps to that section.
  function kpi(tone, iconName, label, value, sub, subTone, page) {
    var props = page
      ? { 'class': 'ui-kpi ui-kpi-btn', type: 'button', onclick: function () { goTo(page); } }
      : { 'class': 'ui-kpi' };
    return h(page ? 'button' : 'div', props,
      h('div', { 'class': 'ui-kpi-ico tone-' + tone }, icon(iconName)),
      h('div', { 'class': 'ui-kpi-body' },
        h('div', { 'class': 'ui-kpi-label' }, label),
        h('div', { 'class': 'ui-kpi-value' }, value),
        sub ? h('div', { 'class': 'ui-kpi-sub' + (subTone ? ' ui-sub-' + subTone : '') }, sub) : null));
  }

  // ── loading skeleton ─────────────────────────────────────────
  function skeleton() {
    var kpis = h('div', { 'class': 'ui-kpis' });
    for (var i = 0; i < 4; i++) {
      var s = h('div', { 'class': 'ui-kpi' }, h('div', { 'class': 'ui-skel' }), h('div', { 'class': 'ui-skel' }));
      s.firstChild.style.cssText = 'width:46px;height:46px;border-radius:50%';
      s.lastChild.style.cssText = 'height:38px;flex:1';
      kpis.appendChild(s);
    }
    var block = h('div', { 'class': 'ui-skel' });
    block.style.cssText = 'height:260px;border-radius:14px';
    return h('div', null, kpis, block);
  }

  // ── cards ────────────────────────────────────────────────────
  function termLabel(term) { return term ? term.term + ' Term · ' + term.session : ''; }

  function academicCard(d) {
    var r = d.latestResult;
    if (!r) {
      return card('Academic overview', null,
        empty('Your results will appear here once your teachers upload scores and the school publishes them.'));
    }
    var rows = r.subjects.map(function (s) {
      var pct = Math.max(0, Math.min(100, Number(s.total) || 0));
      var bar = h('div', { 'class': 'ui-bar' }, h('span'));
      bar.firstChild.style.width = pct + '%';
      return h('tr', null,
        h('td', null, s.subject),
        h('td', { 'class': 'num' }, T.fmtNumber(s.ca, 1)),
        h('td', { 'class': 'num' }, T.fmtNumber(s.exam, 1)),
        h('td', null, h('strong', null, T.fmtNumber(s.total, 1)), bar),
        h('td', null, h('span', { 'class': 'ui-badge tone-' + T.gradeTone(s.grade) }, s.grade)));
    });
    var table = h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null,
        h('th', null, 'Subject'), h('th', { 'class': 'num' }, 'C.A (40)'), h('th', { 'class': 'num' }, 'Exam (60)'),
        h('th', null, 'Total'), h('th', null, 'Grade'))),
      h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 5 }, 'No subject scores recorded.')))));
    return card('Academic overview — ' + termLabel({ term: r.term, session: r.session }),
      linkButton('Full report', 'results'), table, 'flush');
  }

  function attendanceCard(d) {
    var a = d.attendance;
    var body;
    if (!a.total) {
      body = empty('No attendance has been recorded for you yet.');
    } else {
      var legend = [
        ['Present', a.present, '#12833f'], ['Late', a.late, '#e0a100'],
        ['Absent', a.absent, '#c22f2b'], ['Excused', a.excused, '#2456c9'],
      ].filter(function (x) { return x[1] > 0; });
      body = h('div', { 'class': 'ui-donut-row' },
        T.donut(legend.map(function (x) { return { value: x[1], color: x[2] }; }),
          { top: a.rate + '%', bottom: 'present' }, { label: 'Attendance ' + a.rate + ' percent' }),
        h('ul', { 'class': 'ui-legend' }, legend.map(function (x) {
          var dot = h('span', { 'class': 'dot' }); dot.style.background = x[2];
          return h('li', null, dot, x[0], h('span', { 'class': 'val' }, x[1] + (x[1] === 1 ? ' day' : ' days')));
        })));
    }
    return card('Attendance', linkButton('Details', 'attendance'), body);
  }

  function testsCard(d) {
    var body;
    if (!d.recentTests.length) {
      body = empty(d.kpis.pendingTests ? 'You have not completed a test yet.' : 'No tests taken yet.');
    } else {
      body = h('ul', { 'class': 'ui-list' }, d.recentTests.map(function (t) {
        var pct = t.totalMarks ? Math.round((t.score / t.totalMarks) * 100) : null;
        return h('li', null,
          h('div', { 'class': 'ui-li-ico tone-purple' }, icon('test')),
          h('div', { 'class': 'ui-li-main' },
            h('div', { 'class': 'ui-li-title' }, t.title),
            h('div', { 'class': 'ui-li-meta' }, [t.subject, T.fmtDate(t.submittedAt)].filter(Boolean).join(' · '))),
          h('div', { 'class': 'ui-li-end' }, t.score + ' / ' + t.totalMarks,
            pct === null ? null : h('div', { 'class': 'ui-li-meta' }, pct + '%')));
      }));
    }
    return card('Recent tests', linkButton('CBT tests', 'cbt'), body);
  }

  function timetableCard(d) {
    var periods = d.today.periods;
    var body;
    if (!periods.length) {
      var weekend = d.today.weekday === 'Saturday' || d.today.weekday === 'Sunday';
      body = empty(weekend ? 'No lessons on ' + d.today.weekday + '.' : 'No timetable has been set for ' + d.today.weekday + '.');
    } else {
      body = h('ul', { 'class': 'ui-tt' }, periods.map(function (p) {
        return h('li', null,
          h('span', { 'class': 'time' }, p.period || '—'),
          h('span', null, p.subject || '—'),
          h('span', { 'class': 'who' }, p.teacher || ''));
      }));
    }
    return card('Today\u2019s timetable \u2014 ' + d.today.weekday, linkButton('Full timetable', 'timetable'), body);
  }

  function announcementsCard(d) {
    var body;
    if (!d.notifications.length) {
      body = empty('No announcements yet.');
    } else {
      body = h('ul', { 'class': 'ui-list' }, d.notifications.map(function (n) {
        return h('li', null,
          h('div', { 'class': 'ui-li-ico tone-blue' }, icon('megaphone')),
          h('div', { 'class': 'ui-li-main' },
            h('div', { 'class': 'ui-li-title' }, n.title, n.isRead ? null : h('span', { 'class': 'ui-unread', title: 'New' })),
            h('div', { 'class': 'ui-li-text ui-clamp' }, n.message),
            h('div', { 'class': 'ui-li-meta' }, T.fmtDate(n.createdAt))));
      }));
    }
    return card('Announcements', linkButton('View all', 'notifications'), body);
  }

  function eventsCard(d) {
    var body;
    if (!d.events.length) {
      body = empty('No upcoming events.');
    } else {
      body = h('ul', { 'class': 'ui-list' }, d.events.map(function (e) {
        var dt = new Date(e.date + 'T00:00:00');
        var box = isNaN(dt.getTime())
          ? h('div', { 'class': 'ui-datebox' }, h('b', null, '—'))
          : h('div', { 'class': 'ui-datebox' }, h('b', null, String(dt.getDate())), h('span', null, dt.toLocaleString('en-GB', { month: 'short' })));
        return h('li', null, box,
          h('div', { 'class': 'ui-li-main' },
            h('div', { 'class': 'ui-li-title' }, e.title),
            h('div', { 'class': 'ui-li-meta' }, [e.time, e.location].filter(Boolean).join(' · ') || T.fmtDate(e.date))));
      }));
    }
    return card('Upcoming events', linkButton('All events', 'events'), body);
  }

  function feesCard(d) {
    var f = d.fees;
    var tone = f.status === 'full' ? 'green' : f.status === 'part' ? 'amber' : 'red';
    var rows = [
      h('div', { 'class': 'ui-fee-row' }, h('span', null, 'Status'), h('span', { 'class': 'ui-badge tone-' + tone }, f.label)),
    ];
    if (f.classFeeNaira !== null) rows.push(h('div', { 'class': 'ui-fee-row' }, h('span', null, 'Class fee'), h('span', null, T.fmtNaira(f.classFeeNaira))));
    if (f.paidAt) rows.push(h('div', { 'class': 'ui-fee-row' }, h('span', null, 'Last payment'), h('span', null, T.fmtDate(f.paidAt))));
    if (f.note) rows.push(h('div', { 'class': 'ui-fee-note' }, f.note));
    if (f.status !== 'full') rows.push(h('div', { 'class': 'ui-fee-note' }, 'School fees are paid by your parent or guardian.'));
    return card('School fees', null, rows);
  }

  function quickCard() {
    function q(page, iconName, label) {
      return h('button', { type: 'button', onclick: function () { goTo(page); } }, icon(iconName), label);
    }
    return card('Quick links', null, h('div', { 'class': 'ui-quick' },
      q('results', 'results', 'My results'),
      q('attendance', 'calendar', 'Attendance'),
      q('cbt', 'test', 'CBT tests'),
      q('timetable', 'clock', 'Timetable'),
      q('events', 'calendar', 'Events'),
      h('a', { href: 'results.html' }, icon('lock'), 'PIN result check')));
  }

  // ── page assembly ────────────────────────────────────────────
  function render(d) {
    var first = (d.profile.user.name || '').trim().split(/\s+/)[0] || 'there';
    var k = d.kpis;

    var kpis = h('div', { 'class': 'ui-kpis' },
      kpi('amber', 'bars', 'Term average',
        k.average === null ? '—' : T.fmtNumber(k.average, 1) + '%',
        k.overallGrade ? 'Grade ' + k.overallGrade : 'Not published yet', null, 'results'),
      kpi('blue', 'trophy', 'Class position',
        k.position ? T.ordinal(k.position) : '—',
        k.classSize ? 'out of ' + k.classSize + ' students' : 'Not published yet', null, 'results'),
      kpi('green', 'calendar', 'Attendance',
        k.attendanceRate === null ? '—' : k.attendanceRate + '%',
        k.attendanceRate === null ? 'Nothing recorded yet' : d.attendance.present + d.attendance.late + ' of ' + d.attendance.total + ' days',
        k.attendanceRate !== null && k.attendanceRate < 75 ? 'red' : null, 'attendance'),
      kpi('purple', 'test', 'Pending tests', String(k.pendingTests),
        k.pendingTests ? 'Waiting for you' : 'All caught up', null, 'cbt'));

    var head = h('div', { 'class': 'ui-head' },
      h('div', null,
        h('h2', null, T.greeting() + ', ' + first),
        h('p', null, [d.profile.student.className, d.profile.student.admissionNumber].filter(Boolean).join(' · ') || 'Here is your school overview.')));

    return h('div', null, d.profile.user.isDemo ? T.demoNotice() : null, head, kpis,
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' },
          academicCard(d),
          h('div', { 'class': 'ui-pair' }, attendanceCard(d), testsCard(d)),
          timetableCard(d)),
        h('div', { 'class': 'ui-stack' },
          announcementsCard(d), eventsCard(d), feesCard(d), quickCard())));
  }

  function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }

  function applyChrome(d) {
    setText('s-class', d.profile.student.className || 'Student');
    setText('profile-meta', [d.profile.student.className && 'Class: ' + d.profile.student.className,
      d.profile.student.admissionNumber && 'Adm: ' + d.profile.student.admissionNumber].filter(Boolean).join(' · '));

    var chip = document.getElementById('topbar-term');
    if (chip) {
      if (d.term) { chip.textContent = termLabel(d.term); chip.style.display = ''; } else { chip.style.display = 'none'; }
    }
    var unread = d.kpis.unreadNotifications;
    var badge = document.getElementById('notif-badge');
    var bell = document.getElementById('topbar-bell-count');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }
    if (bell) { bell.textContent = unread > 9 ? '9+' : unread; bell.style.display = unread > 0 ? '' : 'none'; }
  }

  function errorState(box, message, canRetry) {
    var kids = [h('p', null, message)];
    if (canRetry) kids.push(h('button', { type: 'button', 'class': 'btn btn-gold', onclick: load }, 'Try again'));
    T.clear(box).appendChild(h('div', { 'class': 'ui-error' }, kids));
  }

  async function load() {
    var box = document.getElementById('overview-body');
    T.clear(box).appendChild(skeleton());

    var r = await global.StudentAPI.dashboard();
    if (!r.ok) {
      if (r.status === 404) return errorState(box, 'Your student record is not linked to this account yet. Please contact the school office.', false);
      if (r.status === 403) return errorState(box, r.data && r.data.message ? r.data.message : 'You do not have access to this page.', false);
      return errorState(box, r.status === 0 ? r.data.message : 'We could not load your dashboard. Please try again.', true);
    }
    try {
      applyChrome(r.data);
      T.clear(box).appendChild(render(r.data));
    } catch (e) {
      errorState(box, 'Something went wrong showing your dashboard. Please try again.', true);
    }
  }

  global.StudentOverview = { load: load, goTo: goTo };
})(window);
