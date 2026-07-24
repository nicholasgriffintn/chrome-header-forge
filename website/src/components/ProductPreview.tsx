export function ProductPreview() {
  return (
    <section className="product-preview content" aria-label="Extension preview">
      <div className="product-preview__heading">
        <h2>Everything in one focused popup.</h2>
      </div>
      <div className="window">
        <div className="window__bar">
          <span className="window__lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window__label">
            <span className="status-dot" />
            Header Forge / Active
          </span>
        </div>
        <img
          src="/header-forge.png"
          alt="Header Forge showing a profile with request and response header rules"
          width="984"
          height="1088"
        />
      </div>
    </section>
  );
}
