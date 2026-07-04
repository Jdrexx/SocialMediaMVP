// @ts-nocheck
'use client';

import { useState } from 'react';
import { api } from './api';

export default function PostComposer({ onPostCreated, posts }) {
  const [postBody, setPostBody] = useState('');
  const [media, setMedia] = useState(null);

  async function uploadFile(file) {
    const form = new FormData();
    form.append('media', file);
    const data = await api('/api/uploads', { method: 'POST', body: form });
    setMedia(data.media);
    return data.media;
  }

  async function createPost(e) {
    e.preventDefault();
    const data = await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ body: postBody, media_id: media?.id })
    });
    onPostCreated([data.post, ...posts]);
    setPostBody('');
    setMedia(null);
  }

  return (
    <section className="card composer">
      <h2>Create post</h2>
      <form onSubmit={createPost}>
        <textarea
          placeholder="What's happening?"
          value={postBody}
          onChange={(e) => setPostBody(e.target.value)}
        />
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        />
        {media && <p className="status">Attached {media.original_name}</p>}
        <button>Publish</button>
      </form>
    </section>
  );
}
