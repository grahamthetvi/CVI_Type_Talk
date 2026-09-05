# CVI Type Talker

An accessible, browser-based typing app for learners with **Cortical Visual Impairment (CVI)**. Students type letters and words, hear them spoken with the **Web Speech API**, and see **real images** matched to completed words. Settings support high-contrast display, timing controls, optional background removal, profanity filtering, approved word lists, and **Teacher Mode** (guided spelling with audio prompts).

**Live site:** [https://cvitypetalk.com](https://cvitypetalk.com)

The interface, spoken prompts, and camera trigger words (for example *me* / *you*, *yo* / *tú*, *moi* / *toi*) are available in **English, Spanish, French, and Arabic**. A physical keyboard is required.

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

Profanity-filter logic, the local English word dictionary, and locale key-tree parity are covered by small Node scripts:

```bash
node run-tests.js
```

The bundled English word list and multilingual profanity list can be regenerated with:

```bash
node scripts/build-word-lists.js
```

## Deployment

Pushes to the `main` branch trigger the **Deploy to GitHub Pages** workflow. The site hostname is configured via `CNAME` (`cvitypetalk.com`).

## External services and data

When images are shown for typed words, the browser may request:

- **[Wikimedia Commons API](https://commons.wikimedia.org/wiki/Commons:API)** — image search and metadata.

Word validation (English UI only) uses a **bundled offline English word list** (~47,000 common words from [FrequencyWords](https://github.com/hermitdave/FrequencyWords)) plus teacher-configured extras (preload list, allowed words, custom local images, student name). Spanish, French, and Arabic skip this check and send finished words to Wikimedia instead. No external dictionary API is called.

Profanity filtering uses a bundled list generated from [LDNOOBWV2](https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2) for English, Arabic, Spanish, and French. Teachers can add extra blocked words in Settings.

Optional **background removal** uses [@imgly/background-removal](https://github.com/imgly/background-removal-js) loaded from **jsDelivr**; the model downloads client-side on first use (on the order of tens of megabytes) and is cached by the browser.

Speech uses each visitor’s **local text-to-speech voices** (browser-dependent) matching the selected UI language when a voice is installed. Settings and one-time consent are stored in **`localStorage`** on the user’s device only.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
