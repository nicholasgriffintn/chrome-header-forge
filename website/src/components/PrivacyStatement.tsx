const privacyPoints = [
  "No analytics or telemetry",
  "No accounts or advertising",
  "No remote scripts or external API calls",
] as const;

export function PrivacyStatement() {
  return (
    <section className="privacy" id="privacy" aria-labelledby="privacy-title">
      <div className="content privacy__inner">
        <div className="privacy__mark" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M24 5 40 11.5v11c0 8.9-6.5 15.3-16 18.8-9.5-3.5-16-9.9-16-18.8v-11L24 5Z" />
            <path d="m17.5 24 4.5 4.5L31.5 19" />
          </svg>
        </div>
        <div className="privacy__copy">
          <h2 id="privacy-title">Your rules stay on your machine.</h2>
          <p>
            Settings live in Chrome&apos;s local extension storage. Chrome
            applies the rules without exposing request contents to Header
            Forge.
          </p>
        </div>
        <ul>
          {privacyPoints.map((point) => (
            <li key={point}>
              <span aria-hidden="true">✓</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
