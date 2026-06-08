'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const frontPageLinks = [
  { href: '/about-us', label: 'About Us', description: 'Learn who we are' },
  { href: '/contact', label: 'Contact', description: 'Get in touch' },
  { href: '/rules-of-conduct', label: 'Rules Of Conduct', description: 'Community guidelines' },
  { href: '/pricing', label: 'Pricing', description: 'View plans and options' }
];

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
  const [chatPeer, setChatPeer] = useState(null);
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('Idle');
  const [inCall, setInCall] = useState(false);
  const socketRef = useRef(null);
  const typingTimer = useRef(null);
  const pcRef = useRef(null);
  const pendingRecipientRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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

  async function startLocalMedia() {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  function createPeerConnection(recipientId) {
    pcRef.current?.close();
    const pc = new RTCPeerConnection(rtcConfig);
    pc.onicecandidate = (event) => {
      if (event.candidate) socketRef.current?.emit('webrtc:ice-candidate', { recipientId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) remoteVideoRef.current.srcObject = event.streams[0];
    };
    pc.onconnectionstatechange = () => setCallStatus(`Call ${pc.connectionState}`);
    pcRef.current = pc;
    return pc;
  }

  async function preparePeer(recipientId) {
    const stream = await startLocalMedia();
    const pc = createPeerConnection(recipientId);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    setInCall(true);
    return pc;
  }

  async function startVideoCall() {
    if (!chatPeer?.id) {
      setCallStatus('Open a message thread before starting a video call.');
      return;
    }
    try {
      setCallStatus(`Calling @${chatPeer.username}...`);
      const ack = await new Promise((resolve) => socketRef.current?.emit('video:call', { recipientId: chatPeer.id }, resolve));
      if (!ack?.ok) throw new Error(ack?.error || 'Could not start call');
      const pc = await preparePeer(chatPeer.id);
      pendingRecipientRef.current = chatPeer.id;
      setCallStatus(`Waiting for @${chatPeer.username} to accept...`);
    } catch (err) {
      setCallStatus(err.message);
      endVideoCall(false);
    }
  }

  async function acceptVideoCall() {
    if (!incomingCall) return;
    try {
      setChatUser(incomingCall.username);
      setChatPeer(incomingCall);
      setCallStatus(`Accepted @${incomingCall.username}. Connecting...`);
      await preparePeer(incomingCall.id);
      socketRef.current?.emit('video:accept', { recipientId: incomingCall.id });
      setIncomingCall(null);
    } catch (err) {
      setCallStatus(err.message);
    }
  }

  function rejectVideoCall() {
    if (incomingCall?.id) socketRef.current?.emit('video:reject', { recipientId: incomingCall.id });
    setIncomingCall(null);
    setCallStatus('Call rejected');
  }

  function endVideoCall(notify = true) {
    const recipientId = chatPeer?.id || incomingCall?.id;
    if (notify && recipientId) socketRef.current?.emit('video:end', { recipientId });
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pendingRecipientRef.current = null;
    setInCall(false);
    setIncomingCall(null);
    setCallStatus('Idle');
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
    socket.on('video:incoming', ({ caller }) => {
      setIncomingCall(caller);
      setCallStatus(`Incoming video call from @${caller.username}`);
    });
    socket.on('video:accepted', async ({ by }) => {
      setCallStatus(`@${by.username} accepted. Connecting...`);
      const recipientId = pendingRecipientRef.current || by.id;
      if (pcRef.current && recipientId) {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        socket.emit('webrtc:offer', { recipientId, description: pcRef.current.localDescription });
      }
    });
    socket.on('video:rejected', ({ by }) => {
      setCallStatus(`@${by.username} rejected the call`);
      endVideoCall(false);
    });
    socket.on('video:ended', ({ by }) => {
      setCallStatus(`Call ended by @${by.username}`);
      endVideoCall(false);
    });
    socket.on('webrtc:offer', async ({ from, description }) => {
      try {
        setChatUser(from.username);
        setChatPeer(from);
        setCallStatus(`Connecting video call with @${from.username}...`);
        const pc = await preparePeer(from.id);
        await pc.setRemoteDescription(description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { recipientId: from.id, description: pc.localDescription });
      } catch (err) {
        setCallStatus(err.message);
      }
    });
    socket.on('webrtc:answer', async ({ description }) => {
      if (pcRef.current && description) await pcRef.current.setRemoteDescription(description);
      setCallStatus('Video call connected');
    });
    socket.on('webrtc:ice-candidate', async ({ candidate }) => {
      if (pcRef.current && candidate) await pcRef.current.addIceCandidate(candidate).catch(() => null);
    });
    return () => {
      socket.close();
      endVideoCall(false);
    };
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

  async function logout() {
    setStatus('Logging out...');
    try {
      await api('/api/auth/logout', { method: 'POST' });
      endVideoCall(false);
      socketRef.current?.close();
      socketRef.current = null;
      setUser(null);
      setNotifications([]);
      setChatUser('');
      setChatPeer(null);
      setMessages([]);
      setResults(null);
      setMedia(null);
      setStatus('Logged out.');
      setMode('login');
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
    setChatPeer(data.user);
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
          <p>Post updates, upload media, video chat, message friends in real time, manage your profile, and moderate community reports.</p>
        </div>
        {user ? <div className="profileCard"><Avatar user={user} size={64} /><strong>@{user.username}</strong><span>{unreadCount} unread notifications</span><button type="button" className="secondaryButton" onClick={logout}>Logout</button></div> : null}
      </section>

      <nav className="frontLinks" aria-label="Front page links">
        {frontPageLinks.map((link) => (
          <a key={link.href} href={link.href}>
            <strong>{link.label}</strong>
            <span>{link.description}</span>
          </a>
        ))}
      </nav>

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
          <section id="profile" className="card profilePanel">
            <div className="cover">{user.cover_url && <img src={user.cover_url} alt="cover" />}</div>
            <Avatar user={user} size={72} />
            <h2>@{user.username}</h2>
            <p>{user.bio || 'Add a bio from the legacy profile screen or API.'}</p>
            <label>Profile photo<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('avatar', e.target.files[0])} /></label>
            <label>Cover image<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('cover', e.target.files[0])} /></label>
          </section>

          <section id="create-post" className="card composer">
            <h2>Create post</h2>
            <form onSubmit={createPost}>
              <textarea placeholder="What's happening?" value={postBody} onChange={(e) => setPostBody(e.target.value)} />
              <input type="file" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {media && <p className="status">Attached {media.original_name}</p>}
              <button>Publish</button>
            </form>
          </section>

          <section id="search" className="card searchPanel">
            <h2>Search</h2>
            <form onSubmit={doSearch} className="inline"><input placeholder="Search users or posts" value={search} onChange={(e) => setSearch(e.target.value)} /><button>Go</button></form>
            {results && <div className="miniList">{results.users?.map((u) => <button key={u.id} onClick={() => { setChatUser(u.username); setChatPeer(u); }}>@{u.username}</button>)}{results.posts?.map((p) => <article key={p.id}>{p.body}</article>)}</div>}
          </section>

          <section id="messages" className="card chatPanel">
            <h2>Messages + Video</h2>
            <form onSubmit={(e) => { e.preventDefault(); openThread(); }} className="inline"><input placeholder="Username" value={chatUser} onChange={(e) => setChatUser(e.target.value)} /><button>Open</button></form>
            <div className="messages">{messages.map((m) => <p key={m.id} className={m.sender_id === user.id ? 'mine' : ''}><b>{m.sender_username}:</b> {m.body}</p>)}<span className="typing">{typing}</span></div>
            {chatUser && <form onSubmit={sendMessage} className="inline"><input placeholder="Message" value={chatBody} onChange={(e) => { setChatBody(e.target.value); socketRef.current?.emit('typing:start', { recipientId: chatPeer?.id }); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => socketRef.current?.emit('typing:stop', { recipientId: chatPeer?.id }), 900); }} /><button>Send</button></form>}
            <div className="videoCall">
              <div className="videoGrid"><video ref={localVideoRef} autoPlay muted playsInline /><video ref={remoteVideoRef} autoPlay playsInline /></div>
              {incomingCall && <div className="incomingCall"><strong>@{incomingCall.username} is calling</strong><button onClick={acceptVideoCall}>Accept</button><button className="danger" onClick={rejectVideoCall}>Reject</button></div>}
              <p className="status">Video status: {callStatus}</p>
              <div className="inline"><button type="button" onClick={startVideoCall} disabled={!chatPeer?.id || inCall}>Start video call</button><button type="button" className="danger" onClick={() => endVideoCall()} disabled={!inCall && !incomingCall}>End call</button></div>
            </div>
          </section>

          <section id="notifications" className="card notifications">
            <h2>Notifications</h2>
            <button onClick={loadNotifications}>Refresh</button>
            {notifications.map((n) => <p key={n.id} className={!n.read_at ? 'unread' : ''}>{n.body}</p>)}
          </section>
        </div>
      )}

      <section id="feed" className="feed">
        {posts.map((post) => <article className="post" key={post.id}><div><Avatar user={{ username: post.username, avatar_url: post.avatar_url }} /><strong>@{post.username}</strong></div><p>{post.body}</p>{post.media_url && (post.media_type?.startsWith('video') ? <video src={post.media_url} controls /> : <img src={post.media_url} alt="post media" />)}</article>)}
      </section>
    </main>
  );
}
