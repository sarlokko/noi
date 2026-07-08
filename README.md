# Vetrina Fotografica

Sito vetrina per mostrare le migliori foto scattate con reflex.

## Setup

```bash
npm install
npm run family:verify
npm run import -- "C:\percorso\alla\tua\cartella\foto"
npm run serve
```

Apri http://localhost:3000

## Cosa fa l'import

1. Scansiona tutte le JPG/PNG/TIF nella cartella (anche sottocartelle)
2. **Filtra solo la famiglia** (Marco, Laura, Luca, Giorgia) se ci sono riferimenti in `config/family/`
3. **Seleziona automaticamente** le migliori (risoluzione, nitidezza, qualità file)
4. Genera versioni **web** (WebP), **anteprime** e copia **originali** per stampa
5. Crea la gallery in `public/data/gallery.json`

### Riferimenti famiglia (opzionale ma consigliato)

```bash
# Da foto singole
npm run family:setup -- marco "E:\100_FUJI\DSCF1234.jpg"

# Da foto di gruppo (ordine volti: sinistra → destra)
npm run family:setup -- --group "E:\foto\pisa.jpg" marco luca giorgia laura
```

I file vanno in `config/family/` (marco.jpg, laura.jpg, luca.jpg, giorgia.jpg).

## Personalizza

Modifica `config.json` e `public/config.json`:
- `siteTitle` — titolo del sito
- `photographer` — tuo nome
- `tagline` — sottotitolo
- `maxGalleryPhotos` — quante foto in vetrina (default 50)

## Stampa

- Clic su una foto → **Scarica originale** (file ad alta risoluzione)
- **Stampa** apre la finestra di stampa del browser
- Tab **Stampa** con formati consigliati

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
