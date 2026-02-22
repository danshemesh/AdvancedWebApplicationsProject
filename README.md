# Rebook

Application for sharing books between people — post books to give away or recommend, comment, and connect.

## Project structure

- **backend/** — Node.js/Express API (TypeScript). Auth, users, posts, comments, Swagger, Jest.
- **client/** — React (Vite + TypeScript) frontend.

## Quick start

### Backend

1. Go to the backend and create your env file:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   API: http://localhost:3000  
   Swagger: http://localhost:3000/api-docs

### Client

1. Optional: set the API URL (default is http://localhost:3000):

   ```bash
   cd client
   cp .env.example .env
   ```

   Edit `client/.env` and set `VITE_API_URL` if your backend runs elsewhere.

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open the URL shown in the terminal (e.g. http://localhost:5173).

## Tests

- Backend: `cd backend && npm test`
- Client: `cd client && npm run build` (checks TypeScript)

## Verify everything works

### 1. Backend

1. **Create env file** (if you haven’t):

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `.env`: set `MONGODB_URI` (your local MongoDB URL), `JWT_SECRET`, and `JWT_REFRESH_SECRET` (any long random strings).

2. **Install and run**:

   ```bash
   npm install
   npm run dev
   ```

   You should see “Connected to MongoDB” and “Server running on port 3000”.

3. **Run tests** (in another terminal):

   ```bash
   cd backend
   npm test
   ```

   All 81 tests should pass.

4. **Check API** (optional): open http://localhost:3000/api-docs — Swagger UI should load.

### 2. Client

1. **Install and run** (with backend still running):

   ```bash
   cd client
   npm install
   npm run dev
   ```

   Open the URL shown (e.g. http://localhost:5173).

2. **Quick build check** (optional):

   ```bash
   cd client
   npm run build
   ```

   Should complete without errors.

### 3. End-to-end check

1. Backend running on port 3000, client running (e.g. port 5173).
2. In the browser: **Register** a new user (username, email, password).
3. You should be logged in and see the **Feed** (may be empty).
4. Open **My profile** — you should see your username and “No posts yet”.
5. Optionally: edit your **username** or **profile picture** and save; the page should update.
6. **Log out** — you should be redirected to Log in.
7. **Log in** again with the same email/password — you should be back on the feed.

If all of the above succeed, the setup is working.
