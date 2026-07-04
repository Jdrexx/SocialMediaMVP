const state = { user: null, posts: [] };
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function setMessage(text, type = 'info') {
  $('message').textContent = text;
  $('message').className = `message ${type}`;
}

function formObject(formEl) {
  return Object.fromEntries(new FormData(formEl));
}

function renderAuth() {
  $('current-user').textContent = state.user ? `@${state.user.username}${state.user.email_verified ? ' ✓' : ''}` : 'Guest';
  $('auth-panel').hidden = Boolean(state.user);
  $('composer').hidden = !state.user;
  $('profile-panel').hidden = !state.user;
  $('notifications-panel').hidden = !state.user;
  $('messages-panel').hidden = !state.user;
  $('admin-panel').hidden = !(state.user && state.user.is_admin);
  $('logout').hidden = !state.user;
  if (state.user) {
    $('bio').value = state.user.bio || '';
    $('avatar_url').value = state.user.avatar_url || '';
    loadNotifications().catch(() => {});
    loadThreads().catch(() => {});
  }
}

function mediaMarkup(post) {
  const url = post.media_url || post.image_url;
  if (!url) return '';
  const safe = escapeHtml(url);
  if (safe.match(/\.(mp4|webm|mov)$/i)) return `<video class="post-image" src="${safe}" controls></video>`;
  return `<img class="post-image" src="${safe}" alt="post media">`;
}

function renderPosts(posts = state.posts) {
  $('feed').innerHTML = posts.map((post) => `
    <article class="post">
      <header>
        <div class="avatar">${post.avatar_url ? `<img src="${escapeHtml(post.avatar_url)}" alt="">` : escapeHtml(post.username[0]?.toUpperCase() || '?')}</div>
        <div><strong>@${escapeHtml(post.username)}</strong><small>${new Date(post.created_at).toLocaleString()}</small></div>
      </header>
      <p>${escapeHtml(post.body)}</p>
      ${mediaMarkup(post)}
      <div class="actions">
        <button data-like="${post.id}">${post.liked_by_me ? '♥ Unlike' : '♡ Like'} (${post.like_count})</button>
        <span>💬 ${post.comment_count}</span>
        <button data-profile="${escapeHtml(post.username)}">View profile</button>
        <button data-report="${post.id}">Report</button>
      </div>
      <form data-comment="${post.id}" class="comment-form">
        <input name="body" placeholder="Add a comment" ${state.user ? '' : 'disabled'}>
        <button ${state.user ? '' : 'disabled'}>Reply</button>
      </form>
      <div class="comments">
        ${(post.comments || []).map((c) => `<p><strong>@${escapeHtml(c.username)}</strong> ${escapeHtml(c.body)}</p>`).join('')}
      </div>
    </article>
  `).join('') || '<p class="empty">No posts yet. Create the first one.</p>';
}

async function loadMe() {
  try { state.user = (await api('/api/me')).user; } catch { state.user = null; }
  renderAuth();
}

async function loadFeed() {
  const path = state.user ? '/api/feed' : '/api/posts';
  state.posts = (await api(path)).posts;
  renderPosts();
}

async function loadNotifications() {
  if (!state.user) return;
  const data = await api('/api/notifications');
  $('notifications').innerHTML = data.notifications.map((n) => `<div class="mini ${n.read ? '' : 'unread'}">${escapeHtml(n.body)}<br><small>${new Date(n.created_at).toLocaleString()}</small></div>`).join('') || '<p class="empty">No notifications.</p>';
}

async function loadThreads() {
  if (!state.user) return;
  const data = await api('/api/messages/threads');
  $('threads').innerHTML = data.threads.map((t) => `<button data-chat="${escapeHtml(t.username)}">@${escapeHtml(t.username)}</button>`).join('') || '<p class="empty">No message threads.</p>';
}

async function submitAuthForm(e, path, success) {
  e.preventDefault();
  const formEl = e.currentTarget;
  try {
    state.user = (await api(path, { method: 'POST', body: JSON.stringify(formObject(formEl)) })).user;
    formEl.reset();
    setMessage(success, 'success');
    renderAuth();
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
}

$('register-form').addEventListener('submit', (e) => submitAuthForm(e, '/api/auth/register', 'Account created.'));
$('login-form').addEventListener('submit', (e) => submitAuthForm(e, '/api/auth/login', 'Logged in.'));

$('logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  setMessage('Logged out.', 'success');
  renderAuth();
  await loadFeed();
});

$('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const form = new FormData(formEl);
  try {
    let media_id;
    const file = $('media-upload').files[0];
    if (file) {
      const uploadForm = new FormData();
      uploadForm.append('media', file);
      media_id = (await api('/api/uploads', { method: 'POST', body: uploadForm })).media.id;
    }
    await api('/api/posts', { method: 'POST', body: JSON.stringify({ body: form.get('body'), image_url: form.get('image_url'), media_id }) });
    formEl.reset();
    setMessage('Posted.', 'success');
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  try {
    state.user = (await api('/api/me', { method: 'PATCH', body: JSON.stringify(formObject(formEl)) })).user;
    setMessage('Profile updated.', 'success');
    renderAuth();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('reset-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { const data = await api('/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify(formObject(e.currentTarget)) }); setMessage(`Reset token: ${data.dev_token || 'check email'}`, 'success'); } catch (err) { setMessage(err.message, 'error'); }
});

$('reset-confirm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/api/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(formObject(e.currentTarget)) }); setMessage('Password reset. Log in with the new password.', 'success'); } catch (err) { setMessage(err.message, 'error'); }
});

$('verify-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { const data = await api('/api/auth/email-verification/request', { method: 'POST' }); setMessage(`Verification token: ${data.dev_token}`, 'success'); } catch (err) { setMessage(err.message, 'error'); }
});

$('verify-confirm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { state.user = (await api('/api/auth/email-verification/confirm', { method: 'POST', body: JSON.stringify(formObject(e.currentTarget)) })).user; setMessage('Email verified.', 'success'); renderAuth(); } catch (err) { setMessage(err.message, 'error'); }
});

$('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const q = new FormData(e.currentTarget).get('q');
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
    $('search-results').innerHTML = `<h3>Users</h3>${data.users.map((u) => `<button data-profile="${escapeHtml(u.username)}">@${escapeHtml(u.username)}</button>`).join('') || '<p>None</p>'}<h3>Posts</h3>${data.posts.map((p) => `<p>@${escapeHtml(p.username)}: ${escapeHtml(p.body)}</p>`).join('') || '<p>None</p>'}`;
    renderPosts(data.posts);
    $('view-title').textContent = `Search: ${q}`;
  } catch (err) { setMessage(err.message, 'error'); }
});

$('feed').addEventListener('click', async (e) => {
  const likeId = e.target.dataset.like;
  const username = e.target.dataset.profile;
  const reportId = e.target.dataset.report;
  try {
    if (likeId) { await api(`/api/posts/${likeId}/like`, { method: 'POST' }); await loadFeed(); }
    if (reportId) { const reason = prompt('Reason for report?', 'spam'); if (reason) { await api(`/api/reports/posts/${reportId}`, { method: 'POST', body: JSON.stringify({ reason }) }); setMessage('Report submitted.', 'success'); } }
    if (username) {
      const profile = await api(`/api/users/${username}`);
      renderPosts(profile.posts);
      $('view-title').textContent = `@${profile.user.username} — ${profile.user.follower_count} followers`;
      if (state.user && state.user.username !== profile.user.username) {
        $('follow-target').textContent = profile.user.following ? `Unfollow @${profile.user.username}` : `Follow @${profile.user.username}`;
        $('follow-target').hidden = false;
        $('follow-target').dataset.username = profile.user.username;
      }
    }
  } catch (err) { setMessage(err.message, 'error'); }
});

$('feed').addEventListener('submit', async (e) => {
  const postId = e.target.dataset.comment;
  if (!postId) return;
  e.preventDefault();
  try { await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: new FormData(e.target).get('body') }) }); await loadFeed(); } catch (err) { setMessage(err.message, 'error'); }
});

$('follow-target').addEventListener('click', async (e) => {
  try { await api(`/api/users/${e.target.dataset.username}/follow`, { method: 'POST' }); setMessage('Follow status changed.', 'success'); await loadFeed(); await loadNotifications(); } catch (err) { setMessage(err.message, 'error'); }
});

$('message-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { const data = formObject(e.currentTarget); await api(`/api/messages/${data.username}`, { method: 'POST', body: JSON.stringify({ body: data.body }) }); e.currentTarget.reset(); setMessage('Message sent.', 'success'); await loadThreads(); } catch (err) { setMessage(err.message, 'error'); }
});

$('threads').addEventListener('click', async (e) => {
  const username = e.target.dataset.chat;
  if (!username) return;
  try { const data = await api(`/api/messages/${username}`); $('threads').innerHTML = data.messages.map((m) => `<p><strong>@${escapeHtml(m.sender_username)}</strong>: ${escapeHtml(m.body)}</p>`).join(''); } catch (err) { setMessage(err.message, 'error'); }
});

$('load-admin').addEventListener('click', async () => {
  try {
    const data = await api('/api/admin/reports');
    $('admin-reports').innerHTML = data.reports.map((r) => `<div class="mini">${escapeHtml(r.target_type)} #${r.target_id}: ${escapeHtml(r.reason)} <button data-remove-post="${r.target_id}">Hide post</button></div>`).join('') || '<p>No reports.</p>';
  } catch (err) { setMessage(err.message, 'error'); }
});

$('admin-reports').addEventListener('click', async (e) => {
  const id = e.target.dataset.removePost;
  if (!id) return;
  try { await api(`/api/admin/posts/${id}`, { method: 'DELETE' }); setMessage('Post hidden.', 'success'); $('load-admin').click(); await loadFeed(); } catch (err) { setMessage(err.message, 'error'); }
});

$('mark-all-read').addEventListener('click', async () => { await api('/api/notifications/read-all', { method: 'POST' }); await loadNotifications(); });
$('show-feed').addEventListener('click', async () => { $('view-title').textContent = state.user ? 'Your feed' : 'Public feed'; $('follow-target').hidden = true; await loadFeed(); });

await loadMe();
await loadFeed();
