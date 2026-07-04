// @ts-nocheck
'use client';

import { useRef, useState, useEffect } from 'react';
import { api } from './api';

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function ChatPanel({
  user,
  socketRef,
  chatUser,
  setChatUser,
  chatPeer,
  setChatPeer,
  messages,
  setMessages,
  typing,
  setTyping,
  incomingCall,
  setIncomingCall,
  callStatus,
  setCallStatus,
  inCall,
  setInCall
}) {
  const typingTimer = useRef(null);
  const pcRef = useRef(null);
  const pendingRecipientRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [chatBody, setChatBody] = useState('');
  const chatBodyRef = useRef(chatBody);
  chatBodyRef.current = chatBody;

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

  function cleanupCall() {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pendingRecipientRef.current = null;
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
      await preparePeer(chatPeer.id);
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
    cleanupCall();
    setInCall(false);
    setIncomingCall(null);
    setCallStatus('Idle');
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
    const body = chatBodyRef.current;
    if (!body || !chatUser) return;
    const data = await api(`/api/messages/${encodeURIComponent(chatUser)}`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    setMessages((prev) => [...prev, data.message]);
    setChatBody('');
  }

  // Wire video-call socket events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handlers = {
      'video:incoming': ({ caller }) => {
        setIncomingCall(caller);
        setCallStatus(`Incoming video call from @${caller.username}`);
      },
      'video:accepted': async ({ by }) => {
        setCallStatus(`@${by.username} accepted. Connecting...`);
        const recipientId = pendingRecipientRef.current || by.id;
        if (pcRef.current && recipientId) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          socket.emit('webrtc:offer', { recipientId, description: pcRef.current.localDescription });
        }
      },
      'video:rejected': ({ by }) => {
        setCallStatus(`@${by.username} rejected the call`);
        endVideoCall(false);
      },
      'video:ended': ({ by }) => {
        setCallStatus(`Call ended by @${by.username}`);
        endVideoCall(false);
      },
      'webrtc:offer': async ({ from, description }) => {
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
      },
      'webrtc:answer': async ({ description }) => {
        if (pcRef.current && description) await pcRef.current.setRemoteDescription(description);
        setCallStatus('Video call connected');
      },
      'webrtc:ice-candidate': async ({ candidate }) => {
        if (pcRef.current && candidate) await pcRef.current.addIceCandidate(candidate).catch(() => null);
      }
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }
    return () => {
      for (const [event] of Object.entries(handlers)) {
        socket.off(event);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef.current, user?.id]);

  return (
    <section className="card chatPanel">
      <h2>Messages + Video</h2>
      <form onSubmit={(e) => { e.preventDefault(); openThread(); }} className="inline">
        <input
          placeholder="Username"
          value={chatUser}
          onChange={(e) => setChatUser(e.target.value)}
        />
        <button>Open</button>
      </form>
      <div className="messages">
        {messages.map((m) => (
          <p key={m.id} className={m.sender_id === user.id ? 'mine' : ''}>
            <b>{m.sender_username}:</b> {m.body}
          </p>
        ))}
        <span className="typing">{typing}</span>
      </div>
      {chatUser && (
        <form onSubmit={sendMessage} className="inline">
          <input
            placeholder="Message"
            value={chatBody}
            onChange={(e) => {
              setChatBody(e.target.value);
              socketRef.current?.emit('typing:start', { recipientId: chatPeer?.id });
              clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(
                () => socketRef.current?.emit('typing:stop', { recipientId: chatPeer?.id }),
                900
              );
            }}
          />
          <button>Send</button>
        </form>
      )}
      <div className="videoCall">
        <div className="videoGrid">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
        {incomingCall && (
          <div className="incomingCall">
            <strong>@{incomingCall.username} is calling</strong>
            <button onClick={acceptVideoCall}>Accept</button>
            <button className="danger" onClick={rejectVideoCall}>Reject</button>
          </div>
        )}
        <p className="status">Video status: {callStatus}</p>
        <div className="inline">
          <button type="button" onClick={startVideoCall} disabled={!chatPeer?.id || inCall}>
            Start video call
          </button>
          <button type="button" className="danger" onClick={() => endVideoCall()} disabled={!inCall && !incomingCall}>
            End call
          </button>
        </div>
      </div>
    </section>
  );
}
