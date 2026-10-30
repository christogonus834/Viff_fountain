// DEMO ONLY: a tiny in-browser "database" over the demo data, so the real admission service (the same code the server runs) works offline.
(function (g) {
  'use strict';
  var D = g.DEMO;
  function db() { return D.db; }
  function ensure() {
    var d = db();
    if (!d.numbering) d.numbering = { id: true, mode: 'auto', prefix: 'VIFF', pattern: '{PREFIX}/{YEAR}/{SEQ}', seq_pad: 4, start_at: 1 };
    d.students.forEach(function (s) { if (s.admission_seq === undefined) { var m = /(\d+)$/.exec(s.admission_number || ''); s.admission_seq = m ? parseInt(m[1], 10) : null; } });
    d.authEmails = d.authEmails || {}; d.tempPw = d.tempPw || {};
  }
  function table(name) {
    var d = db();
    if (name === 'students') return d.students;
    if (name === 'classes') return d.classes;
    if (name === 'admission_numbering') return [d.numbering];
    if (name === 'profiles') return d.parents.map(function (p) { return Object.assign({ role: 'parent' }, p); });
    return [];
  }
  function Q(name) {
    var q = { op: 'select', f: [], payload: null, ord: null, lim: null, one: null };
    function finish(rows) { return q.one === 'single' ? (rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } }) : q.one === 'maybe' ? { data: rows[0] || null, error: null } : { data: rows, error: null }; }
    function run() {
      var d = db(), rows = table(name), match = function (r) { return q.f.every(function (fn) { return fn(r); }); };
      if (q.op === 'insert') {
        var row = Object.assign({ id: 'dm-' + Date.now().toString(36) + Math.floor(Math.random() * 1000) }, q.payload);
        if (name === 'students') {
          if (d.students.some(function (x) { return (row.admission_number && x.admission_number === row.admission_number) || (row.admission_seq != null && x.admission_seq === row.admission_seq); })) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          var sec = (d.classes.filter(function (c) { return c.name === row.class_name; })[0] || {}).section || '';
          Object.assign(row, { id: row.profile_id, name: row.student_name, studentName: row.student_name, admissionNumber: row.admission_number, className: row.class_name, section: sec, phone: row.parent_phone, status: 'approved',
            fee_status: 'not_paid', feeStatus: 'not_paid', fee_note: '', parent_profile_id: null, createdAt: D.nowISO(0), created_at: D.nowISO(0), session: D.SESSION });
          d.students.push(row);
          d.profiles[row.id] = d.profiles[row.id] || { id: row.id, name: row.student_name, role: 'student', phone: row.parent_phone };
        } else if (name === 'profiles') {
          if (row.role === 'parent') { var pr = { id: row.id, name: row.name, role: 'parent', contact_email: row.contact_email, login_email: row.login_email, phone: row.phone, must_change_password: true }; d.parents.push(pr); d.profiles[pr.id] = pr; row = pr; }
          else { d.profiles[row.id] = Object.assign({}, row, { role: 'student' }); }
          var pw = d.tempPw[row.login_email]; if (pw && d.profiles[row.id]) d.profiles[row.id].demoPw = pw;
        }
        D.save(); return finish([row]);
      }
      if (q.op === 'upsert') { Object.assign(d.numbering, q.payload); D.save(); return finish([d.numbering]); }
      if (q.op === 'update') { var hit = rows.filter(match); hit.forEach(function (r) { Object.assign(r, q.payload); }); D.save(); return finish(hit); }
      rows = rows.filter(match);
      if (q.ord) rows = rows.slice().sort(function (a, b) { return (a[q.ord.c] > b[q.ord.c] ? 1 : -1) * (q.ord.asc ? 1 : -1); });
      if (q.lim != null) rows = rows.slice(0, q.lim);
      return finish(rows.map(function (r) { return Object.assign({}, r); }));
    }
    var api = {
      select: function () { return api; }, insert: function (p) { q.op = 'insert'; q.payload = p; return api; }, update: function (p) { q.op = 'update'; q.payload = p; return api; }, upsert: function (p) { q.op = 'upsert'; q.payload = p; return api; },
      eq: function (c, v) { q.f.push(function (r) { return r[c] === v; }); return api; }, in: function (c, a) { q.f.push(function (r) { return a.indexOf(r[c]) > -1; }); return api; },
      not: function (c, op, v) { q.f.push(function (r) { return !(op === 'is' ? r[c] == v : false); }); return api; },
      order: function (c, o) { q.ord = { c: c, asc: !o || o.ascending !== false }; return api; }, limit: function (n) { q.lim = n; return api; },
      single: function () { q.one = 'single'; return api; }, maybeSingle: function () { q.one = 'maybe'; return api; },
      then: function (res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    return api;
  }
  var adapter = {
    from: function (n) { ensure(); return Q(n); },
    auth: { admin: {
      createUser: async function (o) {
        ensure(); var d = db(), known = d.authEmails[o.email] || d.admins.concat(d.teachers, d.parents).some(function (u) { return u.login_email === o.email; });
        if (known) return { data: null, error: { message: 'A user with this email address has already been registered' } };
        d.authEmails[o.email] = true; d.tempPw[o.email] = o.password; return { data: { user: { id: 'dm-u-' + Date.now().toString(36) + Math.floor(Math.random() * 1000) } }, error: null };
      },
      deleteUser: async function () { return { error: null }; }
    } }
  };
  g.DemoAdmissionDb = { db: adapter, ensure: ensure };
})(window);
