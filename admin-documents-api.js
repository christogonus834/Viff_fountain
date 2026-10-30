// ══════════════════════════════════════════════════════════════
//  VIFF — admin-documents-api.js
//  Data layer for dashboard-admin-documents.html ONLY. Load AFTER
//  supabase-api.js. Every call goes to the Express backend
//  (/api/admin/documents/*); nothing here touches the database.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  async function call(method, path, body) {
    var r = await apiRequest(method, path, body);
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }
  var id = encodeURIComponent;

  global.AdminDocsAPI = {
    me: function () { return call('GET', '/admin/documents/me'); },
    getSettings: function () { return call('GET', '/admin/documents/settings'); },
    saveSettings: function (patch) { return call('PUT', '/admin/documents/settings', patch); },

    listGradeScale: function () { return call('GET', '/admin/documents/grade-scale'); },
    createBand: function (body) { return call('POST', '/admin/documents/grade-scale', body); },
    updateBand: function (bandId, body) { return call('PATCH', '/admin/documents/grade-scale/' + id(bandId), body); },
    deleteBand: function (bandId) { return call('DELETE', '/admin/documents/grade-scale/' + id(bandId)); },
    reorderScale: function (order) { return call('PUT', '/admin/documents/grade-scale/reorder', { order: order }); },

    listTraits: function (category) { return call('GET', '/admin/documents/traits' + (category ? '?category=' + id(category) : '')); },
    createTrait: function (body) { return call('POST', '/admin/documents/traits', body); },
    updateTrait: function (traitId, body) { return call('PATCH', '/admin/documents/traits/' + id(traitId), body); },
    deleteTrait: function (traitId) { return call('DELETE', '/admin/documents/traits/' + id(traitId)); },
    reorderTraits: function (category, order) { return call('PUT', '/admin/documents/traits/reorder', { category: category, order: order }); },

    idCard: function (studentId) { return call('GET', '/admin/documents/students/' + id(studentId) + '/id-card'); },
    report: function (studentId, resultId) { return call('GET', '/admin/documents/students/' + id(studentId) + '/report/' + id(resultId)); },

    // Print Center: list all approved students (client-side searched —
    // the admin students endpoint has no free-text search yet), and
    // list a student's published reports (reuses the existing route).
    searchStudents: function () { return call('GET', '/students?status=approved'); },
    studentReports: function (studentId) { return call('GET', '/results/student/' + id(studentId)); },
  };
})(window);
