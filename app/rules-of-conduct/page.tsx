// @ts-nocheck
export default function RulesOfConductPage() {
  const rules = [
    'Be respectful. Do not harass, threaten, or bully other members.',
    'Do not post hate speech, illegal content, scams, spam, or impersonation attempts.',
    'Respect privacy. Do not share private information without permission.',
    'Keep posts and messages honest, safe, and relevant to the community.',
    'Report harmful content instead of escalating conflicts.'
  ];

  return (
    <main className="shell infoPage">
      <a className="backLink" href="/">← Back to home</a>
      <section className="hero">
        <div>
          <p className="eyebrow">Rules Of Conduct</p>
          <h1>Rules Of Conduct</h1>
          <p>These guidelines keep the community safe, welcoming, and useful for everyone.</p>
        </div>
      </section>
      <section className="card infoCard">
        <h2>Community rules</h2>
        <ol>
          {rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ol>
      </section>
    </main>
  );
}
