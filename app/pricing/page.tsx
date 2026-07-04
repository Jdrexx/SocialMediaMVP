// @ts-nocheck
export default function PricingPage() {
  const plans = [
    { name: 'Free', price: '$0', details: 'Create an account, post updates, upload media, and message other members.' },
    { name: 'Community Pro', price: 'Coming soon', details: 'Future premium features for creators, groups, analytics, and enhanced media tools.' },
    { name: 'Business', price: 'Contact us', details: 'Options for branded communities, moderation support, and custom integrations.' }
  ];

  return (
    <main className="shell infoPage">
      <a className="backLink" href="/">← Back to home</a>
      <section className="hero">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Pricing</h1>
          <p>Simple starter pricing for the MVP, with room to add premium plans as the platform grows.</p>
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
