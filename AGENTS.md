# AGENTS.md

## Cursor Cloud specific instructions

**Product:** `vetrina-foto` ("Vetrina Fotografica") — a static, client-side photo gallery site (Italian) served from `public/`. There is no backend, database, or API at runtime.

### Services
- **Static gallery server** — the only runtime service. Start with `npm run serve` (runs `npx serve public -l 3000`), then open http://localhost:3000. The repo ships a populated `public/data/gallery.json` plus images under `public/photos`, `public/thumbs`, `public/originals`, so the gallery renders without running the import pipeline.
  - The page uses `fetch()` for `config.json` and `data/gallery.json`, so it must be viewed over HTTP (the `serve` command), not via `file://`.

### Offline tooling (not required to run the site)
- `npm run import -- "<folder>"` (`scripts/import-photos.js`), `npm run family:setup`, `npm run optimize` are local CLI tools for regenerating the gallery from source photos. They rely on native deps (`sharp`, `@tensorflow/tfjs-node`, `canvas`, `@vladmandic/face-api`) and on source photos that are not in the repo (`config.json` `sourceFolder` points to a Windows path). Skip these unless specifically working on the import pipeline.

### Lint / test / build
- There is no lint config, no test suite, and no build step (vanilla HTML/CSS/JS, no bundler). Deployment is just publishing the `public/` folder (see `.github/workflows/deploy.yml` → GitHub Pages).
