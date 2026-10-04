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
- Thrown errors use `ConvexError` so the message reaches the client on a production deployment.

## Deploy

1. Run `npx convex deploy` to push the backend to production.
2. Deploy the frontend to Vercel with build command `npx convex deploy --cmd "npm run build"` and the `CONVEX_DEPLOY_KEY` environment variable set. That command also sets `VITE_CONVEX_URL` for the build.
