// ══════════════════════════════════════════════════════════════
//  VIFF — admin-overview-api.js
//  Data layer for dashboard-admin-overview.html ONLY. Load AFTER
//  supabase-api.js. Backend only — no direct database calls.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  async function call(method, path) {
    var r = await apiRequest(method, path);
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }
  global.AdminOverviewAPI = {
    me: function () { return call('GET', '/admin/documents/me'); },
    overview: function () { return call('GET', '/admin/overview'); },
    twoFactorStatus: function () { return call('GET', '/admins/2fa-status'); },
    reset2fa: function (id) { return call('POST', '/admins/' + encodeURIComponent(id) + '/reset-2fa'); },
  };

  // ── two-factor enrollment (Supabase Auth's own MFA — no backend
  //    involvement needed: enrolling a SECOND factor for YOUR OWN
  //    account is an identity operation, done with your own session,
  //    exactly like signing in itself already is). ──
  global.AdminMfa = {
    status: async function () {
      var r = await supabase.auth.mfa.listFactors();
      if (r.error) return { enrolled: false, factorId: null };
      var verified = (r.data.totp || []).filter(function (f) { return f.status === 'verified'; });
      var unverified = (r.data.totp || []).filter(function (f) { return f.status === 'unverified'; });
      return { enrolled: verified.length > 0, factorId: verified[0] ? verified[0].id : null, pendingFactorId: unverified[0] ? unverified[0].id : null };
    },
    // Cleans up any half-finished enrollment first, so retrying never
    // piles up abandoned "unverified" factors from a previous attempt.
    startEnroll: async function () {
      var existing = await supabase.auth.mfa.listFactors();
      if (!existing.error) {
        var stale = (existing.data.totp || []).filter(function (f) { return f.status === 'unverified'; });
        for (var i = 0; i < stale.length; i++) { await supabase.auth.mfa.unenroll({ factorId: stale[i].id }); }
      }
      return supabase.auth.mfa.enroll({ factorType: 'totp' });
    },
    confirmEnroll: async function (factorId, code) {
      var ch = await supabase.auth.mfa.challenge({ factorId: factorId });
      if (ch.error) return ch;
      return supabase.auth.mfa.verify({ factorId: factorId, challengeId: ch.data.id, code: code });
    },
    disable: function (factorId) { return supabase.auth.mfa.unenroll({ factorId: factorId }); },
  };
})(window);
