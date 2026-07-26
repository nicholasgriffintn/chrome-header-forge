const privacyPoints = [
  "No analytics, telemetry, advertising or accounts",
  "No request or response bodies read by the extension",
  "Request headers sent only to user-defined matching sites",
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
          <div className="privacy__policy">
            <p>
              Header Forge handles profile names, URL filters, header names
              and header values entered by you. Header values can contain
              authentication information, so they should be treated as
              sensitive.
            </p>
            <p>
              Settings remain in Chrome&apos;s local extension storage until
              you change them, reset the extension or uninstall it. Chrome
              applies enabled rules through its Declarative Net Request API:
              configured request header values are sent only to sites matching
              your URL filters, while Header Forge does not read request or
              response bodies.
            </p>
            <p>
              Settings are not sent to the developer or an analytics service.
              Backups are created only when requested; full backups can contain
              credentials, while redacted exports remove recognised sensitive
              values. Information received through Chrome APIs is used only
              for Header Forge&apos;s stated purpose and in accordance with the
              Chrome Web Store User Data Policy, including the Limited Use
              requirements. Last updated 26 July 2026.{" "}
              <a href="https://nicholasgriffin.dev/contact">Contact the developer</a>
              {" "}with privacy questions.
            </p>
          </div>
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
