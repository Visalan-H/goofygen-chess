# Realtime multiplayer chess

React, Convex, Tailwind and chessground. Two players, a room code or quick match, and a chat with GIFs.

## Run locally

```bash
npm install
npx convex dev   # first run asks you to log in, then writes VITE_CONVEX_URL to .env.local
npm run dev      # in a second terminal
```

## How it works

- Guests have no accounts. The browser stores a random token in localStorage, and Convex maps it to a user.
- The server owns the game. `games.makeMove` replays the PGN with chess.js and rejects illegal or out-of-turn moves.
- Leaving a game in progress counts as a resignation.
- Crons (`convex/crons.ts`) mark users offline when their heartbeat stops, expire lobbies after 30 minutes, end games idle for 2 hours, and delete finished games after 24 hours.
- The client heartbeats every 20s during a game and every 60s elsewhere, and again when the tab becomes visible or the network returns. `games.getGame` returns each seat's `lastSeen` plus the server clock, and the opponent's bar shows Online, then Disconnected after 90s without a beat.
- `Layout` shows a reconnecting bar when the Convex socket stays down for 1.5s. Convex reconnects on its own and the game resumes from the stored token.
- Phones get a one-line chat bar under the board that slides up into a sheet. Landscape and desktop show chat inline.
- Thrown errors use `ConvexError` so the message reaches the client on a production deployment.

## Deploy

Backend changes reach production only through `npx convex deploy`. A frontend that reads new fields should tolerate them being missing until that deploy lands.


1. Run `npx convex deploy` to push the backend to production.
2. Deploy the frontend to Vercel with build command `npx convex deploy --cmd "npm run build"` and the `CONVEX_DEPLOY_KEY` environment variable set. That command also sets `VITE_CONVEX_URL` for the build.
