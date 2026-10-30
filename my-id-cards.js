// ══════════════════════════════════════════════════════════════
//  VIFF — my-id-cards.js
//  Lets a parent pick which child, then opens that child's printable
//  ID card. Reuses the ALREADY-TESTED /api/parent/profile endpoint —
//  no new backend route. Renders via TFIS.h() only, never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h;

  async function call(method, path) {
    var r = await apiRequest(method, path);
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }

  function list(children) {
    return h('ul', { 'class': 'ui-list' }, children.map(function (c) {
      return h('li', null,
        h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, c.name), h('div', { 'class': 'ui-li-meta' }, [c.className, c.admissionNumber].filter(Boolean).join(' \u00B7 '))),
        h('a', { 'class': 'pr-btn gold', target: '_blank', rel: 'noopener', href: 'id-card.html?role=parent&child=' + encodeURIComponent(c.id) }, 'Open ID card'));
    }));
  }

  async function boot() {
    var box = document.getElementById('pr-body');
    var session = await global.requireLogin();
    if (!session) return;
    var r = await call('GET', '/parent/profile');
    if (!r.ok) {
      var msg = r.status === 403 ? (r.data && r.data.message) || 'You do not have access to this.' : 'We could not load your children. Please try again.';
      T.clear(box).appendChild(h('div', { 'class': 'pr-error' }, h('p', null, msg)));
      return;
    }
    var children = r.data.children;
    T.clear(box).appendChild(P.card('My children', null, children.length ? list(children) : P.empty('No child is linked to your account yet.')));
  }

  global.addEventListener('load', boot);
})(window);
