// ====================== STATE ======================
const API = '/api/v1';
let token = null, currentUser = null, tasks = [], workspaces = [], currentWorkspaceId = null;
let view = 'kanban';
let filters = { priority: '', overdue: false, assignedToMe: false, search: '' };
let sortBy = 'createdAt';
let draggedTaskId = null;
let detailTaskId = null;
let calMonth = new Date().getMonth(), calYear = new Date().getFullYear();
let notifInterval = null, chatInterval = null, onlineInterval = null;
const remindersSent = new Set();
let currentPage = 1;
let totalPages = 1;
const taskLimit = 20;
let lastMessageId = null;

// ====================== INIT ======================
document.addEventListener('DOMContentLoaded', () => {
  token = localStorage.getItem('token');
  currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  if (token && currentUser) { showApp(); loadAll(); }
  else showAuth();
  bindEvents();
});

function bindEvents() {
  document.getElementById('login-tab').onclick = () => setAuthTab('login');
  document.getElementById('register-tab').onclick = () => setAuthTab('register');
  document.getElementById('login-form').onsubmit = onLogin;
  document.getElementById('register-form').onsubmit = onRegister;
  document.getElementById('logout-btn').onclick = logout;
  document.getElementById('add-task-btn').onclick = () => openModal();
  document.getElementById('task-form').onsubmit = onSaveTask;
  document.getElementById('kanban-view-btn').onclick = () => setView('kanban');
  document.getElementById('list-view-btn').onclick = () => setView('list');
  document.getElementById('calendar-view-btn').onclick = () => setView('calendar');
  document.getElementById('priority-filter').onclick = (e) => {
    const chip = e.target.closest('.chip[data-value]');
    if (!chip) return;
    document.querySelectorAll('#priority-filter .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active'); filters.priority = chip.dataset.value; renderAll();
  };
  document.getElementById('overdue-filter').onclick = function() {
    filters.overdue = !filters.overdue; this.classList.toggle('active', filters.overdue); renderAll();
  };
  document.getElementById('assigned-filter').onclick = function() {
    filters.assignedToMe = !filters.assignedToMe; this.classList.toggle('active', filters.assignedToMe); renderAll();
  };
  document.getElementById('sort-select').onchange = (e) => { sortBy = e.target.value; renderAll(); };
  document.getElementById('search-input').oninput = (e) => { filters.search = e.target.value.toLowerCase(); renderAll(); };
  document.getElementById('workspace-btn').onclick = (e) => { e.stopPropagation(); togglePanel('workspace-panel'); };
  document.getElementById('notif-btn').onclick = (e) => { e.stopPropagation(); togglePanel('notif-panel'); loadUpcoming(); };
  document.getElementById('cal-prev').onclick = () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); };
  document.getElementById('cal-next').onclick = () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); };
  
  // Chat events
  document.getElementById('chat-toggle-btn').onclick = (e) => { e.stopPropagation(); toggleChat(true); };
  document.getElementById('chat-close-btn').onclick = () => toggleChat(false);
  document.getElementById('chat-overlay').onclick = () => toggleChat(false);
  document.getElementById('chat-form').onsubmit = onSendMessage;

  document.addEventListener('click', () => closeAllPanels());
}

// ====================== AUTH ======================
function setAuthTab(tab) {
  document.getElementById('login-tab').classList.toggle('active', tab === 'login');
  document.getElementById('register-tab').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

async function onLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-submit-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
  const res = await apiFetch('/auth/login', 'POST', { email: document.getElementById('login-email').value, password: document.getElementById('login-password').value });
  if (res?.status === 'success') {
    token = res.data.token; currentUser = res.data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    showApp(); loadAll(); toast('Welcome back! 👋', 'success');
  } else toast(res?.message || 'Login failed', 'error');
  btn.disabled = false; btn.innerHTML = '<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>';
}

async function onRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('register-submit-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
  const res = await apiFetch('/auth/register', 'POST', { username: document.getElementById('register-username').value, email: document.getElementById('register-email').value, password: document.getElementById('register-password').value });
  if (res?.status === 'success') {
    token = res.data.token; currentUser = res.data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    showApp(); loadAll(); toast("Account created! Let's get productive 🚀", 'success');
  } else toast(res?.message || 'Registration failed', 'error');
  btn.disabled = false; btn.innerHTML = '<span>Create Account</span> <i class="fa-solid fa-arrow-right"></i>';
}

function logout() {
  clearInterval(notifInterval);
  clearInterval(chatInterval);
  clearInterval(onlineInterval);
  localStorage.clear(); token = null; currentUser = null; tasks = []; workspaces = [];
  showAuth(); toast('Logged out. See you soon!', 'info');
}

// ====================== PAGE ======================
function showAuth() {
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('app-page').classList.add('hidden');
  document.getElementById('header-right').classList.add('hidden');
}
function showApp() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
  document.getElementById('header-right').classList.remove('hidden');
  const u = currentUser?.username || 'U';
  document.getElementById('username-display').textContent = u;
  const av = document.getElementById('user-avatar');
  av.textContent = u[0].toUpperCase();
  av.style.background = currentUser?.avatarColor || '#7c3aed';
  const commentAv = document.getElementById('comment-avatar');
  commentAv.textContent = u[0].toUpperCase();
  commentAv.style.background = currentUser?.avatarColor || '#7c3aed';
  startReminders();
  startChatSync();
}

// ====================== DATA ======================
async function loadAll() {
  await Promise.all([fetchTasks(), fetchStats(), fetchWorkspaces()]);
}

async function fetchTasks() {
  let url = `/tasks?page=${currentPage}&limit=${taskLimit}`;
  if (currentWorkspaceId) url += `&workspaceId=${currentWorkspaceId}`;
  const res = await authFetch(url);
  if (res?.status === 'success') {
    tasks = res.data.tasks;
    totalPages = res.data.pagination.totalPages || 1;
    renderAll();
    renderPagination();
  }
}

function renderPagination() {
  const info = document.getElementById('page-info');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  if (!info || !prevBtn || !nextBtn) return;

  info.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function changePage(dir) {
  const newPage = currentPage + dir;
  if (newPage < 1 || newPage > totalPages) return;
  currentPage = newPage;
  fetchTasks();
}
async function fetchStats() {
  const res = await authFetch('/tasks/summary');
  if (res?.status === 'success') {
    const s = res.data.summary;
    document.getElementById('sn-total').textContent = s.total;
    document.getElementById('sn-pending').textContent = s.pending;
    document.getElementById('sn-inprogress').textContent = s.inProgress;
    document.getElementById('sn-completed').textContent = s.completed;
    document.getElementById('sn-overdue').textContent = s.overdue;
  }
}
async function fetchWorkspaces() {
  const res = await authFetch('/workspaces');
  if (res?.status === 'success') { workspaces = res.data.workspaces; renderWorkspacePanel(); }
}
async function loadUpcoming() {
  const res = await authFetch('/tasks/upcoming');
  if (res?.status === 'success') renderNotifPanel(res.data.tasks);
}

// ====================== REMINDERS ======================
function startReminders() {
  checkReminders();
  notifInterval = setInterval(checkReminders, 60000);
}
async function checkReminders() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
  const res = await authFetch('/tasks/upcoming');
  if (!res?.status === 'success') return;
  const upcoming = res?.data?.tasks || [];
  const badge = document.getElementById('notif-badge');
  if (upcoming.length > 0) {
    badge.textContent = upcoming.length; badge.classList.remove('hidden');
  } else badge.classList.add('hidden');
  if (Notification.permission !== 'granted') return;
  upcoming.forEach(t => {
    if (remindersSent.has(t.id)) return;
    remindersSent.add(t.id);
    const min = Math.round((new Date(t.dueDate) - new Date()) / 60000);
    const msg = min <= 0 ? 'Overdue!' : `Due in ${min} min`;
    new Notification(`⏰ ${t.title}`, { body: msg, icon: '/favicon.ico' });
  });
}
function renderNotifPanel(upcoming) {
  const list = document.getElementById('notif-list');
  if (!upcoming.length) { list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem">No upcoming reminders 🎉</div>'; return; }
  list.innerHTML = upcoming.map(t => {
    const d = new Date(t.dueDate);
    const isOverdue = d < new Date();
    return `<div class="notif-item" onclick="openDetail('${t.id}')">
      <div class="notif-title">${escHtml(t.title)}</div>
      <div class="notif-time"><i class="fa-regular fa-clock ${isOverdue ? 'overdue' : ''}"></i> ${d.toLocaleString()}</div>
    </div>`;
  }).join('');
}

// ====================== WORKSPACES ======================
function renderWorkspacePanel() {
  const list = document.getElementById('workspace-list');
  const memberList = document.getElementById('member-list');
  
  // Personal option
  let html = `<div class="dropdown-item ${!currentWorkspaceId ? 'active' : ''}" onclick="switchWorkspace(null)">
    <i class="fa-solid fa-user" style="width:16px"></i> Personal</div>`;
  workspaces.forEach(ws => {
    html += `<div class="dropdown-item ${currentWorkspaceId === ws.id ? 'active' : ''}" onclick="switchWorkspace('${ws.id}')">
      <i class="fa-solid fa-building" style="width:16px"></i> ${escHtml(ws.name)}</div>`;
  });
  list.innerHTML = html;

  // Members of current workspace
  const currentWs = workspaces.find(w => w.id === currentWorkspaceId);
  if (currentWs?.members?.length) {
    memberList.innerHTML = currentWs.members.map(m => `
      <div class="dropdown-item">
        <div class="avatar-sm" style="background:${m.user.avatarColor}">${m.user.username[0].toUpperCase()}</div>
        <div><div style="font-size:0.85rem;font-weight:600">${escHtml(m.user.username)}</div><div style="font-size:0.72rem;color:var(--text-muted)">${m.role}</div></div>
      </div>`).join('');
  } else memberList.innerHTML = '<div style="padding:8px 16px;font-size:0.82rem;color:var(--text-muted)">No members yet</div>';
}

function switchWorkspace(id) {
  currentWorkspaceId = id;
  const ws = workspaces.find(w => w.id === id);
  document.getElementById('workspace-name-display').textContent = ws ? ws.name : 'Personal';
  closeAllPanels(); fetchTasks(); fetchStats();
}

// ====================== ASSIGNEE SEARCH ======================
let assigneeSearchTimer = null;

function initAssigneeSearch() {
  const input = document.getElementById('task-assignee-search');
  const dropdown = document.getElementById('assignee-dropdown');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(assigneeSearchTimer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }
    assigneeSearchTimer = setTimeout(() => searchAssignees(q), 250);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { dropdown.classList.add('hidden'); } });
  document.addEventListener('click', e => {
    if (!e.target.closest('.assignee-search-wrap')) dropdown.classList.add('hidden');
  });
}

async function searchAssignees(q) {
  const dropdown = document.getElementById('assignee-dropdown');
  const res = await authFetch(`/auth/search?q=${encodeURIComponent(q)}`);
  if (!res?.data?.users?.length) {
    dropdown.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.85rem">No users found</div>';
    dropdown.classList.remove('hidden'); return;
  }
  dropdown.innerHTML = res.data.users.map(u => `
    <div class="assignee-option" onclick="selectAssignee('${u.id}','${escHtml(u.username)}','${u.avatarColor || '#7c3aed'}',${ JSON.stringify(u.email) })">
      <div class="avatar-sm" style="background:${u.avatarColor || '#7c3aed'}">${u.username[0].toUpperCase()}</div>
      <div class="assignee-option-info">
        <span class="assignee-option-name">${escHtml(u.username)}</span>
        <span class="assignee-option-email">${escHtml(u.email)}</span>
      </div>
    </div>`).join('');
  dropdown.classList.remove('hidden');
}

function selectAssignee(id, username, color, email) {
  document.getElementById('task-assignee-id').value = id;
  document.getElementById('assignee-input-wrap').classList.add('hidden');
  document.getElementById('assignee-dropdown').classList.add('hidden');
  const chip = document.getElementById('assignee-selected');
  chip.innerHTML = `<div class="avatar-sm" style="background:${color}">${username[0].toUpperCase()}</div>
    <span>${escHtml(username)}</span>
    <button class="assignee-chip-clear" onclick="clearAssignee()" title="Remove">×</button>`;
  chip.classList.remove('hidden');
}

function clearAssignee() {
  document.getElementById('task-assignee-id').value = '';
  document.getElementById('assignee-selected').classList.add('hidden');
  document.getElementById('assignee-selected').innerHTML = '';
  document.getElementById('assignee-input-wrap').classList.remove('hidden');
  document.getElementById('task-assignee-search').value = '';
}

function resetAssigneeField(task) {
  clearAssignee();
  if (task?.assignee) {
    selectAssignee(task.assignee.id, task.assignee.username, task.assignee.avatarColor || '#7c3aed', task.assignee.email || '');
  }
}

function openCreateWorkspace() {
  closeAllPanels();
  document.getElementById('gm-title').textContent = 'New Workspace';
  document.getElementById('gm-body').innerHTML = `
    <div class="field"><label>Workspace Name</label><input type="text" id="gm-ws-name" placeholder="e.g. Design Team" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:Outfit,sans-serif;font-size:0.95rem;outline:none"></div>
    <div class="field"><label>Description</label><input type="text" id="gm-ws-desc" placeholder="Optional description" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:Outfit,sans-serif;font-size:0.95rem;outline:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:1rem">
      <button class="btn-ghost" onclick="closeGenericModal()">Cancel</button>
      <button class="btn-primary" onclick="createWorkspace()"><i class="fa-solid fa-plus"></i> Create</button>
    </div>`;
  document.getElementById('generic-modal').classList.remove('hidden');
}

async function createWorkspace() {
  const name = document.getElementById('gm-ws-name')?.value?.trim();
  const description = document.getElementById('gm-ws-desc')?.value?.trim();
  if (!name) return toast('Workspace name required', 'error');
  const res = await authFetch('/workspaces', 'POST', { name, description });
  if (res?.status === 'success') {
    toast(`Workspace "${name}" created!`, 'success'); closeGenericModal(); fetchWorkspaces();
  } else toast(res?.message || 'Error creating workspace', 'error');
}

function openInvite() {
  if (!currentWorkspaceId) return toast('Select a workspace first', 'error');
  closeAllPanels();
  document.getElementById('gm-title').textContent = 'Invite Member';
  document.getElementById('gm-body').innerHTML = `
    <div class="field"><label>Member Email</label><input type="email" id="gm-invite-email" placeholder="member@example.com" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:Outfit,sans-serif;font-size:0.95rem;outline:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:1rem">
      <button class="btn-ghost" onclick="closeGenericModal()">Cancel</button>
      <button class="btn-primary" onclick="inviteMember()"><i class="fa-solid fa-user-plus"></i> Invite</button>
    </div>`;
  document.getElementById('generic-modal').classList.remove('hidden');
}

async function inviteMember() {
  const email = document.getElementById('gm-invite-email')?.value?.trim();
  if (!email) return toast('Email required', 'error');
  const res = await authFetch(`/workspaces/${currentWorkspaceId}/invite`, 'POST', { email });
  if (res?.status === 'success') {
    toast(res.message || 'Invited!', 'success'); closeGenericModal(); fetchWorkspaces();
  } else toast(res?.message || 'Error inviting member', 'error');
}

// ====================== RENDER ======================
function getFilteredTasks() {
  let list = [...tasks];
  if (filters.search) list = list.filter(t => t.title.toLowerCase().includes(filters.search) || (t.description || '').toLowerCase().includes(filters.search) || (t.tags || '').toLowerCase().includes(filters.search));
  if (filters.priority) list = list.filter(t => t.priority === filters.priority);
  if (filters.overdue) { const now = new Date(); list = list.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'); }
  if (filters.assignedToMe) list = list.filter(t => t.assignee?.id === currentUser?.id);
  const order = { high: 3, medium: 2, low: 1 };
  list.sort((a, b) => {
    if (sortBy === 'priority') return (order[b.priority] || 0) - (order[a.priority] || 0);
    if (sortBy === 'dueDate') { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate) - new Date(b.dueDate); }
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return list;
}

function renderAll() {
  const filtered = getFilteredTasks();
  if (view === 'kanban') { renderKanban(filtered); document.getElementById('list-view').classList.add('hidden'); document.getElementById('calendar-view').classList.add('hidden'); document.getElementById('kanban-board').classList.remove('hidden'); }
  else if (view === 'list') { renderList(filtered); document.getElementById('kanban-board').classList.add('hidden'); document.getElementById('calendar-view').classList.add('hidden'); document.getElementById('list-view').classList.remove('hidden'); }
  else if (view === 'calendar') { renderCalendar(); document.getElementById('kanban-board').classList.add('hidden'); document.getElementById('list-view').classList.add('hidden'); document.getElementById('calendar-view').classList.remove('hidden'); }
}

function renderKanban(list) {
  ['pending', 'in-progress', 'completed'].forEach(st => {
    const col = document.getElementById(`drop-${st}`);
    const countEl = document.getElementById(`count-${st}`);
    const colTasks = list.filter(t => t.status === st);
    countEl.textContent = colTasks.length;
    if (!colTasks.length) { col.innerHTML = `<div class="col-empty"><i class="fa-regular fa-clipboard"></i>No tasks</div>`; return; }
    col.innerHTML = colTasks.map(buildCard).join('');
    col.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', e => { draggedTaskId = card.dataset.id; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
  });
}

function buildCard(task) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const dueFmt = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const tags = task.tags ? task.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const prioIcon = { high: '🔥', medium: '⚡', low: '🌿' };
  const cmts = task._count?.comments || 0;
  const files = task._count?.files || 0;
  return `
  <div class="task-card ${task.priority}" data-id="${task.id}" draggable="true" onclick="openDetail('${task.id}')">
    <div class="card-top">
      <div class="card-title ${task.status === 'completed' ? 'completed-text' : ''}">${escHtml(task.title)}</div>
      <div class="card-menu" onclick="event.stopPropagation()">
        <button class="edit-btn" onclick="openModal('${task.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" onclick="confirmDelete('${task.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    ${task.description ? `<div class="card-desc">${escHtml(task.description)}</div>` : ''}
    ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="tag-badge">#${escHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="card-footer">
      <span class="priority-badge ${task.priority}">${prioIcon[task.priority]} ${task.priority}</span>
      ${dueFmt ? `<span class="due-date-badge ${isOverdue ? 'overdue' : ''}"><i class="fa-regular fa-clock"></i> ${dueFmt}</span>` : ''}
    </div>
    <div class="card-counts">
      ${task.assignee ? `<div class="card-assignee"><div class="avatar-xs avatar-sm" style="background:${task.assignee.avatarColor}">${task.assignee.username[0].toUpperCase()}</div> ${escHtml(task.assignee.username)}</div>` : ''}
      ${cmts ? `<span class="card-count-item"><i class="fa-regular fa-comment"></i> ${cmts}</span>` : ''}
      ${files ? `<span class="card-count-item"><i class="fa-solid fa-paperclip"></i> ${files}</span>` : ''}
    </div>
  </div>`;
}

function renderList(list) {
  const container = document.getElementById('list-container');
  if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-subtle)"><i class="fa-solid fa-inbox" style="font-size:2rem;margin-bottom:8px;display:block"></i>No tasks found</div>'; return; }
  const groups = { pending: [], 'in-progress': [], completed: [] };
  list.forEach(t => { if (groups[t.status]) groups[t.status].push(t); });
  const labels = { pending: '⏳ Pending', 'in-progress': '🔄 In Progress', completed: '✅ Completed' };
  let html = '';
  Object.entries(groups).forEach(([st, items]) => {
    if (!items.length) return;
    html += `<div style="margin-bottom:1.5rem"><h4 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${labels[st]} (${items.length})</h4>
      ${items.map(t => `<div class="list-item" onclick="openDetail('${t.id}')">
        <div class="list-check ${t.status === 'completed' ? 'done' : ''}" onclick="event.stopPropagation();quickComplete('${t.id}','${t.status}')">${t.status === 'completed' ? '<i class="fa-solid fa-check"></i>' : ''}</div>
        <div class="list-info"><div class="list-title ${t.status === 'completed' ? 'completed-text' : ''}">${escHtml(t.title)}</div><div class="list-sub">${(t.description || 'No description').slice(0, 60)}</div></div>
        <div class="list-right">
          <span class="priority-badge ${t.priority}">${t.priority}</span>
          ${t.dueDate ? `<span class="due-date-badge"><i class="fa-regular fa-clock"></i> ${new Date(t.dueDate).toLocaleDateString()}</span>` : ''}
          ${t.assignee ? `<div class="avatar-sm" style="background:${t.assignee.avatarColor}" title="${t.assignee.username}">${t.assignee.username[0].toUpperCase()}</div>` : ''}
          <button class="btn-icon" onclick="event.stopPropagation();openModal('${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon danger" onclick="event.stopPropagation();confirmDelete('${t.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('')}
    </div>`;
  });
  container.innerHTML = html;
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = `${months[calMonth]} ${calYear}`;
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  let html = '';

  const tasksByDate = {};
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(t);
  });

  // Before current month
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-cell other-month"><div class="cal-day">${daysInPrev - i}</div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.Date === d && today.getMonth() === calMonth && today.getFullYear() === calYear;
    const key = `${calYear}-${calMonth}-${d}`;
    const dayTasks = tasksByDate[key] || [];
    const shown = dayTasks.slice(0, 3);
    const extra = dayTasks.length - shown.length;
    html += `<div class="cal-cell ${isToday ? 'today' : ''}">
      <div class="cal-day">${d}</div>
      ${shown.map(t => `<div class="cal-task-dot ${t.priority}" onclick="openDetail('${t.id}')" title="${escHtml(t.title)}">${escHtml(t.title)}</div>`).join('')}
      ${extra > 0 ? `<div class="cal-more">+${extra} more</div>` : ''}
    </div>`;
  }
  // After current month padding
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  let nextDay = 1;
  for (let i = firstDay + daysInMonth; i < totalCells; i++) {
    html += `<div class="cal-cell other-month"><div class="cal-day">${nextDay++}</div></div>`;
  }
  grid.innerHTML = html;
}

// ====================== VIEW TOGGLE ======================
function setView(v) {
  view = v;
  ['kanban','list','calendar'].forEach(x => document.getElementById(`${x}-view-btn`).classList.toggle('active', x === v));
  renderAll();
}

// ====================== DRAG & DROP ======================
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
async function handleDrop(e, newStatus) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  if (!draggedTaskId) return;
  const task = tasks.find(t => t.id === draggedTaskId);
  if (!task || task.status === newStatus) { draggedTaskId = null; return; }
  const res = await authFetch(`/tasks/${draggedTaskId}`, 'PUT', { status: newStatus });
  if (res?.status === 'success') { toast(`Moved to "${newStatus}" ✓`, 'success'); loadAll(); }
  draggedTaskId = null;
}

// ====================== TASK MODAL ======================
function openModal(id = null) {
  const form = document.getElementById('task-form');
  form.reset(); document.getElementById('task-id').value = '';
  clearAssignee();
  if (id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('task-id').value = id;
    document.getElementById('task-title').value = t.title;
    document.getElementById('task-description').value = t.description || '';
    document.getElementById('task-priority').value = t.priority;
    document.getElementById('task-status').value = t.status;
    document.getElementById('task-tags').value = t.tags || '';
    if (t.dueDate) { const d = new Date(t.dueDate); document.getElementById('task-duedate').value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    resetAssigneeField(t);
  } else document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('task-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('task-modal').classList.add('hidden'); }
function handleModalBackdropClick(e) { if (e.target === document.getElementById('task-modal')) closeModal(); }

async function onSaveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const rawDue = document.getElementById('task-duedate').value;
  const data = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value || null,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    tags: document.getElementById('task-tags').value || null,
    dueDate: rawDue ? new Date(rawDue).toISOString() : null,
    assigneeId: document.getElementById('task-assignee-id').value || null,
    workspaceId: currentWorkspaceId || null
  };
  const res = await authFetch(id ? `/tasks/${id}` : '/tasks', id ? 'PUT' : 'POST', data);
  if (res?.status === 'success') {
    closeModal(); toast(id ? 'Task updated ✓' : 'Task created ✓', 'success'); loadAll();
  } else if (res) toast(res.message || 'Error saving task', 'error');
}

// ====================== DETAIL PANEL ======================
let dpAssigneeSearchTimer = null;

async function openDetail(id) {
  detailTaskId = id;
  const task = tasks.find(t => t.id === id); if (!task) return;
  document.getElementById('dp-title').textContent = task.title;
  document.getElementById('dp-edit-btn').onclick = () => { closeDetail(); openModal(id); };
  document.getElementById('dp-delete-btn').onclick = () => { closeDetail(); confirmDelete(id); };
  renderDetailMeta(task);
  renderDetailWorkspace(task);
  renderDetailAssignee(task);
  initDpAssigneeSearch();
  document.getElementById('detail-panel').classList.remove('hidden');
  document.getElementById('detail-overlay').classList.remove('hidden');
  loadDetailFiles(id); loadDetailActivity(id); loadDetailComments(id);
}

// --- Workspace pills ---
function renderDetailWorkspace(task) {
  const row = document.getElementById('dp-workspace-row');
  if (!row) return;
  // Personal pill
  let html = `<button class="status-pill ${!task.workspaceId ? 'ws-pill-active' : ''}" onclick="moveToWorkspace(null)">🏠 Personal</button>`;
  workspaces.forEach(ws => {
    const active = task.workspaceId === ws.id;
    html += `<button class="status-pill ${active ? 'ws-pill-active' : ''}" onclick="moveToWorkspace('${ws.id}')">
      <i class="fa-solid fa-building" style="font-size:0.75rem"></i> ${escHtml(ws.name)}</button>`;
  });
  row.innerHTML = html;
}

async function moveToWorkspace(workspaceId) {
  if (!detailTaskId) return;
  const res = await authFetch(`/tasks/${detailTaskId}`, 'PUT', { workspaceId });
  if (res?.status === 'success') {
    const wsName = workspaceId ? (workspaces.find(w => w.id === workspaceId)?.name || 'workspace') : 'Personal';
    toast(`Task moved to "${wsName}" ✓`, 'success');
    // Update local task and re-render
    const t = tasks.find(t => t.id === detailTaskId);
    if (t) { t.workspaceId = workspaceId; t.workspace = workspaceId ? workspaces.find(w => w.id === workspaceId) : null; }
    renderDetailWorkspace(t || { workspaceId });
    loadAll();
  } else toast(res?.message || 'Error moving task', 'error');
}

// --- Quick assignee in detail panel ---
function renderDetailAssignee(task) {
  const display = document.getElementById('dp-assignee-display');
  if (!display) return;
  if (task.assignee) {
    display.innerHTML = `
      <div class="avatar-sm" style="background:${task.assignee.avatarColor || '#7c3aed'}">${task.assignee.username[0].toUpperCase()}</div>
      <span class="name">${escHtml(task.assignee.username)}</span>
      <span style="color:var(--text-subtle);font-size:0.75rem">${escHtml(task.assignee.email || '')}</span>
      <button class="remove-assignee" onclick="dpRemoveAssignee()" title="Remove assignee">× Remove</button>`;
  } else {
    display.innerHTML = '<span style="color:var(--text-subtle);font-style:italic">Unassigned</span>';
  }
}

function initDpAssigneeSearch() {
  const input = document.getElementById('dp-assignee-search');
  const dropdown = document.getElementById('dp-assignee-dropdown');
  if (!input) return;
  input.value = '';
  input.oninput = () => {
    clearTimeout(dpAssigneeSearchTimer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }
    dpAssigneeSearchTimer = setTimeout(() => dpSearchAssignees(q), 250);
  };
  input.onkeydown = e => { if (e.key === 'Escape') dropdown.classList.add('hidden'); };
}

async function dpSearchAssignees(q) {
  const dropdown = document.getElementById('dp-assignee-dropdown');
  const res = await authFetch(`/auth/search?q=${encodeURIComponent(q)}`);
  if (!res?.data?.users?.length) {
    dropdown.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.85rem">No users found</div>';
    dropdown.classList.remove('hidden'); return;
  }
  dropdown.innerHTML = res.data.users.map(u => `
    <div class="assignee-option" onclick="dpSelectAssignee('${u.id}','${escHtml(u.username)}','${u.avatarColor || '#7c3aed'}','${escHtml(u.email || '')}')">
      <div class="avatar-sm" style="background:${u.avatarColor || '#7c3aed'}">${u.username[0].toUpperCase()}</div>
      <div class="assignee-option-info">
        <span class="assignee-option-name">${escHtml(u.username)}</span>
        <span class="assignee-option-email">${escHtml(u.email || '')}</span>
      </div>
    </div>`).join('');
  dropdown.classList.remove('hidden');
}

async function dpSelectAssignee(id, username, color, email) {
  document.getElementById('dp-assignee-dropdown').classList.add('hidden');
  document.getElementById('dp-assignee-search').value = '';
  const res = await authFetch(`/tasks/${detailTaskId}`, 'PUT', { assigneeId: id });
  if (res?.status === 'success') {
    toast(`Assigned to ${username} ✓`, 'success');
    const t = tasks.find(t => t.id === detailTaskId);
    if (t) t.assignee = { id, username, avatarColor: color, email };
    renderDetailAssignee(t || { assignee: { id, username, avatarColor: color, email } });
    renderDetailMeta(t || {}); loadAll();
  } else toast(res?.message || 'Error assigning task', 'error');
}

async function dpRemoveAssignee() {
  const res = await authFetch(`/tasks/${detailTaskId}`, 'PUT', { assigneeId: null });
  if (res?.status === 'success') {
    toast('Assignee removed', 'info');
    const t = tasks.find(t => t.id === detailTaskId);
    if (t) t.assignee = null;
    renderDetailAssignee({ assignee: null });
    renderDetailMeta(t || {}); loadAll();
  }
}

function renderDetailMeta(task) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const tags = task.tags ? task.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const statusIcon = { pending: '⏳', 'in-progress': '🔄', completed: '✅' };
  const prioIcon = { high: '🔥', medium: '⚡', low: '🌿' };
  document.getElementById('dp-meta').innerHTML = `
    <div class="dp-section">
      <div class="dp-meta-row"><i class="fa-solid fa-circle-half-stroke"></i><span class="dp-meta-value">${statusIcon[task.status] || ''} ${task.status || ''}</span></div>
      <div class="dp-meta-row"><i class="fa-solid fa-gauge-high"></i><span class="dp-meta-value"><span class="priority-badge ${task.priority}">${prioIcon[task.priority] || ''} ${task.priority || ''}</span></span></div>
      ${task.dueDate ? `<div class="dp-meta-row"><i class="fa-regular fa-calendar"></i><span class="dp-meta-value" style="${isOverdue ? 'color:var(--red)' : ''}">${new Date(task.dueDate).toLocaleString()}</span></div>` : ''}
      ${task.description ? `<div class="dp-meta-row" style="align-items:flex-start"><i class="fa-solid fa-align-left"></i><span style="color:var(--text-muted);font-size:0.85rem;line-height:1.6">${escHtml(task.description)}</span></div>` : ''}
      ${tags.length ? `<div class="dp-meta-row"><i class="fa-solid fa-tags"></i><div class="card-tags" style="margin:0">${tags.map(t => `<span class="tag-badge">#${escHtml(t)}</span>`).join('')}</div></div>` : ''}
    </div>`;
}

async function loadDetailFiles(id) {
  const res = await authFetch(`/tasks/${id}/files`);
  const container = document.getElementById('dp-files');
  if (!res?.data?.files?.length) { container.innerHTML = '<div style="color:var(--text-subtle);font-size:0.82rem">No attachments yet</div>'; return; }
  const extIcon = (mime) => mime.startsWith('image') ? '🖼️' : mime.includes('pdf') ? '📄' : '📎';
  container.innerHTML = res.data.files.map(f => `
    <div class="file-item">
      <span class="file-icon">${extIcon(f.mimetype)}</span>
      <div class="file-info"><div class="file-name" title="${escHtml(f.originalName)}">${escHtml(f.originalName)}</div><div class="file-size">${formatSize(f.size)}</div></div>
      <div class="file-actions">
        <a href="/uploads/${f.filename}" target="_blank" class="btn-icon" title="Open"><i class="fa-solid fa-external-link"></i></a>
        <button class="btn-icon danger" onclick="deleteFile('${f.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

async function loadDetailActivity(id) {
  const res = await authFetch(`/tasks/${id}/activity`);
  const container = document.getElementById('dp-activity');
  if (!res?.data?.activities?.length) { container.innerHTML = '<div style="color:var(--text-subtle);font-size:0.82rem">No activity yet</div>'; return; }
  const actionLabel = { 'created': 'created this task', 'status_changed': 'changed status', 'edited': 'edited task', 'commented': 'commented', 'assigned': 'assigned task', 'file_uploaded': 'uploaded a file' };
  container.innerHTML = res.data.activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div><div class="activity-text"><strong>${escHtml(a.user.username)}</strong> ${actionLabel[a.action] || a.action}${a.detail ? ` — <em>${escHtml(a.detail)}</em>` : ''}</div>
      <div class="activity-time">${timeAgo(a.createdAt)}</div></div>
    </div>`).join('');
}

async function loadDetailComments(id) {
  const res = await authFetch(`/tasks/${id}/comments`);
  const container = document.getElementById('dp-comments');
  if (!res?.data?.comments?.length) { container.innerHTML = '<div style="color:var(--text-subtle);font-size:0.82rem;margin-bottom:8px">No comments yet. Be the first!</div>'; return; }
  container.innerHTML = res.data.comments.map(c => `
    <div class="comment-item">
      <div class="avatar-sm" style="background:${c.user.avatarColor}">${c.user.username[0].toUpperCase()}</div>
      <div class="comment-content">
        <span class="comment-user">${escHtml(c.user.username)}</span><span class="comment-time">${timeAgo(c.createdAt)}</span>
        <div class="comment-text">${escHtml(c.content)}</div>
      </div>
    </div>`).join('');
}

async function submitComment() {
  const input = document.getElementById('comment-input');
  const content = input.value.trim(); if (!content || !detailTaskId) return;
  const res = await authFetch(`/tasks/${detailTaskId}/comments`, 'POST', { content });
  if (res?.status === 'success') { input.value = ''; loadDetailComments(detailTaskId); loadDetailActivity(detailTaskId); }
  else toast(res?.message || 'Error posting comment', 'error');
}

async function uploadFile(input) {
  const file = input.files[0]; if (!file || !detailTaskId) return;
  const formData = new FormData(); formData.append('file', file);
  try {
    const res = await fetch(`${API}/tasks/${detailTaskId}/files`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
    });
    const json = await res.json();
    if (json.status === 'success') { toast('File uploaded ✓', 'success'); loadDetailFiles(detailTaskId); loadDetailActivity(detailTaskId); }
    else toast(json.message || 'Upload failed', 'error');
  } catch { toast('Upload error', 'error'); }
  input.value = '';
}

async function deleteFile(fileId) {
  const res = await authFetch(`/tasks/${detailTaskId}/files/${fileId}`, 'DELETE');
  if (res?.status === 'success') { toast('File deleted', 'info'); loadDetailFiles(detailTaskId); }
}

function closeDetail() {
  document.getElementById('detail-panel').classList.add('hidden');
  document.getElementById('detail-overlay').classList.add('hidden');
  detailTaskId = null;
}

async function moveTask(newStatus) {
  if (!detailTaskId) return;
  const task = tasks.find(t => t.id === detailTaskId);
  if (!task) return;
  const res = await authFetch(`/tasks/${detailTaskId}`, 'PUT', { status: newStatus });
  if (res?.status === 'success') {
    toast(`Moved to "${newStatus}" ✓`, 'success');
    const dp = document.getElementById('dp-meta');
    // Update status in detail meta without full close
    task.status = newStatus;
    renderDetailMeta(task);
    loadAll();
  }
}

// ====================== DELETE ======================
function confirmDelete(id) {
  document.getElementById('gm-title').textContent = 'Delete Task';
  document.getElementById('gm-body').innerHTML = `
    <p style="color:var(--text-muted);margin-bottom:1.5rem">Are you sure you want to delete this task? This action cannot be undone.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-ghost" onclick="closeGenericModal()">Cancel</button>
      <button class="btn-primary" style="background:var(--red);box-shadow:none" onclick="doDelete('${id}')"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('generic-modal').classList.remove('hidden');
}
async function doDelete(id) {
  closeGenericModal();
  await authFetch(`/tasks/${id}`, 'DELETE');
  toast('Task deleted', 'info'); loadAll();
}
async function quickComplete(id, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  const res = await authFetch(`/tasks/${id}`, 'PUT', { status: newStatus });
  if (res?.status === 'success') { toast(newStatus === 'completed' ? 'Task completed! ✅' : 'Marked as pending', 'success'); loadAll(); }
}

// ====================== PANELS ======================
function togglePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const wasHidden = panel.classList.contains('hidden');
  closeAllPanels();
  if (wasHidden) panel.classList.remove('hidden');
}

// ====================== TEAM CHAT ======================
function toggleChat(show) {
  const p = document.getElementById('chat-panel');
  const o = document.getElementById('chat-overlay');
  if (show) {
    p.classList.remove('hidden'); o.classList.remove('hidden');
    fetchMessages(true); fetchOnlineUsers();
  } else {
    p.classList.add('hidden'); o.classList.add('hidden');
  }
}

function startChatSync() {
  fetchOnlineUsers();
  onlineInterval = setInterval(fetchOnlineUsers, 30000); // Online every 30s
  chatInterval = setInterval(() => {
    if (!document.getElementById('chat-panel').classList.contains('hidden')) {
      fetchMessages();
    }
  }, 4000); // Chat every 4s when panel is open
}

async function fetchOnlineUsers() {
  const res = await authFetch('/chat/online');
  if (res) {
    const list = document.getElementById('online-users-list');
    const count = document.getElementById('online-count');
    count.textContent = res.length;
    list.innerHTML = res.map(u => `
      <div class="chat-online-user">
        <div class="avatar-sm online" style="background:${u.avatarColor || '#7c3aed'}">${u.username[0].toUpperCase()}</div>
        <span>${escHtml(u.username)}</span>
      </div>`).join('');
    
    // Also update global avatars in the UI
    const onlineIds = new Set(res.map(u => u.id));
    document.querySelectorAll('.avatar-sm[data-user-id]').forEach(av => {
      av.classList.toggle('online', onlineIds.has(av.dataset.user-id));
    });
  }
}

async function fetchMessages(scroll = false) {
  const res = await authFetch('/chat/messages');
  if (res) {
    const container = document.getElementById('chat-messages');
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    
    container.innerHTML = res.map(m => `
      <div class="msg-item ${m.userId === currentUser.id ? 'self' : ''}">
        <div class="avatar-sm" style="background:${m.user.avatarColor || '#7c3aed'}">${m.user.username[0].toUpperCase()}</div>
        <div class="msg-content">
          <div class="msg-info"><strong>${escHtml(m.user.username)}</strong> <span>${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
          <div class="msg-bubble">${escHtml(m.content)}</div>
        </div>
      </div>`).join('');
    
    if (scroll || isAtBottom) container.scrollTop = container.scrollHeight;
  }
}

async function onSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const res = await authFetch('/chat/messages', 'POST', { content });
  if (res) fetchMessages(true);
}

function closeAllPanels() {
  document.getElementById('workspace-panel').classList.add('hidden');
  document.getElementById('notif-panel').classList.add('hidden');
}
function closeGenericModal() { document.getElementById('generic-modal').classList.add('hidden'); }

// ====================== API HELPERS ======================
async function authFetch(endpoint, method = 'GET', data = null) {
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (data) opts.body = JSON.stringify(data);
  try {
    const res = await fetch(`${API}${endpoint}`, opts);
    if (res.status === 204) return null;
    const json = await res.json();
    if (res.status === 401) { logout(); return null; }
    return json;
  } catch (err) { console.error(err); toast('Network error', 'error'); return null; }
}
async function apiFetch(endpoint, method, data) {
  const res = await fetch(`${API}${endpoint}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return res.json();
}

// ====================== TOAST ======================
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  el.className = `toast ${type}`; el.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400); }, 3000);
}

// ====================== UTILS ======================
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatSize(bytes) { if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB'; return (bytes/1048576).toFixed(1) + ' MB'; }
function timeAgo(dt) {
  const diff = Date.now() - new Date(dt);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  return new Date(dt).toLocaleDateString();
}

// Global exposure for HTML inline handlers
window.openModal = openModal; window.closeModal = closeModal; window.handleModalBackdropClick = handleModalBackdropClick;
window.openDetail = openDetail; window.closeDetail = closeDetail;
window.moveTask = moveTask; window.moveToWorkspace = moveToWorkspace;
window.dpSelectAssignee = dpSelectAssignee; window.dpRemoveAssignee = dpRemoveAssignee;
window.confirmDelete = confirmDelete; window.doDelete = doDelete; window.quickComplete = quickComplete;
window.handleDragOver = handleDragOver; window.handleDragLeave = handleDragLeave; window.handleDrop = handleDrop;
window.submitComment = submitComment; window.uploadFile = uploadFile; window.deleteFile = deleteFile;
window.openCreateWorkspace = openCreateWorkspace; window.createWorkspace = createWorkspace;
window.openInvite = openInvite; window.inviteMember = inviteMember; window.switchWorkspace = switchWorkspace;
window.closeGenericModal = closeGenericModal;
window.selectAssignee = selectAssignee; window.clearAssignee = clearAssignee;
window.toggleChat = toggleChat; window.onSendMessage = onSendMessage;

// Init modal assignee search after DOM is ready
initAssigneeSearch();

// Pagination Listeners
document.getElementById('prev-page')?.addEventListener('click', () => changePage(-1));
document.getElementById('next-page')?.addEventListener('click', () => changePage(1));
