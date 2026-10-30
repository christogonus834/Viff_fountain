// Data layer for Student Management and Finance Management. Backend only (no direct database calls).
(function (global) {
  'use strict';
  async function call(method, path, body) { var r = await apiRequest(method, path, body); if (r.status === 401) { supabaseLogout(); } return r; }
  function qs(o) { var p = []; Object.keys(o || {}).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); }); return p.length ? '?' + p.join('&') : ''; }
  global.AdminManageAPI = {
    me: function () { return call('GET', '/admin/documents/me'); },
    classes: function () { return call('GET', '/classes'); },
    // students
    students: function (q) { return call('GET', '/students' + qs(q)); },
    student: function (id) { return call('GET', '/students/' + encodeURIComponent(id)); },
    editStudent: function (id, body) { return call('PATCH', '/students/' + encodeURIComponent(id), body); },
    transfer: function (id, body) { return call('POST', '/students/' + encodeURIComponent(id) + '/transfer', body); },
    promote: function (studentIds, newClassName) { return call('POST', '/students/promote', { studentIds: studentIds, newClassName: newClassName }); },
    enrol: function (body) { return call('POST', '/students/enrol', body); },
    pending: function () { return call('GET', '/students/pending'); },
    decide: function (id, status, admissionNumber) { var b = { status: status }; if (admissionNumber) b.admissionNumber = admissionNumber; return call('POST', '/students/' + encodeURIComponent(id) + '/decision', b); },
    numbering: function () { return call('GET', '/students/numbering'); },
    saveNumbering: function (body) { return call('PUT', '/students/numbering', body); },
    importPreview: function (rows) { return call('POST', '/students/import-preview', { rows: rows }); },
    importCommit: function (rows) { return call('POST', '/students/import', { rows: rows }); },
    // fees & finance
    fees: function () { return call('GET', '/fees'); },
    setFee: function (id, body) { return call('PATCH', '/fees/' + encodeURIComponent(id), body); },
    financeOverview: function () { return call('GET', '/finance/overview'); },
    onlinePayments: function () { return call('GET', '/settings/online-payments'); },
    setOnlinePayments: function (enabled) { return call('PUT', '/settings/online-payments', { enabled: !!enabled }); },
    ledgerCategories: function () { return call('GET', '/ledger/categories'); },
    ledger: function (q) { return call('GET', '/ledger' + qs(q)); },
    ledgerSummary: function (q) { return call('GET', '/ledger/summary' + qs(q)); },
    addLedger: function (body) { return call('POST', '/ledger', body); },
    voidLedger: function (id, reason) { return call('POST', '/ledger/' + encodeURIComponent(id) + '/void', { reason: reason }); }
  };
})(window);
