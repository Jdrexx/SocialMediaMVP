// @ts-nocheck
export default function PricingPage() {
  const plans = [
    { name: 'Founding membership', price: '$5 / month', details: 'Planned introductory access to profiles, connections, member stories, private chat, and video.' },
    { name: 'Sponsored membership', price: '$0', details: 'Planned donor-supported access for qualifying members. Safety and crisis resources will never require payment.' },
    { name: 'Support MySazz', price: 'Donate', details: 'Help fund moderated community access and trustworthy resource navigation for people with lived experience.' }
  ];

  return (
    <main className="shell infoPage">
      <a className="backLink" href="/">← Back to home</a>
      <section className="hero">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Pricing</h1>
          <p>Low-cost access with a commitment to keep safety information and resource discovery open to everyone.</p>
        </div>
      </section>
      <section className="pricingGrid">
        {plans.map((plan) => (
          <article className="card infoCard" key={plan.name}>
            <h2>{plan.name}</h2>
            <strong>{plan.price}</strong>
            <p>{plan.details}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
