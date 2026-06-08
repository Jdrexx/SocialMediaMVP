'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Avatar({ user, size = 44 }) {
  return <div className="avatar" style={{ width: size, height: size }}>{user?.avatar_url ? <img src={user.avatar_url} alt="" /> : user?.username?.[0]?.toUpperCase() || '?'}</div>;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [auth, setAuth] = useState({ username: '', email: '', password: '' });
  const [status, setStatus] = useState('');
  const [posts, setPosts] = useState([]);
  const [postBody, setPostBody] = useState('');
  const [media, setMedia] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [chatUser, setChatUser] = useState('');
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState('');
  const socketRef = useRef(null);
  const typingTimer = useRef(null);

  const signedIn = Boolean(user);

  async function loadFeed() {
    const data = await api('/api/posts');
    setPosts(data.posts || []);
  }

  async function loadNotifications() {
    if (!signedIn) return;
    const data = await api('/api/notifications');
    setNotifications(data.notifications || []);
  }

  useEffect(() => {
    api('/api/auth/session').then((data) => setUser(data.user)).catch(() => null);
    loadFeed().catch(() => null);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications().catch(() => null);
    const socket = io(API || window.location.origin, { withCredentials: true });
    socketRef.current = socket;
    socket.on('message:new', ({ message }) => {
      if (chatUser && [message.sender_username, message.recipient_username].includes(chatUser)) {
        setMessages((prev) => [...prev, message]);
      }
      loadNotifications().catch(() => null);
    });
    socket.on('typing:start', ({ username }) => setTyping(`${username} is typing...`));
    socket.on('typing:stop', () => setTyping(''));
    return () => socket.close();
  }, [user, chatUser]);

  async function submitAuth(e) {
    e.preventDefault();
    setStatus('Working...');
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register' ? auth : { email: auth.email, password: auth.password };
      const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      setUser(data.user);
      setStatus(data.verification?.email_sent === false ? `Signed in. Dev verify token: ${data.verification.dev_token}` : 'Signed in.');
      await loadFeed();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('media', file);
    const data = await api('/api/uploads', { method: 'POST', body: form });
    setMedia(data.media);
    return data.media;
  }

  async function setProfileImage(kind, file) {
    const uploaded = await uploadFile(file);
    const data = await api(`/api/me/${kind}`, { method: 'POST', body: JSON.stringify({ media_id: uploaded.id }) });
    setUser(data.user);
  }

  async function createPost(e) {
    e.preventDefault();
    const data = await api('/api/posts', { method: 'POST', body: JSON.stringify({ body: postBody, media_id: media?.id }) });
    setPosts([data.post, ...posts]);
    setPostBody('');
    setMedia(null);
  }

  async function doSearch(e) {
    e.preventDefault();
    setResults(await api(`/api/search?q=${encodeURIComponent(search)}`));
  }

  async function openThread(username = chatUser) {
    if (!username) return;
    const data = await api(`/api/messages/${encodeURIComponent(username)}`);
    setChatUser(username);
    setMessages(data.messages || []);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const data = await api(`/api/messages/${encodeURIComponent(chatUser)}`, { method: 'POST', body: JSON.stringify({ body: chatBody }) });
    setMessages((prev) => [...prev, data.message]);
    setChatBody('');
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Next.js + Express social platform</p>
          <h1>Social Media MVP</h1>
          <p>Post updates, upload media, message friends in real time, manage your profile, and moderate community reports.</p>
        </div>
        {user ? <div className="profileCard"><Avatar user={user} size={64} /><strong>@{user.username}</strong><span>{unreadCount} unread notifications</span></div> : null}
      </section>

      {!signedIn ? (
        <section className="card authCard">
          <div className="tabs"><button onClick={() => setMode('login')} className={mode === 'login' ? 'active' : ''}>Login</button><button onClick={() => setMode('register')} className={mode === 'register' ? 'active' : ''}>Register</button></div>
          <form onSubmit={submitAuth} className="gridForm">
            {mode === 'register' && <input placeholder="Username" value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} />}
            <input placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} />
            <input placeholder="Password" type="password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} />
            <button>{mode === 'register' ? 'Create account' : 'Login'}</button>
          </form>
          <p className="status">{status}</p>
        </section>
      ) : (
        <div className="dashboard">
          <section className="card profilePanel">
            <div className="cover">{user.cover_url && <img src={user.cover_url} alt="cover" />}</div>
            <Avatar user={user} size={72} />
            <h2>@{user.username}</h2>
            <p>{user.bio || 'Add a bio from the legacy profile screen or API.'}</p>
            <label>Profile photo<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('avatar', e.target.files[0])} /></label>
            <label>Cover image<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('cover', e.target.files[0])} /></label>
          </section>

          <section className="card composer">
            <h2>Create post</h2>
            <form onSubmit={createPost}>
              <textarea placeholder="What's happening?" value={postBody} onChange={(e) => setPostBody(e.target.value)} />
              <input type="file" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {media && <p className="status">Attached {media.original_name}</p>}
              <button>Publish</button>
            </form>
          </section>

          <section className="card searchPanel">
            <h2>Search</h2>
            <form onSubmit={doSearch} className="inline"><input placeholder="Search users or posts" value={search} onChange={(e) => setSearch(e.target.value)} /><button>Go</button></form>
            {results && <div className="miniList">{results.users?.map((u) => <button key={u.id} onClick={() => setChatUser(u.username)}>@{u.username}</button>)}{results.posts?.map((p) => <article key={p.id}>{p.body}</article>)}</div>}
          </section>

          <section className="card chatPanel">
            <h2>Messages</h2>
            <form onSubmit={(e) => { e.preventDefault(); openThread(); }} className="inline"><input placeholder="Username" value={chatUser} onChange={(e) => setChatUser(e.target.value)} /><button>Open</button></form>
            <div className="messages">{messages.map((m) => <p key={m.id} className={m.sender_id === user.id ? 'mine' : ''}><b>{m.sender_username}:</b> {m.body}</p>)}<span className="typing">{typing}</span></div>
            {chatUser && <form onSubmit={sendMessage} className="inline"><input placeholder="Message" value={chatBody} onChange={(e) => { setChatBody(e.target.value); socketRef.current?.emit('typing:start', { recipientId: messages.find((m) => m.sender_username === chatUser || m.recipient_username === chatUser)?.sender_id }); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => socketRef.current?.emit('typing:stop', {}), 900); }} /><button>Send</button></form>}
          </section>

          <section className="card notifications">
            <h2>Notifications</h2>
            <button onClick={loadNotifications}>Refresh</button>
            {notifications.map((n) => <p key={n.id} className={!n.read_at ? 'unread' : ''}>{n.body}</p>)}
          </section>
        </div>
      )}

      <section className="feed">
        {posts.map((post) => <article className="post" key={post.id}><div><Avatar user={{ username: post.username, avatar_url: post.avatar_url }} /><strong>@{post.username}</strong></div><p>{post.body}</p>{post.media_url && (post.media_type?.startsWith('video') ? <video src={post.media_url} controls /> : <img src={post.media_url} alt="post media" />)}</article>)}
      </section>
    </main>
  );
}
