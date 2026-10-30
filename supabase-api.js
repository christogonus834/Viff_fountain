// ══════════════════════════════════════════════════════════════
//  VIFF — supabase-api.js
//  Direct replacement for api.js. Same function names, same
//  parameter order, same {ok, status, data} response shape —
//  so every dashboard keeps working without being rewritten.
//  No Express server, no hardcoded API_URL, no manual JWTs:
//  every call here is either a direct RLS-protected Supabase
//  query, a security-definer RPC, or one of the 5 Edge Functions.
// ══════════════════════════════════════════════════════════════

// ── response helpers ──
function ok(data, status = 200)  { return { ok: true,  status, data }; }
function fail(message, status = 400) { return { ok: false, status, data: { message } }; }

async function sb(promise) {
  try {
    const { data, error, status } = await promise;
    if (error) return fail(error.message, status || 400);
    return ok(data);
  } catch (e) {
    return fail(e && e.message ? e.message : 'Something went wrong.', 500);
  }
}

// Every object gets both `id` and `_id` pointing at the same value —
// a lot of existing dashboard code (17+ places in dashboard-admin.html
// alone) reads `._id` the way MongoDB documents worked.
function withMongoIdAlias(row) {
  if (!row || typeof row !== 'object') return row;
  return { ...row, _id: row.id };
}
function withMongoIdAliasList(rows) { return (rows || []).map(withMongoIdAlias); }

async function callEdgeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message || 'Something went wrong.';
    // Edge Functions return { message } in the body on failure — surface that
    // instead of the generic FunctionsHttpError text when we can.
    try {
      if (error.context && typeof error.context.json === 'function') {
        const parsed = await error.context.json();
        if (parsed && parsed.message) message = parsed.message;
      }
    } catch (_) { /* fall back to the generic message above */ }
    return fail(message, 400);
  }
  return ok(data, 200);
}

// ════════════════════════════════════════
//  EXPRESS BACKEND (Render) — the new data layer
// ════════════════════════════════════════
// Supabase Auth still issues the session (login, token refresh) — but
// every actual read/write of school data now goes through this
// instead of a direct supabase.from(...) call. The backend re-verifies
// that session token and enforces authorization itself (see
// backend/src/middleware/auth.js); this function's only job is to
// attach that token and normalize the response into the same
// {ok, status, data} shape every dashboard already expects, so no
// dashboard code needs to change.
async function apiRequest(method, path, body) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let json = {};
    try { json = await res.json(); } catch (_) { /* empty body, e.g. some 204s */ }

    // An admin who has turned on two-factor login, but whose current
    // session has not completed the 6-digit step, gets this specific
    // 401 from the backend. Handled HERE, once, so every page (the old
    // admin dashboard included) recovers the same way without any
    // per-page change: sign out and send them to the login page,
    // where the code step will appear right after their password.
    if (res.status === 401 && json.code === 'mfa_required') {
      await supabase.auth.signOut();
      window.location.href = 'login.html?reason=mfa';
      return fail(json.message || 'Please complete two-factor verification.', 401);
    }

    // Two-factor login is mandatory for admins: until they finish setup the server refuses everything else,
    // so every page (old and new) sends them to the setup page the same way.
    if (res.status === 403 && json.code === 'mfa_enrollment_required') {
      window.location.href = 'setup-2fa.html';
      return fail(json.message || 'Two-factor login must be set up first.', 403);
    }

    if (!res.ok) return fail(json.message || 'Something went wrong.', res.status);
    return ok(json, res.status);
  } catch (err) {
    // Network failure, backend unreachable, cold-start timeout, etc.
    return fail('Could not reach the server. Please check your connection and try again.', 0);
  }
}
const apiGet = (path) => apiRequest('GET', path);
const apiPost = (path, body) => apiRequest('POST', path, body);
const apiPut = (path, body) => apiRequest('PUT', path, body);
const apiPatch = (path, body) => apiRequest('PATCH', path, body);
const apiDelete = (path) => apiRequest('DELETE', path);

// Separate from apiRequest() because file uploads use multipart/form-data,
// not JSON — must NOT set a Content-Type header manually (the browser
// sets it itself, including the multipart boundary; setting it by hand
// breaks the upload silently).
async function apiUpload(path, file) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    let json = {};
    try { json = await res.json(); } catch (_) { /* ignore */ }
    if (!res.ok) return fail(json.message || 'Upload failed.', res.status);
    return ok(json, res.status);
  } catch (err) {
    return fail('Could not reach the server. Please check your connection and try again.', 0);
  }
}

// Uploads an image for use in Site Settings (hero slides, grid card
// images) and returns its public URL.
async function uploadSiteImage(file) {
  const r = await apiUpload('/media/upload', file);
  if (!r.ok) return r;
  return ok({ url: r.data.url });
}

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
// login() lives in supabase-auth.js (supabaseLogin). Kept here too as a
// thin wrapper so any old code calling login(...) still works.
async function login(identifier, password /*, role - no longer needed */) {
  const result = await supabaseLogin(identifier, password);
  if (!result.ok) return fail(result.message);
  return ok({ user: result.profile });
}

function logout() { return supabaseLogout(); }
function requireLogin() { return requireSupabaseLogin(); }
async function isLoggedIn() {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
async function getUser() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
  return profile ? withMongoIdAlias(profile) : null;
}

async function changePassword(currentPassword, newPassword) {
  // Supabase doesn't need the current password to change it (the active
  // session already proves identity) — but we keep the parameter so
  // existing call sites don't need to change.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return fail(error.message);
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', sessionData.session.user.id);
  }
  return ok({ message: 'Password changed successfully.' });
}

// ════════════════════════════════════════
//  helpers shared across roles
// ════════════════════════════════════════
async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.user.id : null;
}

function mapResultRow(r) {
  return {
    _id: r.id, id: r.id,
    className: r.class_name,
    term: r.term,
    session: r.session,
    average: r.average,
    overallGrade: r.overall_grade,
    position: r.class_position,
    classSize: r.total_students,
    totalStudents: r.total_students,
    isPublished: r.is_published,
    publishedAt: r.published_at,
    principalRemark: r.principal_remark,
    subjects: (r.subject_scores || []).map(function (s) {
      return { subject: s.subject, ca: s.ca, exam: s.exam, total: s.total, grade: s.grade };
    }),
    createdAt: r.created_at,
  };
}

function mapNotification(n, unreadIds) {
  return {
    _id: n.id, id: n.id,
    title: n.title, message: n.message, type: n.type, audience: n.audience,
    createdAt: n.created_at,
    isRead: unreadIds ? !unreadIds.has(n.id) : false,
  };
}

function mapEvent(e) {
  return {
    _id: e.id, id: e.id,
    title: e.title, description: e.description, category: e.category,
    date: e.date, time: e.time, location: e.location, audience: e.audience,
    createdAt: e.created_at,
  };
}

async function fetchNotificationsFor(audienceValues) {
  const uid = await currentUserId();
  const { data: notifs, error } = await supabase
    .from('notifications').select('*')
    .in('audience', audienceValues)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return fail(error.message);

  const { data: reads } = await supabase
    .from('notification_reads').select('notification_id').eq('profile_id', uid);
  const readIds = new Set((reads || []).map(function (r) { return r.notification_id; }));
  const unreadIds = new Set((notifs || []).filter(function (n) { return !readIds.has(n.id); }).map(function (n) { return n.id; }));

  return ok({ notifications: (notifs || []).map(function (n) { return mapNotification(n, unreadIds); }) });
}

async function markNotificationReadGeneric(notificationId) {
  const uid = await currentUserId();
  return sb(supabase.from('notification_reads').upsert({ notification_id: notificationId, profile_id: uid }));
}

async function fetchEventsFor(audienceValues) {
  const { data, error } = await supabase
    .from('events').select('*').in('audience', audienceValues).order('date', { ascending: true });
  if (error) return fail(error.message);
  return ok({ events: (data || []).map(mapEvent) });
}

// ════════════════════════════════════════
//  STUDENT
// ════════════════════════════════════════

async function getStudentProfile() {
  const uid = await currentUserId();
  const { data: user, error: userErr } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (userErr) return fail('Profile not found.', 404);
  const { data: student, error: studentErr } = await supabase.from('students').select('*').eq('profile_id', uid).single();
  if (studentErr) return fail('Profile not found.', 404);
  return ok({
    user: withMongoIdAlias(user),
    student: withMongoIdAlias({
      ...student,
      studentName: student.student_name, className: student.class_name,
      admissionNumber: student.admission_number,
    }),
  });
}

async function getStudentResults(term = '', session = '') {
  const uid = await currentUserId();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', uid).single();
  if (!student) return fail('Student record not found.', 404);

  let q = supabase.from('results').select('*, subject_scores(*)').eq('student_id', student.id).eq('is_published', true);
  if (term)    q = q.eq('term', term);
  if (session) q = q.eq('session', session);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return fail(error.message);
  if (!data || data.length === 0) return fail('No published results found yet. Check back after your PIN is verified.', 404);
  return ok({ results: data.map(mapResultRow) });
}

// Matches the old signature (pinCode, term, session) but term/session
// are no longer needed — the PIN itself already knows its term/session
// via verify_pin(), which is simpler and avoids the two ever disagreeing.
async function verifyPin(pinCode /*, term, session */) {
  const { data, error } = await supabase.rpc('verify_pin', { p_code: pinCode });
  if (error) return fail(error.message, 400);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail('Invalid PIN. Please check and try again.', 404);
  return ok({
    message: 'PIN verified. Result unlocked.',
    result: {
      studentName: row.student_name, className: row.class_name, term: row.term, session: row.session,
      average: row.average, overallGrade: row.overall_grade, position: row.class_position,
      classSize: row.total_students, principalRemark: row.principal_remark,
      subjects: row.subjects || [],
    },
  });
}

async function getStudentNotifications() { return fetchNotificationsFor(['all', 'students']); }
async function markNotificationRead(notificationId) { return markNotificationReadGeneric(notificationId); }
async function getStudentEvents() { return fetchEventsFor(['all', 'students']); }

async function getMyTimetable(className) {
  const { data, error } = await supabase.from('timetables').select('*').eq('class_name', className).maybeSingle();
  if (error) return fail(error.message);
  return ok({ timetable: data ? { className: data.class_name, periods: data.periods } : { className, periods: [] } });
}

// ════════════════════════════════════════
//  TEACHER
// ════════════════════════════════════════

async function getTeacherProfile() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) return fail(error.message, 404);
  return ok({ user: withMongoIdAlias(data) });
}

async function updateTeacherProfile(name, email, phone) {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profiles')
    .update({ name, contact_email: email, phone }).eq('id', uid).select().single();
  if (error) return fail(error.message);
  return ok({ message: 'Profile updated.', user: withMongoIdAlias(data) });
}

async function getStudentsByClass(className) {
  let q = supabase.from('students').select('id, student_name, admission_number, class_name').eq('status', 'approved');
  if (className && className !== 'undefined') q = q.eq('class_name', className);
  const { data, error } = await q.order('student_name');
  if (error) return fail(error.message);
  return ok({
    students: (data || []).map(function (s) {
      return { _id: s.id, id: s.id, name: s.student_name, admissionNumber: s.admission_number || '—', className: s.class_name || '—' };
    }),
  });
}

// Upserts one results row per student (student_id + term + session),
// then upserts that student's score for this subject. This replaces the
// old single-document-per-class-with-nested-scores model — each student
// gets their own row, which is what the student/parent dashboards read.
async function uploadScores(className, subject, term, session, scores) {
  if (!className || !subject || !scores || !scores.length) {
    return fail('Class, subject, and scores are required.');
  }
  const uid = await currentUserId();
  try {
    for (const sc of scores) {
      let { data: existingResult } = await supabase
        .from('results').select('id')
        .eq('student_id', sc.studentId).eq('term', term).eq('session', session).maybeSingle();

      let resultId = existingResult && existingResult.id;
      if (!resultId) {
        const { data: newResult, error: insertErr } = await supabase
          .from('results').insert({ student_id: sc.studentId, class_name: className, term, session }).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        resultId = newResult.id;
      }

      const { error: scoreErr } = await supabase.from('subject_scores').upsert(
        { result_id: resultId, subject, ca: sc.ca || 0, exam: sc.exam || 0, uploaded_by: uid },
        { onConflict: 'result_id,subject' }
      );
      if (scoreErr) throw new Error(scoreErr.message);
    }
    return ok({ message: 'Scores uploaded for ' + className + ' — ' + subject });
  } catch (e) {
    return fail(e.message);
  }
}

async function getTeacherResults(className, term, session) {
  let q = supabase.from('results').select('*, subject_scores(*), students(student_name)').eq('class_name', className);
  if (term)    q = q.eq('term', term);
  if (session) q = q.eq('session', session);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return fail(error.message);
  return ok({
    results: (data || []).map(function (r) {
      const mapped = mapResultRow(r);
      mapped.studentName = r.students ? r.students.student_name : '';
      return mapped;
    }),
  });
}

async function getTeacherNotifications() { return fetchNotificationsFor(['all', 'teachers']); }
async function getTeacherEvents() { return fetchEventsFor(['all', 'teachers']); }

// ════════════════════════════════════════
//  PARENT
// ════════════════════════════════════════

async function getParentProfile() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) return fail(error.message, 404);
  return ok({ user: withMongoIdAlias(data) });
}

async function updateParentProfile(name, email, phone) {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profiles')
    .update({ name, contact_email: email, phone }).eq('id', uid).select().single();
  if (error) return fail(error.message);
  return ok({ message: 'Profile updated.', user: withMongoIdAlias(data) });
}

async function getChildInfo() {
  const uid = await currentUserId();
  const { data: child, error } = await supabase.from('students').select('*').eq('parent_profile_id', uid).maybeSingle();
  if (error || !child) return fail('No child record linked to your account. Contact the admin.', 404);
  return ok({
    child: withMongoIdAlias({
      ...child,
      studentName: child.student_name, className: child.class_name, admissionNumber: child.admission_number,
    }),
  });
}

async function getChildResults(term = '', session = '') {
  const uid = await currentUserId();
  const { data: child } = await supabase.from('students').select('*').eq('parent_profile_id', uid).maybeSingle();
  if (!child) return fail('No child record linked to your account. Contact the admin.', 404);

  let q = supabase.from('results').select('*, subject_scores(*)').eq('student_id', child.id).eq('is_published', true);
  if (term)    q = q.eq('term', term);
  if (session) q = q.eq('session', session);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return fail(error.message);
  if (!data || data.length === 0) return fail('No published results found for your child yet.', 404);

  return ok({
    child: { name: child.student_name, admissionNumber: child.admission_number, className: child.class_name },
    results: data.map(mapResultRow),
  });
}

async function getParentNotifications() { return fetchNotificationsFor(['all', 'parents']); }
async function getParentEvents() { return fetchEventsFor(['all', 'parents']); }

// ════════════════════════════════════════
//  PUBLIC ADMISSION (no login needed)
// ════════════════════════════════════════
async function submitAdmission(data) {
  const r = await apiPost('/public/admission', data);
  if (!r.ok) return r;
  return ok({ message: r.data.message, referenceNumber: r.data.referenceNumber, reference: r.data.referenceNumber }, 201);
}

// ════════════════════════════════════════
//  ADMIN — accounts (via Edge Functions —
//  these are the only actions that create a
//  real Supabase Auth login)
// ════════════════════════════════════════

async function registerTeacher(name, email, phone, staffId) {
  return apiPost('/teachers', { name, email, phone, staffId });
}

async function getAllTeachers() {
  const r = await apiGet('/teachers');
  if (!r.ok) return r;
  return ok({ teachers: withMongoIdAliasList(r.data.teachers) });
}

async function updateTeacher(teacherId, data) {
  const patch = {};
  if (data.name)     patch.name = data.name;
  if (data.phone)    patch.phone = data.phone;
  if (data.staffId)  patch.staffId = data.staffId;
  const r = await apiPatch(`/teachers/${teacherId}`, patch);
  if (!r.ok) return r;
  return ok({ message: r.data.message, teacher: withMongoIdAlias(r.data.teacher) });
}

async function enrolStudent(data) {
  return apiPost('/students/enrol', data);
}

async function getAllStudents(className = '', status = '') {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (className) params.set('className', className);
  const r = await apiGet(`/students?${params.toString()}`);
  if (!r.ok) return r;
  return ok({ students: withMongoIdAliasList(r.data.students) });
}

// ── Promotions ──
// Bulk-moves a set of students to a new class in one write — used at
// end-of-term/year to promote a whole class in a couple of clicks
// instead of editing students one by one. The Express route
// re-checks admin/superadmin authorization server-side, same as
// every other privileged write now that RLS isn't the enforcement
// layer for requests coming through this backend.
async function promoteStudents(studentIds, newClassName) {
  if (!studentIds || !studentIds.length) return fail('Select at least one student to promote.');
  if (!newClassName) return fail('Choose a destination class.');
  const r = await apiPost('/students/promote', { studentIds, newClassName });
  if (!r.ok) return r;
  return ok({ message: r.data.message, students: withMongoIdAliasList(r.data.students) });
}

// ── Finance overview ──
// Aggregation now happens server-side (src/routes/finance.routes.js)
// instead of being computed in the browser from three separate
// queries — same output shape, less data sent over the wire, and the
// admin-only restriction is enforced by the backend, not by hoping
// the frontend never calls this without being an admin.
async function getFinanceOverview() {
  const r = await apiGet('/finance/overview');
  if (!r.ok) return r;
  return ok(r.data);
}

async function getAdmissions() {
  const r = await apiGet('/students/pending');
  if (!r.ok) return r;
  return ok({ admissions: withMongoIdAliasList(r.data.admissions) });
}

// Approving creates real login accounts, so it goes through the
// same students/:id/decision route as rejecting — the backend
// decides internally whether that means "just flip status" or "spin
// up student + parent accounts," same branching the old
// approve-admission Edge Function did, just no longer split across
// two different code paths (Edge Function vs. direct RLS update) on
// the frontend.
async function updateAdmission(studentRowId, status) {
  const r = await apiPost(`/students/${studentRowId}/decision`, { status });
  if (!r.ok) return r;
  return ok({
    message: r.data.message || `Application ${status} successfully.`,
    student: withMongoIdAlias(r.data.student),
    tempPasswords: r.data.tempPasswords,
  });
}

async function generatePin(studentId, term, session, maxUses) {
  const r = await apiPost('/pins', { studentId, term: term || 'First', session: session || '2025/2026', maxUses: maxUses || 3 });
  if (!r.ok) return r;
  return ok({ message: r.data.message, pin: withMongoIdAlias(r.data.pin) }, 201);
}

async function getAllPins() {
  const r = await apiGet('/pins');
  if (!r.ok) return r;
  return ok({ pins: withMongoIdAliasList(r.data.pins) });
}

async function deletePin(pinId) {
  return apiDelete(`/pins/${pinId}`);
}

async function publishResult(className, term, session) {
  return apiPost('/results/publish', { className, term, session });
}

async function sendNotification(title, message, audience, targetClass, type) {
  const r = await apiPost('/notifications', { title, message, audience: audience || 'all', targetClass: targetClass || '', type: type || 'info' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, notification: withMongoIdAlias(r.data.notification) }, 201);
}

async function createEvent(title, description, category, date, time, location, audience) {
  const r = await apiPost('/events', { title, description: description || '', category: category || 'general', date, time: time || '', location: location || '', audience: audience || 'all' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, event: withMongoIdAlias(r.data.event) }, 201);
}

async function updateEvent(eventId, data) {
  const patch = {};
  ['title', 'description', 'category', 'date', 'time', 'location', 'audience'].forEach(function (k) {
    if (data[k] !== undefined) patch[k] = data[k];
  });
  const r = await apiPatch(`/events/${eventId}`, patch);
  if (!r.ok) return r;
  return ok({ message: r.data.message, event: withMongoIdAlias(r.data.event) });
}

async function deleteEvent(eventId) {
  return apiDelete(`/events/${eventId}`);
}

async function getTeacherAssignments(teacherId) {
  const { data, error } = await supabase.from('profiles').select('assignments').eq('id', teacherId).single();
  if (error) return fail(error.message);
  return ok({ assignments: data.assignments || [] });
}

async function saveTeacherAssignments(teacherId, assignments) {
  const { data, error } = await supabase.from('profiles').update({ assignments }).eq('id', teacherId).select('assignments').single();
  if (error) return fail(error.message);
  return ok({ message: 'Assignments saved.', assignments: data.assignments });
}

async function getAllAdmins() {
  const r = await apiGet('/admins');
  if (!r.ok) return r;
  return ok({ admins: withMongoIdAliasList(r.data.admins) });
}

async function createAdmin(name, email, phone) {
  return apiPost('/admins', { name, email, phone });
}

async function deleteAdminAccount(profileId) {
  return apiDelete(`/admins/${profileId}`);
}

async function resetUserPassword(profileId) {
  return apiPost(`/admins/${profileId}/reset-password`);
}

async function getAllEvents() {
  const r = await apiGet('/events');
  if (!r.ok) return r;
  return ok({ events: (r.data.events || []).map(mapEvent) });
}

// ════════════════════════════════════════
//  SCHOOL — SUBJECTS & CLASSES
// ════════════════════════════════════════

async function getSubjects() {
  const r = await apiGet('/subjects');
  if (!r.ok) return r;
  return ok({ subjects: withMongoIdAliasList(r.data.subjects) });
}

async function addSubject(name, category, level, compulsory) {
  const r = await apiPost('/subjects', { name, category, level, compulsory: !!compulsory });
  if (!r.ok) return r;
  return ok({ message: r.data.message, subject: withMongoIdAlias(r.data.subject) }, 201);
}

async function deleteSubject(subjectId) {
  return apiDelete(`/subjects/${subjectId}`);
}

async function getClasses() {
  const r = await apiGet('/classes');
  if (!r.ok) return r;
  return ok({ classes: withMongoIdAliasList(r.data.classes) });
}

async function addClass(name, level, arm, section) {
  const r = await apiPost('/classes', { name, level, arm: arm || '', section: section || 'Junior' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, cls: withMongoIdAlias(r.data.class) }, 201);
}

async function assignFormTeacher(classId, formTeacher) {
  const r = await apiPatch(`/classes/${classId}/form-teacher`, { formTeacher });
  if (!r.ok) return r;
  return ok({ message: r.data.message, cls: withMongoIdAlias(r.data.class) });
}

async function deleteClass(classId) {
  return apiDelete(`/classes/${classId}`);
}

// ════════════════════════════════════════
//  ID CARDS (M4)
// ════════════════════════════════════════

async function getIdCards(holderType, status) {
  const params = new URLSearchParams();
  if (holderType) params.set('holderType', holderType);
  if (status) params.set('status', status);
  const qs = params.toString();
  const r = await apiGet(`/id-cards${qs ? '?' + qs : ''}`);
  if (!r.ok) return r;
  return ok({ cards: withMongoIdAliasList(r.data.cards) });
}

// The card's real details (name, class, admission/staff number) are
// looked up server-side from the holder's actual record — this only
// sends which person and which optional extras (photo, expiry).
async function generateIdCard(holderType, holderId, photoUrl, expiresAt) {
  const r = await apiPost('/id-cards', { holderType, holderId, photoUrl: photoUrl || '', expiresAt: expiresAt || undefined });
  if (!r.ok) return r;
  return ok({ message: r.data.message, card: withMongoIdAlias(r.data.card) }, 201);
}

async function revokeIdCard(cardId) {
  const r = await apiPatch(`/id-cards/${cardId}/revoke`);
  if (!r.ok) return r;
  return ok({ message: r.data.message, card: withMongoIdAlias(r.data.card) });
}

async function deleteIdCard(cardId) {
  return apiDelete(`/id-cards/${cardId}`);
}

// ════════════════════════════════════════
//  ACCOUNTING LEDGER (M5)
// ════════════════════════════════════════

async function getLedgerCategories() {
  const r = await apiGet('/ledger/categories');
  if (!r.ok) return r;
  return ok({ categories: r.data.categories });
}

async function createLedgerEntry(entryType, category, description, amountNaira, method, entryDate, reference) {
  const r = await apiPost('/ledger', {
    entryType, category, description: description || '', amountNaira: Number(amountNaira),
    method: method || 'cash', entryDate: entryDate || undefined, reference: reference || '',
  });
  if (!r.ok) return r;
  return ok({ message: r.data.message, entry: withMongoIdAlias(r.data.entry) }, 201);
}

async function getLedgerEntries(from, to, type) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (type) params.set('type', type);
  const qs = params.toString();
  const r = await apiGet(`/ledger${qs ? '?' + qs : ''}`);
  if (!r.ok) return r;
  return ok({ entries: withMongoIdAliasList(r.data.entries) });
}

async function getLedgerSummary(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const r = await apiGet(`/ledger/summary${qs ? '?' + qs : ''}`);
  if (!r.ok) return r;
  return ok(r.data);
}

async function voidLedgerEntry(entryId, reason) {
  return apiPost(`/ledger/${entryId}/void`, { reason });
}

// ════════════════════════════════════════
//  TRANSPORT (M6)
// ════════════════════════════════════════

async function getTransportRoutes() {
  const r = await apiGet('/transport/routes');
  if (!r.ok) return r;
  return ok({ routes: withMongoIdAliasList(r.data.routes) });
}

async function addTransportRoute(name, description, driverName, driverPhone, vehiclePlate, capacity, feeNaira) {
  const r = await apiPost('/transport/routes', {
    name, description: description || '', driverName: driverName || '', driverPhone: driverPhone || '',
    vehiclePlate: vehiclePlate || '', capacity: Number(capacity) || 0, feeNaira: Number(feeNaira) || 0,
  });
  if (!r.ok) return r;
  return ok({ message: r.data.message, route: withMongoIdAlias(r.data.route) }, 201);
}

async function updateTransportRoute(routeId, patch) {
  const r = await apiPatch(`/transport/routes/${routeId}`, patch);
  if (!r.ok) return r;
  return ok({ message: r.data.message, route: withMongoIdAlias(r.data.route) });
}

async function toggleTransportRouteActive(routeId) {
  const r = await apiPatch(`/transport/routes/${routeId}/toggle-active`);
  if (!r.ok) return r;
  return ok({ message: r.data.message, route: withMongoIdAlias(r.data.route) });
}

async function deleteTransportRoute(routeId) {
  return apiDelete(`/transport/routes/${routeId}`);
}

async function getTransportAssignments(routeId) {
  const qs = routeId ? `?routeId=${routeId}` : '';
  const r = await apiGet(`/transport/assignments${qs}`);
  if (!r.ok) return r;
  return ok({ assignments: withMongoIdAliasList(r.data.assignments) });
}

async function assignStudentToRoute(studentId, routeId, pickupPoint) {
  const r = await apiPost('/transport/assignments', { studentId, routeId, pickupPoint: pickupPoint || '' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, assignment: withMongoIdAlias(r.data.assignment) }, 201);
}

async function removeTransportAssignment(assignmentId) {
  return apiDelete(`/transport/assignments/${assignmentId}`);
}

// Parent/student — "which bus does my child take."
async function getMyChildTransport(studentId) {
  const r = await apiGet(`/transport/assignments/mine/${studentId}`);
  if (!r.ok) return r;
  return ok({ assignment: r.data.assignment });
}

// ════════════════════════════════════════
//  HR & PAYROLL (M7)
// ════════════════════════════════════════

async function getPayrollStaff() {
  const r = await apiGet('/payroll/staff');
  if (!r.ok) return r;
  return ok({ staff: r.data.staff });
}

async function saveSalaryStructure(profileId, basicNaira, allowancesNaira, deductionsNaira, bankName, bankAccount) {
  const r = await apiPut(`/payroll/staff/${profileId}`, {
    basicNaira: Number(basicNaira) || 0, allowancesNaira: Number(allowancesNaira) || 0,
    deductionsNaira: Number(deductionsNaira) || 0, bankName: bankName || '', bankAccount: bankAccount || '',
  });
  if (!r.ok) return r;
  return ok({ message: r.data.message, salary: r.data.salary });
}

async function getPayrollRuns() {
  const r = await apiGet('/payroll/runs');
  if (!r.ok) return r;
  return ok({ runs: withMongoIdAliasList(r.data.runs) });
}

async function runPayroll(periodMonth, periodYear) {
  const r = await apiPost('/payroll/runs', { periodMonth: Number(periodMonth), periodYear: Number(periodYear) });
  if (!r.ok) return r;
  return ok({ message: r.data.message, run: withMongoIdAlias(r.data.run) }, 201);
}

async function finalizePayrollRun(runId) {
  const r = await apiPatch(`/payroll/runs/${runId}/finalize`);
  if (!r.ok) return r;
  return ok({ message: r.data.message, run: withMongoIdAlias(r.data.run) });
}

async function getPayslipsForRun(runId) {
  const r = await apiGet(`/payroll/runs/${runId}/payslips`);
  if (!r.ok) return r;
  return ok({ payslips: withMongoIdAliasList(r.data.payslips) });
}

// Teacher/admin's own payslip history — only ever finalized runs are
// returned (a draft payroll's numbers aren't confirmed yet, so staff
// shouldn't see a payslip that might still change).
async function getMyPayslips() {
  const r = await apiGet('/payroll/my-payslips');
  if (!r.ok) return r;
  return ok({ payslips: withMongoIdAliasList(r.data.payslips) });
}

// ════════════════════════════════════════
//  GRANULAR USERS & ROLES (M8)
// ════════════════════════════════════════

async function getPermissionDefinitions() {
  const r = await apiGet('/users-roles/permissions');
  if (!r.ok) return r;
  return ok({ permissions: r.data.permissions });
}

async function getUsersWithPermissions() {
  const r = await apiGet('/users-roles/users');
  if (!r.ok) return r;
  return ok({ users: r.data.users });
}

// Passing an empty array clears all restrictions (back to full
// access) — same "empty = unrestricted" rule the backend enforces,
// so this one function covers both granting AND restoring access.
async function saveUserPermissions(profileId, permissions) {
  const r = await apiPut(`/users-roles/users/${profileId}/permissions`, { permissions });
  if (!r.ok) return r;
  return ok({ message: r.data.message, user: r.data.user });
}

// ════════════════════════════════════════
//  FEE PAYMENT
// ════════════════════════════════════════

async function getAllFees() {
  const r = await apiGet('/fees');
  if (!r.ok) return r;
  return ok({ students: withMongoIdAliasList(r.data.students) });
}

async function updateFeeStatus(studentId, feeStatus, feeNote) {
  const r = await apiPatch(`/fees/${studentId}`, { feeStatus, feeNote: feeNote || '' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, student: withMongoIdAlias(r.data.student) });
}

// TODO: not yet migrated — no dedicated summary route; computed
// client-side from getAllFees() until one exists.
async function getFeeSummary() {
  const r = await getAllFees();
  if (!r.ok) return r;
  const students = r.data.students || [];
  const summary = { full: 0, part: 0, not_paid: 0, total: students.length };
  students.forEach(function (s) { summary[s.feeStatus] = (summary[s.feeStatus] || 0) + 1; });
  return ok({ summary });
}

// ════════════════════════════════════════
//  TIMETABLE
// ════════════════════════════════════════

async function saveTimetable(className, periods) {
  const r = await apiPut(`/classes/${encodeURIComponent(className)}/timetable`, { periods });
  if (!r.ok) return r;
  return ok({ message: r.data.message, timetable: r.data.timetable });
}

// TODO: not yet migrated — simple own-record lookup, low risk to
// leave direct for now; revisit once /api/students/me exists.
async function getMyStudentId() {
  const uid = await currentUserId();
  const { data: student, error } = await supabase.from('students').select('id').eq('profile_id', uid).single();
  if (error || !student) return fail('Student record not found.', 404);
  return ok({ studentId: student.id });
}

// ════════════════════════════════════════
//  SITE CONTENT (multi-school branding/copy)
// ════════════════════════════════════════

// Keep in sync with the defaults seeded in migrations/003_site_content.sql
// — used as a fallback so pages still render sensibly before an admin
// has ever saved anything, and so a partially-saved object doesn't
// blank out fields the admin never touched.
const SITE_CONTENT_DEFAULTS = {
  school_name: "VIFF FOUNTAIN INTERNATIONAL ACADEMY",
  school_short_name: 'VIFF',
  tagline: 'Est. 2005 · Lokogoma, Abuja',
  hero_heading: 'Raising Godly, Brilliant Leaders of Tomorrow',
  hero_subtext: "At VIFF FOUNTAIN INTERNATIONAL ACADEMY, we blend faith, excellence, and innovation to nurture every child into their God-given purpose — academically, morally, and spiritually.",
  hero_image_url: '',
  hero_slides: [], // [{ url, caption }] — empty means fall back to hero_image_url above
  hero_video_url: '',
  grid_cards: [], // [{ icon, title, text }]
  logo_initials: 'VF',
  logo_url: 'logo.png',
  primary_color: '#0b1f5c',
  accent_color: '#8dc63f',
  mission_heading: 'A School Built on Faith & Excellence',
  mission_text: "VIFF FOUNTAIN INTERNATIONAL ACADEMY was founded with a vision to provide world-class education rooted in Christian values. Our holistic approach ensures students don't just pass exams — they become leaders.",
  mission_image_url: '',
  about_heading: 'A Legacy Rooted in Faith Since 2005',
  about_text: 'What began as a small nursery and primary school has grown into a full-scale international school offering nursery, primary, junior secondary, and senior secondary programmes — all under one roof.',
  address: 'Emerald Garden Estate, Dakwo District, Sunnyvale, Lokogoma, Abuja',
  address_line1: 'Emerald Garden Estate, Dakwo District',
  phone: '+234 800 000 0000',
  phone2: '+234 801 000 0000',
  email: 'info@viffacademy.edu.ng',
  admissions_email: 'admissions@viffacademy.edu.ng',
  footer_note: 'SS1 ICT Term 2 Project',
};

// Public — every page (including logged-out visitors) can read this.
async function getSiteSettings() {
  const r = await apiGet('/settings/site-content');
  if (!r.ok) return r;
  return ok({ settings: Object.assign({}, SITE_CONTENT_DEFAULTS, r.data.settings || {}) });
}

// Admin-only — the backend re-checks this server-side regardless of
// what this page believes the caller's role is (src/routes/settings.routes.js).
async function saveSiteSettings(partial) {
  const r = await apiPut('/settings/site-content', partial);
  if (!r.ok) return r;
  return ok({ message: r.data.message, settings: r.data.settings });
}

async function getTimetable(className) {
  const r = await apiGet(`/classes/${encodeURIComponent(className)}/timetable`);
  if (!r.ok) return r;
  return ok({ timetable: r.data.timetable });
}

// ════════════════════════════════════════
//  CBT (Computer-Based Testing)
// ════════════════════════════════════════

// ── Teacher/admin: exam + question management (direct RLS writes,
//    same pattern as timetables/subject_scores elsewhere in this file) ──

async function listCbtExams(className) {
  let q = supabase.from('cbt_exams').select('*').order('created_at', { ascending: false });
  if (className) q = q.eq('class_name', className);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok({ exams: withMongoIdAliasList(data) });
}

async function createCbtExam(exam) {
  const { data, error } = await supabase.from('cbt_exams').insert({
    title: exam.title, subject: exam.subject, class_name: exam.className,
    term: exam.term, duration_minutes: exam.durationMinutes,
  }).select().single();
  if (error) return fail(error.message);
  return ok({ message: 'Test created. Add questions before publishing.', exam: withMongoIdAlias(data) });
}

async function toggleCbtExamPublished(examId, published) {
  const { data, error } = await supabase.from('cbt_exams').update({ is_published: !!published }).eq('id', examId).select().single();
  if (error) return fail(error.message);
  return ok({ message: published ? 'Test published — students can now see it.' : 'Test unpublished.', exam: withMongoIdAlias(data) });
}

async function deleteCbtExam(examId) {
  const { error } = await supabase.from('cbt_exams').delete().eq('id', examId);
  if (error) return fail(error.message);
  return ok({ message: 'Test deleted.' });
}

async function getCbtExamQuestions(examId) {
  const { data, error } = await supabase.from('cbt_questions').select('*').eq('exam_id', examId).order('position');
  if (error) return fail(error.message);
  return ok({ questions: withMongoIdAliasList(data) });
}

async function addCbtQuestion(examId, q, position) {
  const { data, error } = await supabase.from('cbt_questions').insert({
    exam_id: examId, question_text: q.questionText,
    option_a: q.optionA, option_b: q.optionB, option_c: q.optionC, option_d: q.optionD,
    correct_option: q.correctOption, marks: q.marks || 1, position: position || 0,
  }).select().single();
  if (error) return fail(error.message);
  return ok({ message: 'Question added.', question: withMongoIdAlias(data) });
}

async function deleteCbtQuestion(questionId) {
  const { error } = await supabase.from('cbt_questions').delete().eq('id', questionId);
  if (error) return fail(error.message);
  return ok({ message: 'Question removed.' });
}

// Teacher/admin view of who took a test and how they scored.
async function getCbtExamAttempts(examId) {
  const { data, error } = await supabase.from('cbt_attempts').select('*, students(student_name, admission_number)').eq('exam_id', examId).order('submitted_at', { ascending: false });
  if (error) return fail(error.message);
  return ok({
    attempts: (data || []).map(function (a) {
      return withMongoIdAlias({
        ...a,
        studentName: a.students ? a.students.student_name : '—',
        admissionNumber: a.students ? a.students.admission_number : '—',
      });
    }),
  });
}

// ── Student: taking a test ──
// Both of these call Edge Functions on purpose (never a direct table
// query) — see cbt-start-attempt/cbt-submit-attempt for why: it's the
// only way to keep the answer key from ever reaching a student's
// browser at all.

async function getAvailableCbtExams() {
  const idRes = await getMyStudentId();
  if (!idRes || !idRes.ok) return idRes;
  const { data: student } = await supabase.from('students').select('class_name').eq('id', idRes.data.studentId).single();
  if (!student) return fail('Student record not found.', 404);

  const { data: exams, error } = await supabase.from('cbt_exams').select('*').eq('class_name', student.class_name).eq('is_published', true).order('created_at', { ascending: false });
  if (error) return fail(error.message);

  const { data: attempts } = await supabase.from('cbt_attempts').select('exam_id, status, score, total_marks').eq('student_id', idRes.data.studentId);
  const byExam = {};
  (attempts || []).forEach(function (a) { byExam[a.exam_id] = a; });

  return ok({
    exams: (exams || []).map(function (e) {
      const attempt = byExam[e.id];
      return withMongoIdAlias({
        ...e,
        attemptStatus: attempt ? attempt.status : 'not_started',
        score: attempt ? attempt.score : null,
        totalMarks: attempt ? attempt.total_marks : null,
      });
    }),
  });
}

async function startCbtAttempt(examId) {
  return apiPost('/cbt/attempts/start', { examId });
}

async function submitCbtAttempt(examId, answers) {
  return apiPost('/cbt/attempts/submit', { examId, answers });
}

// ════════════════════════════════════════
//  SECURITY — output escaping (XSS)
// ════════════════════════════════════════
// Every dashboard builds table/list HTML by string-concatenating data
// that ultimately came from a user (a name typed on the admission
// form, a note a teacher typed, a subject title, etc). If that string
// is dropped straight into innerHTML, "<img src=x onerror=alert(1)>"
// as someone's name becomes a stored XSS payload the next time an
// admin views that list. escapeHtml() must wrap every such value
// before it goes into a template string that gets assigned to
// .innerHTML anywhere in the dashboards.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ════════════════════════════════════════
//  ONLINE PAYMENTS (Paystack, admin-togglable)
// ════════════════════════════════════════

async function getPaymentSettings() {
  const r = await apiGet('/settings/online-payments');
  if (!r.ok) return r;
  return ok({ onlinePaymentsEnabled: !!r.data.enabled });
}

// Admin-only — the Express route re-checks the caller's role server
// side regardless of what this client believes it is.
async function toggleOnlinePayments(enabled) {
  const r = await apiPut('/settings/online-payments', { enabled: !!enabled });
  if (!r.ok) return r;
  return ok({ message: r.data.message, enabled: r.data.enabled });
}

// Parent (or admin) — amount is decided server-side from the
// student's class fee, never sent from here.
async function initializePayment(studentId, term) {
  return apiPost('/payments/initialize', { studentId, term });
}

async function verifyPayment(reference) {
  return apiPost('/payments/verify', { reference });
}

async function getPaymentHistory(studentId) {
  const r = await apiGet(`/payments/history/${studentId}`);
  if (!r.ok) return r;
  return ok({ payments: withMongoIdAliasList(r.data.payments) });
}

async function setClassFee(classId, feeNaira) {
  const r = await apiPatch(`/classes/${classId}/fee`, { feeNaira: Number(feeNaira) });
  if (!r.ok) return r;
  return ok({ message: r.data.message, cls: withMongoIdAlias(r.data.class) });
}

// ════════════════════════════════════════
//  ATTENDANCE
// ════════════════════════════════════════

// Teacher: mark/update attendance for one student on one date.
async function markAttendance(studentId, className, date, status, note) {
  const r = await apiPost('/attendance/mark', { studentId, className, date, status, note: note || '' });
  if (!r.ok) return r;
  return ok({ message: r.data.message, attendance: withMongoIdAlias(r.data.attendance) });
}

// Teacher: whole class, one date — used to render/prefill the register.
async function getClassAttendance(className, date) {
  const r = await apiGet(`/attendance/class/${encodeURIComponent(className)}/${date}`);
  if (!r.ok) return r;
  return ok({ attendance: withMongoIdAliasList(r.data.attendance) });
}

// Student/parent: history for one student (the Express route checks
// ownership itself now — see isOwnStudentRecord() in
// backend/src/utils/authz.js — since RLS no longer runs for requests
// that go through this backend).
async function getStudentAttendance(studentId, fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);
  const qs = params.toString();
  const r = await apiGet(`/attendance/student/${studentId}${qs ? '?' + qs : ''}`);
  if (!r.ok) return r;
  return ok({ attendance: withMongoIdAliasList(r.data.attendance), attendanceRate: r.data.attendanceRate });
}
