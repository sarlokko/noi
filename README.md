# Vetrina Fotografica

Sito vetrina per mostrare le migliori foto scattate con reflex.

## Setup

```bash
npm install
npm run family:verify
npm run family:test
```

### Sorgente foto

**Amazon Photos** (consigliato se le reflex sono già caricate):

1. Crea il file cookie: `npm run amazon:setup` (oppure su Windows: `copy config\amazon-photos-cookies.example.json config\amazon-photos-cookies.json`)
2. Accedi a [amazon.it/photos](https://www.amazon.it/photos), apri DevTools (F12) → Application → Cookies → `amazon.it`
3. Copia i valori di `ubid-acbit`, `at-acbit` e `session-id`
4. In `config.json` imposta `"source": "amazon-photos"`
5. Verifica: `npm run amazon:verify`
6. Import: `npm run import:scan` (prima volta) poi `npm run import:update`

**Cartella locale** (scheda reflex / disco):

```bash
# In config.json: "source": "local" oppure ometti "source"
npm run import -- "C:\percorso\alla\tua\cartella\foto"
```

```bash
npm run serve
```

Apri http://localhost:3000

## Cosa fa l'import

1. **Amazon Photos**: scarica le foto in `.cache/amazon-photos/` (sync incrementale), oppure scansiona la cartella locale
2. **Filtra solo la famiglia** (Marco, Laura, Luca, Giorgia) con pre-filtro veloce + cache
3. **Seleziona automaticamente** le migliori (risoluzione, nitidezza, qualità file)
4. Genera versioni **web** (WebP), **anteprime** e copia **originali** per stampa
5. Crea la gallery in `public/data/gallery.json`

### Velocità import (filtro famiglia)

**Problema:** analizzare migliaia di foto con riconoscimento volti richiede ore.

**Soluzione — indice incrementale:**

| Comando | Quando usarlo | Tempo |
|---------|---------------|-------|
| `npm run import:scan` | Prima volta (indicizza tutto) | 1–2 ore, una sola volta |
| `npm run import:update` | Ogni mese con nuove foto | **pochi minuti** |
| `npm run amazon:sync` | Solo scaricare da Amazon (senza gallery) | dipende da quante nuove |
| `import-auto.bat` | Doppio click — sceglie automaticamente | scan o update |

L'indice resta in `.cache/photo-index.json`. Se interrompi la scansione, riprende da dove era (salva ogni 50 foto).

### Cookie Amazon Photos

I cookie di sessione scadono periodicamente. Se vedi errori 401, aggiorna `config/amazon-photos-cookies.json` con valori freschi dal browser. Il file è in `.gitignore` e non va mai committato.

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
- `source` — `"amazon-photos"` o cartella locale (ometti o `"local"`)
- `amazonPhotos.cookiesFile` — percorso cookie (default `config/amazon-photos-cookies.json`)
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
