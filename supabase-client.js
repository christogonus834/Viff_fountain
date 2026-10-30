// VIFF DEMO MODE — offline stand-in for the Supabase client.
// No network calls are made. Data comes from demo-data.js.
var API_BASE_URL = '';
var SUPABASE_URL = 'demo', SUPABASE_ANON_KEY = 'demo';
(function (g) {
  'use strict';
  var KEY = 'tfis_demo_session';
  function getSess() { try { return JSON.parse(g.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function done(d) { return Promise.resolve({ data: d === undefined ? null : d, error: null }); }
  function builder() {                       // safety net: unknown direct queries resolve to "empty"
    var b = { then: function (res, rej) { return done([]).then(res, rej); } };
    ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'neq', 'is', 'or', 'ilike'].forEach(function (m) { b[m] = function () { return b; }; });
    b.single = b.maybeSingle = function () { return done(null); };
    return b;
  }
  function verifyCode(code) {                // DEMO: any authenticator app is simulated; the code is always 123456
    if (String(code) !== '123456') return Promise.resolve({ data: null, error: { message: 'Invalid code' } });
    g.localStorage.setItem('tfis_demo_mfa', '1'); g.localStorage.setItem('tfis_demo_aal2', '1'); return done({});
  }
  g.supabase = {
    auth: {
      getSession: function () { var s = getSess(); return done({ session: s ? { access_token: 'demo-token', user: { id: s.id, email: s.email || '' } } : null }); },
      getUser: function () { var s = getSess(); return done({ user: s ? { id: s.id, email: s.email || '' } : null }); },
      signOut: function () { try { g.localStorage.removeItem(KEY); g.localStorage.removeItem('tfis_demo_aal2'); } catch (e) { } return done({}); },
      signInWithPassword: function () { return done({}); },
      updateUser: function () { return done({ user: {} }); },
      resetPasswordForEmail: function () { return done({}); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () { } } } }; },
      mfa: {
        getAuthenticatorAssuranceLevel: function () { return done({ currentLevel: g.localStorage.getItem('tfis_demo_aal2') === '1' ? 'aal2' : 'aal1', nextLevel: g.localStorage.getItem('tfis_demo_mfa') === '1' ? 'aal2' : 'aal1' }); },
        listFactors: function () { var on = g.localStorage.getItem('tfis_demo_mfa') === '1'; return done(on ? { totp: [{ id: 'demo-factor', status: 'verified' }], all: [{ id: 'demo-factor', status: 'verified' }] } : { totp: [], all: [] }); },
        enroll: function () { return done({ id: 'demo-factor', totp: { uri: 'otpauth://totp/VIFF:demo-admin?secret=JBSWY3DPEHPK3PXP&issuer=VIFF', secret: 'JBSWY3DPEHPK3PXP' } }); },
        challenge: function () { return done({ id: 'demo-challenge' }); },
        verify: function (o) { return verifyCode(o && o.code); },
        challengeAndVerify: function (o) { return verifyCode(o && o.code); },
        unenroll: function () { g.localStorage.removeItem('tfis_demo_mfa'); g.localStorage.removeItem('tfis_demo_aal2'); return done({}); }
      }
    },
    from: function () { return builder(); },
    rpc: function (name, args) {
      if (name === 'verify_pin') {
        var db = g.DEMO.db, code = String((args && args.p_code) || '').trim().toUpperCase();
        var pin = db.pins.filter(function (p) { return p.code === code; })[0];
        if (!pin || pin.usedCount >= pin.maxUses) return done(null);
        var st = db.students.filter(function (s) { return s.id === pin.studentId; })[0];
        var r = db.results.filter(function (x) { return x.student_id === pin.studentId && x.term === pin.term && x.session === pin.session; })[0];
        if (!r) return done(null);
        pin.usedCount++; g.DEMO.save();
        return done([{ student_name: st.student_name, class_name: r.class_name, term: r.term, session: r.session, average: r.average, overall_grade: r.overall_grade,
          class_position: r.class_position, total_students: r.total_students, principal_remark: r.principal_remark, subjects: r.subject_scores }]);
      }
      return done(null);
    },
    functions: { invoke: function () { return done({}); } },
    storage: { from: function () { return { upload: function () { return done({ path: 'demo' }); }, getPublicUrl: function () { return { data: { publicUrl: '' } }; } }; } }
  };
})(window);
