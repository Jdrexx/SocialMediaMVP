'use client';

import { useState } from 'react';
import { api } from './api.js';
import Avatar from './Avatar.jsx';
import Linkify from './Linkify.jsx';

export default function PostCard({ post, currentUser, onBookmarkToggle }) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [localPost, setLocalPost] = useState(post);

  async function saveEdit() {
    const data = await api(`/api/posts/${localPost.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: editBody })
    });
    setLocalPost(data.post);
    setEditing(false);
  }

  async function toggleBookmark() {
    await api(`/api/bookmarks/${localPost.id}`, { method: 'POST' });
    onBookmarkToggle?.(localPost.id);
  }

  const isOwn = currentUser && localPost.username === currentUser.username;

  return (
    <article className="post">
      <div>
        <Avatar user={{ username: localPost.username, avatar_url: localPost.avatar_url }} />
        <strong>@{localPost.username}</strong>
        {localPost.edited ? <span className="editedBadge">edited</span> : null}
      </div>
      {editing ? (
        <div className="editForm">
          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={500} />
          <div className="inline">
            <button onClick={saveEdit}>Save</button>
            <button onClick={() => { setEditing(false); setEditBody(localPost.body); }} className="secondaryButton">Cancel</button>
          </div>
        </div>
      ) : (
        <p><Linkify text={localPost.body} /></p>
      )}
      {localPost.media_url && (
        localPost.media_type?.startsWith('video')
          ? <video src={localPost.media_url} controls />
          : <img src={localPost.media_url} alt="post media" />
      )}
      <div className="postMeta">
        <span>{localPost.like_count} likes</span>
        <span>{localPost.comment_count} comments</span>
        {isOwn && !editing && (
          <button className="textButton" onClick={() => { setEditBody(localPost.body); setEditing(true); }}>Edit</button>
        )}
        <button className="textButton" onClick={toggleBookmark}>Bookmark</button>
      </div>
    </article>
  );
}
