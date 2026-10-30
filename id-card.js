// ══════════════════════════════════════════════════════════════
//  VIFF — id-card.js
//  Renders the printable student ID card. Every value goes in via
//  TFIS.h() (textContent), never innerHTML — a name or note that
//  contains markup is shown as plain text, never runs.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, h = T.h;

  function setColors(school) {
    document.documentElement.style.setProperty('--pr-navy', school.primaryColor || '#0b1f5c');
    document.documentElement.style.setProperty('--pr-gold', school.accentColor || '#8dc63f');
  }

  function crest(school) {
    if (school.logoUrl) return h('div', { 'class': 'id-crest' }, h('img', { src: school.logoUrl, alt: '' }));
    var initial = (school.name || 'S').trim().charAt(0).toUpperCase();
    return h('div', { 'class': 'id-crest' }, h('span', null, initial));
  }

  function field(label, value) {
    return h('div', { 'class': 'id-field' }, h('b', null, label), h('span', null, value || '\u2014'));
  }

  var STATUS_LABEL = { active: 'Active', revoked: 'Revoked', not_issued: 'Not yet issued' };

  function render(d) {
    setColors(d.school);
    var s = d.student, card = d.card;

    var front = h('div', { 'class': 'id-front' },
      h('div', { 'class': 'id-head' }, crest(d.school),
        h('div', { 'class': 'id-head-text' }, h('div', { 'class': 'id-school-name' }, d.school.name), h('div', { 'class': 'id-badge' }, 'Student ID'))),
      h('div', { 'class': 'id-photo-row' }, h('img', { 'class': 'id-photo', src: card.photoUrl || '', alt: '', onerror: function (e) { e.target.style.visibility = 'hidden'; } })),
      h('div', { 'class': 'id-name' }, s.name),
      h('div', { 'class': 'id-class' }, s.className || '\u2014'),
      h('div', { 'class': 'id-fields' },
        field('Admission No.', s.admissionNumber), field('Session', s.session), field('Phone', s.phone)),
      d.showQr ? h('div', { 'class': 'id-qr-row' }) : null,
      h('div', { 'class': 'id-valid' }, d.validText));

    if (d.showQr) {
      var qrRow = front.querySelector('.id-qr-row');
      if (qrRow) qrRow.appendChild(global.TFISQR.svg(d.verificationCode, 96));
    }

    var status = h('div', { 'class': 'id-status ' + card.status }, STATUS_LABEL[card.status] || card.status);

    var back = h('div', { 'class': 'id-back' },
      h('h4', null, 'Terms of Use'),
      h('p', { 'class': 'id-terms' }, d.termsText),
      h('div', { 'class': 'id-contact' },
        d.school.address ? h('div', null, d.school.address) : null,
        [d.school.phone, d.school.email].filter(Boolean).join('  \u00B7  ')),
      h('div', { 'class': 'id-signed' }, 'Verification code: ' + d.verificationCode));

    return h('div', { 'class': 'id-cards' },
      h('div', { 'class': 'id-card' }, front, status),
      h('div', { 'class': 'id-card' }, back));
  }

  function errorBox(message) {
    return h('div', { 'class': 'pr-error' }, h('p', null, message));
  }

  async function boot() {
    var box = document.getElementById('pr-body');
    var role = global.PrintAPI.role();
    if (!role) { T.clear(box).appendChild(errorBox('This page was opened without saying whose ID card to show.')); return; }

    if (role !== 'admin') {
      var session = await global.requireLogin();
      if (!session) return;
    }

    var r = await global.PrintAPI.idCard();
    if (!r.ok) {
      var msg = r.status === 404 ? 'That student could not be found.' : r.status === 403 ? (r.data && r.data.message) || 'You do not have access to this.' : 'We could not load this ID card. Please try again.';
      T.clear(box).appendChild(errorBox(msg));
      return;
    }
    document.title = r.data.student.name + ' — ID Card';
    T.clear(box).appendChild(render(r.data));
    document.getElementById('pr-print').disabled = false;
  }

  global.addEventListener('load', boot);
})(window);
