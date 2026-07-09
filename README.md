# Vetrina Fotografica

Sito vetrina per mostrare le migliori foto scattate con reflex.

## Altri progetti

- **[Magna e tasi](magna-e-tasi/)** — sito/app per ricette di cucina italiana

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

**Problema:** analizzare ~3000 foto con riconoscimento volti richiede ore.

**Soluzione — indice incrementale:**

| Comando | Quando usarlo | Tempo |
|---------|---------------|-------|
| `npm run import:scan -- "E:\100_FUJI"` | Prima volta (indicizza tutto) | 1–2 ore, una sola volta |
| `npm run import:update` | Ogni mese con nuove foto | **pochi minuti** |
| `import-auto.bat` | Doppio click — sceglie automaticamente | scan o update |

L'indice resta in `.cache/photo-index.json`. Se interrompi la scansione, riprende da dove era (salva ogni 50 foto).

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
- `familyFilter.useIndex` — indice incrementale (default true)
- `familyFilter.matchDetectMaxSize` — risoluzione analisi volti (default 640)

## Stampa

- Clic su una foto → **Scarica originale** (file ad alta risoluzione)
- **Stampa** apre la finestra di stampa del browser
- Tab **Stampa** con formati consigliati

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
