// Mandatory two-factor set-up for administrators (Supabase Auth's own TOTP MFA; this page never talks to the VIFF backend).
(function (global) {
  'use strict';
  var NEXT = 'dashboard-admin-overview.html', factorId = null, busy = false;
  function $(id) { return document.getElementById(id); }
  function show(id) { ['s-load', 's-intro', 's-scan', 's-done', 's-error'].forEach(function (s) { $(s).hidden = s !== id; }); }
  function fatal(msg) { $('e-fatal').textContent = msg; show('s-error'); }
  function groups(secret) { return String(secret || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim(); }

  async function boot() {
    var s = await supabase.auth.getSession();
    if (!s.data || !s.data.session) { global.location.href = 'login.html'; return; }
    var lvl = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(), f = await supabase.auth.mfa.listFactors();
    var verified = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
    if (verified.length) {
      if (lvl.data && lvl.data.currentLevel === 'aal2') { global.location.href = NEXT; return; }
      await supabase.auth.signOut(); global.location.href = 'login.html?reason=mfa'; return;       // already set up: sign in with the code
    }
    show('s-intro');
  }

  async function startEnroll() {
    if (busy) return; busy = true; $('b-start').disabled = true; $('e-intro').textContent = '';
    try {
      var existing = await supabase.auth.mfa.listFactors();                                          // drop half-finished attempts
      var stale = ((existing.data && existing.data.totp) || []).filter(function (x) { return x.status === 'unverified'; });
      for (var i = 0; i < stale.length; i++) { await supabase.auth.mfa.unenroll({ factorId: stale[i].id }); }
      var r = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (r.error || !r.data) { $('e-intro').textContent = 'Could not start set-up. Please try again.'; return; }
      factorId = r.data.id;
      var host = $('qr'); while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(global.TFISQR.svg(r.data.totp.uri, 200));
      $('secret').textContent = groups(r.data.totp.secret);
      show('s-scan'); $('code').focus();
    } catch (e) { $('e-intro').textContent = 'Could not start set-up. Please check your connection.'; }
    finally { busy = false; $('b-start').disabled = false; }
  }

  async function confirm() {
    if (busy) return;
    var code = $('code').value.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) { $('e-scan').textContent = 'Enter the 6 digits shown in your authenticator app.'; return; }
    busy = true; $('b-confirm').disabled = true; $('e-scan').textContent = '';
    try {
      var ch = await supabase.auth.mfa.challenge({ factorId: factorId });
      var v = ch.error ? ch : await supabase.auth.mfa.verify({ factorId: factorId, challengeId: ch.data.id, code: code });
      if (v.error) { $('e-scan').textContent = 'That code is not right, or it has expired. Use the newest code.'; $('code').value = ''; $('code').focus(); return; }
      show('s-done');
    } catch (e) { $('e-scan').textContent = 'Could not check the code. Please try again.'; }
    finally { busy = false; $('b-confirm').disabled = false; }
  }

  $('b-start').addEventListener('click', startEnroll);
  $('b-confirm').addEventListener('click', confirm);
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
  $('b-go').addEventListener('click', function () { global.location.href = NEXT; });
  $('b-copy').addEventListener('click', function () {
    var t = $('secret').textContent.replace(/\s+/g, '');
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('b-copy').textContent = 'Copied'; setTimeout(function () { $('b-copy').textContent = 'Copy'; }, 1500); });
  });
  $('b-out').addEventListener('click', async function (e) { e.preventDefault(); await supabase.auth.signOut(); global.location.href = 'login.html'; });
  global.addEventListener('load', function () { boot().catch(function () { fatal('We could not check your account. Please check your connection and try again.'); }); });
})(window);
