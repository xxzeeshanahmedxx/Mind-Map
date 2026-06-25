# Personal Mind Map Canvas

A private desktop mind-map website built with **Vite**, **Tailwind CSS**, and **vanilla JavaScript**.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Features

- Desktop mind-map canvas
- Drag, pan, zoom
- Create, duplicate, delete, connect nodes
- Node formatting: colors, font, font size, bold, italic, underline, alignment, shape, border, radius, opacity, padding, shadow
- Connector formatting: color, thickness, curved/straight/elbow, dashed
- Canvas color and grid toggle
- Search nodes
- Outline-to-nodes generator
- Local browser save/load
- JSON export/import
- Print/save as PDF

## Cloudflare D1 setup

This project includes a Cloudflare Pages Function at `/api/map` that stores the single user's map in D1.

1. In Cloudflare, create a D1 database named `mind-map-db`.
2. In Cloudflare Pages → your project → Settings → Functions → D1 database bindings, add:

```txt
Variable name: DB
D1 database: mind-map-db
```

3. Run `schema.sql` on the database once. In Cloudflare dashboard you can paste it into the D1 console, or with Wrangler:

```bash
npx wrangler d1 execute mind-map-db --file=./schema.sql --remote
```

4. Deploy Pages again.

The app is single-user: it stores one map row with id `default`. The Save button saves to D1, localStorage, and a local file/download backup.
