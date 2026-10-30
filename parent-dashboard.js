// ══════════════════════════════════════════════════════════════
//  VIFF — parent-dashboard.js
//  The whole parent portal. Every value is inserted with textContent
//  through TFIS.h(); nothing here uses innerHTML. All data comes from
//  the backend through ParentAPI — no direct database calls.
//
//  A parent can have several children. S.childId is only ever sent to
//  the server to say WHICH of the parent's own children to show; the
//  server checks it against the parent's real list (see parent-api.js).
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear;

  var S = {
    user: null, children: [], childId: null,
    mustChange: false, overviewShown: false, current: 'overview', paying: false,
  };

  var TITLES = {
    overview: 'Dashboard', results: 'Results', attendance: 'Attendance', timetable: 'Timetable',
    fees: 'Fees & Payments', notifications: 'Notifications', events: 'Events', profile: 'My Profile', password: 'Change Password',
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function child() { return S.children.filter(function (c) { return c.id === S.childId; })[0] || null; }

  // ── toast (text only) ────────────────────────────────────────
  function toast(message) {
    var el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 4000);
  }
  function apiMessage(r, fallback) { return r && r.data && r.data.message ? r.data.message : fallback; }

  // ── navigation ───────────────────────────────────────────────
  function navBtn(id) { return document.querySelector('.nav-item[data-page="' + id + '"]'); }
  function goTo(id) { global.showPage(id, navBtn(id)); }

  global.showPage = function (id, btn) {
    // Temporary password: only the change-password page is usable.
    if (S.mustChange && id !== 'password') {
      toast('Please change your temporary password first.');
      id = 'password'; btn = navBtn('password');
    }
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
    else if (id === 'results') loadResults();
    else if (id === 'attendance') loadAttendance();
    else if (id === 'timetable') loadTimetable();
    else if (id === 'fees') loadFees();
    else if (id === 'notifications') loadNotifications();
    else if (id === 'events') loadEvents();
    else if (id === 'profile') renderProfile();
    else if (id === 'password') renderPassword();
  }

  // ── shared bits ──────────────────────────────────────────────
  // Lets a parent choose which of their children they are looking at.
  function childBar(onChange) {
    var kids = S.children;
    if (!kids.length) return null;
    if (kids.length === 1) {
      return h('div', { 'class': 'ui-childbar' }, icon('user'), h('span', null, kids[0].name + (kids[0].className ? ' \u00B7 ' + kids[0].className : '')));
    }
    var sel = h('select', { 'class': 'form-control ui-childsel', id: 'child-select', 'aria-label': 'Choose child' },
      kids.map(function (k) { return h('option', { value: k.id }, k.name + (k.className ? ' \u2014 ' + k.className : '')); }));
    sel.value = S.childId;
    sel.addEventListener('change', function () { S.childId = sel.value; onChange(); });
    return h('div', { 'class': 'ui-childbar' }, h('label', { 'for': 'child-select' }, 'Viewing'), sel);
  }

  function pageHead(title, subtitle, onChildChange) {
    return h('div', { 'class': 'ui-head' },
      h('div', null, h('h2', null, title), subtitle ? h('p', null, subtitle) : null),
      onChildChange ? childBar(onChildChange) : null);
  }

  function noChild(box) {
    clear(box).appendChild(h('div', { 'class': 'ui-card' }, h('div', { 'class': 'ui-card-body' },
      P.empty('No child is linked to your account yet. Please contact the school office.'))));
  }

  function showError(box, r, retry) {
    var msg = r.status === 404 ? 'That child could not be found on your account.'
      : r.status === 403 ? apiMessage(r, 'You do not have access to this page.')
      : 'We could not load this page. Please try again.';
    clear(box).appendChild(P.errorBlock(msg, r.status === 403 ? null : retry));
  }

  function withChild(boxId, fn) {
    var box = $(boxId);
    if (!S.children.length) { noChild(box); return null; }
    clear(box).appendChild(P.skeleton());
    return box;
  }

  function applyUnread(count) {
    var badge = $('notif-badge'), bell = $('topbar-bell-count');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? '' : 'none'; }
    if (bell) { bell.textContent = count > 9 ? '9+' : count; bell.style.display = count > 0 ? '' : 'none'; }
  }

  function firstName(name) { return (name || '').trim().split(/\s+/)[0] || 'there'; }

  // ── OVERVIEW ─────────────────────────────────────────────────
  var FEE_TONE = { full: 'green', part: 'amber', not_paid: 'red' };
  var FEE_SHORT = { full: 'Paid', part: 'Part paid', not_paid: 'Not paid' };

  async function loadOverview() {
    var box = withChild('overview-body'); if (!box) return;
    var r = await global.ParentAPI.dashboard(S.childId);
    if (!r.ok) return showError(box, r, loadOverview);
    try {
      applyUnread(r.data.kpis ? r.data.kpis.unreadNotifications : 0);
      var chip = $('topbar-term');
      if (chip) { if (r.data.term) { chip.textContent = P.termLabel(r.data.term); chip.style.display = ''; } else chip.style.display = 'none'; }
      clear(box).appendChild(renderOverview(r.data));
    } catch (e) { clear(box).appendChild(P.errorBlock('Something went wrong showing this page. Please try again.', loadOverview)); }
  }

  function payButton(d) {
    var pay = d.fees.pay;
    return h('button', { type: 'button', 'class': 'btn btn-gold', id: 'pay-btn', onclick: function (e) { startPayment(e.currentTarget); } },
      'Pay ' + pay.term + ' term fees online');
  }

  function feeCard(d, withPayNote) {
    var f = d.fees, tone = FEE_TONE[f.status] || 'gray';
    var rows = [P.feeRow('Status', P.badge(f.label, tone))];
    if (f.classFeeNaira !== null) rows.push(P.feeRow('Class fee', T.fmtNaira(f.classFeeNaira)));
    rows.push(P.feeRow(f.pay.term + ' term ' + f.pay.session, P.badge(f.pay.termPaid ? 'Paid' : 'Not paid', f.pay.termPaid ? 'green' : 'red')));
    if (f.paidAt) rows.push(P.feeRow('Last payment', T.fmtDate(f.paidAt)));
    if (f.note) rows.push(h('div', { 'class': 'ui-fee-note' }, f.note));
    if (f.pay.canPay) rows.push(h('div', { 'class': 'ui-actions' }, payButton(d)));
    else if (withPayNote) rows.push(h('div', { 'class': 'ui-fee-note' }, payNote(f)));
    return P.card('School fees', null, rows);
  }

  function payNote(f) {
    if (f.pay.termPaid) return 'Fees for this term are paid. Thank you.';
    if (f.classFeeNaira === null) return 'The school has not set a fee for this class yet.';
    if (!f.pay.onlineEnabled) return 'Online payment is currently unavailable \u2014 please pay at the school office.';
    return '';
  }

  function transportCard(tr) {
    return P.card('School transport', null, [
      P.feeRow('Route', tr.routeName || '\u2014'), P.feeRow('Driver', tr.driverName || '\u2014'),
      P.feeRow('Driver phone', tr.driverPhone || '\u2014'), P.feeRow('Pickup point', tr.pickupPoint || '\u2014'),
    ]);
  }

  function renderOverview(d) {
    var k = d.kpis, c = d.child, att = d.attendance;
    var head = pageHead(T.greeting() + ', ' + firstName(d.profile.user.name),
      'Here is how ' + c.name + ' is doing' + (c.className ? ' in ' + c.className : '') + '.', loadOverview);

    var kpis = h('div', { 'class': 'ui-kpis' },
      P.kpi('amber', 'bars', 'Term average', k.average === null ? '\u2014' : T.fmtNumber(k.average, 1) + '%',
        k.overallGrade ? 'Grade ' + k.overallGrade : 'Not published yet', null, function () { goTo('results'); }),
      P.kpi('blue', 'trophy', 'Class position', k.position ? T.ordinal(k.position) : '\u2014',
        k.classSize ? 'out of ' + k.classSize + ' students' : 'Not published yet', null, function () { goTo('results'); }),
      P.kpi('green', 'calendar', 'Attendance', k.attendanceRate === null ? '\u2014' : k.attendanceRate + '%',
        k.attendanceRate === null ? 'Nothing recorded yet' : (att.present + att.late) + ' of ' + att.total + ' days',
        k.attendanceRate !== null && k.attendanceRate < 75 ? 'red' : null, function () { goTo('attendance'); }),
      P.kpi(FEE_TONE[k.feeStatus] || 'navy', 'wallet', 'School fees', FEE_SHORT[k.feeStatus] || '\u2014',
        d.fees.classFeeNaira !== null ? 'Class fee ' + T.fmtNaira(d.fees.classFeeNaira) : 'Fee not set yet', null, function () { goTo('fees'); }));

    var r = d.latestResult;
    var academic = r
      ? P.card('Academic overview \u2014 ' + P.termLabel(r), P.link('Full report', function () { goTo('results'); }), P.resultsTable(r), 'flush')
      : P.card('Academic overview', null, P.empty('Results appear here once the school publishes them.'));

    var tests = P.card('Recent tests', null, d.recentTests.length
      ? h('ul', { 'class': 'ui-list' }, d.recentTests.map(function (t) {
        var pct = t.totalMarks ? Math.round((t.score / t.totalMarks) * 100) : null;
        return h('li', null, h('div', { 'class': 'ui-li-ico tone-purple' }, icon('test')),
          h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, t.title), h('div', { 'class': 'ui-li-meta' }, [t.subject, T.fmtDate(t.submittedAt)].filter(Boolean).join(' \u00B7 '))),
          h('div', { 'class': 'ui-li-end' }, t.score + ' / ' + t.totalMarks, pct === null ? null : h('div', { 'class': 'ui-li-meta' }, pct + '%')));
      }))
      : P.empty('No tests taken yet.'));

    var weekend = d.today.weekday === 'Saturday' || d.today.weekday === 'Sunday';
    var timetable = P.card('Today\u2019s timetable \u2014 ' + d.today.weekday, P.link('Full timetable', function () { goTo('timetable'); }),
      P.periodList(d.today.periods, weekend ? 'No lessons on ' + d.today.weekday + '.' : 'No timetable has been set for ' + d.today.weekday + '.'));

    var quick = P.card('Quick links', null, h('div', { 'class': 'ui-quick' },
      [['results', 'results', 'Results'], ['attendance', 'calendar', 'Attendance'], ['timetable', 'clock', 'Timetable'],
        ['fees', 'wallet', 'Fees'], ['events', 'calendar', 'Events'], ['notifications', 'bell', 'Notices']].map(function (q) {
        return h('button', { type: 'button', onclick: function () { goTo(q[0]); } }, icon(q[1]), q[2]);
      })));

    return h('div', null, d.profile.user.isDemo ? T.demoNotice() : null, head, kpis,
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' }, academic, h('div', { 'class': 'ui-pair' },
          P.card('Attendance', P.link('Details', function () { goTo('attendance'); }), P.attendanceDonut(att)), tests), timetable),
        h('div', { 'class': 'ui-stack' },
          P.card('Announcements', P.link('View all', function () { goTo('notifications'); }), P.noticeList(d.notifications)),
          P.card('Upcoming events', P.link('All events', function () { goTo('events'); }), P.eventList(d.events)),
          feeCard(d, true), d.transport ? transportCard(d.transport) : null, quick)));
  }

  // ── RESULTS ──────────────────────────────────────────────────
  async function loadResults() {
    var box = withChild('results-body'); if (!box) return;
    var r = await global.ParentAPI.results(S.childId);
    if (!r.ok) return showError(box, r, loadResults);
    var list = r.data.results;
    var body = h('div');
    function draw(i) {
      var res = list[i];
      clear(body).appendChild(h('div', null,
        h('div', { 'class': 'ui-kpis' },
          P.kpi('amber', 'bars', 'Average', T.fmtNumber(res.average, 1) + '%', 'Grade ' + res.overallGrade),
          P.kpi('blue', 'trophy', 'Class position', res.position > 0 ? T.ordinal(res.position) : '\u2014', res.classSize > 0 ? 'out of ' + res.classSize + ' students' : ''),
          P.kpi('purple', 'cap', 'Session', res.session, res.term + ' Term')),
        P.card('Subject scores', null, P.resultsTable(res), 'flush'),
        res.principalRemark ? h('div', { 'class': 'ui-fee-note' }, h('strong', null, 'Principal\u2019s remark: '), res.principalRemark) : null));
    }
    var picker = null;
    if (list.length > 1) {
      var sel = h('select', { 'class': 'form-control ui-childsel', id: 'result-select', 'aria-label': 'Choose term' },
        list.map(function (x, i) { return h('option', { value: String(i) }, P.termLabel(x)); }));
      sel.addEventListener('change', function () { draw(Number(sel.value)); });
      picker = h('div', { 'class': 'ui-childbar' }, h('label', { 'for': 'result-select' }, 'Term'), sel);
    }
    clear(box).appendChild(h('div', null, pageHead('Results', child() ? child().name : '', loadResults), picker ? h('div', { 'class': 'ui-toolrow' }, picker) : null, body));
    if (list.length) draw(0);
    else body.appendChild(P.empty('No published results for this child yet.'));
  }

  // ── ATTENDANCE ───────────────────────────────────────────────
  async function loadAttendance() {
    var box = withChild('attendance-body'); if (!box) return;
    var r = await global.ParentAPI.attendance(S.childId);
    if (!r.ok) return showError(box, r, loadAttendance);
    var rows = r.data.attendance, s = r.data.summary;
    var table = rows.length
      ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Status'), h('th', null, 'Note'))),
        h('tbody', null, rows.slice(0, 40).map(function (a) {
          return h('tr', null, h('td', null, T.fmtDate(a.date)), h('td', null, P.badge(P.cap(a.status), P.attendanceTone(a.status))), h('td', null, a.note || '\u2014'));
        }))))
      : P.empty('No attendance has been recorded yet.');
    clear(box).appendChild(h('div', null, pageHead('Attendance', child() ? child().name : '', loadAttendance),
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' }, P.card('Recent days', null, table, 'flush')),
        h('div', { 'class': 'ui-stack' }, P.card('Summary', null, P.attendanceDonut(s))))));
  }

  // ── TIMETABLE ────────────────────────────────────────────────
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  function schoolWeekday() { return new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'long' }).format(new Date()); }

  async function loadTimetable() {
    var box = withChild('timetable-body'); if (!box) return;
    var r = await global.ParentAPI.timetable(S.childId);
    if (!r.ok) return showError(box, r, loadTimetable);
    var periods = r.data.timetable.periods, today = schoolWeekday();
    var slots = [];
    DAYS.forEach(function (d) { periods.filter(function (p) { return p.day === d; }).forEach(function (p) { if (slots.indexOf(p.period) === -1) slots.push(p.period); }); });
    var body;
    if (!slots.length) body = P.empty('No timetable has been set for this class yet.');
    else {
      body = h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table ui-tt-grid' },
        h('thead', null, h('tr', null, h('th', null, 'Time'), DAYS.map(function (d) { return h('th', { 'class': d === today ? 'is-today' : '' }, d); }))),
        h('tbody', null, slots.map(function (slot) {
          return h('tr', null, h('td', { 'class': 'time' }, slot), DAYS.map(function (d) {
            var p = periods.filter(function (x) { return x.day === d && x.period === slot; })[0];
            return h('td', { 'class': d === today ? 'is-today' : '' }, p ? [h('div', null, p.subject), p.teacher ? h('small', null, p.teacher) : null] : '');
          }));
        }))));
    }
    clear(box).appendChild(h('div', null, pageHead('Timetable', r.data.timetable.className || (child() ? child().className : ''), loadTimetable), P.card('Weekly timetable', null, body, 'flush')));
  }

  // ── FEES & PAYMENTS ──────────────────────────────────────────
  async function loadFees() {
    var box = withChild('fees-body'); if (!box) return;
    var results = await Promise.all([global.ParentAPI.dashboard(S.childId), global.ParentAPI.payments(S.childId)]);
    var dr = results[0], pr = results[1];
    if (!dr.ok) return showError(box, dr, loadFees);
    var pays = pr.ok ? pr.data.payments : [];
    var STATUS = { success: ['Successful', 'green'], pending: ['Pending', 'amber'], failed: ['Failed', 'red'], abandoned: ['Not completed', 'gray'] };
    var history = pays.length
      ? h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
        h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Term'), h('th', { 'class': 'num' }, 'Amount'), h('th', null, 'Status'))),
        h('tbody', null, pays.map(function (p) {
          var st = STATUS[p.status] || [p.status, 'gray'];
          return h('tr', null, h('td', null, T.fmtDate(p.createdAt)), h('td', null, [p.term, p.session].filter(Boolean).join(' \u00B7 ') || '\u2014'),
            h('td', { 'class': 'num' }, T.fmtNaira(p.amountNaira)), h('td', null, P.badge(st[0], st[1])));
        }))))
      : P.empty('No payments yet.');
    clear(box).appendChild(h('div', null, pageHead('Fees & Payments', child() ? child().name : '', loadFees),
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' }, P.card('Payment history', null, history, 'flush')),
        h('div', { 'class': 'ui-stack' }, feeCard(dr.data, true)))));
  }

  // The amount, term and session are decided by the server — the browser
  // only says which child. The checkout address it sends back is only
  // followed if it is an https Paystack page.
  function safeCheckoutUrl(u) {
    try {
      var x = new URL(u);
      if (x.protocol !== 'https:') return null;
      if (!/(^|\.)paystack\.(com|co)$/i.test(x.hostname)) return null;
      return x.href;
    } catch (e) { return null; }
  }

  async function startPayment(btn) {
    if (S.paying) return;
    S.paying = true; if (btn) btn.disabled = true;
    var r = await global.ParentAPI.startPayment(S.childId);
    S.paying = false; if (btn) btn.disabled = false;
    if (!r.ok) { toast(apiMessage(r, 'Could not start payment.')); return; }
    var url = safeCheckoutUrl(r.data.authorizationUrl);
    if (!url) { toast('Could not open the payment page. Please try again.'); return; }
    global.location.assign(url);
  }

  // Paystack sends the parent back here with ?reference=… . The address
  // is never trusted as proof of payment: the server re-checks with
  // Paystack itself before anything is marked paid.
  async function checkReturnFromPaystack() {
    var params = new URLSearchParams(global.location.search);
    var ref = params.get('reference') || params.get('trxref');
    if (!ref) return;
    global.history.replaceState({}, '', global.location.pathname);
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(ref)) return;
    var r = await global.ParentAPI.verifyPayment(ref);
    toast(r.ok ? (r.data.status === 'success' ? 'Payment successful. Thank you!' : 'Payment status: ' + r.data.status + '.') : apiMessage(r, 'We could not confirm your payment yet.'));
    goTo('fees');
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────
  async function loadNotifications() {
    var box = $('notifications-body'); clear(box).appendChild(P.skeleton());
    var r = await global.ParentAPI.notifications();
    if (!r.ok) return showError(box, r, loadNotifications);
    var list = r.data.notifications;
    function unread() { return list.filter(function (n) { return !n.isRead; }).length; }
    applyUnread(unread());
    function draw() {
      clear(box).appendChild(h('div', null, pageHead('Notifications', unread() ? unread() + ' unread' : 'You are all caught up'),
        P.card('Announcements', null, P.noticeList(list, async function (n) {
          if (n.isRead) return;
          var mr = await global.ParentAPI.markRead(n.id);
          if (mr.ok) { n.isRead = true; applyUnread(unread()); draw(); }
        }))));
    }
    draw();
  }

  // ── EVENTS ───────────────────────────────────────────────────
  async function loadEvents() {
    var box = $('events-body'); clear(box).appendChild(P.skeleton());
    var r = await global.ParentAPI.events();
    if (!r.ok) return showError(box, r, loadEvents);
    clear(box).appendChild(h('div', null, pageHead('Events', 'School calendar'), P.card('All events', null, P.eventList(r.data.events))));
  }

  // ── PROFILE ──────────────────────────────────────────────────
  function field(label, id, props) {
    return h('div', { 'class': 'form-group' }, h('label', { 'class': 'form-label', 'for': id }, label), h('input', Object.assign({ 'class': 'form-control', id: id }, props)));
  }

  function renderProfile() {
    var box = $('profile-body'); var u = S.user;
    var form = h('div', { 'class': 'ui-form' },
      field('Full name', 'pf-name', { type: 'text', value: u.name, maxlength: '120', autocomplete: 'name' }),
      field('Phone', 'pf-phone', { type: 'tel', value: u.phone || '', maxlength: '30', autocomplete: 'tel' }),
      field('Email for notifications', 'pf-email', { type: 'email', value: u.contactEmail || '', maxlength: '255', autocomplete: 'email' }),
      h('div', { 'class': 'ui-actions' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'pf-save', onclick: saveProfile }, 'Save changes')));

    var kids = S.children.length
      ? h('ul', { 'class': 'ui-list' }, S.children.map(function (c) {
        return h('li', null, h('div', { 'class': 'ui-li-ico tone-navy' }, icon('user')),
          h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, c.name), h('div', { 'class': 'ui-li-meta' }, [c.className, c.admissionNumber].filter(Boolean).join(' \u00B7 '))));
      }))
      : P.empty('No child is linked to your account yet.');

    clear(box).appendChild(h('div', null, pageHead('My Profile', 'Your contact details'),
      h('div', { 'class': 'ui-cols' }, h('div', { 'class': 'ui-stack' }, P.card('Contact details', null, form)),
        h('div', { 'class': 'ui-stack' }, P.card('My children', null, kids)))));
  }

  async function saveProfile() {
    var name = $('pf-name').value.trim(), phone = $('pf-phone').value.trim(), email = $('pf-email').value.trim();
    if (name.length < 2) { toast('Please enter your full name.'); return; }
    var btn = $('pf-save'); btn.disabled = true;
    var r = await global.ParentAPI.saveProfile(name, phone, email);
    btn.disabled = false;
    if (r.ok) { S.user.name = r.data.user.name; S.user.phone = r.data.user.phone; S.user.contactEmail = r.data.user.contactEmail; setText('p-name', S.user.name); setText('p-avatar', T.initials(S.user.name)); toast('Profile updated.'); }
    else toast(apiMessage(r, 'Could not update your profile.'));
  }

  // ── PASSWORD ─────────────────────────────────────────────────
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
    var banner = S.mustChange
      ? h('div', { 'class': 'ui-alert', role: 'alert' }, icon('alert'), h('div', null, 'You are signing in with a temporary password. Please choose a new password before you continue.'))
      : null;
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
    var problem = passwordProblem(cur, nw, cf);
    if (problem) { toast(problem); return; }
    var btn = $('pw-save'); btn.disabled = true;
    var r = await global.ParentAPI.changePassword(cur, nw);
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
    var r = await global.ParentAPI.profile();
    if (!r.ok) {
      if (r.status === 401) return;                                     // signing out
      if (r.status === 403) { global.location.href = 'login.html'; return; }   // not a parent account
      clear(box).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); }));
      return;
    }
    S.user = r.data.user; S.children = r.data.children; S.childId = S.children.length ? S.children[0].id : null;
    setText('p-name', S.user.name); setText('p-avatar', T.initials(S.user.name));

    if (S.user.mustChangePassword) { S.mustChange = true; goTo('password'); return; }
    await loadOverview();
    S.overviewShown = true;
    await checkReturnFromPaystack();
  }

  global.addEventListener('load', boot);
  global.ParentApp = { goTo: goTo };
})(window);
