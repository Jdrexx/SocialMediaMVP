import Avatar from './Avatar.jsx';

export default function PostCard({ post }) {
  return (
    <article className="post">
      <div>
        <Avatar user={{ username: post.username, avatar_url: post.avatar_url }} />
        <strong>@{post.username}</strong>
      </div>
      <p>{post.body}</p>
      {post.media_url && (
        post.media_type?.startsWith('video')
          ? <video src={post.media_url} controls />
          : <img src={post.media_url} alt="post media" />
      )}
    </article>
  );
}
