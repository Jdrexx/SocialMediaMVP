// @ts-nocheck
export default function Avatar({ user, size = 44 }) {
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" />
      ) : (
        user?.username?.[0]?.toUpperCase() || '?'
      )}
    </div>
  );
}
