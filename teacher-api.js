// ══════════════════════════════════════════════════════════════
//  VIFF — teacher-api.js
//  Data layer for dashboard-teacher.html — and ONLY that page.
//  Load AFTER supabase-api.js. Every call goes to the Express
//  backend (/api/teacher/*); nothing here touches the database.
//
//  The browser only NAMES a class / subject / test. The server
//  checks each one against the teacher's own assignments (class +
//  subject) and answers 403/404 for anything outside them, so
//  editing a request by hand gets a teacher nothing extra.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  async function call(method, path, body) {
    var r = await apiRequest(method, path, body);
    if (r.status === 401) { supabaseLogout(); }   // expired / revoked session
    return r;
  }
  // multipart upload (the scoresheet photo). In the demo build this is answered locally.
  async function uploadForm(path, fd) {
    if (global.DEMO_UPLOAD) return global.DEMO_UPLOAD(path, fd);
    try {
      var sess = await supabase.auth.getSession(), token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      var res = await fetch(API_BASE_URL + '/api' + path, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
      var json = {}; try { json = await res.json(); } catch (_) { /* ignore */ }
      if (res.status === 401) { supabaseLogout(); }
      return { ok: res.ok, status: res.status, data: json };
    } catch (e) { return { ok: false, status: 0, data: { message: 'Could not reach the server. Check your internet connection.' } }; }
  }
  function qs(params) {
    var p = new URLSearchParams();
    Object.keys(params).forEach(function (k) { if (params[k]) p.set(k, params[k]); });
    var s = p.toString();
    return s ? '?' + s : '';
  }
  var id = encodeURIComponent;

  global.TeacherAPI = {
    profile: function () { return call('GET', '/teacher/profile'); },
    saveProfile: function (name, phone, contactEmail) { return call('PUT', '/teacher/profile', { name: name, phone: phone, contactEmail: contactEmail }); },
    changePassword: function (currentPassword, newPassword) { return call('POST', '/teacher/password', { currentPassword: currentPassword, newPassword: newPassword }); },

    dashboard: function () { return call('GET', '/teacher/dashboard'); },
    classes: function () { return call('GET', '/teacher/classes'); },
    students: function (className) { return call('GET', '/teacher/students' + qs({ className: className })); },

    scoreSheet: function (className, subject, term, session) { return call('GET', '/teacher/scores' + qs({ className: className, subject: subject, term: term, session: session })); },
    saveScores: function (body) { return call('POST', '/teacher/scores', body); },
    importPreview: function (body) { return call('POST', '/teacher/scores/import-preview', body); },
    photoPreview: function (fields, blob) {
      var fd = new FormData();
      Object.keys(fields).forEach(function (k) { if (fields[k]) fd.append(k, fields[k]); });
      fd.append('photo', blob, 'scoresheet.png');
      return uploadForm('/teacher/scores/photo-preview', fd);
    },

    // Optional AI reading: aiStatus says whether the button should be shown; aiPreview is the same kind of preview as photoPreview.
    aiStatus: function () { return call('GET', '/teacher/scores/ai-status'); },
    aiPreview: function (fields, blob) {
      var fd = new FormData();
      Object.keys(fields).forEach(function (k) { if (fields[k]) fd.append(k, fields[k]); });
      fd.append('photo', blob, 'scoresheet.jpg');
      return uploadForm('/teacher/scores/ai-preview', fd);
    },

    register: function (className, date) { return call('GET', '/teacher/attendance' + qs({ className: className, date: date })); },
    saveRegister: function (body) { return call('POST', '/teacher/attendance', body); },

    tests: function () { return call('GET', '/teacher/tests'); },
    test: function (testId) { return call('GET', '/teacher/tests/' + id(testId)); },
    createTest: function (body) { return call('POST', '/teacher/tests', body); },
    addQuestion: function (testId, body) { return call('POST', '/teacher/tests/' + id(testId) + '/questions', body); },
    deleteQuestion: function (testId, questionId) { return call('DELETE', '/teacher/tests/' + id(testId) + '/questions/' + id(questionId)); },
    setPublished: function (testId, published) { return call('PATCH', '/teacher/tests/' + id(testId) + '/publish', { published: !!published }); },
    deleteTest: function (testId) { return call('DELETE', '/teacher/tests/' + id(testId)); },
    attempts: function (testId) { return call('GET', '/teacher/tests/' + id(testId) + '/attempts'); },

    timetable: function () { return call('GET', '/teacher/timetable'); },
    notifications: function () { return call('GET', '/teacher/notifications'); },
    markRead: function (notificationId) { return call('POST', '/teacher/notifications/' + id(notificationId) + '/read', {}); },
    events: function () { return call('GET', '/teacher/events'); },
    payslips: function () { return call('GET', '/teacher/payslips'); },
  };
})(window);
