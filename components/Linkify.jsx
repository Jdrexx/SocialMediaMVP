export default function Linkify({ text }) {
  if (!text) return null;
  // Turn #hashtag → <a href="/search?q=%23hashtag">
  const parts = text.split(/(#\w+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          const tag = encodeURIComponent(part);
          return <a key={i} href={`/search?q=${tag}`} className="hashtag">{part}</a>;
        }
        return part;
      })}
    </>
  );
}
