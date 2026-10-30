// ══════════════════════════════════════════════════════════════
//  VIFF — tfis-ui.js
//  Shared toolkit for the redesigned dashboards.
//
//  SECURITY: nothing in here ever writes data through innerHTML.
//  Every value goes in via textContent / setAttribute on elements
//  created with createElement, so a name, title or message that
//  contains "<script>" or "<img onerror=…>" is displayed as plain
//  text and can never run. Use h() for every new piece of UI that
//  shows data from the server.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var HTML_NS = 'http://www.w3.org/1999/xhtml';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ── DOM builder ─────────────────────────────────────────────
  // h('div', { class: 'card', onclick: fn, 'aria-label': 'x' }, 'text', childNode, [more])
  // Only these attribute names are accepted; anything that could
  // carry script (on* strings, href="javascript:…", style strings,
  // srcdoc) is refused.
  function isSafeAttr(name, value) {
    if (/^on/i.test(name)) return false;
    if (name === 'style' || name === 'srcdoc') return false;
    if ((name === 'href' || name === 'src') && !/^(https?:|#|[a-z0-9_./-]+(\?[^\s]*)?$)/i.test(String(value))) return false;
    return true;
  }

  function appendChildren(el, kids) {
    kids.forEach(function (k) {
      if (k === null || k === undefined || k === false) return;
      if (Array.isArray(k)) { appendChildren(el, k); return; }
      if (k instanceof Node) { el.appendChild(k); return; }
      el.appendChild(document.createTextNode(String(k)));
    });
  }

  function build(el, props, kids) {
    if (props) {
      Object.keys(props).forEach(function (name) {
        var value = props[name];
        if (value === null || value === undefined || value === false) return;
        if (name === 'class') { el.setAttribute('class', String(value)); return; }
        if (name === 'text') { el.textContent = String(value); return; }
        if (typeof value === 'function') {
          // only real event names, wired with addEventListener
          if (/^on[a-z]+$/.test(name)) el.addEventListener(name.slice(2), value);
          return;
        }
        if (!isSafeAttr(name, value)) return;
        el.setAttribute(name, value === true ? '' : String(value));
      });
    }
    appendChildren(el, kids);
    return el;
  }

  function h(tag, props) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return build(document.createElementNS(HTML_NS, tag), props, kids);
  }

  function svg(tag, props) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return build(document.createElementNS(SVG_NS, tag), props, kids);
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ── Icons (stroke set, same family the app already uses) ────
  var ICONS = {
    home:     [['path', 'M4 11.5L12 4l8 7.5'], ['path', 'M6 10v9.5h12V10']],
    results:  [['rect', { x: 5.5, y: 4.5, width: 13, height: 17, rx: 2 }], ['rect', { x: 9, y: 2.5, width: 6, height: 3.5, rx: 1 }], ['path', 'M8.5 11h7M8.5 14.5h7M8.5 18h4']],
    calendar: [['path', 'M8 3.5v3M16 3.5v3M4 8.5h16'], ['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2 }]],
    test:     [['rect', { x: 4, y: 3.5, width: 16, height: 17, rx: 2 }], ['path', 'M8 8h8M8 12h8M8 16h4']],
    bell:     [['path', 'M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z'], ['path', 'M10 18.5a2 2 0 0 0 4 0']],
    clock:    [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 7v5l3.5 2']],
    user:     [['circle', { cx: 12, cy: 8, r: 3.7 }], ['path', 'M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6']],
    lock:     [['rect', { x: 5.5, y: 10.5, width: 13, height: 10, rx: 2 }], ['path', 'M8 10.5V7.5a4 4 0 0 1 8 0v3']],
    cap:      [['path', 'M2 9l10-4.5L22 9l-10 4.5L2 9z'], ['path', 'M6 11v4.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5V11']],
    trophy:   [['path', 'M7 4.5h10v4a5 5 0 0 1-10 0v-4z'], ['path', 'M7 6H4.5a2 2 0 0 0 0 4H7M17 6h2.5a2 2 0 0 1 0 4H17'], ['path', 'M12 13.5V17M8.5 20.5h7']],
    bars:     [['rect', { x: 4, y: 12, width: 3.4, height: 8, rx: 0.5 }], ['rect', { x: 10.3, y: 7, width: 3.4, height: 13, rx: 0.5 }], ['rect', { x: 16.6, y: 15, width: 3.4, height: 5, rx: 0.5 }]],
    megaphone:[['path', 'M3 10v4h3l6 3.5V6.5L6 10H3z'], ['path', 'M13.5 8.5a5 5 0 0 1 0 7M16.5 6a9 9 0 0 1 0 12']],
    check:    [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M8 12.5l2.5 2.5L16 9']],
    alert:    [['path', 'M12 3.5L2.5 20h19L12 3.5z'], ['path', 'M12 10v4.5'], ['path', 'M12 17.3v.01']],
    wallet:   [['rect', { x: 3.5, y: 6, width: 17, height: 13, rx: 2 }], ['path', 'M3.5 10h17'], ['circle', { cx: 16.5, cy: 14.5, r: 1 }]],
    arrow:    [['path', 'M5 12h14M13 6l6 6-6 6']],
    doc:      [['path', 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5H7A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z'], ['path', 'M14 3.5V7.5h4'], ['path', 'M9 12h6M9 15h6']],
    logout:   [['path', 'M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3'], ['path', 'M20 12H10.5M17 8.5L20.5 12 17 15.5']],
    menu:     [['path', 'M4 6.5h16M4 12h16M4 17.5h16']],
  };

  function icon(name, extraClass) {
    var g = svg('g');
    (ICONS[name] || []).forEach(function (part) {
      var attrs = typeof part[1] === 'string' ? { d: part[1] } : part[1];
      g.appendChild(svg(part[0], attrs));
    });
    return svg('svg', { 'class': 'icon' + (extraClass ? ' ' + extraClass : ''), viewBox: '0 0 24 24', 'aria-hidden': 'true' }, g);
  }

  // ── Donut chart (pure SVG, no library) ──────────────────────
  // segments: [{ value, color }]   centre: { top, bottom }
  function donut(segments, centre, opts) {
    opts = opts || {};
    var size = opts.size || 132, stroke = opts.stroke || 15;
    var r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r;
    var total = segments.reduce(function (s, x) { return s + (x.value > 0 ? x.value : 0); }, 0);

    var root = svg('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'img', 'aria-label': opts.label || 'Chart' });
    root.appendChild(svg('circle', { cx: c, cy: c, r: r, fill: 'none', stroke: '#edf0f6', 'stroke-width': stroke }));

    if (total > 0) {
      var g = svg('g', { transform: 'rotate(-90 ' + c + ' ' + c + ')' });
      var offset = 0;
      segments.forEach(function (seg) {
        if (!(seg.value > 0)) return;
        var len = (seg.value / total) * circ;
        g.appendChild(svg('circle', {
          cx: c, cy: c, r: r, fill: 'none', stroke: seg.color, 'stroke-width': stroke,
          'stroke-dasharray': len + ' ' + (circ - len), 'stroke-dashoffset': -offset,
        }));
        offset += len;
      });
      root.appendChild(g);
    }
    if (centre) {
      root.appendChild(svg('text', { x: c, y: c + (centre.bottom ? -1 : 6), 'text-anchor': 'middle', 'class': 'ui-donut-top' }, centre.top));
      if (centre.bottom) root.appendChild(svg('text', { x: c, y: c + 17, 'text-anchor': 'middle', 'class': 'ui-donut-bottom' }, centre.bottom));
    }
    return root;
  }

  // ── formatters ──────────────────────────────────────────────
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function ordinal(n) {
    var v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  }

  function toDate(v) {
    if (!v) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    var d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(v) {
    var d = toDate(v);
    return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }

  function fmtNaira(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return '\u20A6' + n.toLocaleString('en-NG', { maximumFractionDigits: 2 });
  }

  function fmtNumber(n, digits) {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  function greeting(date) {
    var hr = (date || new Date()).getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }

  function gradeTone(grade) {
    return grade === 'A' ? 'green' : grade === 'B' ? 'blue' : grade === 'C' ? 'amber' : 'red';
  }

  // Shown on sample (demo) accounts only, so nobody mistakes them for real ones.
  function demoNotice() {
    return h('div', { 'class': 'ui-demo', role: 'note' }, icon('alert'),
      h('div', null, h('strong', null, 'Sample data. '),
        'This account and everything on this page are for demonstration. They are removed automatically when real students, parents or teachers are registered.'));
  }

  global.TFIS = {
    h: h, svg: svg, clear: clear, icon: icon, donut: donut,
    initials: initials, ordinal: ordinal, fmtDate: fmtDate, fmtNaira: fmtNaira, fmtNumber: fmtNumber,
    greeting: greeting, gradeTone: gradeTone, demoNotice: demoNotice,
  };
})(window);
