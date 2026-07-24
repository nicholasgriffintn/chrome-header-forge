const features = [
  {
    title: "Profiles with a purpose",
    description:
      "Keep authentication, CORS, staging and experiment rules separate. Switch the active set in one click.",
  },
  {
    title: "Precise URL filters",
    description:
      "Use Chrome DNR filter syntax to apply rules globally, to a domain or to an exact URL prefix.",
  },
  {
    title: "Pause when you need to",
    description:
      "Disable one rule or pause the whole profile. Your configuration stays ready for the next reload.",
  },
  {
    title: "Portable configuration",
    description:
      "Export every profile as JSON and import it later to restore or move your setup.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="features content" id="features" aria-labelledby="features-title">
      <div className="section-heading">
        <h2 id="features-title">Useful controls. Nothing extra.</h2>
      </div>
      <div className="feature-grid">
        {features.map((feature, index) => (
          <article className="feature-card" key={feature.title}>
            <span className="feature-card__number">0{index + 1}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
