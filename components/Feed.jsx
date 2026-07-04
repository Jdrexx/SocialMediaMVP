import PostCard from './PostCard.jsx';

export default function Feed({ posts }) {
  return (
    <section className="feed">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </section>
  );
}
