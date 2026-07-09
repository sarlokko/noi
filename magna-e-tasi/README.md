# Magna e tasi

Sito e app per ricette di cucina italiana — dal Veneto e oltre.

## Avvio rapido

```bash
cd magna-e-tasi
npm run serve
```

Apri http://localhost:3001

## Struttura

- `public/data/recipes.json` — ricette (titolo, ingredienti, procedimento, categorie)
- `public/css/style.css` — stili
- `public/js/app.js` — logica dell'app (ricerca, filtri, dettaglio ricetta)

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
  "emoji": "🍚"
}
```

## Pubblicazione

Carica la cartella `public/` su GitHub Pages, Netlify o qualsiasi hosting statico.
