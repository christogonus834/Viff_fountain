// ══════════════════════════════════════════════════════════════
//  VIFF — parent-api.js
//  Data layer for dashboard-parent.html — and ONLY that page.
//
//  Load AFTER supabase-api.js. Every call goes to the Express
//  backend (/api/parent/* and /api/payments/*). Nothing here touches
//  the database directly.
//
//  About child IDs: the browser sends a child ID only to say WHICH of
//  the parent's own children to show. The server re-derives the list
//  of children from the login session and answers 404 for any ID that
//  isn't in it, so an ID typed or edited by hand reveals nothing.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // apiRequest / supabaseLogout come from supabase-api.js / supabase-auth.js.
  async function call(method, path, body) {
    var r = await apiRequest(method, path, body);
    if (r.status === 401) { supabaseLogout(); }   // expired / revoked session
    return r;
  }

  function qs(params) {
    var p = new URLSearchParams();
    Object.keys(params).forEach(function (k) { if (params[k]) p.set(k, params[k]); });
    var s = p.toString();
    return s ? '?' + s : '';
  }

  var id = encodeURIComponent;

  global.ParentAPI = {
    profile: function () { return call('GET', '/parent/profile'); },
    dashboard: function (childId) { return call('GET', '/parent/dashboard' + qs({ child: childId })); },
    results: function (childId) { return call('GET', '/parent/children/' + id(childId) + '/results'); },
    attendance: function (childId) { return call('GET', '/parent/children/' + id(childId) + '/attendance'); },
    timetable: function (childId) { return call('GET', '/parent/children/' + id(childId) + '/timetable'); },
    payments: function (childId) { return call('GET', '/parent/children/' + id(childId) + '/payments'); },
    notifications: function () { return call('GET', '/parent/notifications'); },
    markRead: function (notificationId) { return call('POST', '/parent/notifications/' + id(notificationId) + '/read', {}); },
    events: function () { return call('GET', '/parent/events'); },
    saveProfile: function (name, phone, contactEmail) { return call('PUT', '/parent/profile', { name: name, phone: phone, contactEmail: contactEmail }); },
    changePassword: function (currentPassword, newPassword) { return call('POST', '/parent/password', { currentPassword: currentPassword, newPassword: newPassword }); },

    // Payments. The amount, term and session are decided by the server;
    // the browser only says which child.
    startPayment: function (childId) { return call('POST', '/payments/initialize', { studentId: childId }); },
    verifyPayment: function (reference) { return call('POST', '/payments/verify', { reference: reference }); },
  };
})(window);
