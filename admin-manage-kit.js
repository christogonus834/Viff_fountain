// Small shared helpers for the Student Management and Finance Management screens. Everything renders through TFIS.h (textContent).
(function (global) {
  'use strict';
  var T = global.TFIS, h = T.h, clear = T.clear;

  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 4200);
  }
  function apiMessage(r, fallback) { return r && r.data && r.data.message ? r.data.message : fallback; }

  function input(o) {
    o = o || {}; var el = h('input', { 'class': 'am-input', type: o.type || 'text', id: o.id, placeholder: o.placeholder, maxlength: o.maxlength, min: o.min, step: o.step, autocomplete: 'off' });
    if (o.value !== undefined && o.value !== null) el.value = o.value; return el;
  }
  function textarea(o) { o = o || {}; var el = h('textarea', { 'class': 'am-textarea', id: o.id, rows: o.rows || 3, maxlength: o.maxlength, placeholder: o.placeholder }); if (o.value) el.value = o.value; return el; }
  function select(options, value, o) {            // options: ['A', 'B'] or [{value,label}]
    o = o || {}; var el = h('select', { 'class': 'am-select', id: o.id });
    options.forEach(function (op) { var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op; var opt = h('option', { value: v }, l); el.appendChild(opt); });
    if (value !== undefined && value !== null) el.value = value; return el;
  }
  function field(label, control, hint) { return h('div', { 'class': 'am-field' }, h('label', null, label), control, hint ? h('div', { 'class': 'am-hint' }, hint) : null); }
  function tabs(items, active, onPick) {
    var wrap = h('div', { 'class': 'am-tabs', role: 'tablist' });
    items.forEach(function (it) {
      var b = h('button', { 'class': 'am-tab', type: 'button', role: 'tab', 'aria-selected': it.id === active ? 'true' : 'false', onclick: function () { onPick(it.id); } },
        it.label, it.count ? h('span', { 'class': 'am-count' }, String(it.count)) : null);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function modal(title, body, opts) {
    opts = opts || {};
    var overlay = h('div', { 'class': 'am-overlay' }), prev = document.activeElement;
    var closeBtn = h('button', { 'class': 'am-x', type: 'button', 'aria-label': 'Close', onclick: close }, '\u00D7');
    var box = h('div', { 'class': 'am-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { 'class': 'am-modal-head' }, h('h3', null, title), closeBtn), h('div', { 'class': 'am-modal-body' }, body));
    overlay.appendChild(box);
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { document.removeEventListener('keydown', onKey); if (overlay.parentNode) overlay.parentNode.removeChild(overlay); if (prev && prev.focus) prev.focus(); if (opts.onClose) opts.onClose(); }
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.sticky) close(); });
    document.addEventListener('keydown', onKey); document.body.appendChild(overlay);
    var first = box.querySelector('input,select,textarea,button.am-btn'); if (first) first.focus();
    return { close: close, el: box };
  }

  // A form modal: fields -> Save. onSubmit(close, setError, setBusy) is called when the form is valid to submit.
  function formModal(title, fields, saveLabel, onSubmit, tone) {
    var err = h('div', { 'class': 'am-err', role: 'alert' }), save = h('button', { 'class': 'am-btn ' + (tone || 'gold'), type: 'button' }, saveLabel);
    var cancel = h('button', { 'class': 'am-btn line', type: 'button' }, 'Cancel');
    var body = h('div', { 'class': 'am-modal-body', style: 'padding:0' }, fields, err, h('div', { 'class': 'am-actions' }, save, cancel));
    var m = modal(title, body);
    cancel.addEventListener('click', m.close);
    function setError(t) { err.textContent = t || ''; }
    function setBusy(b) { save.disabled = b; cancel.disabled = b; save.textContent = b ? 'Please wait\u2026' : saveLabel; }
    save.addEventListener('click', function () { setError(''); onSubmit(m.close, setError, setBusy); });
    return m;
  }
  function confirmBox(title, message, label, onYes, tone) {
    return formModal(title, h('p', { style: 'margin:0;line-height:1.5' }, message), label, function (close, setError, setBusy) { setBusy(true); Promise.resolve(onYes()).then(function (msg) { if (msg) setError(msg); else close(); setBusy(false); }); }, tone || 'red');
  }

  function csvDownload(filename, rows) {
    var esc = function (v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };   // also blocks spreadsheet-formula injection
    var blob = new Blob(['\uFEFF' + rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function csvDownloadRaw(filename, text) {                      // text is already CSV (built by StudentImport)
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function copyText(text) { if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }, function () { toast('Could not copy. Select the text and copy it.'); }); toast('Select the text and copy it.'); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function shell() {                         // sidebar helpers shared by every admin page
    global.showPage = function () {};
    global.openSidebar = function () { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-backdrop').classList.add('show'); };
    global.closeSidebar = function () { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-backdrop').classList.remove('show'); };
  }
  global.AMKit = { toast: toast, apiMessage: apiMessage, input: input, textarea: textarea, select: select, field: field, tabs: tabs, modal: modal, formModal: formModal, confirmBox: confirmBox,
    csvDownload: csvDownload, csvDownloadRaw: csvDownloadRaw, copyText: copyText, debounce: debounce, shell: shell, clear: clear };
})(window);
