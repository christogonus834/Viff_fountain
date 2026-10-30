// ══════════════════════════════════════════════════════════════
//  VIFF — admin-overview.js
//  Principal / admin dashboard overview: headline KPIs, students by
//  section, today's attendance, and recent activity. Backend only —
//  no direct database calls. Every value renders via TFIS.h()
//  (textContent), never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear;

  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function apiMessage(r, fallback) { return r && r.data && r.data.message ? r.data.message : fallback; }

  global.showPage = function () { /* single-page screen; kept for the shared shell's markup */ };
  global.openSidebar = function () { $('sidebar').classList.add('open'); $('sidebar-backdrop').classList.add('show'); };
  global.closeSidebar = function () { $('sidebar').classList.remove('open'); $('sidebar-backdrop').classList.remove('show'); };

  var SECTION_COLORS = { Nursery: '#e0a100', Primary: '#2456c9', Junior: '#12833f', Senior: '#6b3fd1' };
  function colorFor(section, i) {
    return SECTION_COLORS[section] || ['#c22f2b', '#0f7a8c', '#a35f00', '#5b6478'][i % 4];
  }

  function sectionDonut(rows) {
    var total = rows.reduce(function (s, r) { return s + r.count; }, 0);
    if (!total) return P.empty('No students enrolled yet.');
    var segments = rows.map(function (r, i) { return { value: r.count, color: colorFor(r.section, i) }; });
    return h('div', { 'class': 'ui-donut-row' },
      T.donut(segments, { top: String(total), bottom: 'students' }, { label: 'Students by section' }),
      h('ul', { 'class': 'ui-legend' }, rows.map(function (r, i) {
        var dot = h('span', { 'class': 'dot' }); dot.style.background = colorFor(r.section, i);
        return h('li', null, dot, r.section, h('span', { 'class': 'val' }, r.count + ' (' + Math.round((r.count / total) * 100) + '%)'));
      })));
  }

  function attendanceDonut(a) {
    if (!a.total) return P.empty('No attendance has been marked today yet.');
    var rate = Math.round(((a.present + a.late) / a.total) * 100);
    var segs = [['Present', a.present, '#12833f'], ['Late', a.late, '#e0a100'], ['Absent', a.absent, '#c22f2b'], ['Excused', a.excused, '#2456c9']].filter(function (x) { return x[1] > 0; });
    return h('div', { 'class': 'ui-donut-row' },
      T.donut(segs.map(function (x) { return { value: x[1], color: x[2] }; }), { top: rate + '%', bottom: 'present' }, { label: 'Attendance today' }),
      h('ul', { 'class': 'ui-legend' }, segs.map(function (x) {
        var dot = h('span', { 'class': 'dot' }); dot.style.background = x[2];
        return h('li', null, dot, x[0], h('span', { 'class': 'val' }, x[1]));
      })));
  }

  function activityList(items) {
    if (!items.length) return P.empty('Nothing recorded yet.');
    return h('ul', { 'class': 'ui-list' }, items.map(function (a) {
      return h('li', null, h('div', { 'class': 'ui-li-ico tone-navy' }, icon('bell')),
        h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, a.description), h('div', { 'class': 'ui-li-meta' }, T.fmtDate(a.createdAt))));
    }));
  }

  function feeChip(label, count, total, tone) {
    var pct = total ? Math.round((count / total) * 100) : 0;
    return h('div', { 'class': 'ui-fee-row' }, h('span', null, label), h('span', null, P.badge(count + ' (' + pct + '%)', tone)));
  }

  // ── Two-factor login (Security card) ────────────────────────
  var mfaState = { enrolled: false, factorId: null, pendingFactorId: null, busy: false };

  function toast(message) {
    var el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 4500);
  }

  function securityCard() {
    if (mfaState.enrolled) {
      return P.card('Two-factor login', null, h('div', null,
        h('div', { 'class': 'ui-fee-row' }, h('span', null, 'Status'), P.badge('Enabled', 'green')),
        h('p', { 'class': 'ui-hint' }, 'A 6-digit code from your authenticator app is required every time you sign in.'),
        (global.__adminMe && global.__adminMe.mfaRequired)
          ? h('p', { 'class': 'ui-hint' }, 'Required for all administrators by school policy, so it cannot be turned off.')
          : h('button', { type: 'button', 'class': 'btn btn-outline', id: 'mfa-disable', onclick: disableMfa }, 'Turn off two-factor login')));
    }
    return P.card('Two-factor login', null, h('div', null,
      h('div', { 'class': 'ui-fee-row' }, h('span', null, 'Status'), P.badge('Not enabled', 'gray')),
      h('p', { 'class': 'ui-hint' }, 'Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, etc.) for stronger protection on this account.'),
      h('button', { type: 'button', 'class': 'btn btn-gold', id: 'mfa-enable', onclick: startEnroll }, 'Set up two-factor login')));
  }

  async function refreshSecurityCard() {
    var r = await global.AdminMfa.status();
    mfaState.enrolled = r.enrolled; mfaState.factorId = r.factorId; mfaState.pendingFactorId = r.pendingFactorId;
    var slot = $('security-slot'); if (slot) { clear(slot).appendChild(securityCard()); }
  }

  async function disableMfa() {
    if (!global.confirm('Turn off two-factor login for your account?')) return;
    var btn = $('mfa-disable'); btn.disabled = true;
    var r = await global.AdminMfa.disable(mfaState.factorId);
    if (r.error) { toast('Could not turn off two-factor login. Please try again.'); btn.disabled = false; return; }
    toast('Two-factor login turned off.');
    await refreshSecurityCard();
  }

  async function startEnroll() {
    if (mfaState.busy) return; mfaState.busy = true;
    var btn = $('mfa-enable'); if (btn) btn.disabled = true;
    var r = await global.AdminMfa.startEnroll();
    mfaState.busy = false;
    if (r.error) { toast('Could not start two-factor set-up. Please try again.'); if (btn) btn.disabled = false; return; }
    showEnrollDialog(r.data.id, r.data.totp.uri);
  }

  function showEnrollDialog(factorId, uri) {
    var overlay = h('div', { 'class': 'mfa-overlay' });
    var help = h('p', { 'class': 'mfa-help' }, 'Scan this with your authenticator app, then enter the 6-digit code it shows.');
    var qrHost = h('div', { style: 'display:flex;justify-content:center;margin:10px 0 16px' });
    var input = h('input', { 'class': 'mfa-input', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', 'aria-label': '6-digit code' });
    var error = h('p', { 'class': 'mfa-error', role: 'alert' });
    var confirm = h('button', { type: 'button', 'class': 'mfa-btn' }, 'Confirm and enable');
    var cancel = h('button', { type: 'button', 'class': 'mfa-cancel' }, 'Cancel');
    var box = h('div', { 'class': 'mfa-box', role: 'dialog', 'aria-modal': 'true' },
      h('h2', { 'class': 'mfa-title' }, 'Set up two-factor login'), help, qrHost, input, error, confirm, cancel);
    overlay.appendChild(box); document.body.appendChild(overlay);
    qrHost.appendChild(global.TFISQR.svg(uri, 160));
    input.focus();

    var busy = false;
    async function submit() {
      if (busy) return;
      var code = input.value.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) { error.textContent = 'Enter the 6 digits from your authenticator app.'; return; }
      busy = true; confirm.disabled = true; error.textContent = '';
      var r = await global.AdminMfa.confirmEnroll(factorId, code);
      busy = false; confirm.disabled = false;
      if (r.error) { error.textContent = 'That code is not right, or it has expired. Try the newest code.'; input.value = ''; input.focus(); return; }
      overlay.remove();
      toast('Two-factor login enabled.');
      await refreshSecurityCard();
    }
    confirm.addEventListener('click', submit);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
    cancel.addEventListener('click', async function () {
      overlay.remove();
      try { await global.AdminMfa.disable(factorId); } catch (e) { /* best effort clean-up of the abandoned factor */ }
    });
  }

  function render(d) {
    var k = d.kpis;
    var kpis = h('div', { 'class': 'ui-kpis' },
      P.kpi('blue', 'user', 'Total students', String(k.totalStudents), null),
      P.kpi('purple', 'cap', 'Total staff', String(k.totalStaff), null),
      P.kpi('navy', 'doc', 'Total classes', String(k.totalClasses), null),
      P.kpi(k.attendanceRateToday !== null && k.attendanceRateToday < 75 ? 'red' : 'green', 'calendar', 'Attendance today',
        k.attendanceRateToday === null ? '\u2014' : k.attendanceRateToday + '%', k.attendanceMarkedToday + ' marked so far'));

    var fees = d.feeSnapshot;
    var feeCard = P.card('Fee status snapshot', null, h('div', null,
      feeChip('Paid in full', fees.full, fees.total, 'green'), feeChip('Part payment', fees.part, fees.total, 'amber'), feeChip('Not paid', fees.not_paid, fees.total, 'red')));

    return h('div', null,
      h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, 'School overview'), h('p', null, 'A snapshot of the school right now.'))),
      kpis,
      h('div', { 'class': 'ui-cols' },
        h('div', { 'class': 'ui-stack' },
          P.card('Students by section', null, sectionDonut(d.studentsBySection)),
          P.card('Attendance today', null, attendanceDonut(d.attendanceToday))),
        h('div', { 'class': 'ui-stack' }, feeCard, h('div', { id: 'security-slot' }, securityCard()), h('div', { id: 'twofa-slot' }), P.card('Recent activity', null, activityList(d.recentActivity)))));
  }

  async function load() {
    var box = $('overview-body'); clear(box).appendChild(P.skeleton());
    var r = await global.AdminOverviewAPI.overview();
    if (!r.ok) {
      var msg = r.status === 403 ? apiMessage(r, 'You do not have access to this.') : 'We could not load the overview. Please try again.';
      clear(box).appendChild(P.errorBlock(msg, r.status === 403 ? null : load));
      return;
    }
    clear(box).appendChild(render(r.data));
    await refreshSecurityCard();
  }


  // Superadmin only: who has two-factor set up, and a way back in for someone who lost their phone.
  async function loadTwoFaAdmins() {
    var slot = $('twofa-slot'); if (!slot || !global.__adminMe || global.__adminMe.role !== 'superadmin') return;
    var r = await global.AdminOverviewAPI.twoFactorStatus();
    if (!r.ok) return;
    var body = h('tbody');
    r.data.admins.forEach(function (a) {
      var self = global.__adminMe && a.id === global.__adminMe.id;
      var btn = (!self && a.enrolled) ? h('button', { type: 'button', 'class': 'btn btn-outline', style: 'padding:4px 10px', onclick: function () { resetTwoFa(a); } }, 'Reset') : null;
      body.appendChild(h('tr', null, h('td', null, h('strong', null, a.name), h('div', { 'class': 'ui-li-meta' }, a.email)), h('td', null, P.cap(a.role)),
        h('td', null, P.badge(a.enrolled ? 'On' : 'Not set up', a.enrolled ? 'green' : 'amber')), h('td', null, btn)));
    });
    clear(slot).appendChild(P.card('Administrators and two-factor', null, h('div', null,
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Administrator'), h('th', null, 'Role'), h('th', null, 'Two-factor'), h('th', null, ''))), body)),
      h('p', { 'class': 'ui-hint' }, 'If someone loses their phone, reset their two-factor login. They sign in with their password and set it up again.'))));
  }
  async function resetTwoFa(a) {
    if (!global.confirm('Remove two-factor login for ' + a.name + '? They must set it up again at their next sign-in.')) return;
    var r = await global.AdminOverviewAPI.reset2fa(a.id);
    toast(r.ok ? (r.data.message || 'Two-factor login removed.') : (r.data && r.data.message ? r.data.message : 'Could not reset two-factor login.'));
    if (r.ok) loadTwoFaAdmins();
  }

  async function boot() {
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.appendChild(icon(el.getAttribute('data-icon'))); });
    var session = await global.requireLogin();
    if (!session) return;
    var r = await global.AdminOverviewAPI.me();
    if (!r.ok) {
      if (r.status === 401) return;
      if (r.status === 403) { global.location.href = 'login.html'; return; }
      clear($('overview-body')).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); }));
      return;
    }
    global.__adminMe = r.data.user;
    setText('a-name', r.data.user.name); setText('a-avatar', T.initials(r.data.user.name)); setText('a-role', P.cap(r.data.user.role));
    await load();
    loadTwoFaAdmins();
  }

  global.addEventListener('load', boot);
})(window);
