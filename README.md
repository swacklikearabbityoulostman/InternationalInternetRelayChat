# International Internet Relay Chat (IIRC)

A classic-inspired, browser-based IRC client frontend.

## Run locally

Open `index.html` in Firefox or another modern browser. The current version is a frontend prototype: it simulates connecting, joining channels, and sending messages locally. It does not connect to a real IRC network yet.

## Publish with GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open the **Actions** tab and wait for the `Deploy IIRC to GitHub Pages` workflow to finish.
4. GitHub will show the published Pages URL under **Settings → Pages**.

Future pushes to `main` will automatically redeploy the site.

## Project files

- `index.html` — application structure
- `styles.css` — full-screen classic charcoal/grey interface
- `app.js` — frontend behavior and local IRC-style command simulation
- `.github/workflows/pages.yml` — automatic GitHub Pages deployment

## Real IRC connectivity

GitHub Pages only hosts static files. A browser cannot open a raw IRC TCP connection directly, so real network access will require a separate WebSocket-compatible IRC service or a backend bridge. Do not put IRC passwords, API keys, or other secrets in this repository or frontend JavaScript.
