// Admission number rules (pure: no database, no network). Works in Node and in the browser (the demo reuses it).
//
// Pattern tokens:  {PREFIX} school code   {YEAR} calendar year of admission   {TERM} 1/2/3 (First/Second/Third)
//                  {CLASS} class admitted into (JSS 1A -> JSS1A)   {SEQ} running number, NEVER resets, never repeats.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AdmissionNumbers = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TOKENS = ['PREFIX', 'YEAR', 'TERM', 'CLASS', 'SEQ'];
  var PRESETS = [
    { id: 'simple',     pattern: '{PREFIX}/{YEAR}/{SEQ}',                  label: 'School / Year / Number' },
    { id: 'term',       pattern: '{PREFIX}/{YEAR}/T{TERM}/{SEQ}',          label: 'School / Year / Term / Number' },
    { id: 'class',      pattern: '{PREFIX}/{YEAR}/{CLASS}/{SEQ}',          label: 'School / Year / Class / Number' },
    { id: 'term-class', pattern: '{PREFIX}/{YEAR}/T{TERM}/{CLASS}/{SEQ}',  label: 'School / Year / Term / Class / Number' }
  ];
  var TERM_CODE = { First: '1', Second: '2', Third: '3' };

  function classCode(name) { var c = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c || 'NA'; }
  function termCode(term) { return TERM_CODE[term] || '1'; }

  // Returns '' when valid, otherwise a plain-language reason.
  function validatePattern(p) {
    p = String(p || '');
    if (p.length < 5 || p.length > 60) return 'The pattern must be between 5 and 60 characters.';
    if (!/^[A-Za-z0-9{}\/_.\-]+$/.test(p)) return 'The pattern may only contain letters, numbers, { } / - _ .';
    var found = p.match(/\{[^}]*\}/g) || [], i;
    for (i = 0; i < found.length; i++) if (TOKENS.indexOf(found[i].slice(1, -1)) < 0) return 'Unknown part ' + found[i] + '. Use ' + TOKENS.map(function (t) { return '{' + t + '}'; }).join(', ') + '.';
    if (p.split('{SEQ}').length !== 2) return 'The pattern must contain {SEQ} exactly once. It is the running number.';
    if (/[{}]/.test(p.replace(/\{[A-Z]+\}/g, ''))) return 'Check the { } brackets in the pattern.';
    if (/\/\/|^\/|\/$/.test(p)) return 'The pattern cannot start or end with "/" or contain "//".';
    return '';
  }

  // settings {pattern, prefix, seqPad}   ctx {year, term, className, seq}
  function format(settings, ctx) {
    var out = String(settings.pattern)
      .replace(/\{PREFIX\}/g, String(settings.prefix).toUpperCase())
      .replace(/\{YEAR\}/g, String(ctx.year))
      .replace(/\{TERM\}/g, termCode(ctx.term))
      .replace(/\{CLASS\}/g, classCode(ctx.className))
      .replace(/\{SEQ\}/g, String(ctx.seq).padStart(Number(settings.seqPad) || 4, '0'));
    return out;
  }

  // For numbers the admin types (manual mode). Must be usable as a login name, so no spaces or odd symbols.
  function validateManual(n) {
    n = String(n == null ? '' : n).trim();
    if (!n) return 'Enter an admission number.';
    if (n.length < 3 || n.length > 40) return 'The admission number must be 3 to 40 characters.';
    if (!/^[A-Za-z0-9][A-Za-z0-9\/_.\-]*$/.test(n)) return 'Use only letters, numbers and / - _ . in an admission number (no spaces).';
    return '';
  }
  function normalise(n) { return String(n || '').trim().toUpperCase(); }

  return { TOKENS: TOKENS, PRESETS: PRESETS, classCode: classCode, termCode: termCode, validatePattern: validatePattern, format: format, validateManual: validateManual, normalise: normalise };
}));
