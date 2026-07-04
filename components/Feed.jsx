'use client';

import PostCard from './PostCard.jsx';

export default function Feed({ posts, currentUser, onBookmarkToggle, onLoadMore, hasMore }) {
  return (
    <section className="feed">
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
