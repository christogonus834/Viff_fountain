// ══════════════════════════════════════════════════════════════
//  VIFF — tfis-parts.js
//  Reusable dashboard components, shared by the parent page now and
//  the teacher / admin pages later. Load AFTER tfis-ui.js.
//
//  Same safety rule as tfis-ui.js: every value is inserted with
//  textContent through TFIS.h(). Nothing here uses innerHTML, so
//  server data can never run as script.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var T = global.TFIS;
  var h = T.h, icon = T.icon;

  function empty(text) { return h('div', { 'class': 'ui-empty' }, text); }

  function link(label, onClick) {
    return h('button', { type: 'button', 'class': 'ui-link', onclick: onClick }, label, icon('arrow'));
  }

  function card(title, headRight, body, bodyClass) {
    return h('section', { 'class': 'ui-card' },
      h('div', { 'class': 'ui-card-head' }, h('h3', null, title), headRight || null),
      h('div', { 'class': 'ui-card-body' + (bodyClass ? ' ' + bodyClass : '') }, body));
  }

  function badge(text, tone) { return h('span', { 'class': 'ui-badge tone-' + (tone || 'gray') }, text); }

  // A KPI tile; a real <button> (keyboard-focusable) when onClick is given.
  function kpi(tone, iconName, label, value, sub, subTone, onClick) {
    var props = onClick ? { 'class': 'ui-kpi ui-kpi-btn', type: 'button', onclick: onClick } : { 'class': 'ui-kpi' };
    return h(onClick ? 'button' : 'div', props,
      h('div', { 'class': 'ui-kpi-ico tone-' + tone }, icon(iconName)),
      h('div', { 'class': 'ui-kpi-body' },
        h('div', { 'class': 'ui-kpi-label' }, label),
        h('div', { 'class': 'ui-kpi-value' }, value),
        sub ? h('div', { 'class': 'ui-kpi-sub' + (subTone ? ' ui-sub-' + subTone : '') }, sub) : null));
  }

  function skeleton() {
    var kpis = h('div', { 'class': 'ui-kpis' });
    for (var i = 0; i < 4; i++) {
      var s = h('div', { 'class': 'ui-kpi' }, h('div', { 'class': 'ui-skel' }), h('div', { 'class': 'ui-skel' }));
      s.firstChild.style.cssText = 'width:46px;height:46px;border-radius:50%';
      s.lastChild.style.cssText = 'height:38px;flex:1';
      kpis.appendChild(s);
    }
    var block = h('div', { 'class': 'ui-skel' });
    block.style.cssText = 'height:240px;border-radius:14px';
    return h('div', null, kpis, block);
  }

  function errorBlock(message, onRetry) {
    var kids = [h('p', null, message)];
    if (onRetry) kids.push(h('button', { type: 'button', 'class': 'btn btn-gold', onclick: onRetry }, 'Try again'));
    return h('div', { 'class': 'ui-error' }, kids);
  }

  function termLabel(r) { return r ? r.term + ' Term \u00B7 ' + r.session : ''; }

  // ── a published result as a table with score bars ────────────
  function resultsTable(result) {
    var rows = result.subjects.map(function (s) {
      var pct = Math.max(0, Math.min(100, Number(s.total) || 0));
      var bar = h('div', { 'class': 'ui-bar' }, h('span'));
      bar.firstChild.style.width = pct + '%';
      return h('tr', null,
        h('td', null, s.subject),
        h('td', { 'class': 'num' }, T.fmtNumber(s.ca, 1)),
        h('td', { 'class': 'num' }, T.fmtNumber(s.exam, 1)),
        h('td', null, h('strong', null, T.fmtNumber(s.total, 1)), bar),
        h('td', null, badge(s.grade, T.gradeTone(s.grade))));
    });
    return h('div', { 'class': 'ui-table-wrap' }, h('table', { 'class': 'ui-table' },
      h('thead', null, h('tr', null,
        h('th', null, 'Subject'), h('th', { 'class': 'num' }, 'C.A (40)'), h('th', { 'class': 'num' }, 'Exam (60)'),
        h('th', null, 'Total'), h('th', null, 'Grade'))),
      h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 5 }, 'No subject scores recorded.')))));
  }

  // ── attendance donut + legend ────────────────────────────────
  var ATT = [['Present', 'present', '#12833f'], ['Late', 'late', '#e0a100'], ['Absent', 'absent', '#c22f2b'], ['Excused', 'excused', '#2456c9']];
  function attendanceDonut(a) {
    if (!a || !a.total) return empty('No attendance has been recorded yet.');
    var legend = ATT.filter(function (x) { return a[x[1]] > 0; });
    return h('div', { 'class': 'ui-donut-row' },
      T.donut(legend.map(function (x) { return { value: a[x[1]], color: x[2] }; }),
        { top: a.rate + '%', bottom: 'present' }, { label: 'Attendance ' + a.rate + ' percent' }),
      h('ul', { 'class': 'ui-legend' }, legend.map(function (x) {
        var dot = h('span', { 'class': 'dot' }); dot.style.background = x[2];
        return h('li', null, dot, x[0], h('span', { 'class': 'val' }, a[x[1]] + (a[x[1]] === 1 ? ' day' : ' days')));
      })));
  }

  function attendanceTone(status) { return status === 'present' ? 'green' : status === 'late' ? 'amber' : status === 'excused' ? 'blue' : 'red'; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  // ── list builders ────────────────────────────────────────────
  function periodList(periods, emptyText) {
    if (!periods.length) return empty(emptyText);
    return h('ul', { 'class': 'ui-tt' }, periods.map(function (p) {
      return h('li', null, h('span', { 'class': 'time' }, p.period || '\u2014'), h('span', null, p.subject || '\u2014'), h('span', { 'class': 'who' }, p.teacher || ''));
    }));
  }

  function noticeList(items, onOpen) {
    if (!items.length) return empty('No announcements yet.');
    return h('ul', { 'class': 'ui-list' }, items.map(function (n) {
      var main = h('div', { 'class': 'ui-li-main' },
        h('div', { 'class': 'ui-li-title' }, n.title, n.isRead ? null : h('span', { 'class': 'ui-unread', title: 'New' })),
        h('div', { 'class': 'ui-li-text ui-clamp' }, n.message),
        h('div', { 'class': 'ui-li-meta' }, T.fmtDate(n.createdAt)));
      var li = h('li', null, h('div', { 'class': 'ui-li-ico tone-blue' }, icon('megaphone')), main);
      if (onOpen) { li.style.cursor = 'pointer'; li.addEventListener('click', function () { onOpen(n); }); }
      return li;
    }));
  }

  function dateBox(dateStr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
    if (!m) return h('div', { 'class': 'ui-datebox' }, h('b', null, '\u2014'));
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return h('div', { 'class': 'ui-datebox' }, h('b', null, String(d.getDate())), h('span', null, d.toLocaleString('en-GB', { month: 'short' })));
  }

  function eventList(events) {
    if (!events.length) return empty('No upcoming events.');
    return h('ul', { 'class': 'ui-list' }, events.map(function (e) {
      return h('li', null, dateBox(e.date),
        h('div', { 'class': 'ui-li-main' },
          h('div', { 'class': 'ui-li-title' }, e.title),
          h('div', { 'class': 'ui-li-meta' }, [e.time, e.location].filter(Boolean).join(' \u00B7 ') || T.fmtDate(e.date))));
    }));
  }

  function feeRow(label, value) { return h('div', { 'class': 'ui-fee-row' }, h('span', null, label), typeof value === 'string' ? h('span', null, value) : value); }

  T.parts = {
    empty: empty, link: link, card: card, badge: badge, kpi: kpi, skeleton: skeleton, errorBlock: errorBlock,
    termLabel: termLabel, resultsTable: resultsTable, attendanceDonut: attendanceDonut, attendanceTone: attendanceTone, cap: cap,
    periodList: periodList, noticeList: noticeList, eventList: eventList, dateBox: dateBox, feeRow: feeRow,
  };
})(window);
