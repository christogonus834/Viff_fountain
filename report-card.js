// ══════════════════════════════════════════════════════════════
//  VIFF — report-card.js
//  Renders the printable academic report. Every value goes in via
//  TFIS.h() (textContent), never innerHTML.
// ══════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var T = global.TFIS, h = T.h;

  function setColors(school) {
    document.documentElement.style.setProperty('--pr-navy', school.primaryColor || '#0b1f5c');
    document.documentElement.style.setProperty('--pr-gold', school.accentColor || '#8dc63f');
  }

  function info(label, value) {
    return h('div', null, h('b', null, label), h('span', null, value));
  }

  function gradeChip(grade) {
    var tone = grade === 'A' ? '#e3f5ea' : grade === 'B' ? '#e7eefc' : grade === 'C' ? '#fff1d3' : '#fde8e7';
    var color = grade === 'A' ? '#12833f' : grade === 'B' ? '#2456c9' : grade === 'C' ? '#a35f00' : '#c22f2b';
    var chip = h('span', { 'class': 'rc-grade-chip' }, grade);
    chip.style.background = tone; chip.style.color = color;
    return chip;
  }

  function subjectsTable(d) {
    var rows = d.subjects.map(function (s) {
      return h('tr', null,
        h('td', null, s.subject), h('td', { 'class': 'num' }, T.fmtNumber(s.ca, 1)), h('td', { 'class': 'num' }, T.fmtNumber(s.exam, 1)),
        h('td', { 'class': 'num' }, h('strong', null, T.fmtNumber(s.total, 1))), h('td', { 'class': 'num' }, gradeChip(s.grade)), h('td', null, s.remark));
    });
    return h('div', { 'class': 'rc-table-wrap' }, h('table', { 'class': 'rc-table' },
      h('thead', null, h('tr', null, h('th', null, 'Subject'), h('th', { 'class': 'num' }, 'C.A (40)'), h('th', { 'class': 'num' }, 'Exam (60)'), h('th', { 'class': 'num' }, 'Total'), h('th', { 'class': 'num' }, 'Grade'), h('th', null, 'Remark'))),
      h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 6 }, 'No subject scores recorded.'))),
      h('tfoot', null, h('tr', null, h('td', null, 'Total'), h('td'), h('td'), h('td', { 'class': 'num' }, T.fmtNumber(d.totals.score, 1)), h('td', { 'class': 'num' }, gradeChip(d.totals.grade)), h('td', null, d.totals.remark)))));
  }

  var CATEGORY_LABEL = { affective: 'Affective Traits', psychomotor: 'Psychomotor Domain', cocurricular: 'Co-Curricular Activities' };

  function traitBox(category, items) {
    return h('div', { 'class': 'rc-box' }, h('h4', null, CATEGORY_LABEL[category]),
      h('table', null, items.length
        ? items.map(function (t) { return h('tr', null, h('td', null, t.name), h('td', { 'class': 'num' }, t.score === null ? '\u2014' : String(t.score))); })
        : h('tr', null, h('td', null, 'None set up yet.'))));
  }

  function attendanceBox(a) {
    return h('div', { 'class': 'rc-attend' },
      h('div', null, h('span', null, 'No. of times present'), h('strong', null, String(a.present))),
      h('div', null, h('span', null, 'No. of times absent'), h('strong', null, String(a.absent))),
      a.excused ? h('div', null, h('span', null, 'Excused'), h('strong', null, String(a.excused))) : null,
      h('div', { 'class': 'rc-note' }, a.note));
  }

  function scaleBox(scale) {
    return h('div', { 'class': 'rc-scale' },
      h('table', null,
        h('tr', null, h('td', null, h('b', null, 'Score')), h('td', null, h('b', null, 'Grade')), h('td', null, h('b', null, 'Remark'))),
        scale.map(function (b) { return h('tr', null, h('td', null, b.minScore + '\u2013' + b.maxScore), h('td', null, gradeChip(b.grade)), h('td', null, b.remark)); })));
  }

  function render(d) {
    setColors(d.school);
    var head = h('div', { 'class': 'rc-head' },
      d.school.logoUrl ? h('img', { 'class': 'rc-logo', src: d.school.logoUrl, alt: '' }) : null,
      h('div', { 'class': 'rc-head-text' },
        h('div', { 'class': 'rc-school-name' }, d.school.name),
        h('div', { 'class': 'rc-school-contact' }, [d.school.phone, d.school.email].filter(Boolean).join('  \u00B7  '))));

    var title = h('div', { 'class': 'rc-title' },
      h('h2', null, d.student.className + ' \u2014 ' + d.term + ' Term Academic Report'),
      h('span', { 'class': 'rc-pub ' + (d.isPublished ? 'published' : 'draft') }, d.isPublished ? 'Approved' : 'Draft \u2014 not yet published'));

    var info1 = h('div', { 'class': 'rc-info' },
      info('Name of Student:', d.student.name), info('Term:', d.term + ' Term'),
      info('Admission Number:', d.student.admissionNumber), info('Total Marks Obtainable:', String(d.totals.obtainable)),
      info('Class:', d.student.className), info('Total Score:', T.fmtNumber(d.totals.score, 1)),
      info('Session:', d.session), info('Students Average:', d.totals.classAverage === null ? '\u2014' : d.totals.classAverage + '%'),
      info('No. of Subjects Offered:', String(d.totals.subjectCount)), info('Overall Average:', T.fmtNumber(d.totals.average, 1) + '%'),
      info('Overall Grade:', d.totals.grade));

    var remarks = h('div', { 'class': 'rc-remarks' },
      d.teacherRemark ? h('div', { 'class': 'rc-remark' }, h('b', null, 'Class Teacher\u2019s Remark'), d.teacherRemark) : null,
      d.principalRemark ? h('div', { 'class': 'rc-remark' }, h('b', null, 'Head of School\u2019s Remark'), d.principalRemark) : null);

    var footer = h('div', { 'class': 'rc-footer' },
      h('div', { 'class': 'rc-sign' }, h('div', { 'class': 'rc-sign-line' }, 'Head of School\u2019s Signature')),
      d.nextTermFeesNote ? h('div', { 'class': 'rc-fees-note' }, h('b', null, 'Next Term Fees: '), d.nextTermFeesNote) : null);

    return h('div', { 'class': 'rc-sheet' },
      head, title, info1,
      subjectsTable(d),
      h('div', { 'class': 'rc-grid3' }, traitBox('affective', d.traits.affective), traitBox('psychomotor', d.traits.psychomotor), traitBox('cocurricular', d.traits.cocurricular)),
      h('div', { 'class': 'rc-pair' }, attendanceBox(d.attendance), scaleBox(d.gradeScale)),
      remarks, footer);
  }

  function errorBox(message) { return h('div', { 'class': 'pr-error' }, h('p', null, message)); }

  async function boot() {
    var box = document.getElementById('pr-body');
    var role = global.PrintAPI.role();
    if (!role) { T.clear(box).appendChild(errorBox('This page was opened without saying whose report to show.')); return; }

    if (role !== 'admin') {
      var session = await global.requireLogin();
      if (!session) return;
    }

    var r = await global.PrintAPI.report();
    if (!r.ok) {
      var msg = r.status === 404 ? 'That report could not be found. It may not be published yet.' : r.status === 403 ? (r.data && r.data.message) || 'You do not have access to this.' : 'We could not load this report. Please try again.';
      T.clear(box).appendChild(errorBox(msg));
      return;
    }
    document.title = r.data.student.name + ' — ' + r.data.term + ' Term Report';
    var kids = [render(r.data)];
    if (!r.data.isPublished) kids.unshift(h('div', { 'class': 'pr-notice' }, 'This report has not been published by the school yet. What you see here is a preview.'));
    T.clear(box).appendChild(h('div', { 'class': 'pr-wrap' }, kids));
    document.getElementById('pr-print').disabled = false;
  }

  global.addEventListener('load', boot);
})(window);
