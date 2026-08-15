// @ts-nocheck
'use client';

import PostCard from './PostCard';

export default function Feed({ posts, currentUser, onBookmarkToggle, onLoadMore, hasMore }) {
  return (
    <section className="feed" aria-label="Community stories">
      {posts.length === 0 && <div className="card emptyFeed"><p className="eyebrow">Community stories</p><h2>This space is ready for your voice.</h2><p>Share the first thought, question, or milestone when it feels right.</p></div>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUser={currentUser} onBookmarkToggle={onBookmarkToggle} />
      ))}
      {hasMore && (
        <div className="loadMoreWrap">
          <button onClick={onLoadMore} className="secondaryButton">Load more</button>
        </div>
      )}
    </section>
  );
}
