// ══════════════════════════════════════════════════════════════
//  VIFF — print-api.js
//  Data layer for id-card.html and report-card.html ONLY.
//
//  These pages are opened with a query string saying WHO is asking
//  (?role=student|parent|admin) and WHICH record (?child=… / ?student=…
//  / ?result=…). The role only picks which backend endpoint to call;
//  every actual ownership check still happens server-side exactly as
//  it does in the dashboards; a parent can never fetch another
//  family's child no matter what the query string says.
//
//  Load AFTER supabase-api.js.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  async function call(method, path) {
    var r = await apiRequest(method, path);
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }

  function params() { return new URLSearchParams(global.location.search); }
  function role() {
    var r = (params().get('role') || '').toLowerCase();
    return ['student', 'parent', 'admin'].indexOf(r) === -1 ? null : r;
  }

  global.PrintAPI = {
    role: role,

    idCard: function () {
      var p = params();
      if (role() === 'admin') return call('GET', '/admin/documents/students/' + encodeURIComponent(p.get('student') || '') + '/id-card');
      if (role() === 'parent') return call('GET', '/parent/children/' + encodeURIComponent(p.get('child') || '') + '/id-card');
      return call('GET', '/student/id-card');
    },

    report: function () {
      var p = params(), resultId = encodeURIComponent(p.get('result') || '');
      if (role() === 'admin') return call('GET', '/admin/documents/students/' + encodeURIComponent(p.get('student') || '') + '/report/' + resultId);
      if (role() === 'parent') return call('GET', '/parent/children/' + encodeURIComponent(p.get('child') || '') + '/report/' + resultId);
      return call('GET', '/student/report/' + resultId);
    },
  };
})(window);
