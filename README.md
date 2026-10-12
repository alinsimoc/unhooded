# Unhooded

Desktop-style devtools for your phone's browser, in one bookmark. Console, Elements (with box model and live CSS editing), Network and Storage. No laptop, no cable, no app, and it works even on sites with strict security policies.

## Install

Open the site on your phone and follow the 30-second install: bookmark the page, copy the code, and replace the bookmark's address with it. Then open any site and tap the bookmark.

Works in Safari and Chrome.

## Develop

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 and tap **See it live on this page** to run `unhooded.js` straight from the folder. After changing it, rebuild the bookmarklet that the install page hands out:

```bash
node build.mjs
```

The build minifies `unhooded.js`, encodes it as a `javascript:` URL and writes it, along with its size, into `index.html`. On Netlify it also adds a loader that fetches the latest version, falling back to the embedded copy on sites that block it.

## License

MIT
