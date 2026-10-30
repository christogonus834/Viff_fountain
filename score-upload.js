// Reads a score file in the browser: CSV or Excel (.xlsx). No outside libraries, nothing leaves the browser until the
// teacher presses "Check file". Also builds the downloadable template.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ScoreUpload = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── CSV ──
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, '');
    var first = text.split(/\r?\n/, 1)[0] || '', best = ',', bestN = -1;
    [',', ';', '\t'].forEach(function (d) { var n = first.split(d).length; if (n > bestN) { bestN = n; best = d; } });
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === best) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ── Excel .xlsx (zip + XML), dependency-free ──
  function xmlDecode(s) {
    return String(s).replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  async function inflateRaw(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('This is not an Excel (.xlsx) file.');
    var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), files = {}, td = new TextDecoder('utf-8');
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
      var ln = dv.getUint16(lo + 26, true), le = dv.getUint16(lo + 28, true), start = lo + 30 + ln + le, data = u8.subarray(start, start + csize);
      files[name] = td.decode(method === 0 ? data : method === 8 ? await inflateRaw(data) : (function () { throw new Error('Unsupported Excel file.'); })());
    }
    return files;
  }
  function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref) || ['', 'A'], n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
  async function readXlsx(buf) {
    var f = await unzip(buf), shared = [];
    if (f['xl/sharedStrings.xml']) {
      (f['xl/sharedStrings.xml'].match(/<si\b[\s\S]*?<\/si>/g) || []).forEach(function (si) {
        si = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''); var t = '', re = /<t\b[^>]*>([\s\S]*?)<\/t>/g, m;
        while ((m = re.exec(si))) t += m[1]; shared.push(xmlDecode(t));
      });
    }
    var path = 'xl/worksheets/sheet1.xml';
    if (f['xl/workbook.xml'] && f['xl/_rels/workbook.xml.rels']) {
      var sh = /<sheet\b[^>]*r:id="([^"]+)"/.exec(f['xl/workbook.xml']);
      if (sh) { var rel = new RegExp('<Relationship\\b[^>]*Id="' + sh[1] + '"[^>]*>').exec(f['xl/_rels/workbook.xml.rels']); var tg = rel && /Target="([^"]+)"/.exec(rel[0]);
        if (tg) path = tg[1].charAt(0) === '/' ? tg[1].slice(1) : 'xl/' + tg[1]; }
    }
    var xml = f[path] || f['xl/worksheets/sheet1.xml']; if (!xml) throw new Error('Could not find the worksheet in this Excel file.');
    var grid = [], re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
    while ((m = re.exec(xml))) {
      var attrs = m[1], body = m[2] || '', ref = (/\br="([A-Z]+)(\d+)"/.exec(attrs) || []), t = (/\bt="([^"]+)"/.exec(attrs) || [])[1];
      if (!ref[1]) continue;
      var v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1], val = null;
      if (t === 'inlineStr') { var it = '', r2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g, mm; while ((mm = r2.exec(body))) it += mm[1]; val = xmlDecode(it); }
      else if (v === undefined) val = null;
      else if (t === 's') val = shared[parseInt(v, 10)] === undefined ? null : shared[parseInt(v, 10)];
      else if (t === 'str' || t === 'e') val = xmlDecode(v);
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else val = Number(v);
      var ri = parseInt(ref[2], 10) - 1, ci = colIndex(ref[1]); (grid[ri] = grid[ri] || [])[ci] = val;
    }
    for (var i = 0; i < grid.length; i++) { grid[i] = grid[i] || []; for (var j = 0; j < grid[i].length; j++) if (grid[i][j] === undefined) grid[i][j] = null; }
    return grid;
  }

  // ── grid -> rows for the server ──
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function detect(headerRow) {
    var col = { adm: -1, name: -1, ca: -1, exam: -1 };
    headerRow.forEach(function (cell, i) {
      var k = norm(cell); if (!k) return;
      if (col.exam < 0 && /exam/.test(k)) col.exam = i;
      else if (col.ca < 0 && (/^(ca|cas|continuousassessment|continuous|test|assessment)/.test(k) || /^ca\d*(040)?$/.test(k))) col.ca = i;
      else if (col.adm < 0 && /(admission|admno|regno|registration|studentid|matric|^id$)/.test(k)) col.adm = i;
      else if (col.name < 0 && /(name|student|pupil)/.test(k)) col.name = i;
    });
    return col;
  }
  function toRows(grid) {
    var h = -1, col = null;
    for (var i = 0; i < Math.min(grid.length, 12); i++) { var c = detect(grid[i] || []); if (c.ca >= 0 && c.exam >= 0) { h = i; col = c; break; } }
    if (h < 0) return { error: 'Could not find the C.A and Exam columns. Download the template and keep its column titles.' };
    if (col.adm < 0 && col.name < 0) return { error: 'Could not find a student column. Keep the "Admission Number" or "Student Name" column from the template.' };
    var rows = [];
    for (var r = h + 1; r < grid.length; r++) {
      var g = grid[r] || [], get = function (ix) { var v = ix >= 0 && g[ix] !== undefined ? g[ix] : null; return (typeof v === 'string' && v.trim() === '') ? null : v; };
      var o = { line: r + 1, admissionNumber: get(col.adm), name: get(col.name), ca: get(col.ca), exam: get(col.exam) };
      if (o.admissionNumber === null && o.name === null && o.ca === null && o.exam === null) continue;
      if (typeof o.admissionNumber === 'number') o.admissionNumber = String(o.admissionNumber);
      rows.push(o);
    }
    if (!rows.length) return { error: 'The file has no student rows under the column titles.' };
    return { rows: rows };
  }

  async function readFile(file) {            // File -> grid
    var name = String(file.name || '').toLowerCase();
    if (/\.xls$/.test(name)) throw new Error('Old .xls files are not supported. In Excel choose Save As > .xlsx or .csv.');
    if (/\.xlsx$/.test(name) || (file.type || '').indexOf('spreadsheetml') > -1) return readXlsx(await file.arrayBuffer());
    return parseCsv(await file.text());
  }

  function esc(v) { v = v == null ? '' : String(v); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function templateCsv(students) {
    var lines = [['Admission Number', 'Student Name', 'C.A (0-40)', 'Exam (0-60)']];
    students.forEach(function (s) { lines.push([s.admissionNumber || '', s.name, s.ca === null || s.ca === undefined ? '' : s.ca, s.exam === null || s.exam === undefined ? '' : s.exam]); });
    return '\uFEFF' + lines.map(function (l) { return l.map(esc).join(','); }).join('\r\n');
  }

  return { parseCsv: parseCsv, readXlsx: readXlsx, toRows: toRows, readFile: readFile, templateCsv: templateCsv, detect: detect };
}));
