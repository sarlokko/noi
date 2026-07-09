# Magna e tasi

Sito e app per ricette di cucina italiana — dal Veneto e oltre.

## Avvio rapido

```bash
cd magna-e-tasi
npm run serve
```

Apri http://localhost:3001

## Struttura

- `public/data/recipes.json` — ricette con video, ingredienti e procedimento
- `public/css/style.css` — bowl giapponese, carousel 3D e layout video/dettaglio
- `public/js/app.js` — rotazione ricette nella bowl e vista affiancata

## Interfaccia

1. **Bowl donburi** — le ricette girano all'interno di una grande bowl giapponese
2. **Selezione** — clicca una ricetta (o usa le frecce) per aprirla
3. **Vista ricetta** — video a sinistra, ingredienti e procedimento a destra

## Aggiungere una ricetta

Modifica `public/data/recipes.json` e aggiungi un oggetto con:

```json
{
  "id": "risotto-radicchio",
  "title": "Risotto al radicchio",
  "category": "primi",
  "difficulty": "media",
  "prepMinutes": 15,
  "cookMinutes": 25,
  "servings": 4,
  "tags": ["vegetariano", "veneto"],
  "description": "Breve descrizione della ricetta.",
  "ingredients": ["200 g riso Carnaroli", "..."],
  "steps": ["Trita la cipolla...", "..."],
  "emoji": "🍚",
  "video": {
    "type": "youtube",
    "id": "VIDEO_ID_YOUTUBE",
    "caption": "Didascalia del video"
  }
}
```

Per video locali usa `"type": "mp4"` e `"src": "videos/nome.mp4"`.

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
