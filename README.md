# Unhooded

Desktop-style devtools for your phone's browser, in one bookmark. Console, Elements (with box model and live CSS editing), Network and Storage. No laptop, no cable, no app, and it works even on sites with strict security policies.

## Install

Open the site on your phone and follow the 30-second install: bookmark the page, copy the code, and replace the bookmark's address with it. Then open any site and tap the bookmark.

Works in Safari and Chrome.

## Develop

```bash
npm run dev
```

Open http://localhost:3000 and tap **See it live on this page** to run `unhooded.js` straight from the folder. Saving any file reloads the page (the panel reopens if it was open), and saving `unhooded.js` also rebuilds the bookmarklet the install page hands out. `npm run build` does a one-off build.

The build minifies `unhooded.js`, encodes it as a `javascript:` URL and writes it, along with its size, into `index.html`. On Netlify it also adds a loader that fetches the latest version, falling back to the embedded copy on sites that block it.

## Versioning

The version lives in `package.json` (semver). The build copies it into `unhooded.js`, so the panel's first console line and `window.__unhooded.version` report it. To release:

```bash
npm version patch --no-git-tag-version && npm run build
```

Use `minor` or `major` instead of `patch` as needed; drop `--no-git-tag-version` to also get a commit and `vX.Y.Z` tag.

## License

MIT
