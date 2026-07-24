import { DownloadButton } from "./DownloadButton.tsx";

const steps = [
  {
    title: "Unzip the download",
    description: "Keep the extracted Header Forge folder somewhere permanent.",
  },
  {
    title: "Open Chrome extensions",
    description: "Visit chrome://extensions and enable Developer mode.",
  },
  {
    title: "Load the folder",
    description: "Select Load unpacked, then choose the extracted folder.",
  },
  {
    title: "Create your first rule",
    description: "Open Header Forge, choose a URL filter and add a header.",
  },
] as const;

export function Installation() {
  return (
    <section className="installation content" id="install" aria-labelledby="install-title">
      <div className="installation__copy">
        <h2 id="install-title">Four simple steps.</h2>
        <DownloadButton />
      </div>
      <ol className="steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="steps__number">0{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
