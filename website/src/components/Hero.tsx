import { DownloadButton } from "./DownloadButton.tsx";

export function Hero() {
  return (
    <section className="hero content" aria-labelledby="hero-title">
      <p className="hero__status reveal">
        <span aria-hidden="true" />
        Chrome extension · Manifest V3
      </p>
      <h1 className="hero__title reveal reveal--one" id="hero-title">
        HTTP headers,
        <em> under control.</em>
      </h1>
      <p className="hero__intro reveal reveal--two">
        Set, append or remove request and response headers locally in Chrome.
        Use focused profiles and URL filters without changing your server or
        running a proxy.
      </p>
      <div className="hero__actions reveal reveal--three">
        <DownloadButton />
        <a className="text-link" href="#install">
          Installation guide
          <span aria-hidden="true">↓</span>
        </a>
      </div>
      <dl className="hero__facts reveal reveal--three">
        <div>
          <dt>Local only</dt>
          <dd>No account required</dd>
        </div>
        <div>
          <dt>Precise rules</dt>
          <dd>Request and response</dd>
        </div>
        <div>
          <dt>Open source</dt>
          <dd>MIT licensed</dd>
        </div>
      </dl>
    </section>
  );
}
