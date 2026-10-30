// ══════════════════════════════════════════════════════════════
//  VIFF — admin-finance.js   Finance Management
//  Fee collection overview + per-student fee status + income/expense ledger.
//  Backend only. Every value renders via TFIS.h (textContent), never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear, K = global.AMKit, A = global.AdminManageAPI, N = T.fmtNaira;
  K.shell();
  function $(id) { return document.getElementById(id); }
  var FEE = { full: ['Paid in full', 'green'], part: ['Part payment', 'amber'], not_paid: ['Not paid', 'red'] };
  var METHODS = [{ value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }];
  var METHOD_LABEL = { cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', other: 'Other', online: 'Online' };
  var S = { tab: 'collection', overview: null, fees: [], online: null, categories: [], fq: '', fcls: '', fstatus: '', fLimit: 200,
    led: { from: '', to: '', type: '', voided: false, entries: [], summary: null, loaded: false } };
  var root;
  function today() { return new Date().toISOString().slice(0, 10); }
  function btn(label, cls, fn) { return h('button', { 'class': 'am-btn ' + cls, type: 'button', onclick: fn }, label); }
  function feeBadge(s) { var f = FEE[s] || [s || '\u2014', 'gray']; return P.badge(f[0], f[1]); }

  async function loadAll() {
    clear(root).appendChild(P.skeleton());
    var res = await Promise.all([A.financeOverview(), A.fees(), A.onlinePayments(), A.ledgerCategories()]);
    var bad = res.slice(0, 2).find(function (r) { return !r.ok; });
    if (bad) { clear(root).appendChild(P.errorBlock(bad.status === 403 ? K.apiMessage(bad, 'You do not have access to this.') : 'We could not load the finance data. Please try again.', bad.status === 403 ? null : loadAll)); return; }
    S.overview = res[0].data; S.fees = res[1].data.students || []; S.online = res[2].ok ? !!res[2].data.enabled : null; S.categories = res[3].ok ? res[3].data.categories : ['Other'];
    render();
  }
  function render() {
    clear(root).appendChild(h('div', null,
      h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, 'Finance Management'), h('p', null, 'Fee collection, student fee status and the income and expense ledger.'))),
      K.tabs([{ id: 'collection', label: 'Fee collection' }, { id: 'ledger', label: 'Income & expenses' }], S.tab, function (t) { S.tab = t; render(); }),
      S.tab === 'collection' ? collectionPanel() : ledgerPanel()));
    if (S.tab === 'ledger' && !S.led.loaded) loadLedger();
  }

  // ═════════ Fee collection ═════════
  function collectionPanel() {
    var o = S.overview;
    return h('div', null,
      h('div', { 'class': 'ui-kpis' },
        P.kpi('navy', 'wallet', 'Expected fees', N(o.expectedNaira), 'if every student pays in full'),
        P.kpi('green', 'check', 'Collected online', N(o.collectedOnlineNaira), 'through the portal'),
        P.kpi('amber', 'alert', 'Part payments', String(o.partCount), 'students'),
        P.kpi('red', 'alert', 'Not paid', String(o.notPaidCount), 'students')),
      onlineCard(), classTable(), feeTable());
  }
  function onlineCard() {
    if (S.online === null) return null;
    var b = btn(S.online ? 'Turn off' : 'Turn on', S.online ? 'line' : 'gold', function () {
      K.confirmBox(S.online ? 'Turn off online payments' : 'Turn on online payments', S.online ? 'Parents will no longer see the Pay online button.' : 'Parents will be able to pay fees online (Paystack). Make sure your Paystack keys are set on the server.', S.online ? 'Turn off' : 'Turn on', async function () {
        var r = await A.setOnlinePayments(!S.online); if (!r.ok) return K.apiMessage(r, 'Could not change this setting.');
        S.online = !!r.data.enabled; K.toast(S.online ? 'Online payments are on.' : 'Online payments are off.'); render();
      }, S.online ? 'red' : 'gold');
    });
    return P.card('Online payments', null, h('div', { 'class': 'am-toolbar', style: 'margin:0' }, h('div', { 'class': 'am-grow' }, P.badge(S.online ? 'On' : 'Off', S.online ? 'green' : 'gray'), ' ',
      h('span', { 'class': 'am-muted' }, S.online ? 'Parents can pay fees from their dashboard.' : 'Parents cannot pay online yet.')), b));
  }
  function classTable() {
    var rows = S.overview.perClass || [];
    if (!rows.length) return P.card('Collection by class', null, P.empty('No enrolled students yet.'));
    var body = h('tbody');
    rows.forEach(function (c) {
      var pct = c.students ? Math.round((c.full / c.students) * 100) : 0;
      body.appendChild(h('tr', null, h('td', null, h('strong', null, c.className)), h('td', { 'class': 'am-num' }, String(c.students)), h('td', { 'class': 'am-num' }, String(c.full)),
        h('td', { 'class': 'am-num' }, String(c.part)), h('td', { 'class': 'am-num' }, String(c.notPaid)), h('td', { 'class': 'am-num' }, N(c.expectedNaira)),
        h('td', null, h('div', { 'class': 'ui-bar', role: 'img', 'aria-label': pct + ' percent paid in full' }, h('span', { style: 'width:' + pct + '%' })), h('div', { 'class': 'am-muted' }, pct + '% paid in full'))));
    });
    return P.card('Collection by class', null, h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null, h('th', null, 'Class'), h('th', { 'class': 'am-num' }, 'Students'), h('th', { 'class': 'am-num' }, 'Paid'), h('th', { 'class': 'am-num' }, 'Part'), h('th', { 'class': 'am-num' }, 'Not paid'), h('th', { 'class': 'am-num' }, 'Expected'), h('th', null, 'Progress'))), body)));
  }
  function feeFiltered() {
    var q = S.fq.trim().toLowerCase();
    return S.fees.filter(function (s) { return (!S.fcls || s.className === S.fcls) && (!S.fstatus || s.feeStatus === S.fstatus) && (!q || ((s.studentName || '') + ' ' + (s.admission_number || s.admissionNumber || '')).toLowerCase().indexOf(q) > -1); });
  }
  function feeTable() {
    var classes = []; S.fees.forEach(function (s) { if (s.className && classes.indexOf(s.className) < 0) classes.push(s.className); }); classes.sort();
    var search = K.input({ placeholder: 'Search student or admission number', value: S.fq }); search.setAttribute('aria-label', 'Search students');
    search.addEventListener('input', K.debounce(function () { S.fq = search.value; S.fLimit = 200; drawFees(); }, 180));
    var cls = K.select([{ value: '', label: 'All classes' }].concat(classes.map(function (n) { return { value: n, label: n }; })), S.fcls);
    cls.addEventListener('change', function () { S.fcls = cls.value; S.fLimit = 200; drawFees(); });
    var st = K.select([{ value: '', label: 'Any status' }, { value: 'full', label: 'Paid in full' }, { value: 'part', label: 'Part payment' }, { value: 'not_paid', label: 'Not paid' }], S.fstatus);
    st.addEventListener('change', function () { S.fstatus = st.value; S.fLimit = 200; drawFees(); });
    setTimeout(drawFees, 0);
    return P.card('Student fee status', null, h('div', null,
      h('div', { 'class': 'am-toolbar am-noprint' }, h('div', { 'class': 'am-grow' }, search), cls, st, btn('Export CSV', 'line', function () {
        var rows = [['Student', 'Admission number', 'Class', 'Fee status', 'Note']]; feeFiltered().forEach(function (s) { rows.push([s.studentName, s.admission_number || s.admissionNumber || '', s.className, (FEE[s.feeStatus] || [s.feeStatus])[0], s.feeNote || '']); }); K.csvDownload('fee-status.csv', rows);
      })), h('div', { id: 'fee-table' })));
  }
  function drawFees() {
    var box = $('fee-table'); if (!box) return;
    var rows = feeFiltered(), shown = rows.slice(0, S.fLimit);
    if (!rows.length) { clear(box).appendChild(P.empty('No students match.')); return; }
    var body = h('tbody');
    shown.forEach(function (s) {
      body.appendChild(h('tr', null, h('td', null, h('strong', null, s.studentName), h('div', { 'class': 'am-muted' }, s.admission_number || s.admissionNumber || '')), h('td', null, s.className || '\u2014'),
        h('td', null, feeBadge(s.feeStatus)), h('td', null, s.feeNote || h('span', { 'class': 'am-muted' }, '\u2014')), h('td', { 'class': 'am-noprint' }, btn('Update', 'line sm', function () { editFee(s); }))));
    });
    clear(box).appendChild(h('div', null, h('div', { 'class': 'am-muted', style: 'margin:0 0 8px' }, 'Showing ' + shown.length + ' of ' + rows.length),
      h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Student'), h('th', null, 'Class'), h('th', null, 'Status'), h('th', null, 'Note'), h('th', { 'class': 'am-noprint' }, ''))), body)),
      rows.length > shown.length ? h('div', { style: 'margin-top:10px' }, btn('Show more', 'line', function () { S.fLimit += 200; drawFees(); })) : null));
  }
  function editFee(s) {
    var status = K.select([{ value: 'full', label: 'Paid in full' }, { value: 'part', label: 'Part payment' }, { value: 'not_paid', label: 'Not paid' }], s.feeStatus), note = K.input({ value: s.feeNote || '', maxlength: 300, placeholder: 'optional, e.g. balance due 15 Nov' });
    K.formModal('Fee status: ' + s.studentName, h('div', { style: 'display:grid;gap:12px' }, K.field('Status', status), K.field('Note', note)), 'Save', async function (close, setError, setBusy) {
      setBusy(true); var r = await A.setFee(s.id, { feeStatus: status.value, feeNote: note.value.trim() }); setBusy(false);
      if (!r.ok) return setError(K.apiMessage(r, 'Could not update the fee status.'));
      close(); K.toast('Fee status updated.');
      var ov = await A.financeOverview(), fl = await A.fees(); if (ov.ok) S.overview = ov.data; if (fl.ok) S.fees = fl.data.students || []; render();
    });
  }

  // ═════════ Ledger ═════════
  function ledgerPanel() {
    var L = S.led;
    var from = K.input({ type: 'date', value: L.from }), to = K.input({ type: 'date', value: L.to }), type = K.select([{ value: '', label: 'Income and expenses' }, { value: 'income', label: 'Income only' }, { value: 'expense', label: 'Expenses only' }], L.type);
    var vd = h('input', { type: 'checkbox', 'class': 'am-check', id: 'led-voided', 'aria-label': 'Show voided entries' }); vd.checked = L.voided;
    function reload() { L.from = from.value; L.to = to.value; L.type = type.value; L.voided = vd.checked; loadLedger(); }
    [from, to, type, vd].forEach(function (el) { el.addEventListener('change', reload); });
    return h('div', null,
      h('div', { 'class': 'am-toolbar am-noprint' }, K.field('From', from), K.field('To', to), K.field('Show', type), h('label', { style: 'display:flex;gap:6px;align-items:center;font-size:.85rem' }, vd, 'Show voided'),
        h('div', { 'class': 'am-grow' }), btn('+ Add entry', 'gold', addEntry), btn('Export CSV', 'line', exportLedger), btn('Print', 'line', function () { global.print(); })),
      h('div', { id: 'led-kpis' }), h('div', { id: 'led-table' }, P.skeleton()));
  }
  async function loadLedger() {
    var L = S.led, q = { from: L.from, to: L.to, type: L.type, includeVoided: L.voided ? '1' : '' };
    var res = await Promise.all([A.ledger(q), A.ledgerSummary({ from: L.from, to: L.to })]);
    if (!res[0].ok || !res[1].ok) { var box = $('led-table'); if (box) clear(box).appendChild(P.errorBlock('We could not load the ledger. Please try again.', loadLedger)); return; }
    L.entries = res[0].data.entries || []; L.summary = res[1].data; L.loaded = true; drawLedger();
  }
  function drawLedger() {
    var L = S.led, k = $('led-kpis'), t = $('led-table'); if (!k || !t) return; var sm = L.summary;
    clear(k).appendChild(h('div', { 'class': 'ui-kpis' }, P.kpi('green', 'arrow', 'Total income', N(sm.totalIncomeNaira), sm.onlinePaymentCount + ' online payments'),
      P.kpi('red', 'arrow', 'Total expenses', N(sm.totalExpenseNaira), null), P.kpi(sm.netBalanceNaira >= 0 ? 'blue' : 'red', 'wallet', 'Net balance', N(sm.netBalanceNaira), sm.netBalanceNaira >= 0 ? 'surplus' : 'deficit')));
    if (!L.entries.length) { clear(t).appendChild(P.empty('No entries for this period.')); return; }
    var body = h('tbody');
    L.entries.forEach(function (e) {
      var inc = e.type === 'income', cls = e.voided ? 'am-voided' : '';
      var act = (e.source === 'manual' && !e.voided) ? btn('Void', 'line sm', function () { voidEntry(e); }) : (e.voided ? P.badge('Voided', 'gray') : null);
      body.appendChild(h('tr', { 'class': cls },
        h('td', null, T.fmtDate(e.date)), h('td', null, h('strong', null, e.category), h('div', { 'class': 'am-muted' }, e.description || ''), e.voided && e.voidReason ? h('div', { 'class': 'am-muted' }, 'Void reason: ' + e.voidReason) : null),
        h('td', null, METHOD_LABEL[e.method] || e.method || '\u2014', e.reference ? h('div', { 'class': 'am-muted' }, e.reference) : null),
        h('td', { 'class': 'am-num am-in' }, inc ? N(e.amountNaira) : ''), h('td', { 'class': 'am-num am-out' }, inc ? '' : N(e.amountNaira)),
        h('td', null, e.source === 'online_payment' ? P.badge('Online', 'blue') : P.badge('Manual', 'gray')), h('td', { 'class': 'am-noprint' }, act)));
    });
    clear(t).appendChild(h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' }, h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Details'), h('th', null, 'Method'), h('th', { 'class': 'am-num' }, 'Income'), h('th', { 'class': 'am-num' }, 'Expense'), h('th', null, 'Source'), h('th', { 'class': 'am-noprint' }, ''))), body)));
  }
  function exportLedger() {
    var rows = [['Date', 'Type', 'Category', 'Description', 'Method', 'Reference', 'Amount (NGN)', 'Source', 'Voided']];
    S.led.entries.forEach(function (e) { rows.push([e.date, e.type, e.category, e.description, METHOD_LABEL[e.method] || e.method, e.reference, e.amountNaira, e.source === 'online_payment' ? 'Online' : 'Manual', e.voided ? 'Yes' : '']); });
    K.csvDownload('ledger.csv', rows);
  }
  function addEntry() {
    var f = { type: K.select([{ value: 'income', label: 'Income (money in)' }, { value: 'expense', label: 'Expense (money out)' }], 'income'), cat: K.select(S.categories, S.categories[0]), amt: K.input({ type: 'number', min: '1', step: '0.01', placeholder: '0.00' }),
      date: K.input({ type: 'date', value: today() }), method: K.select(METHODS, 'cash'), desc: K.input({ maxlength: 300, placeholder: 'What was this for?' }), ref: K.input({ maxlength: 100, placeholder: 'optional receipt or transfer reference' }) };
    K.formModal('Add a ledger entry', h('div', { style: 'display:grid;gap:12px' }, h('div', { 'class': 'am-grid2' }, K.field('Type', f.type), K.field('Category', f.cat)), h('div', { 'class': 'am-grid2' }, K.field('Amount (\u20A6)', f.amt), K.field('Date', f.date)),
      h('div', { 'class': 'am-grid2' }, K.field('Method', f.method), K.field('Reference', f.ref)), K.field('Description', f.desc)), 'Save entry', async function (close, setError, setBusy) {
      var amount = Number(f.amt.value);
      if (!isFinite(amount) || amount <= 0) return setError('Enter an amount greater than zero.');
      if (!f.date.value) return setError('Choose the date.');
      setBusy(true); var r = await A.addLedger({ entryType: f.type.value, category: f.cat.value, amountNaira: amount, entryDate: f.date.value, method: f.method.value, description: f.desc.value.trim(), reference: f.ref.value.trim() }); setBusy(false);
      if (!r.ok) return setError(K.apiMessage(r, 'Could not save the entry.'));
      close(); K.toast('Entry recorded.'); await loadLedger();
    });
  }
  function voidEntry(e) {
    var why = K.textarea({ rows: 3, maxlength: 300, placeholder: 'Why is this entry being voided?' });
    K.formModal('Void this entry', h('div', { style: 'display:grid;gap:12px' }, h('p', { style: 'margin:0' }, e.category + ' \u00B7 ' + N(e.amountNaira) + ' \u00B7 ' + T.fmtDate(e.date)), h('p', { 'class': 'am-muted', style: 'margin:0' }, 'Entries are never deleted. A voided entry stays visible with its reason, and no longer counts in the totals.'), K.field('Reason', why)),
      'Void entry', async function (close, setError, setBusy) {
        if (why.value.trim().length < 3) return setError('Please say why this entry is being voided.');
        setBusy(true); var r = await A.voidLedger(e.id, why.value.trim()); setBusy(false);
        if (!r.ok) return setError(K.apiMessage(r, 'Could not void the entry.'));
        close(); K.toast('Entry voided.'); await loadLedger();
      }, 'red');
  }

  async function boot() {
    root = $('finance-body');
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.appendChild(icon(el.getAttribute('data-icon'))); });
    var session = await global.requireLogin(); if (!session) return;
    var r = await A.me();
    if (!r.ok) { if (r.status === 401) return; if (r.status === 403) { global.location.href = 'login.html'; return; } clear(root).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); })); return; }
    $('a-name').textContent = r.data.user.name; $('a-avatar').textContent = T.initials(r.data.user.name); $('a-role').textContent = P.cap(r.data.user.role);
    await loadAll();
  }
  global.addEventListener('load', boot);
})(window);
