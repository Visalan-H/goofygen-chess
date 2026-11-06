# Realtime multiplayer chess

React, Convex, Tailwind and chessground. Two players, a room code or quick match, and a chat with GIFs.

## Run locally

```bash
npm install
npx convex dev   # first run asks you to log in, then writes VITE_CONVEX_URL to .env.local
npm run dev      # in a second terminal
```

Before a PR, run `npm run typecheck` and `npm run lint`. The lint config enforces the Convex rules, such as bounded reads, no duplicate indexes and no top-of-hour crons.

## How it works

- Guests have no accounts. The browser stores a random token in localStorage, and Convex maps it to a user.
- The server owns the game. `games.makeMove` replays the PGN with chess.js and rejects illegal or out-of-turn moves.
- Leaving a game in progress counts as a resignation.
- A pawn reaching the last rank opens a picker for queen, rook, bishop or knight. The server accepts any promotion piece. Cancelling snaps the pawn back.
- If the opponent stays offline, the cron marks them offline after 3 to 4 minutes and the remaining player gets a Claim win button. `games.claimWin` ends the game in their favor only when the opponent has no live presence and their last heartbeat is over 10 minutes old. Earlier clicks show how many minutes remain.
- Crons (`convex/crons.ts`) mark users offline when their heartbeat stops, expire lobbies after 30 minutes, end games idle for 2 hours, delete finished games after 24 hours, and delete guests who have been offline for 30 days and sit in no game.
- Quick match skips hosts who checked in more than 60 seconds ago and deletes the lobbies of hosts the cron already marked offline.
- A blank name input never renames a stored guest. Chat allows 5 messages per player per 10 seconds and 100 per player per game, inside a 300 message cap.
- The client heartbeats every 20s during a game and every 60s elsewhere, and again when the tab becomes visible or the network returns. Heartbeats write only a small `presence` table, which exists for a user only while they are online, so they never re-send the game or chat. `games.getPresence` returns each seat's heartbeat stamp, and the opponent's bar shows Online, then Disconnected after 90s without a new stamp.
- `Layout` shows a reconnecting bar when the Convex socket stays down for 1.5s. Convex reconnects on its own and the game resumes from the stored token.
- If a heartbeat hangs for 10 seconds on a socket that claims to be connected, the page reloads and rejoins the game. A phone that slept can hold a dead socket for up to 60 seconds. The reload is skipped while the chat input holds text.
- Phones get a one-line chat bar under the board that slides up into a sheet. Landscape and desktop show chat inline.
- Thrown errors use `ConvexError` so the message reaches the client on a production deployment.

## Deploy

Backend changes reach production only through `npx convex deploy`. A frontend that reads new fields should tolerate them being missing until that deploy lands.


1. Run `npx convex deploy` to push the backend to production. Do this before merging a frontend that calls a new function.
2. Merge to `main`. Vercel builds the frontend with `tsc && vite build` and reads `VITE_CONVEX_URL` from its environment variables. It never deploys the backend, and no `CONVEX_DEPLOY_KEY` is set on Vercel.
