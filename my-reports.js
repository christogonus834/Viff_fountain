// ══════════════════════════════════════════════════════════════
//  VIFF — my-reports.js
//  A small, standalone listing page so a student or parent can find
//  and open a published report card. Reuses the ALREADY-TESTED
//  results endpoints (/api/student/results, /api/parent/profile and
//  /api/parent/children/:childId/results) rather than adding new
//  backend routes. Everything renders via TFIS.h() (textContent),
//  never innerHTML.
//
//  ?role=student            — the logged-in student's own results
//  ?role=parent             — lets the parent choose which child
//  ?role=parent&child=<id>  — go straight to one child's results
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h;

  function params() { return new URLSearchParams(global.location.search); }
  function role() { var r = (params().get('role') || '').toLowerCase(); return r === 'parent' ? 'parent' : 'student'; }

  async function call(method, path) {
    var r = await apiRequest(method, path);
    if (r.status === 401) { supabaseLogout(); }
    return r;
  }

  function printUrl(childId, resultId) {
    var q = role() === 'parent' ? 'role=parent&child=' + encodeURIComponent(childId) : 'role=student';
    return 'report-card.html?' + q + '&result=' + encodeURIComponent(resultId);
  }

  function resultsList(childId, results) {
    if (!results.length) return P.empty('No published report cards yet. They will appear here once the school publishes them.');
    return h('ul', { 'class': 'ui-list' }, results.map(function (r) {
      return h('li', null,
        h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, r.term + ' Term \u00B7 ' + r.session),
          h('div', { 'class': 'ui-li-meta' }, 'Average ' + T.fmtNumber(r.average, 1) + '% \u00B7 Grade ' + r.overallGrade)),
        h('a', { 'class': 'pr-btn gold', target: '_blank', rel: 'noopener', href: printUrl(childId, r.id) }, 'Open'));
    }));
  }

  function errorBox(r) {
    var msg = r.status === 403 ? (r.data && r.data.message) || 'You do not have access to this.' : 'We could not load your report cards. Please try again.';
    return h('div', { 'class': 'pr-error' }, h('p', null, msg));
  }

  async function loadStudent(box) {
    var r = await call('GET', '/student/results');
    if (!r.ok) { T.clear(box).appendChild(errorBox(r)); return; }
    T.clear(box).appendChild(P.card('Published report cards', null, resultsList(null, r.data.results)));
  }

  async function loadParent(box) {
    var childId = params().get('child');
    var pr = await call('GET', '/parent/profile');
    if (!pr.ok) { T.clear(box).appendChild(errorBox(pr)); return; }
    var children = pr.data.children;
    if (!children.length) { T.clear(box).appendChild(h('div', { 'class': 'pr-error' }, h('p', null, 'No child is linked to your account yet.'))); return; }
    if (!childId || !children.some(function (c) { return c.id === childId; })) childId = children[0].id;

    var resultsBox = h('div', { id: 'my-reports-list' }, h('div', { 'class': 'pr-skel' }));
    async function loadFor(id) {
      T.clear(resultsBox).appendChild(h('div', { 'class': 'pr-skel' }));
      var r = await call('GET', '/parent/children/' + encodeURIComponent(id) + '/results');
      T.clear(resultsBox).appendChild(r.ok ? resultsList(id, r.data.results) : errorBox(r));
    }

    var picker = null;
    if (children.length > 1) {
      var sel = h('select', { 'class': 'form-control', style: 'max-width:260px;margin-bottom:14px', 'aria-label': 'Choose child' },
        children.map(function (c) { return h('option', { value: c.id }, c.name + (c.className ? ' \u2014 ' + c.className : '')); }));
      sel.value = childId;
      sel.addEventListener('change', function () { loadFor(sel.value); });
      picker = sel;
    }
    T.clear(box).appendChild(h('div', null, picker, P.card('Published report cards', null, resultsBox)));
    loadFor(childId);
  }

  async function boot() {
    var box = document.getElementById('pr-body');
    var session = await global.requireLogin();
    if (!session) return;
    if (role() === 'parent') await loadParent(box); else await loadStudent(box);
  }

  global.addEventListener('load', boot);
})(window);
