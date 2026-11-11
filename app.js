'use strict';
/* MORF Research Tracker: front end.
 * All data lives in the MORF Google Sheet; this file holds no data and no passwords.
 * With API_URL empty (or ?demo in the address), the site runs in preview mode and
 * saves changes only in the current browser.
 */

// ===================== Settings =====================
const API_URL = 'https://script.google.com/macros/s/AKfycbwhdaasiK146tebOxX6FmxMZo_RQv2VJ0m6lv-R4yx2PZj5BIqdVlNku1lbw43ibQwGrA/exec';            // Paste the Apps Script web app URL here (it ends in /exec).
const POLL_MS = 30000;         // how often open pages check for other people's changes
const DEMO = !API_URL || new URLSearchParams(location.search).has('demo');

const OPT = {
  category: ['Research', 'QI'],
  project_group: ['TriNetX retrospective', 'Clinical Prospective', 'Review Article', 'QI Project', 'Other'],
  focus_area: ['Method Development', 'Data Analysis', 'Quality Improvement'],
  project_status: ['Not started', 'Literature review', 'Data collection', 'Drafting Manuscript', 'Manuscript Completed', 'Submitted', 'Published'],
  task_status: ['To Do', 'In Progress', 'Done'],
  task_type: ['Analysis', 'Experiment', 'Writing', 'Admin'],
  deadline_type: ['Conference', 'Abstract/Poster Deadline', 'Grant Deadline', 'Scholarship', 'Educational Course'],
  deadline_status: ['Not started', 'In progress', 'Submitted', 'Done'],
  priority: ['High', 'Medium', 'Low'],
  effort: ['Small', 'Medium', 'Large'],
  grant_status: ['Researching', 'Planning to apply', 'Submitted', 'Awarded', 'Not awarded'],
  sub_kind: ['Abstract', 'Poster', 'Podium', 'Manuscript'],
  sub_status: ['Submitted', 'Accepted', 'Presented', 'Rejected', 'Published'],
};
// Dropdown lists an admin can add choices to from the site (stored in the Sheet's Options tab).
// The choices above are built in; added ones are appended after them. Keys must match OPTION_LISTS in Code.gs.
const LIST_LABELS = {
  project_group: 'Project type', focus_area: 'Focus area', project_status: 'Project status',
  task_type: 'Task type', deadline_type: 'Deadline type', deadline_status: 'Deadline status',
  priority: 'Priority', effort: 'Effort', grant_status: 'Grant status',
  sub_kind: 'Submission kind', sub_status: 'Submission status',
};
const NEW_CHOICE = '__new__';
// Project statuses that count as finished (shown under "Done" instead of "Active").
const DONE_PROJECT = ['Manuscript Completed', 'Submitted', 'Published'];

// Form fields for each Sheet tab. Keys must match the column names in backend/Code.gs.
const SCHEMA = {
  Projects: { noun: 'project', fields: [
    { k: 'title', l: 'Project title', t: 'text', req: true, full: true },
    { k: 'category', l: 'Category', t: 'select', o: 'category' },
    { k: 'project_group', l: 'Project type', t: 'select', o: 'project_group' },
    { k: 'status', l: 'Status', t: 'select', o: 'project_status' },
    { k: 'focus_area', l: 'Focus area', t: 'select', o: 'focus_area' },
    { k: 'team', l: 'Team', t: 'text', ph: 'Names, separated by commas' },
    { k: 'target_date', l: 'Target date', t: 'date' },
    { k: 'notes', l: 'Notes', t: 'textarea', full: true },
  ]},
  Tasks: { noun: 'task', fields: [
    { k: 'task', l: 'Task', t: 'text', req: true, full: true },
    { k: 'project_id', l: 'Project', t: 'project', full: true },
    { k: 'status', l: 'Status', t: 'select', o: 'task_status' },
    { k: 'type', l: 'Type', t: 'select', o: 'task_type' },
    { k: 'due_date', l: 'Due date', t: 'date' },
    { k: 'assignee', l: 'Assigned to', t: 'text', ph: 'Who is doing it' },
  ]},
  Deadlines: { noun: 'deadline or conference', fields: [
    { k: 'name', l: 'Name', t: 'text', req: true, full: true, ph: 'e.g., OrthoCon 2027 abstract submissions' },
    { k: 'type', l: 'Type', t: 'select', o: 'deadline_type' },
    { k: 'status', l: 'Status', t: 'select', o: 'deadline_status' },
    { k: 'start_date', l: 'Date (or first day)', t: 'date' },
    { k: 'end_date', l: 'Last day (multi-day events)', t: 'date' },
    { k: 'priority', l: 'Priority', t: 'select', o: 'priority' },
    { k: 'effort', l: 'Effort', t: 'select', o: 'effort' },
    { k: 'team', l: 'Team', t: 'text', full: true },
    { k: 'link', l: 'Website', t: 'url', full: true, ph: 'https://' },
    { k: 'description', l: 'Description', t: 'textarea', full: true },
  ]},
  Grants: { noun: 'grant', fields: [
    { k: 'name', l: 'Grant name', t: 'text', req: true, full: true },
    { k: 'sponsor', l: 'Sponsor / organization', t: 'text' },
    { k: 'amount', l: 'Amount', t: 'text', ph: 'e.g., $10,000' },
    { k: 'deadline', l: 'Application deadline', t: 'date' },
    { k: 'status', l: 'Status', t: 'select', o: 'grant_status' },
    { k: 'link', l: 'Website', t: 'url', full: true, ph: 'https://' },
    { k: 'description', l: 'Description and eligibility', t: 'textarea', full: true },
  ]},
  Submissions: { noun: 'submission', fields: [
    { k: 'project_id', l: 'Project', t: 'project', req: true, full: true },
    { k: 'venue', l: 'Conference or journal', t: 'text', full: true, ph: 'e.g., AAOS 2027 or JBJS' },
    { k: 'deadline_id', l: 'Linked conference on this site (optional)', t: 'deadline', full: true },
    { k: 'kind', l: 'Kind', t: 'select', o: 'sub_kind' },
    { k: 'status', l: 'Status', t: 'select', o: 'sub_status' },
    { k: 'submitted_date', l: 'Date submitted', t: 'date' },
    { k: 'presentation_date', l: 'Presentation date (blank = linked conference date)', t: 'date' },
    { k: 'presenter', l: 'Presenter / first author', t: 'text' },
    { k: 'notes', l: 'Notes', t: 'textarea', full: true },
  ]},
  Contacts: { noun: 'contact', fields: [
    { k: 'name', l: 'Name', t: 'text', req: true },
    { k: 'role', l: 'Role', t: 'text', ph: 'Research Fellow' },
    { k: 'phone', l: 'Phone', t: 'text', full: true },
  ]},
  Options: { noun: 'dropdown choice', adminOnly: true, fields: [
    { k: 'list', l: 'Dropdown list', t: 'list', req: true, full: true },
    { k: 'value', l: 'Choice', t: 'text', req: true, full: true, ph: 'e.g., Skeletal Dynamics', max: 80 },
  ]},
};

const VIEWS = [
  ['dashboard', 'Dashboard'], ['research', 'Research'], ['qi', 'QI Projects'], ['tasks', 'Tasks'],
  ['deadlines', 'Conferences & Deadlines'], ['timeline', 'Timeline'], ['grants', 'Grants'], ['submissions', 'Submissions'],
];
const ADMIN_VIEWS = [['choices', 'Dropdown lists']];
function views() { return state.role === 'admin' ? VIEWS.concat(ADMIN_VIEWS) : VIEWS; }

// ===================== State =====================
const state = {
  token: localStorage.getItem('morf_token') || '',
  role: localStorage.getItem('morf_role') || '',
  name: localStorage.getItem('morf_name') || '',
  data: null, version: null, byId: {}, proj: {},
  view: location.hash.slice(1) || 'dashboard',
  f: {},
  calMonth: firstOfMonth(new Date()),
  lastSync: 0, syncError: false, busy: false, timer: null,
};

// ===================== Small helpers =====================
const $ = (s, el = document) => el.querySelector(s);
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
}
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function todayIso() { return iso(new Date()); }
function addDaysIso(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
function daysUntil(s) { const d = parseDate(s); if (!d) return null; const t = parseDate(todayIso()); return Math.round((d - t) / 86400000); }
function fmtDate(s, withYear = true) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }) : '';
}
function fmtRange(a, b) {
  if (!a) return '';
  if (!b || b === a) return fmtDate(a);
  const da = parseDate(a), db = parseDate(b);
  return (da.getFullYear() === db.getFullYear() ? fmtDate(a, false) : fmtDate(a)) + ' – ' + fmtDate(b);
}
function rel(n) {
  if (n === null) return '';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
}
function fmtStamp(s) {
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function byText(k) { return (a, b) => String(a[k] || '').localeCompare(String(b[k] || ''), undefined, { sensitivity: 'base' }); }
function byDate(k, desc = false) {
  return (a, b) => {
    const x = a[k] || '', y = b[k] || '';
    if (!x && !y) return 0; if (!x) return 1; if (!y) return -1;
    return desc ? y.localeCompare(x) : x.localeCompare(y);
  };
}
function distinct(rows, k, base = []) {
  const set = new Set(base);
  rows.forEach(r => { if (r[k]) set.add(r[k]); });
  return [...set];
}
// Built-in choices for a dropdown plus any an admin has added (Options tab), without repeats.
function opts(list) {
  const out = OPT[list].slice(), seen = new Set(out.map(v => v.toLowerCase()));
  customChoices(list).forEach(o => {
    if (!seen.has(o.value.toLowerCase())) { seen.add(o.value.toLowerCase()); out.push(o.value); }
  });
  return out;
}
function customChoices(list) {
  return ((state.data && state.data.Options) || []).filter(o => o.list === list && o.value);
}
function matches(r, q, keys) {
  if (!q) return true;
  q = q.toLowerCase();
  return keys.some(k => String(r[k] || '').toLowerCase().includes(q));
}
function tone(s) {
  s = String(s || '').toLowerCase();
  if (/reject|not awarded/.test(s)) return 'red';
  if (/done|complet|published|accepted|awarded|presented/.test(s)) return 'green';
  if (/draft|progress|submitted|collection|analysis|planning/.test(s)) return 'amber';
  if (/literature|researching/.test(s)) return 'blue';
  return 'grey';
}
function pill(s) { return s ? '<span class="pill ' + tone(s) + '">' + esc(s) + '</span>' : ''; }
function typeClass(t) {
  t = String(t || '').toLowerCase();
  if (t.includes('conference')) return 't-conference';
  if (t.includes('abstract') || t.includes('poster')) return 't-abstract';
  if (t.includes('grant')) return 't-grant';
  if (t.includes('scholar')) return 't-scholarship';
  if (t.includes('course') || t.includes('educat')) return 't-course';
  return 't-other';
}
function typePill(t) { return t ? '<span class="pill ' + typeClass(t) + '">' + esc(t) + '</span>' : ''; }
function projTitle(id) { const p = state.byId[id]; return p ? p.title : ''; }
function F(view, defaults) { return state.f[view] || (state.f[view] = Object.assign({}, defaults)); }
function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
function apiError(code, message, current) { const e = new Error(message); e.code = code; e.current = current; return e; }

// ===================== Server calls =====================
async function api(action, payload = {}) {
  if (DEMO) return demoApi(action, payload);
  let res, j;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // plain text avoids a CORS preflight
      body: JSON.stringify(Object.assign({}, payload, { action: action, token: state.token })),
    });
  } catch (e) { throw apiError('network', 'Cannot reach the tracker. Check your connection and try again.'); }
  try { j = await res.json(); } catch (e) { throw apiError('server', 'The tracker sent an unexpected reply. Try again in a minute.'); }
  if (!j.ok) throw apiError(j.code || 'server', j.error || 'Something went wrong.', j.current);
  return j;
}

// Preview mode: same rules as the real backend, stored in this browser only.
const DEMO_KEY = 'morf_demo_db';
async function demoDb() {
  let db = null;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { db = null; }
  if (!db) {
    db = { version: '1', data: {} };
    Object.keys(SCHEMA).forEach(t => { db.data[t] = []; });
    try { // only present when previewing locally, never on the public site
      const r = await fetch('../backend/seed.json', { cache: 'no-store' });
      if (r.ok) { const s = await r.json(); Object.keys(s).forEach(t => { if (db.data[t]) db.data[t] = s[t]; }); }
    } catch (e) { /* start empty */ }
    localStorage.setItem(DEMO_KEY, JSON.stringify(db));
  }
  Object.keys(SCHEMA).forEach(t => { if (!db.data[t]) db.data[t] = []; }); // previews saved before a tab existed
  return db;
}
function demoSave(db) { db.version = String(Date.now()); localStorage.setItem(DEMO_KEY, JSON.stringify(db)); return db.version; }
async function demoApi(action, p) {
  if (action === 'login') {
    const name = String(p.name || '').trim().slice(0, 60);
    if (!name) throw apiError('bad_request', 'Enter your name.');
    if (!p.password) throw apiError('auth', 'Wrong password.');
    return { ok: true, token: 'demo', role: p.password === 'admin' ? 'admin' : 'resident', name: name };
  }
  const db = await demoDb();
  if (action === 'version') return { ok: true, version: db.version };
  if (action === 'list') {
    const data = {};
    Object.keys(db.data).forEach(t => { data[t] = db.data[t].filter(r => String(r.archived).toUpperCase() !== 'TRUE'); });
    return { ok: true, version: db.version, data: data, role: state.role };
  }
  const rows = db.data[p.tab];
  if (!rows) throw apiError('bad_request', 'Unknown tab.');
  if (p.tab === 'Contacts' && state.role !== 'admin') throw apiError('forbidden', 'Only an admin can change Contacts.');
  if (p.tab === 'Options' && state.role !== 'admin') throw apiError('forbidden', 'Only an admin can change dropdown choices.');
  const checkOption = (o, selfId) => {
    if (!LIST_LABELS[o.list]) throw apiError('bad_request', 'That dropdown list cannot be changed.');
    if (!o.value) throw apiError('bad_request', 'Enter the new choice.');
    if (rows.some(x => x.id !== selfId && String(x.archived).toUpperCase() !== 'TRUE' && x.list === o.list && x.value.toLowerCase() === o.value.toLowerCase())) {
      throw apiError('bad_request', '"' + o.value + '" is already a choice in that list.');
    }
  };
  const clean = rec => {
    const o = {};
    SCHEMA[p.tab].fields.forEach(f => { if (rec && f.k in rec) o[f.k] = String(rec[f.k] == null ? '' : rec[f.k]).trim(); });
    return o;
  };
  const now = new Date().toISOString();
  if (action === 'create') {
    if (p.tab === 'Options') checkOption(clean(p.record), null);
    const r = Object.assign(clean(p.record), { id: p.tab[0].toLowerCase() + Math.random().toString(16).slice(2, 10), updated_at: now, updated_by: state.name, archived: '' });
    rows.push(r);
    return { ok: true, record: r, version: demoSave(db) };
  }
  const r = rows.find(x => x.id === p.id);
  if (!r) throw apiError('not_found', 'That entry no longer exists. Reloading.');
  if (action === 'update') {
    if (p.expected_updated_at && r.updated_at !== p.expected_updated_at) {
      throw apiError('conflict', r.updated_by + ' changed this entry while you were editing it. Your edit was not saved.', r);
    }
    if (p.tab === 'Options') checkOption(Object.assign({}, r, clean(p.record)), r.id);
    Object.assign(r, clean(p.record), { updated_at: now, updated_by: state.name });
    return { ok: true, record: r, version: demoSave(db) };
  }
  if (action === 'archive') {
    if (state.role !== 'admin') throw apiError('forbidden', 'Only an admin can delete entries.');
    Object.assign(r, { archived: 'TRUE', updated_at: now, updated_by: state.name });
    return { ok: true, version: demoSave(db) };
  }
  throw apiError('bad_request', 'Unknown action.');
}

function handleError(e) {
  if (e.code === 'auth') { logout(e.message); return; }
  toast(e.message, 'error');
}

// ===================== Data =====================
function derive() {
  const d = state.data;
  state.byId = {};
  Object.keys(d).forEach(t => d[t].forEach(r => { state.byId[r.id] = r; }));
  state.proj = {};
  d.Projects.forEach(p => { state.proj[p.id] = { total: 0, done: 0, next: '' }; });
  d.Tasks.forEach(t => {
    const s = state.proj[t.project_id];
    if (!s) return;
    s.total++;
    if (t.status === 'Done') s.done++;
    else if (t.due_date && (!s.next || t.due_date < s.next)) s.next = t.due_date;
  });
}

async function loadData() {
  try {
    const j = await api('list');
    state.data = {};
    Object.keys(SCHEMA).forEach(t => { state.data[t] = (j.data && j.data[t]) || []; });
    state.version = j.version;
    state.lastSync = Date.now();
    state.syncError = false;
    derive();
    refreshView();
  } catch (e) {
    state.syncError = true;
    handleError(e);
  }
  updateSync();
}

function applySaved(tab, record, version, removed) {
  const rows = state.data[tab];
  const i = rows.findIndex(r => r.id === (record && record.id));
  if (removed) { if (i >= 0) rows.splice(i, 1); }
  else if (i >= 0) rows[i] = record;
  else rows.push(record);
  state.version = version;
  state.lastSync = Date.now();
  derive();
  refreshView();
  updateSync();
}

async function checkVersion() {
  if (document.hidden || !state.token || state.busy || !state.data) return;
  try {
    const j = await api('version');
    state.syncError = false;
    state.lastSync = Date.now();
    if (j.version !== state.version) await loadData();
  } catch (e) {
    state.syncError = true;
    if (e.code === 'auth') logout(e.message);
  }
  updateSync();
}

function startPolling() {
  clearInterval(state.timer);
  state.timer = setInterval(checkVersion, POLL_MS);
}

function updateSync() {
  const el = $('#sync');
  if (!el) return;
  el.classList.toggle('err', state.syncError);
  if (state.syncError) { el.textContent = 'Offline, retrying'; return; }
  if (!state.lastSync) { el.textContent = 'Connecting…'; return; }
  const s = Math.round((Date.now() - state.lastSync) / 1000);
  el.textContent = 'Synced ' + (s < 10 ? 'just now' : s < 60 ? s + 's ago' : Math.round(s / 60) + ' min ago');
}

// ===================== Login and shell =====================
function showLogin(msg) {
  $('#app').innerHTML =
    '<div class="login-wrap"><form class="login card" id="login-form">' +
    '<div class="brand-mark">M</div>' +
    '<h1>MORF Research Tracker</h1>' +
    '<p class="muted" style="margin:0">Research and QI projects, tasks, conference and grant deadlines, and submissions.</p>' +
    (DEMO ? '<p class="notice">Preview mode: any password works (type <b>admin</b> for admin rights). Changes stay in this browser.</p>' : '') +
    '<label>Your name<input name="name" autocomplete="name" required maxlength="60" placeholder="First and last name" value="' + esc(state.name) + '"></label>' +
    '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
    '<button class="btn primary" type="submit">Log in</button>' +
    '<p class="error" id="login-error">' + esc(msg || '') + '</p>' +
    '<p class="muted small" style="margin:0">Ask a research fellow for the password.</p>' +
    '</form></div>';
  const form = $('#login-form');
  (state.name ? form.password : form.name).focus();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Logging in…';
    $('#login-error').textContent = '';
    try {
      const j = await api('login', { name: form.name.value, password: form.password.value });
      state.token = j.token; state.role = j.role; state.name = j.name;
      localStorage.setItem('morf_token', j.token);
      localStorage.setItem('morf_role', j.role);
      localStorage.setItem('morf_name', j.name);
      enterApp();
    } catch (e) {
      $('#login-error').textContent = e.message;
      btn.disabled = false; btn.textContent = 'Log in';
    }
  });
}

function logout(msg) {
  clearInterval(state.timer);
  state.token = ''; state.role = ''; state.data = null; state.version = null; state.lastSync = 0;
  localStorage.removeItem('morf_token');
  localStorage.removeItem('morf_role');
  closeModal();
  showLogin(msg);
}

function enterApp() {
  $('#app').innerHTML =
    '<header class="topbar"><div class="brand"><span class="brand-mark sm">M</span><span>MORF Research Tracker</span></div>' +
    '<div class="top-right"><span id="sync" class="sync">Connecting…</span>' +
    '<span class="who">' + esc(state.name) + (state.role === 'admin' ? '<span class="badge admin">admin</span>' : '') + '</span>' +
    '<button class="btn ghost sm" id="logout-btn" type="button">Log out</button></div></header>' +
    (DEMO ? '<div class="demo-banner">Preview mode: changes are saved only in this browser.</div>' : '') +
    '<nav class="tabs" id="tabs">' + views().map(v => '<a href="#' + v[0] + '" data-view="' + v[0] + '">' + esc(v[1]) + '</a>').join('') + '</nav>' +
    '<main id="main"><div class="loading">Loading…</div></main>';
  $('#logout-btn').addEventListener('click', () => logout());
  loadData();
  startPolling();
}

// ===================== Rendering =====================
function refreshView() {
  if (!state.data || !$('#main')) return;
  if (state.rendered === state.view && $('#results')) renderResults();
  else renderView();
}

function renderView() {
  if (!state.data || !$('#main')) return;
  if (!views().some(v => v[0] === state.view)) state.view = 'dashboard';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.view === state.view));
  $('#main').innerHTML = VIEW_DEF[state.view].shell();
  state.rendered = state.view;
  renderResults();
}

function renderResults() {
  const el = $('#results');
  if (el) el.innerHTML = VIEW_DEF[state.view].body();
}

function head(title, text, addTab, preset, addLabel) {
  return '<div class="view-head"><div><h2>' + esc(title) + '</h2><p>' + text + '</p></div>' +
    (addTab ? addBtn(addTab, preset, addLabel) : '') + '</div>';
}
function addBtn(tab, preset, label) {
  return '<button class="btn primary" type="button" data-add="' + tab + '"' +
    (preset ? ' data-preset="' + esc(JSON.stringify(preset)) + '"' : '') + '>+ ' + esc(label || 'Add ' + SCHEMA[tab].noun) + '</button>';
}
function seg(view, key, options) {
  const cur = F(view)[key];
  return '<div class="seg" role="group">' + options.map(o =>
    '<button type="button" data-seg="' + key + '" data-val="' + esc(o[0]) + '" class="' + (cur === o[0] ? 'on' : '') + '">' + esc(o[1]) + '</button>').join('') + '</div>';
}
function selectFilter(view, key, label, values) {
  const cur = F(view)[key] || '';
  return '<select data-filter="' + key + '" aria-label="' + esc(label) + '"><option value="">' + esc(label) + ': all</option>' +
    values.map(v => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select>';
}
function projectFilter(view, rows) {
  const cur = F(view).project || '';
  const ids = [...new Set(rows.map(r => r.project_id).filter(id => state.byId[id]))];
  ids.sort((a, b) => projTitle(a).localeCompare(projTitle(b)));
  return '<select data-filter="project" aria-label="Project"><option value="">Project: all</option>' +
    ids.map(id => '<option value="' + esc(id) + '"' + (id === cur ? ' selected' : '') + '>' + esc(projTitle(id)) + '</option>').join('') + '</select>';
}
function search(view, ph) {
  return '<input type="search" data-filter="q" placeholder="' + esc(ph || 'Search') + '" value="' + esc(F(view).q || '') + '">';
}
function table(cols, rows, rowAttrs) {
  if (!rows.length) return '<div class="table-wrap"><div class="empty">Nothing here yet.</div></div>';
  return '<div class="table-wrap"><table><thead><tr>' + cols.map(c => '<th>' + esc(c[0]) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr ' + rowAttrs(r) + '>' + cols.map(c => '<td' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + c[1](r) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
function editAttrs(tab, extraClass) {
  return r => 'data-edit="' + tab + ':' + esc(r.id) + '" tabindex="0"' + (extraClass ? ' class="' + extraClass(r) + '"' : '');
}
function linkIcon(url) {
  const u = safeUrl(url);
  return u ? ' <a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" title="Open website">↗</a>' : '';
}
function dueCell(s, done) {
  if (!s) return '<span class="muted">None</span>';
  const n = daysUntil(s);
  return '<span class="' + (!done && n < 0 ? 'overdue' : '') + '">' + esc(fmtDate(s)) + '</span>';
}

// ---------- Dashboard ----------
function dashboardShell() {
  const open = state.howtoOpen !== false;
  return '<div class="card" style="margin-bottom:1rem"><details class="howto" id="howto"' + (open ? ' open' : '') + '><summary>How to use this tracker</summary><ol>' +
    '<li><b>Projects:</b> add yours under <b>Research</b> or <b>QI Projects</b> with "+ Add project". Keep <b>Status</b> and <b>Team</b> current.</li>' +
    '<li><b>Tasks:</b> break work into tasks and link each one to its project. Ticking a task off updates that project\'s <b>Progress</b> and <b>Next due</b>.</li>' +
    '<li><b>Conferences &amp; Deadlines:</b> add conference dates, abstract deadlines, scholarships, and courses. Grants go under <b>Grants</b> and also show on the calendar.</li>' +
    '<li><b>Timeline:</b> a Gantt chart of conferences, courses, abstract and grant deadlines, and each submission from the date it was sent to its presentation.</li>' +
    '<li><b>Submissions:</b> log every abstract or manuscript you send out, then update its status when you hear back (Accepted, Presented, Published).</li>' +
    '<li><b>QI:</b> everyone needs one QI project to graduate. Projects marked <b>Needs owner</b> are open; add your name to Team and contact a research fellow.</li>' +
    '</ol><p class="muted small" style="margin:.6rem 0 0">Changes save as soon as you click Save and appear for everyone within 30 seconds. Only admins can delete entries.</p></details></div>' +
    '<div id="results"></div>';
}
function dashboardBody() {
  const d = state.data, t0 = todayIso(), t60 = addDaysIso(60);
  const items = [];
  allEvents().forEach(ev => {
    if ((ev.end || ev.start) >= t0 && ev.start <= t60) items.push({ date: ev.start >= t0 ? ev.start : t0, label: ev.name, sub: ev.type, tab: ev.tab, id: ev.id, ongoing: ev.start < t0 });
  });
  d.Tasks.forEach(t => {
    if (t.status !== 'Done' && t.due_date && t.due_date <= t60) {
      items.push({ date: t.due_date, label: t.task, sub: 'Task' + (projTitle(t.project_id) ? ' · ' + projTitle(t.project_id) : ''), tab: 'Tasks', id: t.id, overdue: t.due_date < t0 });
    }
  });
  items.sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = items.length ? '<ul class="list">' + items.slice(0, 14).map(i =>
    '<li><div><button class="linkish" type="button" data-edit="' + i.tab + ':' + esc(i.id) + '">' + esc(i.label) + '</button><div class="muted small">' + esc(i.sub) + '</div></div>' +
    '<div class="when' + (i.overdue ? ' overdue' : '') + '">' + esc(fmtDate(i.date)) + '<br>' + (i.ongoing ? 'happening now' : i.overdue ? 'overdue' : esc(rel(daysUntil(i.date)))) + '</div></li>').join('') + '</ul>'
    : '<div class="empty">Nothing due in the next 60 days.</div>';

  const contacts = d.Contacts.slice().sort(byText('name'));
  const contactHtml = contacts.length ? '<ul class="list">' + contacts.map(c =>
    '<li><div>' + (state.role === 'admin' ? '<button class="linkish" type="button" data-edit="Contacts:' + esc(c.id) + '">' + esc(c.name) + '</button>' : '<b>' + esc(c.name) + '</b>') +
    '<div class="muted small">' + esc(c.role) + '</div></div><div class="when">' +
    (c.phone ? '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + esc(c.phone) + '</a>' : '') + '</div></li>').join('') + '</ul>'
    : '<div class="empty">No contacts yet.</div>';

  const statusCounts = cat => {
    const rows = d.Projects.filter(p => p.category === cat);
    const counts = {};
    rows.forEach(p => { const s = p.status || 'No status'; counts[s] = (counts[s] || 0) + 1; });
    const order = opts('project_status').concat(['No status']);
    const keys = Object.keys(counts).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    return '<p class="count">' + rows.length + ' projects</p><div class="stat-rows">' +
      keys.map(k => '<div><span>' + pill(k === 'No status' ? '' : k) + (k === 'No status' ? '<span class="muted">No status</span>' : '') + '</span><b>' + counts[k] + '</b></div>').join('') + '</div>';
  };

  const needOwner = d.Projects.filter(p => p.category === 'QI' && !p.team && !DONE_PROJECT.includes(p.status)).sort(byText('title'));
  const ownerHtml = needOwner.length ? '<ul class="list">' + needOwner.map(p =>
    '<li><button class="linkish" type="button" data-edit="Projects:' + esc(p.id) + '">' + esc(p.title) + '</button><span class="when">' + pill(p.status) + '</span></li>').join('') + '</ul>'
    : '<div class="empty">Every QI project has an owner.</div>';

  const recentSubs = d.Submissions.slice().sort(byDate('updated_at', true)).slice(0, 6);
  const subsHtml = recentSubs.length ? '<ul class="list">' + recentSubs.map(s =>
    '<li><div><button class="linkish" type="button" data-edit="Submissions:' + esc(s.id) + '">' + esc(projTitle(s.project_id) || 'Untitled project') + '</button>' +
    '<div class="muted small">' + esc([s.kind, venueName(s)].filter(Boolean).join(' · ')) + '</div></div><span class="when">' + pill(s.status) + '</span></li>').join('') + '</ul>'
    : '<div class="empty">No submissions logged yet.</div>';

  return '<div class="grid">' +
    '<section class="card"><h3>Coming up (next 60 days)</h3>' + upcoming + '</section>' +
    '<section class="card"><h3>Research fellows' + (state.role === 'admin' ? addBtn('Contacts', null, 'Add') : '') + '</h3>' + contactHtml +
    '<p class="muted small" style="margin:.6rem 0 0">Contact a fellow to join a project or claim a QI project.</p></section>' +
    '<section class="card"><h3>Research projects by status</h3>' + statusCounts('Research') + '</section>' +
    '<section class="card"><h3>QI projects needing an owner</h3>' + ownerHtml + '</section>' +
    '<section class="card"><h3>Latest submissions' + addBtn('Submissions', null, 'Log') + '</h3>' + subsHtml + '</section>' +
    '<section class="card"><h3>QI projects by status</h3>' + statusCounts('QI') + '</section>' +
    '</div>';
}

// ---------- Projects (Research and QI) ----------
function projectsShell(view, cat) {
  F(view, { show: 'active' });
  const rows = state.data.Projects.filter(p => p.category === cat);
  const intro = cat === 'QI'
    ? 'Plenty to go around: everybody needs one to graduate. Open projects are marked <b>Needs owner</b>; claim one and contact a research fellow.'
    : 'Every line of research in flight and how far along it is. <b>Active</b> is the day-to-day list, <b>Done</b> is the archive, and <b>All</b> shows everything by target date.';
  return head(cat === 'QI' ? 'QI Projects' : 'Research Projects', intro, 'Projects', { category: cat }, 'Add project') +
    '<div class="controls">' + seg(view, 'show', [['active', 'Active'], ['done', 'Done'], ['all', 'All']]) +
    selectFilter(view, 'status', 'Status', distinct(rows, 'status', opts('project_status'))) +
    (cat === 'QI' ? '' : selectFilter(view, 'project_group', 'Type', distinct(rows, 'project_group', opts('project_group')))) +
    selectFilter(view, 'focus_area', 'Focus', distinct(rows, 'focus_area', opts('focus_area'))) +
    search(view, 'Search projects or team') + '</div><div id="results"></div>';
}
function projectsBody(view, cat) {
  const f = F(view);
  let rows = state.data.Projects.filter(p => p.category === cat)
    .filter(p => f.show === 'all' || (f.show === 'done') === DONE_PROJECT.includes(p.status))
    .filter(p => (!f.status || p.status === f.status) && (!f.project_group || p.project_group === f.project_group) && (!f.focus_area || p.focus_area === f.focus_area))
    .filter(p => matches(p, f.q, ['title', 'team', 'notes', 'project_group']));
  if (f.show === 'all') rows.sort((a, b) => byDate('target_date')(a, b) || byText('title')(a, b));
  else rows.sort((a, b) => byDate('next')(state.proj[a.id], state.proj[b.id]) || byText('title')(a, b));
  const cols = [
    ['Project', p => '<div class="title">' + esc(p.title) + (cat === 'QI' && !p.team && !DONE_PROJECT.includes(p.status) ? '<span class="badge">Needs owner</span>' : '') + '</div>' +
      (p.team ? '<div class="sub">' + esc(p.team) + '</div>' : '')],
    ['Status', p => pill(p.status) || '<span class="muted">None</span>'],
  ];
  if (cat !== 'QI') cols.push(['Type', p => esc(p.project_group)]);
  cols.push(
    ['Focus', p => esc(p.focus_area)],
    ['Progress', p => {
      const s = state.proj[p.id];
      if (!s.total) return '<span class="muted small">No tasks</span>';
      const pct = Math.round(100 * s.done / s.total);
      return '<div class="progress"><div class="bar"><i style="width:' + pct + '%"></i></div><span class="small">' + s.done + '/' + s.total + '</span></div>';
    }],
    ['Next due', p => state.proj[p.id].next ? dueCell(state.proj[p.id].next) : '<span class="muted">None</span>', 'nowrap'],
    ['Target', p => p.target_date ? esc(fmtDate(p.target_date)) : '<span class="muted">None</span>', 'nowrap'],
  );
  return '<p class="count">' + rows.length + ' shown</p>' + table(cols, rows, editAttrs('Projects'));
}

// ---------- Tasks ----------
function tasksShell() {
  F('tasks', { show: 'open' });
  const rows = state.data.Tasks;
  return head('Research Tasks', 'The individual pieces of work that move each project forward. Give a task a project and a due date, and the project\'s progress bar and next due date follow on their own.', 'Tasks') +
    '<div class="controls">' + seg('tasks', 'show', [['open', 'Open'], ['done', 'Done'], ['all', 'All']]) +
    projectFilter('tasks', rows) + selectFilter('tasks', 'type', 'Type', distinct(rows, 'type', opts('task_type'))) +
    search('tasks', 'Search tasks or people') + '</div><div id="results"></div>';
}
function tasksBody() {
  const f = F('tasks');
  const rows = state.data.Tasks
    .filter(t => f.show === 'all' || (f.show === 'done') === (t.status === 'Done'))
    .filter(t => (!f.project || t.project_id === f.project) && (!f.type || t.type === f.type))
    .filter(t => matches(Object.assign({ ptitle: projTitle(t.project_id) }, t), f.q, ['task', 'assignee', 'ptitle']))
    .sort((a, b) => byDate('due_date')(a, b) || byText('task')(a, b));
  if (!rows.length) return '<div class="task-list"><div class="empty">No tasks match.</div></div>';
  const groups = {};
  rows.forEach(t => { (groups[t.type || 'Other'] = groups[t.type || 'Other'] || []).push(t); });
  return Object.keys(groups).sort().map(g =>
    '<div class="group-title">' + esc(g) + ' (' + groups[g].length + ')</div><div class="task-list">' + groups[g].map(t => {
      const done = t.status === 'Done';
      return '<div class="task' + (done ? ' done' : '') + '"><input type="checkbox" data-task-toggle="' + esc(t.id) + '"' + (done ? ' checked' : '') + ' aria-label="Mark done">' +
        '<div class="body"><button class="linkish" type="button" data-edit="Tasks:' + esc(t.id) + '">' + esc(t.task) + '</button><div class="meta">' +
        (projTitle(t.project_id) ? '<span>' + esc(projTitle(t.project_id)) + '</span>' : '<span>No project</span>') +
        (t.assignee ? '<span>' + esc(t.assignee) + '</span>' : '') +
        (t.status && t.status !== 'Done' && t.status !== 'To Do' ? '<span>' + esc(t.status) + '</span>' : '') +
        (t.due_date ? '<span>Due ' + dueCell(t.due_date, done) + '</span>' : '') +
        '</div></div></div>';
    }).join('') + '</div>').join('');
}

// ---------- Conferences & deadlines ----------
function allEvents() {
  const d = state.data;
  return d.Deadlines.map(r => ({ tab: 'Deadlines', id: r.id, name: r.name, type: r.type || 'Other', start: r.start_date, end: r.end_date || r.start_date, rec: r }))
    .concat(d.Grants.filter(g => g.deadline).map(g => ({ tab: 'Grants', id: g.id, name: g.name + ' (grant)', type: 'Grant Deadline', start: g.deadline, end: g.deadline, rec: g })));
}
function deadlinesShell() {
  F('deadlines', { show: 'upcoming' });
  const types = distinct(state.data.Deadlines, 'type', opts('deadline_type'));
  return head('Conferences & Deadlines', 'Conference dates, abstract and poster deadlines, scholarships, and courses. Grant deadlines from the Grants tab appear here too.', 'Deadlines', null, 'Add deadline or conference') +
    '<div class="controls">' + seg('deadlines', 'show', [['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']]) +
    selectFilter('deadlines', 'type', 'Type', types) + search('deadlines', 'Search') + '</div><div id="results"></div>';
}
function deadlinesBody() {
  const f = F('deadlines'), t0 = todayIso();
  const evs = allEvents()
    .filter(e => !f.type || e.type === f.type)
    .filter(e => matches(Object.assign({ name: e.name }, e.rec), f.q, ['name', 'description', 'team', 'status', 'sponsor']));
  let list = evs.filter(e => {
    if (f.show === 'all') return true;
    const isPast = e.start && (e.end || e.start) < t0;
    return f.show === 'past' ? isPast : !isPast;
  });
  list.sort(f.show === 'past' ? byDate('start', true) : byDate('start'));
  const cols = [
    ['Date', e => e.start ? esc(fmtRange(e.start, e.end)) : '<span class="muted">No date</span>', 'nowrap'],
    ['Name', e => '<span class="title">' + esc(e.name) + '</span>' + linkIcon(e.rec.link) + (e.rec.description ? '<div class="sub">' + esc(e.rec.description) + '</div>' : '')],
    ['Type', e => typePill(e.type)],
    ['Status', e => pill(e.rec.status)],
    ['Team', e => esc(e.rec.team || '')],
    ['When', e => e.start ? esc(rel(daysUntil(e.start))) : '', 'nowrap'],
  ];
  return calendar(evs.filter(e => e.start)) + '<p class="count">' + list.length + ' shown</p>' +
    table(cols, list, e => 'data-edit="' + e.tab + ':' + esc(e.id) + '" tabindex="0"' + (e.start && (e.end || e.start) < t0 ? ' class="past"' : ''));
}
function calendar(evs) {
  const m = state.calMonth, y = m.getFullYear(), mo = m.getMonth();
  const lead = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  const t0 = todayIso();
  let html = '<div class="cal"><div class="cal-head"><button class="btn sm" type="button" data-cal="-1" aria-label="Previous month">‹</button>' +
    '<strong>' + esc(m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })) + '</strong>' +
    '<span><button class="btn sm" type="button" data-cal="0">Today</button> <button class="btn sm" type="button" data-cal="1" aria-label="Next month">›</button></span></div>' +
    '<div class="cal-grid">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => '<div class="cal-dow">' + d + '</div>').join('');
  for (let i = 0; i < cells; i++) {
    const day = new Date(y, mo, 1 - lead + i), ds = iso(day);
    const here = evs.filter(e => e.start <= ds && ds <= (e.end || e.start));
    html += '<div class="cal-day' + (day.getMonth() !== mo ? ' other' : '') + (ds === t0 ? ' today' : '') + '"><span class="num">' + day.getDate() + '</span>' +
      here.slice(0, 3).map(e => '<button type="button" class="cal-ev ' + typeClass(e.type) + '" data-edit="' + e.tab + ':' + esc(e.id) + '" title="' + esc(e.name) + '">' + esc(e.name) + '</button>').join('') +
      (here.length > 3 ? '<span class="more">+' + (here.length - 3) + ' more</span>' : '') + '</div>';
  }
  return html + '</div></div>';
}

// ---------- Timeline (Gantt) ----------
const TL_SECTIONS = [
  ['conf', 'Conferences'], ['course', 'Educational courses'], ['abstract', 'Abstract & poster deadlines'],
  ['subs', 'Submissions & presentations'], ['grant', 'Grants & scholarships'], ['other', 'Other deadlines'],
];
function tlSection(type) {
  const c = typeClass(type);
  return c === 't-conference' ? 'conf' : c === 't-course' ? 'course' : c === 't-abstract' ? 'abstract'
    : (c === 't-grant' || c === 't-scholarship') ? 'grant' : 'other';
}
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function dayAfter(s) { const d = parseDate(s); d.setDate(d.getDate() + 1); return d; }

// One row per dated item. Bars run from start through the end day; deadlines are single-day milestones.
function timelineItems() {
  const d = state.data, items = [];
  d.Deadlines.forEach(r => {
    if (!r.start_date) return;
    const sec = tlSection(r.type), end = r.end_date && r.end_date >= r.start_date ? r.end_date : r.start_date;
    items.push({ sec: sec, tab: 'Deadlines', id: r.id, label: r.name, sub: [r.type, r.status].filter(Boolean).join(' · '),
      start: r.start_date, end: end, cls: typeClass(r.type), milestone: end === r.start_date && sec !== 'conf' && sec !== 'course',
      txt: fmtRange(r.start_date, end) });
  });
  d.Grants.forEach(g => {
    if (!g.deadline) return;
    items.push({ sec: 'grant', tab: 'Grants', id: g.id, label: g.name, sub: ['Grant deadline', g.sponsor, g.status].filter(Boolean).join(' · '),
      start: g.deadline, end: g.deadline, cls: 't-grant', milestone: true, txt: fmtDate(g.deadline) });
  });
  d.Submissions.forEach(s => {
    const conf = state.byId[s.deadline_id];
    const pres = s.presentation_date || (conf ? conf.start_date : '');
    const start = s.submitted_date || pres;
    if (!start) return;
    const end = pres && pres >= start ? pres : start;
    items.push({ sec: 'subs', tab: 'Submissions', id: s.id,
      label: (projTitle(s.project_id) || 'Project not found') + (venueName(s) ? ' → ' + venueName(s) : ''),
      sub: [s.kind, s.status, s.presenter].filter(Boolean).join(' · '),
      start: start, end: end, cls: 'g-' + tone(s.status), milestone: start === end, pres: pres,
      txt: s.submitted_date && pres && pres !== s.submitted_date ? 'Sent ' + fmtDate(s.submitted_date, false) + ' → presents ' + fmtDate(pres)
        : pres ? 'Presents ' + fmtDate(pres) : 'Sent ' + fmtDate(start) });
  });
  return items;
}

function timelineShell() {
  F('timeline', { range: 'fit', hide: '' });
  return head('Timeline', 'A Gantt chart of conferences, courses, abstract and grant deadlines, and every submission from the date it was sent to the date it is presented. Click any bar or name to edit it.', 'Deadlines', null, 'Add deadline or conference') +
    '<div class="controls">' + seg('timeline', 'range', [['fit', 'Fit all'], ['6', '6 months'], ['12', '12 months'], ['24', '24 months']]) +
    search('timeline', 'Search') + '</div><div id="results"></div>';
}

function timelineBody() {
  const f = F('timeline'), t0 = todayIso();
  const all = timelineItems().filter(it => matches(it, f.q, ['label', 'sub']));
  const hidden = (f.hide || '').split(',').filter(Boolean);
  const start = addMonths(firstOfMonth(new Date()), -1 + (state.tlOffset || 0));
  let months = Number(f.range);
  if (f.range === 'fit') {
    const last = parseDate(all.reduce((m, it) => (it.end > m ? it.end : m), t0));
    months = Math.min(24, Math.max(6, (last.getFullYear() - start.getFullYear()) * 12 + last.getMonth() - start.getMonth() + 2)); // one spare month after the last item
  }
  const end = addMonths(start, months), span = end - start;
  const pct = d => Math.max(0, Math.min(100, (d - start) / span * 100));
  const inRange = all.filter(it => parseDate(it.start) < end && dayAfter(it.end) > start);
  const shown = inRange.filter(it => !hidden.includes(it.sec));
  const lastMonth = addMonths(end, -1);
  const rangeLabel = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) + ' – ' + lastMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  const chips = TL_SECTIONS.map(s => {
    const n = inRange.filter(it => it.sec === s[0]).length;
    return '<button type="button" class="chip' + (hidden.includes(s[0]) ? ' off' : '') + '" data-tlsec="' + s[0] + '" aria-pressed="' + !hidden.includes(s[0]) + '">' + esc(s[1]) + ' (' + n + ')</button>';
  }).join('');

  let monthsHtml = '', lines = '';
  for (let i = 0; i < months; i++) {
    const m = addMonths(start, i), l = pct(m), w = pct(addMonths(start, i + 1)) - l;
    const lbl = m.toLocaleDateString(undefined, { month: 'short' }) + (i === 0 || m.getMonth() === 0 ? ' ' + m.getFullYear() : '');
    monthsHtml += '<div class="g-month" style="left:' + l + '%;width:' + w + '%">' + esc(lbl) + '</div>';
    if (i) lines += '<div class="g-line" style="left:' + l + '%"></div>';
  }
  const now = parseDate(t0);
  const todayLine = now >= start && now < end ? '<div class="g-today" style="left:' + pct(now) + '%"><span>Today</span></div>' : '';

  const row = it => {
    const s = parseDate(it.start), e = dayAfter(it.end), left = pct(s), right = pct(e);
    const attrs = 'data-edit="' + it.tab + ':' + esc(it.id) + '" title="' + esc(it.label + ': ' + it.txt) + '"';
    const flip = left > 68;
    const txtAt = x => flip ? 'right:calc(' + (100 - x) + '% + 10px)' : 'left:calc(' + x + '% + 10px)';
    let mark;
    if (it.milestone) {
      const mid = (left + right) / 2;
      const shape = it.sec === 'subs' && !it.pres ? 'g-dot' : 'g-diamond';
      mark = '<button type="button" class="g-ms ' + shape + ' ' + it.cls + '" style="left:' + mid + '%" ' + attrs + ' aria-label="' + esc(it.label) + '"></button>' +
        '<span class="g-txt" style="' + txtAt(flip ? mid - 1 : mid) + '">' + esc(it.txt) + '</span>';
    } else {
      const w = Math.max(right - left, 0.5), inside = w > 16;
      mark = '<button type="button" class="g-bar ' + it.cls + (s < start ? ' clip-l' : '') + (e > end ? ' clip-r' : '') + '" style="left:' + left + '%;width:' + w + '%" ' + attrs + '>' + (inside ? esc(it.txt) : '') + '</button>' +
        (inside ? '' : '<span class="g-txt" style="' + txtAt(flip ? left : left + w) + '">' + esc(it.txt) + '</span>');
      if (it.pres && it.pres !== it.start) {
        const p = parseDate(it.pres);
        if (p >= start && p < end) mark += '<span class="g-ms g-diamond g-pres" style="left:' + (pct(p) + pct(dayAfter(it.pres))) / 2 + '%" title="Presentation ' + esc(fmtDate(it.pres)) + '"></span>';
      }
    }
    return '<div class="g-row' + (it.end < t0 ? ' past' : '') + '"><div class="g-label"><button type="button" class="linkish" data-edit="' + it.tab + ':' + esc(it.id) + '">' + esc(it.label) + '</button>' +
      (it.sub ? '<div class="sub">' + esc(it.sub) + '</div>' : '') + '</div><div class="g-track">' + mark + '</div></div>';
  };

  const sections = TL_SECTIONS.filter(s => !hidden.includes(s[0])).map(s => {
    const rows = shown.filter(it => it.sec === s[0]).sort((a, b) => byDate('start')(a, b) || byText('label')(a, b));
    return rows.length ? '<div class="g-section"><div class="g-label">' + esc(s[1]) + '</div><div class="g-track"></div></div>' + rows.map(row).join('') : '';
  }).join('');

  const outside = all.length - inRange.length;
  const undated = state.data.Deadlines.filter(r => !r.start_date).length + state.data.Submissions.filter(s => !s.submitted_date && !s.presentation_date && !(state.byId[s.deadline_id] || {}).start_date).length;
  const notes = [outside ? outside + ' item' + (outside > 1 ? 's' : '') + ' outside this range (use Earlier / Later)' : '',
                 undated ? undated + ' item' + (undated > 1 ? 's have' : ' has') + ' no date yet and cannot be placed' : ''].filter(Boolean).join(' · ');

  return '<div class="tl-bar"><div class="chips">' + chips + '</div><div class="tl-nav">' +
    '<button class="btn sm" type="button" data-tl="-3">‹ Earlier</button><button class="btn sm" type="button" data-tl="0">Today</button>' +
    '<button class="btn sm" type="button" data-tl="3">Later ›</button></div></div>' +
    '<p class="count"><b class="tl-range">' + esc(rangeLabel) + '</b>' + (notes ? ' · ' + esc(notes) : '') + '</p>' +
    (shown.length
      ? '<div class="gantt-wrap"><div class="gantt" style="--months:' + months + '">' +
        '<div class="g-head"><div class="g-label">Item</div><div class="g-track">' + monthsHtml + '</div></div>' +
        '<div class="g-body"><div class="g-grid">' + lines + todayLine + '</div>' + sections + '</div></div></div>'
      : '<div class="table-wrap"><div class="empty">Nothing dated in this range.</div></div>') +
    '<p class="muted small">Submission bars run from the date submitted to the presentation date (or the linked conference\'s first day); ◆ marks the presentation. Colour shows status: amber submitted, green accepted, presented or published, red rejected.</p>';
}

// ---------- Grants ----------
function grantsShell() {
  F('grants', {});
  return head('Research & Education Grants', 'Name, sponsor, amount, deadline, and description. Deadlines also appear on the Conferences &amp; Deadlines calendar.', 'Grants') +
    '<div class="controls">' + selectFilter('grants', 'status', 'Status', distinct(state.data.Grants, 'status', opts('grant_status'))) +
    search('grants', 'Search grants or sponsors') + '</div><div id="results"></div>';
}
function grantsBody() {
  const f = F('grants');
  const rows = state.data.Grants.filter(g => !f.status || g.status === f.status)
    .filter(g => matches(g, f.q, ['name', 'sponsor', 'description']))
    .sort((a, b) => byDate('deadline')(a, b) || byText('name')(a, b));
  const cols = [
    ['Grant', g => '<span class="title">' + esc(g.name) + '</span>' + linkIcon(g.link) + (g.description ? '<div class="sub">' + esc(g.description) + '</div>' : '')],
    ['Sponsor', g => esc(g.sponsor)],
    ['Amount', g => esc(g.amount), 'nowrap'],
    ['Deadline', g => g.deadline ? esc(fmtDate(g.deadline)) + '<div class="sub">' + esc(rel(daysUntil(g.deadline))) + '</div>' : '<span class="muted">None</span>', 'nowrap'],
    ['Status', g => pill(g.status)],
  ];
  return '<p class="count">' + rows.length + ' shown</p>' + table(cols, rows, editAttrs('Grants'));
}

// ---------- Submissions ----------
function venueName(s) {
  const d = state.byId[s.deadline_id];
  return s.venue || (d ? d.name : '');
}
function submissionsShell() {
  F('submissions', {});
  const rows = state.data.Submissions;
  return head('Submissions', 'Every abstract, poster, podium, and manuscript sent out, and how it turned out. Update the status when you hear back.', 'Submissions', null, 'Log submission') +
    '<div class="controls">' + selectFilter('submissions', 'status', 'Status', distinct(rows, 'status', opts('sub_status'))) +
    selectFilter('submissions', 'kind', 'Kind', distinct(rows, 'kind', opts('sub_kind'))) + projectFilter('submissions', rows) +
    search('submissions', 'Search venue or presenter') + '</div><div id="results"></div>';
}
function submissionsBody() {
  const f = F('submissions');
  const all = state.data.Submissions;
  const rows = all.filter(s => (!f.status || s.status === f.status) && (!f.kind || s.kind === f.kind) && (!f.project || s.project_id === f.project))
    .filter(s => matches(Object.assign({ v: venueName(s), p: projTitle(s.project_id) }, s), f.q, ['v', 'p', 'presenter', 'notes']))
    .sort((a, b) => byDate('submitted_date', true)(a, b) || byText('venue')(a, b));
  const counts = opts('sub_status').map(st => st + ': ' + all.filter(s => s.status === st).length).join(' · ');
  const cols = [
    ['Project', s => '<span class="title">' + esc(projTitle(s.project_id) || 'Project not found') + '</span>' + (s.notes ? '<div class="sub">' + esc(s.notes) + '</div>' : '')],
    ['Venue', s => esc(venueName(s))],
    ['Kind', s => esc(s.kind)],
    ['Submitted', s => s.submitted_date ? esc(fmtDate(s.submitted_date)) : '<span class="muted">None</span>', 'nowrap'],
    ['Status', s => pill(s.status)],
    ['Presenter', s => esc(s.presenter)],
  ];
  return '<p class="count">' + rows.length + ' shown · ' + esc(counts) + '</p>' + table(cols, rows, editAttrs('Submissions'));
}

// ---------- Dropdown lists (admin only) ----------
function choicesShell() {
  return head('Dropdown lists', 'Add choices to the site\'s dropdown menus, such as a new project type. Everyone sees them within 30 seconds, with no code change. ' +
    'Built-in choices (grey) are fixed. Click a choice you added to rename or delete it; entries that already use it keep their current text.') +
    '<div id="results"></div>';
}
function choicesBody() {
  return '<div class="grid">' + Object.keys(LIST_LABELS).map(k => {
    const added = customChoices(k).slice().sort(byText('value'));
    return '<section class="card"><h3>' + esc(LIST_LABELS[k]) + addBtn('Options', { list: k }, 'Add') + '</h3><div class="choices">' +
      OPT[k].map(v => '<span class="pill grey" title="Built in">' + esc(v) + '</span>').join('') +
      added.map(o => '<button type="button" class="pill choice" data-edit="Options:' + esc(o.id) + '" title="Added by ' + esc(o.updated_by || 'an admin') + '. Click to rename or delete.">' + esc(o.value) + '</button>').join('') +
      '</div></section>';
  }).join('') + '</div>';
}

// Admin picks "+ Add a new choice…" inside a form's dropdown: save it to the Options tab and select it.
async function addChoiceFromForm(sel) {
  const list = sel.dataset.list, prev = sel.dataset.prev || '';
  const value = (prompt('New ' + LIST_LABELS[list].toLowerCase() + ':') || '').trim().slice(0, 80);
  if (!value) { sel.value = prev; return; }
  const existing = opts(list).find(o => o.toLowerCase() === value.toLowerCase());
  if (existing) {
    if (![...sel.options].some(o => o.value === existing)) {
      const o = document.createElement('option'); o.textContent = existing;
      sel.insertBefore(o, sel.querySelector('option[value="' + NEW_CHOICE + '"]'));
    }
    sel.value = existing; sel.dataset.prev = existing; return;
  }
  sel.disabled = true;
  state.busy = true;
  try {
    const j = await api('create', { tab: 'Options', record: { list: list, value: value } });
    applySaved('Options', j.record, j.version);
    const o = document.createElement('option');
    o.textContent = j.record.value;
    sel.insertBefore(o, sel.querySelector('option[value="' + NEW_CHOICE + '"]'));
    sel.value = j.record.value; sel.dataset.prev = j.record.value;
    toast('Added "' + j.record.value + '" to ' + LIST_LABELS[list] + '.');
  } catch (e) { sel.value = prev; handleError(e); } finally { sel.disabled = false; state.busy = false; }
}

const VIEW_DEF = {
  dashboard: { shell: dashboardShell, body: dashboardBody },
  research: { shell: () => projectsShell('research', 'Research'), body: () => projectsBody('research', 'Research') },
  qi: { shell: () => projectsShell('qi', 'QI'), body: () => projectsBody('qi', 'QI') },
  tasks: { shell: tasksShell, body: tasksBody },
  deadlines: { shell: deadlinesShell, body: deadlinesBody },
  timeline: { shell: timelineShell, body: timelineBody },
  grants: { shell: grantsShell, body: grantsBody },
  submissions: { shell: submissionsShell, body: submissionsBody },
  choices: { shell: choicesShell, body: choicesBody },
};

// ===================== Add / edit form =====================
function fieldHtml(f, val) {
  const id = 'fld-' + f.k, v = val == null ? '' : String(val);
  const label = esc(f.l) + (f.req ? ' <span class="req">*</span>' : '');
  const attrs = 'id="' + id + '" name="' + f.k + '"' + (f.req ? ' required' : '');
  let input;
  if (f.t === 'textarea') input = '<textarea ' + attrs + '>' + esc(v) + '</textarea>';
  else if (f.t === 'select') {
    const list = opts(f.o);
    if (v && !list.includes(v)) list.unshift(v);
    const canAdd = state.role === 'admin' && LIST_LABELS[f.o];
    input = '<select ' + attrs + (canAdd ? ' data-list="' + f.o + '" data-prev="' + esc(v) + '"' : '') + '><option value="">Choose…</option>' +
      list.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
      (canAdd ? '<option value="' + NEW_CHOICE + '">+ Add a new choice…</option>' : '') + '</select>';
  } else if (f.t === 'list') {
    input = '<select ' + attrs + '><option value="">Choose…</option>' + Object.keys(LIST_LABELS).map(k =>
      '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(LIST_LABELS[k]) + '</option>').join('') + '</select>';
  } else if (f.t === 'project') {
    const groups = ['Research', 'QI'].map(cat => {
      const ps = state.data.Projects.filter(p => p.category === cat).sort(byText('title'));
      return ps.length ? '<optgroup label="' + (cat === 'QI' ? 'QI projects' : 'Research projects') + '">' +
        ps.map(p => '<option value="' + esc(p.id) + '"' + (p.id === v ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('') + '</optgroup>' : '';
    }).join('');
    const other = state.data.Projects.filter(p => p.category !== 'Research' && p.category !== 'QI');
    input = '<select ' + attrs + '><option value="">' + (f.req ? 'Choose a project…' : 'No project') + '</option>' + groups +
      other.map(p => '<option value="' + esc(p.id) + '"' + (p.id === v ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('') + '</select>';
  } else if (f.t === 'deadline') {
    const ds = state.data.Deadlines.slice().sort(byDate('start_date'));
    input = '<select ' + attrs + '><option value="">None</option>' +
      ds.map(d => '<option value="' + esc(d.id) + '"' + (d.id === v ? ' selected' : '') + '>' + esc(d.name + (d.start_date ? ' (' + fmtDate(d.start_date) + ')' : '')) + '</option>').join('') + '</select>';
  } else {
    const type = f.t === 'date' ? 'date' : f.t === 'url' ? 'url' : 'text';
    input = '<input type="' + type + '" ' + attrs + ' value="' + esc(v) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + ' maxlength="' + (f.max || 4000) + '">';
  }
  return '<label class="' + (f.full ? 'full' : '') + '" for="' + id + '">' + label + input + '</label>';
}

function openForm(tab, id, preset) {
  const sch = SCHEMA[tab];
  if (!sch) return;
  if ((tab === 'Contacts' || sch.adminOnly) && state.role !== 'admin') return;
  const rec = id ? state.byId[id] : null;
  if (id && !rec) { toast('That entry no longer exists.', 'error'); return; }
  const vals = rec ? Object.assign({}, rec) : Object.assign({}, preset || {});
  if (!rec && tab === 'Tasks' && !vals.status) vals.status = 'To Do';
  if (!rec && tab === 'Submissions' && !vals.status) vals.status = 'Submitted';
  const title = (rec ? 'Edit ' : 'Add ') + sch.noun;
  $('#modal-root').innerHTML =
    '<div class="backdrop" data-close="1"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<header><h2>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '</h2><button class="xbtn" type="button" data-close="1" aria-label="Close">×</button></header>' +
    '<form id="rec-form" novalidate><div class="form">' + sch.fields.map(f => fieldHtml(f, vals[f.k])).join('') + '</div>' +
    '<footer>' + (rec ? '<span class="muted small">Last changed by ' + esc(rec.updated_by || 'unknown') + (rec.updated_at ? ', ' + esc(fmtStamp(rec.updated_at)) : '') + '</span>' : '') +
    '<span class="spacer"></span>' +
    (rec && state.role === 'admin' ? '<button class="btn danger" type="button" id="del-btn">Delete</button>' : '') +
    '<button class="btn" type="button" data-close="1">Cancel</button><button class="btn primary" type="submit">Save</button></footer></form></div></div>';
  const form = $('#rec-form');
  const first = form.querySelector('input,select,textarea');
  if (first) first.focus();

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const record = {};
    sch.fields.forEach(f => { record[f.k] = form.elements[f.k].value.trim(); });
    const missing = sch.fields.filter(f => f.req && !record[f.k]);
    if (missing.length) { toast('Fill in: ' + missing.map(f => f.l).join(', '), 'error'); form.elements[missing[0].k].focus(); return; }
    if (record.start_date && record.end_date && record.end_date < record.start_date) { toast('The last day is before the first day.', 'error'); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…';
    state.busy = true;
    try {
      const j = rec ? await api('update', { tab: tab, id: rec.id, record: record, expected_updated_at: rec.updated_at })
                    : await api('create', { tab: tab, record: record });
      closeModal();
      applySaved(tab, j.record, j.version);
      toast('Saved. Everyone will see it within 30 seconds.');
    } catch (e) {
      if (e.code === 'conflict' || e.code === 'not_found') { closeModal(); toast(e.message, 'error'); loadData(); }
      else { btn.disabled = false; btn.textContent = 'Save'; handleError(e); }
    } finally { state.busy = false; }
  });

  const del = $('#del-btn');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Delete "' + (rec.title || rec.task || rec.name || rec.value || projTitle(rec.project_id) || 'this entry') + '"? An admin can restore it from the Sheet.')) return;
    del.disabled = true;
    state.busy = true;
    try {
      const j = await api('archive', { tab: tab, id: rec.id });
      closeModal();
      applySaved(tab, rec, j.version, true);
      toast('Deleted.');
    } catch (e) { del.disabled = false; handleError(e); } finally { state.busy = false; }
  });
}

function closeModal() { const r = $('#modal-root'); if (r) r.innerHTML = ''; }

async function toggleTask(id, checked, box) {
  const t = state.byId[id];
  if (!t) return;
  box.disabled = true;
  state.busy = true;
  try {
    const j = await api('update', { tab: 'Tasks', id: id, record: { status: checked ? 'Done' : 'To Do' }, expected_updated_at: t.updated_at });
    applySaved('Tasks', j.record, j.version);
  } catch (e) {
    box.checked = !checked; box.disabled = false;
    if (e.code === 'conflict' || e.code === 'not_found') { toast(e.message, 'error'); loadData(); } else handleError(e);
  } finally { state.busy = false; }
}

// ===================== Events =====================
document.addEventListener('click', e => {
  if (e.target.closest('a[target=_blank]')) return; // external links open normally
  const t = e.target.closest('[data-close],[data-add],[data-edit],[data-seg],[data-cal],[data-tl],[data-tlsec]');
  if (!t) return;
  if (t.dataset.tl) {
    const n = Number(t.dataset.tl);
    state.tlOffset = n === 0 ? 0 : (state.tlOffset || 0) + n;
    renderResults();
    return;
  }
  if (t.dataset.tlsec) {
    const f = F('timeline'), hid = (f.hide || '').split(',').filter(Boolean), k = t.dataset.tlsec;
    f.hide = (hid.includes(k) ? hid.filter(x => x !== k) : hid.concat(k)).join(',');
    renderResults();
    return;
  }
  if (t.dataset.close) { if (e.target === t || t.tagName === 'BUTTON') closeModal(); return; }
  if (t.dataset.add) { openForm(t.dataset.add, null, t.dataset.preset ? JSON.parse(t.dataset.preset) : {}); return; }
  if (t.dataset.edit) { const i = t.dataset.edit.indexOf(':'); openForm(t.dataset.edit.slice(0, i), t.dataset.edit.slice(i + 1)); return; }
  if (t.dataset.seg) { F(state.view)[t.dataset.seg] = t.dataset.val; renderView(); return; }
  if (t.dataset.cal) {
    const n = Number(t.dataset.cal), m = state.calMonth;
    state.calMonth = n === 0 ? firstOfMonth(new Date()) : new Date(m.getFullYear(), m.getMonth() + n, 1);
    renderResults();
  }
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.filter;
  if (k) { F(state.view)[k] = e.target.value; renderResults(); }
});
document.addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.taskToggle;
  if (id) toggleTask(id, e.target.checked, e.target);
  if (e.target.dataset && e.target.dataset.list) {
    if (e.target.value === NEW_CHOICE) addChoiceFromForm(e.target); else e.target.dataset.prev = e.target.value;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal();
  if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-edit]')) e.target.click();
});
document.addEventListener('toggle', e => { if (e.target.id === 'howto') state.howtoOpen = e.target.open; }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
window.addEventListener('hashchange', () => { state.view = location.hash.slice(1) || 'dashboard'; renderView(); window.scrollTo(0, 0); });
setInterval(updateSync, 10000);

function boot() {
  if (state.token) enterApp(); else showLogin();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
