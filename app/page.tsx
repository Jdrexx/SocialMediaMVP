// @ts-nocheck
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../components/api';
import Avatar from '../components/Avatar';
import AuthForm from '../components/AuthForm';
import NavLinks from '../components/NavLinks';
import ProfileCard from '../components/ProfileCard';
import PostComposer from '../components/PostComposer';
import Feed from '../components/Feed';
import SearchPanel from '../components/SearchPanel';
import NotificationsPanel from '../components/NotificationsPanel';
import ChatPanel from '../components/ChatPanel';
import MemberOnboarding from '../components/MemberOnboarding';

export default function Home() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('');
  const [verification, setVerification] = useState(null);
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
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

  const loadFeed = useCallback(async (cursor) => {
    const url = cursor ? `/api/posts?before=${cursor}&limit=25` : '/api/posts?limit=25';
    const data = await api(url);
    if (cursor) {
      setPosts((prev) => [...prev, ...data.posts]);
    } else {
      setPosts(data.posts || []);
    }
    setNextCursor(data.next || null);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!signedIn) return;
    const data = await api('/api/notifications');
    setNotifications(data.notifications || []);
  }, [signedIn]);

  async function handleLogin(loggedInUser, verificationResult = null) {
    setUser(loggedInUser);
    setVerification(verificationResult);
    if (loggedInUser.onboarding_complete) await loadFeed();
  }

  async function logout() {
    setStatus('Logging out...');
    try {
      await api('/api/auth/logout', { method: 'POST' });
      socketRef.current?.close();
      socketRef.current = null;
      setUser(null);
      setNotifications([]);
      setChatUser('');
      setChatPeer(null);
      setMessages([]);
      setPosts([]);
      setNextCursor(null);
      setStatus('Logged out.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  function handleBookmarkToggle() {
    loadFeed(); // Refresh feed to update bookmark state
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  useEffect(() => {
    api('/api/auth/session').then((data) => {
      setUser(data.user);
      if (data.user.onboarding_complete) loadFeed().catch(() => null);
    }).catch(() => null);
  }, [loadFeed]);

  useEffect(() => {
    if (!user?.onboarding_complete) return;
    loadNotifications().catch(() => null);
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
    return () => { socket.close(); };
  }, [user, chatUser, loadNotifications]);

  function handleSelectUser(userData) {
    setChatUser(userData.username);
    setChatPeer(userData);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Your story. Your connections. Your next chapter.</p>
          <h1>A place to move forward—together.</h1>
          <p className="heroLead">Meet adults who understand that lived experience is part of your story, not the whole of who you are.</p>
          <div className="heroPromises" aria-label="MySazz community principles">
            <span>Private by choice</span>
            <span>Mutual connections</span>
            <span>Built without judgment</span>
          </div>
          {!user && <a className="primaryLink" href="#member-access">Join the community</a>}
        </div>
        <figure className="heroVisual">
          <img src="/brand/mysazz-community-hero.webp" alt="Four adults gathered around a table in a welcoming community space" />
          <figcaption>Connection begins with being seen as a whole person.</figcaption>
        </figure>
      </section>

      {user && (
        <section className="memberBar" aria-label="Signed-in member controls">
          <div className="memberBarIdentity">
            <Avatar user={user} size={48} />
            <span><strong>Welcome back, @{user.username}</strong><small>{unreadCount} unread notifications</small></span>
          </div>
          <div className="memberBarActions">
            {user.is_admin && <a href="/admin" className="secondaryButton">Admin panel</a>}
            <button type="button" className="secondaryButton" onClick={logout}>Log out</button>
          </div>
        </section>
      )}

      <NavLinks />

      {!signedIn ? (
        <div id="member-access"><AuthForm onLogin={handleLogin} /></div>
      ) : !user.onboarding_complete ? (
        <MemberOnboarding onComplete={(completedUser) => { setUser(completedUser); loadFeed().catch(() => null); }} />
      ) : (
        <>
          {!user.email_verified && (
            <section className="noticeCard" role="status">
              <strong>Verify your email</strong>
              <span>Check your inbox before relying on MySazz member features.</span>
              {verification?.dev_token && <a href={`/verify-email?token=${encodeURIComponent(verification.dev_token)}`}>Verify this development account</a>}
            </section>
          )}
          <div className="dashboard">
            <ProfileCard user={user} onUserUpdate={setUser} />
            <PostComposer onPostCreated={(newPosts) => { setPosts(newPosts); setNextCursor(null); }} posts={posts} />
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
          <Feed
            posts={posts}
            currentUser={user}
            onBookmarkToggle={handleBookmarkToggle}
            onLoadMore={() => loadFeed(nextCursor)}
            hasMore={!!nextCursor}
          />
        </>
      )}
    </main>
  );
}
