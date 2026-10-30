// ══════════════════════════════════════════════════════════════
//  VIFF — student-api.js
//  Data layer for dashboard-student.html — and ONLY that page.
//
//  Load AFTER supabase-api.js. Every function below talks to the
//  Express backend (/api/student/*). Not one of them touches the
//  database directly, and none of them ever sends a student ID:
//  the server works out who you are from your login session, so
//  there is nothing to tamper with.
//
//  Why it reassigns names like getStudentResults: the existing
//  Results / Attendance / CBT / Notifications / Events / Timetable
//  sections of the page call those names and expect the
//  { ok, status, data } shape. Re-pointing the names keeps those
//  sections working unchanged while moving them onto the backend.
//  Other dashboards do not load this file, so they are unaffected.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // apiRequest / ok / fail / supabaseLogout come from supabase-api.js
  // and supabase-auth.js. Only the login SESSION is handled by
  // Supabase Auth; all school data comes from the backend.
  async function call(method, path, body) {
    var r = await apiRequest(method, path, body);
    // Session expired or revoked → sign out cleanly instead of
    // leaving the page half-working.
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }

  function qs(params) {
    var p = new URLSearchParams();
    Object.keys(params).forEach(function (k) { if (params[k]) p.set(k, params[k]); });
    var s = p.toString();
    return s ? '?' + s : '';
  }

  // ── new, page-specific API ──────────────────────────────────
  global.StudentAPI = {
    dashboard: function () { return call('GET', '/student/dashboard'); },
    profile: function () { return call('GET', '/student/profile'); },
  };

  // ── re-pointed legacy names (same shapes as before) ─────────
  global.__studentAuthStatus = 0;

  global.getUser = async function () {
    var r = await call('GET', '/student/profile');
    global.__studentAuthStatus = r.status;
    if (!r.ok) return null;
    var u = r.data.user;
    return {
      id: u.id, _id: u.id, name: u.name, role: u.role,
      email: u.contactEmail, phone: u.phone, mustChangePassword: u.mustChangePassword,
    };
  };

  global.getStudentProfile = async function () {
    var r = await call('GET', '/student/profile');
    if (!r.ok) return r;
    return ok({ user: r.data.user, student: r.data.student });
  };

  global.getStudentResults = async function (term, session) {
    var r = await call('GET', '/student/results' + qs({ term: term, session: session }));
    if (!r.ok) return r;
    if (!r.data.results.length) return fail('No published results found yet. Check back after your PIN is verified.', 404);
    return ok({ results: r.data.results });
  };

  global.getStudentAttendance = function (_ignored, fromDate, toDate) {
    // the first argument (a student ID) is deliberately ignored
    return call('GET', '/student/attendance' + qs({ from: fromDate, to: toDate }));
  };

  global.getStudentNotifications = function () { return call('GET', '/student/notifications'); };
  global.markNotificationRead = function (id) { return call('POST', '/student/notifications/' + encodeURIComponent(id) + '/read', {}); };
  global.getStudentEvents = function () { return call('GET', '/student/events'); };
  global.getMyTimetable = function () { return call('GET', '/student/timetable'); };
  global.getAvailableCbtExams = function () { return call('GET', '/student/cbt/exams'); };

  global.changePassword = function (currentPassword, newPassword) {
    return call('POST', '/student/password', { currentPassword: currentPassword, newPassword: newPassword });
  };
})(window);
