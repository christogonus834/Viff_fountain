// GENERATED from backend/src/services/admission.service.js (same code the server runs). Do not edit.
(function (g) {
  var module = { exports: {} };
  var require = function (p) { if (/admissionNumbers/.test(p)) return g.AdmissionNumbers; throw new Error('unexpected require ' + p); };
// src/services/admission.service.js
// Admission numbering (automatic or manual), student creation and bulk import.
// Everything takes `db` (the Supabase admin client) and `deps` so it can be tested without a server.
//   deps = { syntheticEmail(n), tempPassword(), AppError }
'use strict';
const A = require('../utils/admissionNumbers');

const DEFAULTS = (prefix) => ({ mode: 'auto', prefix: (prefix || 'VIFF').toUpperCase(), pattern: '{PREFIX}/{YEAR}/{SEQ}', seqPad: 4, startAt: 1 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function must(res, AppError, msg) { if (res.error) throw new AppError(msg || res.error.message, 400); return res.data; }
function isCollision(err) {
  const m = String((err && (err.message || err.code)) || '').toLowerCase();
  return m.includes('23505') || m.includes('duplicate key') || m.includes('already been registered') || m.includes('already registered') || m.includes('already exists');
}

// ── settings ─────────────────────────────────────────────────────────
async function getSettings(db, envPrefix) {
  const res = await db.from('admission_numbering').select('*').limit(1).maybeSingle();
  if (res.error || !res.data) return DEFAULTS(envPrefix);                 // migration 015 not run yet: behave like automatic numbering
  const r = res.data;
  return { mode: r.mode, prefix: r.prefix, pattern: r.pattern, seqPad: r.seq_pad, startAt: Number(r.start_at) };
}
async function saveSettings(db, userId, input, deps) {
  const { AppError } = deps;
  if (!['auto', 'manual'].includes(input.mode)) throw new AppError('Choose automatic or manual numbering.', 400);
  if (!/^[A-Za-z0-9]{1,12}$/.test(input.prefix || '')) throw new AppError('The school code must be 1 to 12 letters or numbers.', 400);
  const bad = A.validatePattern(input.pattern); if (bad) throw new AppError(bad, 400);
  const pad = Number(input.seqPad); if (!Number.isInteger(pad) || pad < 1 || pad > 8) throw new AppError('Digits must be between 1 and 8.', 400);
  const start = Number(input.startAt); if (!Number.isInteger(start) || start < 1) throw new AppError('The starting number must be 1 or more.', 400);
  const row = { id: true, mode: input.mode, prefix: input.prefix.toUpperCase(), pattern: input.pattern, seq_pad: pad, start_at: start, updated_at: new Date().toISOString(), updated_by: userId };
  const res = await db.from('admission_numbering').upsert(row).select().single();
  if (res.error) throw new AppError('Could not save the numbering settings. Has migration 015 been run?', 500);
  return getSettings(db);
}

// ── the running number ───────────────────────────────────────────────
async function nextSeq(db, settings) {
  const res = await db.from('students').select('admission_seq').not('admission_seq', 'is', null).order('admission_seq', { ascending: false }).limit(1);
  const top = res.data && res.data[0] ? Number(res.data[0].admission_seq) : 0;
  return Math.max(settings.startAt || 1, top + 1);                        // never resets, never repeats: always highest used + 1
}
async function highestSeq(db) {
  const res = await db.from('students').select('admission_seq').not('admission_seq', 'is', null).order('admission_seq', { ascending: false }).limit(1);
  return res.data && res.data[0] ? Number(res.data[0].admission_seq) : 0;
}
// ctx = { year, term, session, className }
async function previewNext(db, settings, ctx) {
  if (settings.mode !== 'auto') return { number: null, seq: null };
  const seq = await nextSeq(db, settings);
  return { number: A.format(settings, Object.assign({}, ctx, { seq })), seq };
}
async function resolveNumber(db, settings, supplied, ctx, deps) {
  const { AppError } = deps;
  if (settings.mode === 'auto') {
    if (supplied) throw new AppError('Admission numbers are automatic. To type your own numbers, switch to manual numbering under Student Management > Numbering.', 400);
    return previewNext(db, settings, ctx);
  }
  const bad = A.validateManual(supplied); if (bad) throw new AppError(bad, 400);
  const number = A.normalise(supplied);
  const dup = await db.from('students').select('id').eq('admission_number', number).maybeSingle();
  if (dup.data) throw new AppError(`The admission number ${number} is already used by another student.`, 409);
  return { number, seq: null };
}

// ── create one student (+ login, + parent login) ─────────────────────
// s = { name, className, email?, phone?, gender?, dateOfBirth?, parentName?, parentPhone?, parentEmail?, parentRel?, supplied? }
async function createStudent(db, settings, ctx, s, deps) {
  const { AppError, syntheticEmail, tempPassword } = deps;
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const num = await resolveNumber(db, settings, s.supplied, Object.assign({}, ctx, { className: s.className }), deps);
    const loginEmail = s.email || syntheticEmail(num.number), pw = tempPassword();
    const au = await db.auth.admin.createUser({ email: loginEmail, password: pw, email_confirm: true });
    if (au.error) { lastErr = au.error; if (isCollision(au.error) && settings.mode === 'auto') continue; throw new AppError(au.error.message, 400); }
    const uid = au.data.user.id;
    const pr = await db.from('profiles').insert({ id: uid, name: s.name, role: 'student', student_id: num.number, phone: s.phone || '', login_email: loginEmail, contact_email: s.email || '', must_change_password: true });
    if (pr.error) { await db.auth.admin.deleteUser(uid); throw new AppError(pr.error.message, 400); }
    const ins = await db.from('students').insert({
      profile_id: uid, student_name: s.name, class_name: s.className, admission_number: num.number, admission_seq: num.seq,
      admission_session: ctx.session, admission_term: ctx.term, admission_class: s.className, status: 'approved',
      gender: s.gender || '', date_of_birth: s.dateOfBirth || null, parent_name: s.parentName || '', parent_phone: s.parentPhone || s.phone || '',
      parent_email: s.parentEmail || '', parent_rel: s.parentRel || '',
    }).select().single();
    if (ins.error) {
      await db.auth.admin.deleteUser(uid);                                    // profile row cascades
      lastErr = ins.error; if (isCollision(ins.error) && settings.mode === 'auto') continue;
      throw new AppError(ins.error.message, 400);
    }
    const out = { student: ins.data, admissionNumber: num.number, studentTemp: pw, parentTemp: null, parentExisting: false, parentError: null };
    if (s.parentEmail) {
      try {
        const link = await ensureParent(db, { email: s.parentEmail, name: s.parentName, phone: s.parentPhone || s.phone }, deps);
        out.parentTemp = link.temp; out.parentExisting = link.existing;
        await db.from('students').update({ parent_profile_id: link.id }).eq('id', ins.data.id);
      } catch (e) { out.parentError = e.message; }                            // the student exists; only the parent login failed
    }
    return out;
  }
  throw new AppError('Could not give this student a unique admission number. Please try again.', 409);
}
async function ensureParent(db, p, deps) {
  const email = p.email.toLowerCase();
  const ex = await db.from('profiles').select('id').eq('role', 'parent').eq('login_email', email).maybeSingle();
  if (ex.data) return { id: ex.data.id, existing: true, temp: null };
  const pw = deps.tempPassword();
  const au = await db.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (au.error) throw new deps.AppError(`parent login: ${au.error.message}`, 400);
  const pr = await db.from('profiles').insert({ id: au.data.user.id, name: p.name || 'Parent/Guardian', role: 'parent', phone: p.phone || '', login_email: email, contact_email: email, must_change_password: true });
  if (pr.error) { await db.auth.admin.deleteUser(au.data.user.id); throw new deps.AppError(`parent login: ${pr.error.message}`, 400); }
  return { id: au.data.user.id, existing: false, temp: pw };
}

// ── bulk import: checking ────────────────────────────────────────────
function isoDate(v) {
  v = String(v == null ? '' : v).trim(); if (!v) return { value: null };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v), d, mo, y;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(v))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return { error: 'Date of birth must look like 2013-05-14 or 14/05/2013.' };
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: 'That date of birth does not exist.' };
  if (dt > new Date() || y < 1990) return { error: 'Check the date of birth year.' };
  return { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');

async function checkRows(db, settings, ctx, rows) {
  const cls = await db.from('classes').select('name'), classSet = {};
  (cls.data || []).forEach((c) => { classSet[String(c.name).toLowerCase()] = c.name; });
  const ex = await db.from('students').select('student_name, class_name, date_of_birth, admission_number').in('status', ['approved', 'pending']);
  const existing = {}, existingNumbers = {};
  (ex.data || []).forEach((s) => { existing[`${nameKey(s.student_name)}|${String(s.class_name || '').toLowerCase()}|${s.date_of_birth || ''}`] = true; if (s.admission_number) existingNumbers[A.normalise(s.admission_number)] = true; });
  let seq = settings.mode === 'auto' ? await nextSeq(db, settings) : null;
  const seen = {}, seenNum = {}, out = [];
  rows.forEach((r, i) => {
    const row = { line: r.line || i + 2, name: String(r.name || '').trim().replace(/\s+/g, ' '), className: '', gender: '', dateOfBirth: null, parentName: String(r.parentName || '').trim(),
      parentPhone: String(r.parentPhone || '').trim(), parentEmail: String(r.parentEmail || '').trim().toLowerCase(), admissionNumber: '', status: 'ok', message: '' };
    const fail = (m) => { if (row.status === 'ok') { row.status = 'error'; row.message = m; } };
    if (!row.name && !r.className && !row.parentName) return;                                  // blank line
    if (row.name.length < 2 || row.name.length > 120) fail('Enter the student\'s full name.');
    const c = classSet[String(r.className || '').trim().toLowerCase()];
    if (!c) fail(r.className ? `There is no class called "${String(r.className).trim()}". Create it first, or fix the spelling.` : 'Enter the class.'); else row.className = c;
    const g = String(r.gender || '').trim().toLowerCase();
    if (g) { if (['m', 'male', 'boy'].includes(g)) row.gender = 'Male'; else if (['f', 'female', 'girl'].includes(g)) row.gender = 'Female'; else fail('Gender must be Male or Female.'); }
    const d = isoDate(r.dateOfBirth); if (d.error) fail(d.error); else row.dateOfBirth = d.value;
    if (row.parentEmail && !EMAIL_RE.test(row.parentEmail)) fail('The parent email does not look right.');
    if (row.parentPhone && !/^[0-9+()\-\s]{6,30}$/.test(row.parentPhone)) fail('The parent phone number does not look right.');
    const supplied = String(r.admissionNumber == null ? '' : r.admissionNumber).trim();
    if (settings.mode === 'manual') {
      const bad = A.validateManual(supplied); if (bad) fail(bad);
      else { const n = A.normalise(supplied); row.admissionNumber = n;
        if (existingNumbers[n]) fail(`${n} is already used by another student.`); else if (seenNum[n]) fail(`${n} appears more than once in the file (line ${seenNum[n]}).`); else seenNum[n] = row.line; }
    } else if (supplied) fail('Admission numbers are automatic. Leave this column empty, or switch to manual numbering.');
    if (row.status === 'ok') {
      const key = `${nameKey(row.name)}|${row.className.toLowerCase()}|${row.dateOfBirth || ''}`;
      if (existing[key]) { row.status = 'duplicate'; row.message = 'This student is already enrolled (same name, class and date of birth).'; }
      else if (seen[key]) { row.status = 'duplicate'; row.message = `Same as line ${seen[key]} in this file.`; }
      else seen[key] = row.line;
    }
    if (row.status === 'ok' && settings.mode === 'auto') { row.admissionNumber = A.format(settings, Object.assign({}, ctx, { className: row.className, seq })); seq += 1; }   // what the number WILL be
    if (row.status === 'ok' && !row.parentEmail) row.message = 'No parent email: no parent login will be created. Add it later.';
    out.push(row);
  });
  const counts = { total: out.length, ok: 0, error: 0, duplicate: 0 }; out.forEach((r) => { counts[r.status] += 1; });
  const emails = {}; out.filter((r) => r.status === 'ok' && r.parentEmail).forEach((r) => { emails[r.parentEmail] = true; });
  return { rows: out, counts, parentLogins: Object.keys(emails).length };
}

// ── bulk import: creating ────────────────────────────────────────────
async function runImport(db, settings, ctx, rows, deps) {
  const checked = await checkRows(db, settings, ctx, rows), results = [];
  for (const r of checked.rows) {
    if (r.status !== 'ok') { results.push({ line: r.line, name: r.name, className: r.className, ok: false, skipped: r.status === 'duplicate', message: r.message }); continue; }
    try {
      const c = await createStudent(db, settings, ctx, { name: r.name, className: r.className, gender: r.gender, dateOfBirth: r.dateOfBirth, parentName: r.parentName,
        parentPhone: r.parentPhone, parentEmail: r.parentEmail, supplied: settings.mode === 'manual' ? r.admissionNumber : '' }, deps);
      results.push({ line: r.line, name: r.name, className: r.className, ok: true, admissionNumber: c.admissionNumber, studentTemp: c.studentTemp,
        parentEmail: r.parentEmail, parentTemp: c.parentTemp, parentExisting: c.parentExisting, parentError: c.parentError });
    } catch (e) { results.push({ line: r.line, name: r.name, className: r.className, ok: false, message: e.message }); }
  }
  return { results, created: results.filter((x) => x.ok).length };
}

module.exports = { DEFAULTS, getSettings, saveSettings, nextSeq, highestSeq, previewNext, resolveNumber, createStudent, ensureParent, checkRows, runImport, isoDate, isCollision };

  g.AdmissionService = module.exports;
})(window);
