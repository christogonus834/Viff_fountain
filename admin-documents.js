// ══════════════════════════════════════════════════════════════
//  VIFF — admin-documents.js
//  Document Settings mini-app: branding, grade scale, report traits,
//  and a Print Center to open any student's ID card / report card.
//  Backend only — no direct database calls. Every value renders via
//  TFIS.h() (textContent), never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, P = T.parts, h = T.h, icon = T.icon, clear = T.clear;

  var S = { canConfigure: true, current: 'print' };
  var TITLES = { print: 'Print Center', branding: 'Document Settings', grades: 'Grade Scale', traits: 'Report Traits' };
  var CATS = [['affective', 'Affective Traits'], ['psychomotor', 'Psychomotor Domain'], ['cocurricular', 'Co-Curricular Activities']];

  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function apiMessage(r, fallback) { return r && r.data && r.data.message ? r.data.message : fallback; }
  function toast(message) {
    var el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 4500);
  }

  function navBtn(id) { return document.querySelector('.nav-item[data-page="' + id + '"]'); }
  global.showPage = function (id, btn) {
    S.current = id;
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
    var page = $('page-' + id); if (page) page.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    setText('page-title', TITLES[id] || id);
    global.closeSidebar();
    load(id);
  };
  global.openSidebar = function () { $('sidebar').classList.add('open'); $('sidebar-backdrop').classList.add('show'); };
  global.closeSidebar = function () { $('sidebar').classList.remove('open'); $('sidebar-backdrop').classList.remove('show'); };

  function load(id) {
    if (id === 'print') loadPrintCenter();
    else if (id === 'branding') loadBranding();
    else if (id === 'grades') loadGrades();
    else if (id === 'traits') loadTraits();
  }

  function pageHead(title, subtitle) { return h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, title), subtitle ? h('p', null, subtitle) : null)); }
  function showError(box, r, retry) { clear(box).appendChild(P.errorBlock(r.status === 403 ? apiMessage(r, 'You do not have access to this.') : 'We could not load this. Please try again.', r.status === 403 ? null : retry)); }
  function field(label, id, props, tag) { return h('div', { 'class': 'form-group' }, h('label', { 'class': 'form-label', 'for': id }, label), h(tag || 'input', Object.assign({ 'class': 'form-control', id: id }, props))); }
  function lockNote() { return S.canConfigure ? null : h('div', { 'class': 'ui-fee-note' }, 'Your account can view this but not change it. Ask a superadmin for the "Edit ID card / result document settings" permission.'); }

  // ── PRINT CENTER ─────────────────────────────────────────────
  var pcState = { all: [], filtered: [], student: null, reports: [] };

  async function loadPrintCenter() {
    var box = $('print-body'); clear(box).appendChild(P.skeleton());
    var r = await global.AdminDocsAPI.searchStudents();
    if (!r.ok) return showError(box, r, loadPrintCenter);
    pcState.all = r.data.students; pcState.filtered = pcState.all; pcState.student = null; pcState.reports = [];
    drawPrintCenter(box);
  }

  function drawPrintCenter(box) {
    var search = h('input', { type: 'search', 'class': 'form-control', id: 'pc-search', placeholder: 'Search by name or admission number\u2026', 'aria-label': 'Search students' });
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      pcState.filtered = !q ? pcState.all : pcState.all.filter(function (s) { return s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q); });
      redrawList();
    });

    var list = h('div', { id: 'pc-list' });
    var detail = h('div', { id: 'pc-detail' }, P.empty('Select a student to print their documents.'));

    function redrawList() {
      clear(list).appendChild(pcState.filtered.length
        ? h('ul', { 'class': 'ui-list' }, pcState.filtered.slice(0, 60).map(function (s) {
          var li = h('li', null, h('div', { 'class': 'ui-li-ico tone-navy' }, icon('user')),
            h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, s.name), h('div', { 'class': 'ui-li-meta' }, [s.admissionNumber, s.className].filter(Boolean).join(' \u00B7 '))));
          li.style.cursor = 'pointer';
          li.addEventListener('click', function () { selectStudent(s); });
          return li;
        }))
        : P.empty('No students match your search.'));
    }

    async function selectStudent(s) {
      pcState.student = s;
      clear(detail).appendChild(P.skeleton());
      var results = await Promise.all([global.AdminDocsAPI.idCard(s.id), global.AdminDocsAPI.studentReports(s.id)]);
      var idr = results[0], rr = results[1];
      pcState.reports = rr.ok ? rr.data.results : [];
      var idBtn = h('a', { 'class': 'pr-btn gold', target: '_blank', rel: 'noopener', href: 'id-card.html?role=admin&student=' + encodeURIComponent(s.id) }, 'Open ID card');
      var cardPreview = idr.ok ? h('div', { 'class': 'ui-fee-note' }, 'Card status: ' + (idr.data.card.status === 'not_issued' ? 'not yet issued' : idr.data.card.status)) : null;

      var reportRows = pcState.reports.length
        ? h('ul', { 'class': 'ui-list' }, pcState.reports.map(function (res) {
          return h('li', null, h('div', { 'class': 'ui-li-ico tone-purple' }, icon('doc')),
            h('div', { 'class': 'ui-li-main' }, h('div', { 'class': 'ui-li-title' }, res.term + ' Term \u00B7 ' + res.session), h('div', { 'class': 'ui-li-meta' }, 'Average ' + T.fmtNumber(res.average, 1) + '%')),
            h('a', { 'class': 'ui-link', target: '_blank', rel: 'noopener', href: 'report-card.html?role=admin&student=' + encodeURIComponent(s.id) + '&result=' + encodeURIComponent(res.id) }, 'Open', icon('arrow')));
        }))
        : P.empty('No published reports for this student yet.');

      clear(detail).appendChild(h('div', null,
        h('div', { 'class': 'ui-head' }, h('div', null, h('h2', null, s.name), h('p', null, [s.admissionNumber, s.className].filter(Boolean).join(' \u00B7 ')))),
        P.card('Student ID card', null, h('div', null, cardPreview, h('div', { 'class': 'ui-actions' }, idBtn))),
        h('div', { 'class': 'ui-gap' }), P.card('Published report cards', null, reportRows)));
    }

    redrawList();
    clear(box).appendChild(h('div', null, pageHead('Print Center', 'Find a student to open their ID card or a published report card.'),
      h('div', { 'class': 'ui-cols' }, h('div', { 'class': 'ui-stack' }, P.card('Students', null, h('div', null, search, h('div', { 'class': 'ui-gap' }), list))), h('div', { 'class': 'ui-stack' }, detail))));
  }

  // ── DOCUMENT SETTINGS ────────────────────────────────────────
  async function loadBranding() {
    var box = $('branding-body'); clear(box).appendChild(P.skeleton());
    var r = await global.AdminDocsAPI.getSettings();
    if (!r.ok) return showError(box, r, loadBranding);
    var s = r.data.settings;
    var form = h('div', { 'class': 'ui-form' },
      field('ID card \u2014 terms of use', 'bs-terms', { rows: '4', maxlength: '600' }, 'textarea'),
      field('ID card \u2014 validity note', 'bs-valid', { type: 'text', maxlength: '200' }),
      h('div', { 'class': 'form-group' }, h('label', { 'class': 'form-label' },
        h('input', { type: 'checkbox', id: 'bs-qr' }), ' Show a QR verification code on the ID card')),
      field('Head of school \u2014 name', 'bs-head-name', { type: 'text', maxlength: '120' }),
      field('Head of school \u2014 signature image URL', 'bs-head-sig', { type: 'text', maxlength: '500', placeholder: 'https://\u2026' }),
      field('Next term fees \u2014 note shown on report cards', 'bs-fees', { type: 'text', maxlength: '300', placeholder: 'e.g. Basic 1 to 3 \u20A650,000. Basic 4 & 5 \u20A653,000.' }),
      lockNote(),
      h('div', { 'class': 'ui-actions' }, h('button', { type: 'button', 'class': 'btn btn-gold', id: 'bs-save', onclick: saveBranding, disabled: !S.canConfigure }, 'Save settings')));
    clear(box).appendChild(h('div', null, pageHead('Document Settings', 'Controls what appears on every printed ID card and report card.'), P.card('Branding', null, form)));
    $('bs-terms').value = s.id_card_terms; $('bs-valid').value = s.id_card_valid_text; $('bs-qr').checked = !!s.show_qr_on_id_card;
    $('bs-head-name').value = s.head_of_school_name; $('bs-head-sig').value = s.head_of_school_signature_url; $('bs-fees').value = s.next_term_fees_note;
  }

  async function saveBranding() {
    var btn = $('bs-save'); btn.disabled = true;
    var r = await global.AdminDocsAPI.saveSettings({
      id_card_terms: $('bs-terms').value.trim(), id_card_valid_text: $('bs-valid').value.trim(), show_qr_on_id_card: $('bs-qr').checked,
      head_of_school_name: $('bs-head-name').value.trim(), head_of_school_signature_url: $('bs-head-sig').value.trim(), next_term_fees_note: $('bs-fees').value.trim(),
    });
    btn.disabled = !S.canConfigure;
    toast(r.ok ? 'Document settings saved.' : apiMessage(r, 'Could not save settings.'));
  }

  // ── GRADE SCALE ──────────────────────────────────────────────
  async function loadGrades() {
    var box = $('grades-body'); clear(box).appendChild(P.skeleton());
    var r = await global.AdminDocsAPI.listGradeScale();
    if (!r.ok) return showError(box, r, loadGrades);
    drawGrades(box, r.data.bands);
  }

  function drawGrades(box, bands) {
    var rows = bands.map(function (b) {
      var min = h('input', { type: 'number', 'class': 'form-control ui-score', min: '0', max: '100', value: String(b.minScore) });
      var max = h('input', { type: 'number', 'class': 'form-control ui-score', min: '0', max: '100', value: String(b.maxScore) });
      var grade = h('input', { type: 'text', 'class': 'form-control', style: 'width:70px', maxlength: '4', value: b.grade });
      var remark = h('input', { type: 'text', 'class': 'form-control', maxlength: '40', value: b.remark });
      var save = h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', disabled: !S.canConfigure, onclick: async function () {
        var mn = Number(min.value), mx = Number(max.value);
        if (!isFinite(mn) || !isFinite(mx) || mn > mx) { toast('The minimum score must not be greater than the maximum.'); return; }
        if (!grade.value.trim()) { toast('Enter a grade letter.'); return; }
        var res = await global.AdminDocsAPI.updateBand(b.id, { minScore: mn, maxScore: mx, grade: grade.value.trim(), remark: remark.value.trim() });
        if (!res.ok) { toast(apiMessage(res, 'Could not save.')); return; }
        toast('Saved.'); loadGrades();
      } }, 'Save');
      var del = h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', disabled: !S.canConfigure, onclick: async function () {
        if (!global.confirm('Remove the ' + b.grade + ' band?')) return;
        var res = await global.AdminDocsAPI.deleteBand(b.id);
        if (!res.ok) { toast(apiMessage(res, 'Could not remove.')); return; }
        toast('Removed.'); loadGrades();
      } }, 'Delete');
      return h('tr', null, h('td', null, min), h('td', null, max), h('td', null, grade), h('td', null, remark), h('td', null, h('div', { 'class': 'ui-btnrow' }, save, del)));
    });

    var addForm = h('div', { 'class': 'ui-form-row' },
      h('div', { 'class': 'ui-tool' }, h('label', null, 'Min'), h('input', { 'class': 'form-control ui-score', id: 'ng-min', type: 'number', min: '0', max: '100' })),
      h('div', { 'class': 'ui-tool' }, h('label', null, 'Max'), h('input', { 'class': 'form-control ui-score', id: 'ng-max', type: 'number', min: '0', max: '100' })),
      h('div', { 'class': 'ui-tool' }, h('label', null, 'Grade'), h('input', { 'class': 'form-control', id: 'ng-grade', type: 'text', maxlength: '4', style: 'width:70px' })),
      h('div', { 'class': 'ui-tool ui-grow' }, h('label', null, 'Remark'), h('input', { 'class': 'form-control', id: 'ng-remark', type: 'text', maxlength: '40' })),
      h('button', { type: 'button', 'class': 'btn btn-gold', disabled: !S.canConfigure, onclick: async function () {
        var mn = Number($('ng-min').value), mx = Number($('ng-max').value), grade = $('ng-grade').value.trim();
        if (!isFinite(mn) || !isFinite(mx) || mn > mx) { toast('The minimum score must not be greater than the maximum.'); return; }
        if (!grade) { toast('Enter a grade letter.'); return; }
        var res = await global.AdminDocsAPI.createBand({ minScore: mn, maxScore: mx, grade: grade, remark: $('ng-remark').value.trim() });
        if (!res.ok) { toast(apiMessage(res, 'Could not add the band.')); return; }
        toast('Grade band added.'); loadGrades();
      } }, 'Add band'));

    var table = h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null, h('th', null, 'Min score'), h('th', null, 'Max score'), h('th', null, 'Grade'), h('th', null, 'Remark'), h('th', null, ''))),
      h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 5 }, 'No grade bands yet.')))));

    clear(box).appendChild(h('div', null, pageHead('Grade Scale', 'Used to work out every subject grade and overall grade on printed report cards.'),
      P.card('Bands', null, h('div', null, table, h('div', { 'class': 'ui-gap' }), addForm, lockNote()), 'flush')));
  }

  // ── REPORT TRAITS ────────────────────────────────────────────
  async function loadTraits() {
    var box = $('traits-body'); clear(box).appendChild(P.skeleton());
    var r = await global.AdminDocsAPI.listTraits();
    if (!r.ok) return showError(box, r, loadTraits);
    var traits = r.data.traits;
    var cards = CATS.map(function (cat) { return traitCategoryCard(cat[0], cat[1], traits.filter(function (t) { return t.category === cat[0]; })); });
    clear(box).appendChild(h('div', null, pageHead('Report Traits', 'Affective, psychomotor and co-curricular items scored on the report card.'), h('div', { 'class': 'ui-grid3' }, cards)));
  }

  function traitCategoryCard(category, label, items) {
    var rows = items.map(function (t) {
      var name = h('input', { type: 'text', 'class': 'form-control', maxlength: '60', value: t.name });
      return h('li', null,
        name,
        h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', disabled: !S.canConfigure, onclick: async function () {
          if (!name.value.trim()) { toast('Enter a name.'); return; }
          var res = await global.AdminDocsAPI.updateTrait(t.id, { name: name.value.trim() });
          if (!res.ok) { toast(apiMessage(res, 'Could not save.')); return; } toast('Saved.'); loadTraits();
        } }, 'Save'),
        h('button', { type: 'button', 'class': 'btn btn-outline btn-sm', disabled: !S.canConfigure, onclick: async function () {
          if (!global.confirm('Remove "' + t.name + '"?')) return;
          var res = await global.AdminDocsAPI.deleteTrait(t.id);
          if (!res.ok) { toast(apiMessage(res, 'Could not remove.')); return; } toast('Removed.'); loadTraits();
        } }, 'Delete'));
    });
    var addRow = h('div', { 'class': 'ui-traitadd' },
      h('input', { type: 'text', 'class': 'form-control', placeholder: 'New item name', maxlength: '60', id: 'nt-' + category }),
      h('button', { type: 'button', 'class': 'btn btn-gold btn-sm', disabled: !S.canConfigure, onclick: async function () {
        var input = $('nt-' + category), val = input.value.trim();
        if (!val) { toast('Enter a name.'); return; }
        var res = await global.AdminDocsAPI.createTrait({ category: category, name: val });
        if (!res.ok) { toast(apiMessage(res, 'Could not add.')); return; }
        toast('Added.'); loadTraits();
      } }, 'Add'));
    return P.card(label, null, h('div', null, h('ul', { 'class': 'ui-traitlist' }, rows.length ? rows : [h('li', null, P.empty('None yet.'))]), addRow, lockNote()));
  }

  // ── start-up ─────────────────────────────────────────────────
  async function boot() {
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.appendChild(icon(el.getAttribute('data-icon'))); });
    var session = await global.requireLogin();
    if (!session) return;
    var r = await global.AdminDocsAPI.me();
    if (!r.ok) {
      if (r.status === 401) return;
      if (r.status === 403) { global.location.href = 'login.html'; return; }
      clear($('print-body')).appendChild(P.errorBlock('We could not load your account. Please check your connection and try again.', function () { global.location.reload(); }));
      return;
    }
    setText('a-name', r.data.user.name); setText('a-avatar', T.initials(r.data.user.name)); setText('a-role', T.parts.cap(r.data.user.role));
    S.canConfigure = r.data.user.canConfigure;
    await loadPrintCenter();
  }

  global.addEventListener('load', boot);
})(window);
