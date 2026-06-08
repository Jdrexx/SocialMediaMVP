export default function AboutUsPage() {
  return (
    <main className="shell infoPage">
      <a className="backLink" href="/">← Back to home</a>
      <section className="hero">
        <div>
          <p className="eyebrow">About Us</p>
          <h1>About Us</h1>
          <p>We are building a community-first social platform for posting updates, sharing media, messaging friends, and connecting in real time.</p>
        </div>
      </section>
      <section className="card infoCard">
        <h2>Our mission</h2>
        <p>Give people a simple, respectful place to connect with their community while keeping the product easy to use and easy to grow.</p>
      </section>
    </main>
  );
}
