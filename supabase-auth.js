// VIFF DEMO MODE — hardcoded sign-in (no server). Accounts live in demo-data.js.
(function (g) {
  'use strict';
  var KEY = 'tfis_demo_session';
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function findAccount(identifier, password) {
    var db = g.DEMO.db, id = norm(identifier), hit = null, pw = null;
    db.admins.forEach(function (a) { if (norm(a.login_email) === id) { hit = a; pw = a.role === 'superadmin' ? 'Super@123' : 'Admin@123'; } });
    db.teachers.forEach(function (t) { if (norm(t.login_email) === id || norm(t.staff_id) === id) { hit = t; pw = 'Teacher@123'; } });
    db.parents.forEach(function (p) { if (norm(p.login_email) === id) { hit = p; pw = p.demoPw || 'Parent@123'; } });
    db.students.forEach(function (s) { if (norm(s.admission_number) === id) { hit = db.profiles[s.id]; pw = (hit && hit.demoPw) || 'Student@123'; } });
    return hit && password === pw ? hit : null;
  }
  g.supabaseLogin = async function (identifier, password) {
    var p = findAccount(identifier, password);
    if (!p) return { ok: false, message: 'Invalid ID/email or password. Check the demo logins below the form.' };
    try { g.localStorage.removeItem('tfis_demo_aal2'); g.localStorage.setItem(KEY, JSON.stringify({ id: p.id, role: p.role, email: p.contact_email || '' })); } catch (e) { }
    return { ok: true, profile: { id: p.id, name: p.name, role: p.role } };
  };
  g.supabaseLogout = function () { try { g.localStorage.removeItem(KEY); } catch (e) { } g.location.href = 'login.html'; };
  g.requireSupabaseLogin = async function () {
    var r = await g.supabase.auth.getSession();
    if (!r.data.session) { g.location.href = 'login.html'; return null; }
    return r.data.session;
  };
})(window);
