# Vetrina Fotografica

Sito vetrina per mostrare le migliori foto scattate con reflex.

## Setup

```bash
npm install
npm run family:verify
npm run family:test
npm run import -- "C:\percorso\alla\tua\cartella\foto"
npm run serve
```

Apri http://localhost:3000

## Cosa fa l'import

1. Scansiona tutte le JPG/PNG/TIF nella cartella (anche sottocartelle)
2. **Filtra solo la famiglia** (Marco, Laura, Luca, Giorgia) con pre-filtro veloce + cache
3. **Seleziona automaticamente** le migliori (risoluzione, nitidezza, qualità file)
4. Genera versioni **web** (WebP), **anteprime** e copia **originali** per stampa
5. Crea la gallery in `public/data/gallery.json`

### Velocità import (filtro famiglia)

L'analisi di ~3000 foto richiedeva 1–2 ore; ora usa tre accellerazioni:

1. **Pre-filtro volti** — TinyFaceDetector a bassa risoluzione (512px) scarta paesaggi e foto senza volti in millisecondi
2. **Parallelismo** — analizza più foto in parallelo (`concurrency` in `config.json`, default 4)
3. **Cache** — risultati salvati in `.cache/family-scores.json`; un secondo import salta le foto già analizzate

Tempi indicativi su PC medio: **15–40 min** al primo giro, **pochi minuti** se rilanci con cache attiva.

Se `git pull` è lento, è perché `public/` contiene molte immagini. Per aggiornare solo gli script:

```bash
git pull --depth 1
# oppure, dopo il primo clone completo, evita di committare public/ finché la gallery non è pronta
```

### Riferimenti famiglia (opzionale ma consigliato)

```bash
# Da foto singole
npm run family:setup -- marco "E:\100_FUJI\DSCF1234.jpg"

# Da foto di gruppo (ordine volti: sinistra → destra)
npm run family:setup -- --group "E:\foto\pisa.jpg" marco luca giorgia laura
```

I file vanno in `config/family/` (marco.jpg, laura.jpg, luca.jpg, giorgia.jpg).

### Verifica riconoscimento (prima dell'import)

```bash
npm run family:test
```

Controlla che ogni riferimento si riconosca da solo (✅ marco.jpg → marco) e che nel campione compaiano foto famiglia. Il report va in `reports/family-test-report.txt`.

Su Windows, doppio click su **`import-auto.bat`**: aggiorna il codice, verifica, testa e poi chiede conferma per l'import.

## Personalizza

Modifica `config.json` e `public/config.json`:
- `siteTitle` — titolo del sito
- `photographer` — tuo nome
- `tagline` — sottotitolo
- `maxGalleryPhotos` — quante foto in vetrina (default 50)
- `familyFilter.concurrency` — foto analizzate in parallelo (default 4)
- `familyFilter.useCache` — riusa analisi precedenti (default true)

## Stampa

- Clic su una foto → **Scarica originale** (file ad alta risoluzione)
- **Stampa** apre la finestra di stampa del browser
- Tab **Stampa** con formati consigliati

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
