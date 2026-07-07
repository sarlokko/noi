# Vetrina Fotografica

Sito vetrina per mostrare le migliori foto scattate con reflex.

## Setup

```bash
npm install
npm run import -- "C:\percorso\alla\tua\cartella\foto"
npm run serve
```

Apri http://localhost:3000

## Cosa fa l'import

1. Scansiona tutte le JPG/PNG/TIF nella cartella (anche sottocartelle)
2. **Seleziona automaticamente** le migliori (risoluzione, nitidezza, qualità file)
3. Genera versioni **web** (WebP), **anteprime** e copia **originali** per stampa
4. Crea la gallery in `public/data/gallery.json`

## Personalizza

Modifica `config.json` e `public/config.json`:
- `siteTitle` — titolo del sito
- `photographer` — tuo nome
- `tagline` — sottotitolo
- `maxGalleryPhotos` — quante foto in vetrina (default 24)

## Stampa

- Clic su una foto → **Scarica originale** (file ad alta risoluzione)
- **Stampa** apre la finestra di stampa del browser
- Tab **Stampa** con formati consigliati

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
