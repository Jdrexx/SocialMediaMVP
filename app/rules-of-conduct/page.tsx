// @ts-nocheck
export default function RulesOfConductPage() {
  const rules = [
    'Be respectful. Do not harass, threaten, or bully other members.',
    'Do not post hate speech, illegal content, scams, spam, or impersonation attempts.',
    'Respect privacy. Do not share private information without permission.',
    'Never screenshot, record, repost, or identify another member without their clear permission.',
    'Do not pressure members for romance, money, medical details, meetings, photos, or off-platform contact.',
    'Do not present personal experience as medical advice or tell anyone to stop professional treatment.',
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
          <p>Version 2026-08-14. These commitments protect a private community built around sensitive lived experiences.</p>
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
