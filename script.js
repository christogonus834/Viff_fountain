/* ═══════════════════════════════════
   VIFF — VIFF FOUNDATION INTERNATIONAL ACADEMY
   Shared Script
═══════════════════════════════════ */

// ── GREETING BAR ──
function setGreeting() {
  const bar = document.getElementById('announce-bar');
  if (!bar) return;
  const h = new Date().getHours();
  const g = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  bar.innerHTML = `<strong>${g}!</strong> &nbsp;Welcome to VIFF FOUNDATION INTERNATIONAL ACADEMY — Nurturing Excellence Since 2005 &nbsp;<svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></g></svg>&nbsp; <a href="results.html" style="color:var(--gold-light);font-weight:600;text-decoration:none;"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><rect x="5.5" y="4.5" width="13" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/></g></svg> Check Your Results <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M4 12h15.5M14 6l6 6-6 6"/></g></svg></a>`;
}

// ── NAV HAMBURGER ──
function initNav() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) nav.classList.remove('open');
  });
}

// ── TOAST ──
function showToast(msg, duration = 3500) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── DARK MODE ──
function initDarkToggle() {
  const btn = document.getElementById('dark-toggle');
  if (!btn) return;
  if (localStorage.getItem('tfis-theme') === 'dark') {
    document.body.classList.add('dark');
    btn.textContent = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12h2.5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8"/></g></svg> Light Mode';
  }
  btn.addEventListener('click', () => {
    const d = document.body.classList.toggle('dark');
    localStorage.setItem('tfis-theme', d ? 'dark' : 'light');
    btn.textContent = d ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12h2.5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8"/></g></svg> Light Mode' : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></g></svg> Dark Mode';
    showToast(d ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></g></svg> Dark mode enabled' : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12h2.5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8"/></g></svg> Light mode enabled');
  });
}

// ── SCROLL REVEAL ──
function initScrollReveal() {
  const els = document.querySelectorAll('.scroll-reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

// ── COUNTER ANIMATION ──
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const dur = 1800;
  const step = Math.ceil(target / (dur / 16));
  let cur = 0;
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString() + suffix;
    if (cur >= target) clearInterval(t);
  }, 16);
}
function initCounters() {
  const cs = document.querySelectorAll('.counter');
  if (!cs.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  cs.forEach(c => io.observe(c));
}

// ── WELCOME TOGGLE ──
function initWelcomeToggle() {
  const btn = document.getElementById('welcome-toggle');
  const box = document.getElementById('welcome-box');
  if (!btn || !box) return;
  btn.addEventListener('click', () => {
    const open = box.style.display === 'block';
    box.style.display = open ? 'none' : 'block';
    btn.textContent = open ? '▼ Read Our Welcome Message' : '▲ Hide Welcome Message';
  });
}

// ── CONTACT FORM ──
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name    = document.getElementById('f-name').value.trim();
    const email   = document.getElementById('f-email').value.trim();
    const message = document.getElementById('f-message').value.trim();
    if (!name || !email || !message) { showToast('<svg class="icon icon-warn" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none"/></g></svg> Please fill in all required fields.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('<svg class="icon icon-warn" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none"/></g></svg> Please enter a valid email address.'); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Sending…';
    setTimeout(() => {
      form.reset(); btn.disabled = false; btn.textContent = 'Send Message <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 7 8.5-7"/></g></svg>';
      showToast('<svg class="icon icon-success" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></g></svg> Message sent! We\'ll respond within 24 hours.');
    }, 1400);
  });
}

// ── RESULTS CHECKER ──
function initResultsChecker() {
  const form = document.getElementById('results-form');
  if (!form) return;

  // Demo coupon codes (in real backend these come from server)
  const DEMO_CODES = {
    'VIFF-2024-ABCD': {
      student: 'Chidera Okonkwo', class: 'SS1A', term: '2nd Term 2024/2025',
      subjects: [
        { name:'English Language', score:78, grade:'B', remark:'Good' },
        { name:'Mathematics',      score:85, grade:'A', remark:'Excellent' },
        { name:'Biology',          score:72, grade:'B', remark:'Good' },
        { name:'Chemistry',        score:69, grade:'C', remark:'Average' },
        { name:'Physics',          score:80, grade:'A', remark:'Excellent' },
        { name:'ICT',              score:91, grade:'A', remark:'Excellent' },
      ]
    },
    'VIFF-2024-WXYZ': {
      student: 'Amina Bello', class: 'JS3B', term: '2nd Term 2024/2025',
      subjects: [
        { name:'English Language', score:88, grade:'A', remark:'Excellent' },
        { name:'Mathematics',      score:74, grade:'B', remark:'Good' },
        { name:'Basic Science',    score:65, grade:'C', remark:'Average' },
        { name:'Social Studies',   score:79, grade:'B', remark:'Good' },
        { name:'ICT',              score:93, grade:'A', remark:'Excellent' },
        { name:'Agricultural Sci', score:70, grade:'B', remark:'Good' },
      ]
    }
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const code = (document.getElementById('coupon-code').value || '').trim().toUpperCase();
    const preview = document.getElementById('result-preview');
    const errBox  = document.getElementById('coupon-error');

    if (errBox) errBox.style.display = 'none';
    preview.classList.remove('show');

    if (!code) { showToast('<svg class="icon icon-warn" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none"/></g></svg> Please enter your coupon code.'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Checking…';

    setTimeout(() => {
      btn.disabled = false; btn.textContent = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5L15.2 15.2"/></g></svg> Check My Results';
      const data = DEMO_CODES[code];
      if (!data) {
        if (errBox) { errBox.style.display='block'; errBox.textContent = '<svg class="icon icon-danger" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></g></svg> Invalid or already-used coupon code. Please contact the school admin.'; }
        showToast('<svg class="icon icon-danger" viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></g></svg> Coupon code not found.');
        return;
      }
      renderResult(data, preview);
      preview.classList.add('show');
      preview.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 1500);
  });
}

function renderResult(data, container) {
  const total = data.subjects.reduce((s,sub) => s + sub.score, 0);
  const avg   = (total / data.subjects.length).toFixed(1);
  const overallGrade = avg >= 70 ? 'A' : avg >= 60 ? 'B' : avg >= 50 ? 'C' : avg >= 45 ? 'D' : 'F';
  const remarks = { A:'Excellent', B:'Good', C:'Average', D:'Below Average', F:'Fail' };

  container.innerHTML = `
    <div class="result-header">
      <div>
        <div class="result-school">VIFF FOUNDATION INTERNATIONAL ACADEMY</div>
        <div style="font-size:.78rem;color:rgba(255,255,255,.55);margin-top:2px;">${data.term}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:.75rem;color:rgba(255,255,255,.5);">Student</div>
        <div style="font-weight:600;font-size:.95rem;">${data.student}</div>
        <div style="font-size:.75rem;color:var(--gold);">Class: ${data.class}</div>
      </div>
    </div>

    <table class="result-table">
      <thead>
        <tr>
          <th>Subject</th><th>Score</th><th>Grade</th><th>Remark</th>
        </tr>
      </thead>
      <tbody>
        ${data.subjects.map(s => `
          <tr>
            <td>${s.name}</td>
            <td><strong>${s.score}</strong>/100</td>
            <td><span class="grade-badge grade-${s.grade.toLowerCase()}">${s.grade}</span></td>
            <td style="color:rgba(255,255,255,.65);">${s.remark}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="result-footer">
      <div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.5);margin-bottom:2px;">Overall Grade</div>
        <span class="grade-badge grade-${overallGrade.toLowerCase()}" style="font-size:1rem;padding:6px 16px;">${overallGrade} — ${remarks[overallGrade]}</span>
      </div>
      <div style="text-align:right;">
        <div class="result-avg">${avg}%<small>Average Score</small></div>
      </div>
    </div>

    <div style="margin-top:1.25rem;padding:1rem;background:rgba(255,255,255,.05);border-radius:10px;font-size:.78rem;color:rgba(255,255,255,.45);text-align:center;">
      <svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></g></svg> This result is for viewing purposes. Official transcripts must be collected from the school office. <svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></g></svg>
    </div>
  `;
}

// ── FAQ ACCORDION ──
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });
}

// ── BOOT ──
document.addEventListener('DOMContentLoaded', () => {
  setGreeting();
  initNav();
  initDarkToggle();
  initScrollReveal();
  initCounters();
  initWelcomeToggle();
  initContactForm();
  initResultsChecker();
  initFAQ();
});
