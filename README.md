# Header Forge

Need to change HTTP headers while testing a website or API? Header Forge lets you set, append or remove request and response headers locally in Chrome.

![Header Forge routing requests through precise header controls](promos/marquee-1400x560.png)

## What it does

- Set, append or remove request and response headers.
- Restrict rules with Chrome URL filters.
- Keep separate profiles for different sites or tasks.
- Pause individual rules or all changes at once.
- Export and restore profiles as JSON.

![Header Forge popup with request and response header rules](screenshots/screenshot.png)

## How to use it

1. Install Header Forge and open the extension popup.
2. Choose an existing profile or select **New**.
3. Enter a URL filter:

   - `*` — all HTTP and HTTPS requests
   - `||example.com/` — `example.com` and its subdomains
   - `|https://example.com/` — URLs beginning with this exact prefix

4. Add a request or response header.
5. Choose **Set**, **Append** or **Remove**, then enter the header name and value.
6. Select **Apply changes**, then reload the target page.

Only the selected profile is active. Use the main switch to pause all rules.

## Import and export

- Select **Export redacted** to download `header-forge-redacted.json` with sensitive header values removed.
- Select **Backup** to download `header-forge-backup.json` with every header value. The file may contain credentials, so store it carefully.
- Select **Import** to replace the current settings with a valid Header Forge JSON file.

Export your settings before importing if you may need to restore them.

## Install

[Install Header Forge from the Chrome Web Store](https://chromewebstore.google.com/detail/header-forge/hjniljmdaadpkbllgfilpiolmbgihbon).

For local development, open `chrome://extensions`, enable **Developer mode**, then select **Load unpacked** and choose this repository. Reload an already-open target page after the first installation.

## Privacy

Header Forge handles profile names, URL filters, header names and header values entered by the user. Header values can contain authentication information and should be treated as sensitive. Settings remain in Chrome's local extension storage until they are changed, reset or the extension is uninstalled.

Chrome applies enabled rules through its Declarative Net Request API. Configured request header values are sent only to sites matching the user's URL filters; Header Forge does not read request or response bodies. Access to all URLs is required so enabled rules can work on any site.

Settings are not sent to the developer or an analytics service. Backups are created only when requested; full backups can contain credentials, while redacted exports remove recognised sensitive values. The extension has no accounts, analytics, advertising, remote scripts or external API calls.

Information received through Chrome APIs is used only for Header Forge's stated purpose and in accordance with the Chrome Web Store User Data Policy, including the Limited Use requirements. The privacy policy was last updated on 26 July 2026. [Contact the developer](https://nicholasgriffin.dev/contact) with privacy questions.

## Limitations

- Chrome protects or specially handles some headers, so not every change is permitted.
- Service workers, `CacheStorage` and cached responses can hide changes. Disable the cache in Chrome DevTools when testing if necessary.
- Chrome only permits **Append** for a defined set of request headers. Header Forge flags unsupported request headers in the popup.
- Chrome 120 or later is required.

## Development

Header Forge has no runtime dependencies or build step. Run the extension tests with:

```sh
npm test
```

Run the website checks with:

```sh
pnpm --dir website install
pnpm --dir website check
```

## Licence

MIT. See `LICENSE`.
