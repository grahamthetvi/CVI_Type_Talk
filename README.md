# CVI Type Talker

An accessible, browser-based typing app for learners with **Cortical Visual Impairment (CVI)**. Students type letters and words, hear them spoken with the **Web Speech API**, and see **real images** matched to completed words. Settings support high-contrast display, timing controls, optional background removal, profanity filtering, approved word lists, and **Teacher Mode** (guided spelling with audio prompts).

**Live site:** [https://cvitypetalk.com](https://cvitypetalk.com)

## Using the app

Open the live site (or run locally as below). The first screen explains keyboard shortcuts, Teacher Mode, and that a **physical keyboard** is required. A **Settings** guide in the app describes every customization option. No install or account is needed.

## Tech stack

- **Vanilla** HTML, CSS, and JavaScript (no build step or package manager).
- **GitHub Pages** deploys the repository as static files (see `.github/workflows/deploy.yml`).

## Running locally

Because the app loads ES modules (for example optional background removal from a CDN), serve the folder over HTTP instead of opening `index.html` as a `file://` URL.

Example:

```bash
npx --yes serve .
```

Then open the URL the tool prints (often `http://localhost:3000`).

## Tests

Profanity-filter logic is covered by a small Node script:

```bash
node run-tests.js
```

## Deployment

Pushes to the `main` branch trigger the **Deploy to GitHub Pages** workflow. The site hostname is configured via `CNAME` (`cvitypetalk.com`).

## External services and data

When images are shown for typed words, the browser may request:

- **[Wikimedia Commons API](https://commons.wikimedia.org/wiki/Commons:API)** — image search and metadata.
- **[Free Dictionary API](https://dictionaryapi.dev/)** — checks whether a string looks like a real English word before fetching images.

Optional **background removal** uses [@imgly/background-removal](https://github.com/imgly/background-removal-js) loaded from **jsDelivr**; the model downloads client-side on first use (on the order of tens of megabytes) and is cached by the browser.

Speech uses each visitor’s **local text-to-speech voices** (browser-dependent). Settings and one-time consent are stored in **`localStorage`** on the user’s device only.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
