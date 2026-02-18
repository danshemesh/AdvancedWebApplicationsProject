# Rebook — Backend

Node.js/Express API for the Rebook app.

## Setup

1. Copy the environment file and set your values:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - **MONGODB_URI** — MongoDB connection string (local; use username/password on college server).
   - **JWT_SECRET** and **JWT_REFRESH_SECRET** — Strong random strings for tokens.

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   API: `http://localhost:3000` (or the `PORT` in `.env`).  
   Swagger: `http://localhost:3000/api-docs`.

## Scripts

- `npm run dev` — Start with ts-node.
- `npm run build` — Compile TypeScript to `dist/`.
- `npm start` — Run `dist/app.js` (after build).
- `npm test` — Run Jest tests.
