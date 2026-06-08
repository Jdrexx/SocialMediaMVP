const state = { user: null, posts: [] };
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function setMessage(text, type = 'info') {
  $('message').textContent = text;
  $('message').className = `message ${type}`;
}

function renderAuth() {
  $('current-user').textContent = state.user ? `@${state.user.username}` : 'Guest';
  $('auth-panel').hidden = Boolean(state.user);
  $('composer').hidden = !state.user;
  $('profile-panel').hidden = !state.user;
  $('logout').hidden = !state.user;
  if (state.user) {
    $('bio').value = state.user.bio || '';
    $('avatar_url').value = state.user.avatar_url || '';
  }
}

function renderPosts(posts = state.posts) {
  $('feed').innerHTML = posts.map((post) => `
    <article class="post">
      <header>
        <div class="avatar">${post.avatar_url ? `<img src="${escapeHtml(post.avatar_url)}" alt="">` : escapeHtml(post.username[0]?.toUpperCase() || '?')}</div>
        <div><strong>@${escapeHtml(post.username)}</strong><small>${new Date(post.created_at).toLocaleString()}</small></div>
      </header>
      <p>${escapeHtml(post.body)}</p>
      ${post.image_url ? `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="post image">` : ''}
      <div class="actions">
        <button data-like="${post.id}">${post.liked_by_me ? '♥ Unlike' : '♡ Like'} (${post.like_count})</button>
        <span>💬 ${post.comment_count}</span>
        <button data-profile="${escapeHtml(post.username)}">View profile</button>
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
  try {
    state.user = (await api('/api/me')).user;
  } catch {
    state.user = null;
  }
  renderAuth();
}

async function loadFeed() {
  const path = state.user ? '/api/feed' : '/api/posts';
  state.posts = (await api(path)).posts;
  renderPosts();
}

$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const form = new FormData(formEl);
  try {
    state.user = (await api('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })).user;
    formEl.reset();
    setMessage('Account created.', 'success');
    renderAuth();
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const form = new FormData(formEl);
  try {
    state.user = (await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })).user;
    formEl.reset();
    setMessage('Logged in.', 'success');
    renderAuth();
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

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
    await api('/api/posts', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    formEl.reset();
    setMessage('Posted.', 'success');
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const form = new FormData(formEl);
  try {
    state.user = (await api('/api/me', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(form)) })).user;
    setMessage('Profile updated.', 'success');
    renderAuth();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('feed').addEventListener('click', async (e) => {
  const likeId = e.target.dataset.like;
  const username = e.target.dataset.profile;
  try {
    if (likeId) {
      await api(`/api/posts/${likeId}/like`, { method: 'POST' });
      await loadFeed();
    }
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
  const body = new FormData(e.target).get('body');
  try {
    await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('follow-target').addEventListener('click', async (e) => {
  try {
    await api(`/api/users/${e.target.dataset.username}/follow`, { method: 'POST' });
    setMessage('Follow status changed.', 'success');
    await loadFeed();
  } catch (err) { setMessage(err.message, 'error'); }
});

$('show-feed').addEventListener('click', async () => {
  $('view-title').textContent = state.user ? 'Your feed' : 'Public feed';
  $('follow-target').hidden = true;
  await loadFeed();
});

await loadMe();
await loadFeed();
