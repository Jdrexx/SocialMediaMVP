'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../components/api.js';
import Avatar from '../components/Avatar.jsx';
import AuthForm from '../components/AuthForm.jsx';
import NavLinks from '../components/NavLinks.jsx';
import ProfileCard from '../components/ProfileCard.jsx';
import PostComposer from '../components/PostComposer.jsx';
import Feed from '../components/Feed.jsx';
import SearchPanel from '../components/SearchPanel.jsx';
import NotificationsPanel from '../components/NotificationsPanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';

export default function Home() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('');
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [chatUser, setChatUser] = useState('');
  const [chatPeer, setChatPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('Idle');
  const [inCall, setInCall] = useState(false);
  const socketRef = useRef(null);

  const signedIn = Boolean(user);

  const loadFeed = useCallback(async () => {
    const data = await api('/api/posts');
    setPosts(data.posts || []);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!signedIn) return;
    const data = await api('/api/notifications');
    setNotifications(data.notifications || []);
  }, [signedIn]);

  async function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    await loadFeed();
  }

  async function logout() {
    setStatus('Logging out...');
    try {
      await api('/api/auth/logout', { method: 'POST' });
      const pc = null;
      socketRef.current?.close();
      socketRef.current = null;
      setUser(null);
      setNotifications([]);
      setChatUser('');
      setChatPeer(null);
      setMessages([]);
      setPosts([]);
      setStatus('Logged out.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  useEffect(() => {
    api('/api/auth/session').then((data) => setUser(data.user)).catch(() => null);
    loadFeed().catch(() => null);
  }, [loadFeed]);

  useEffect(() => {
    if (!user) return;

    // Load initial notifications
    loadNotifications().catch(() => null);

    // Connect Socket.IO
    const API = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
    const socket = io(API, { withCredentials: true });
    socketRef.current = socket;

    socket.on('message:new', ({ message }) => {
      if (chatUser && [message.sender_username, message.recipient_username].includes(chatUser)) {
        setMessages((prev) => [...prev, message]);
      }
      loadNotifications().catch(() => null);
    });

    socket.on('typing:start', ({ username }) => setTyping(`${username} is typing...`));
    socket.on('typing:stop', () => setTyping(''));

    return () => {
      socket.close();
    };
  }, [user, chatUser, loadNotifications]);

  function handleSelectUser(userData) {
    setChatUser(userData.username);
    setChatPeer(userData);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Next.js + Express social platform</p>
          <h1>Social Media MVP</h1>
          <p>Post updates, upload media, video chat, message friends in real time, manage your profile, and moderate community reports.</p>
        </div>
        {user ? (
          <div className="profileCard">
            <Avatar user={user} size={64} />
            <strong>@{user.username}</strong>
            <span>{unreadCount} unread notifications</span>
            {user.is_admin && <a href="/admin" className="secondaryButton" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>Admin Panel</a>}
            <button type="button" className="secondaryButton" onClick={logout}>Logout</button>
          </div>
        ) : null}
      </section>

      <NavLinks />

      {!signedIn ? (
        <AuthForm onLogin={handleLogin} />
      ) : (
        <>
          <div className="dashboard">
            <ProfileCard user={user} onUserUpdate={setUser} />
            <PostComposer onPostCreated={setPosts} posts={posts} />
            <SearchPanel onSelectUser={handleSelectUser} />
            <ChatPanel
              user={user}
              socketRef={socketRef}
              chatUser={chatUser}
              setChatUser={setChatUser}
              chatPeer={chatPeer}
              setChatPeer={setChatPeer}
              messages={messages}
              setMessages={setMessages}
              typing={typing}
              setTyping={setTyping}
              incomingCall={incomingCall}
              setIncomingCall={setIncomingCall}
              callStatus={callStatus}
              setCallStatus={setCallStatus}
              inCall={inCall}
              setInCall={setInCall}
            />
            <NotificationsPanel
              notifications={notifications}
              onRefresh={loadNotifications}
            />
          </div>
          <Feed posts={posts} />
        </>
      )}
    </main>
  );
}
