import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { Chess } from "chess.js";
import { Doc } from "./_generated/dataModel";
import { generateRoomCode } from "./utils";
import { requireUser, requireGame, findActiveGame, getUserByToken, getSeatPresence, deleteGameWithMessages } from "./lib/helpers";
import { gameStatus, gameWinner, playerColor, seatColor } from "./lib/validators";

const WAITING_TTL_MS = 30 * 60 * 1000;
const IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const FINISHED_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 100;
const HOST_FRESH_MS = 60 * 1000; // a waiting host heartbeats every 20s

const seat = v.object({ gameId: v.id("games"), roomId: v.string(), color: seatColor });

export const create = mutation({
  args: { token: v.string() },
  returns: v.object({ gameId: v.id("games"), roomId: v.string() }),
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    if (await findActiveGame(ctx, user._id)) throw new ConvexError("You already have an active game");

    let roomId = generateRoomCode();
    for (let i = 0; i < 5; i++) {
      const taken = await ctx.db.query("games").withIndex("by_room_code", (q) => q.eq("roomId", roomId)).first();
      if (!taken) break;
      roomId = generateRoomCode();
    }

    const now = Date.now();
    const gameId = await ctx.db.insert("games", {
      roomId,
      pgn: "",
      playerWhite: user._id,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    });
    return { gameId, roomId };
  },
});

export const join = mutation({
  args: { token: v.string(), roomId: v.optional(v.string()) },
  returns: v.union(seat, v.null()),
  handler: async (ctx, { token, roomId }) => {
    const user = await requireUser(ctx, token);

    let game: Doc<"games"> | null = null;
    if (roomId) {
      const code = roomId.toUpperCase().trim();
      game = await ctx.db.query("games").withIndex("by_room_code", (q) => q.eq("roomId", code)).first();
      if (!game) throw new ConvexError("Room not found");
    } else {
      // Quick match: oldest waiting game whose host checked in recently. isOnline alone lags up to
      // 3 minutes behind a host who closed the tab, which would seat the joiner across from nobody.
      const waiting = await ctx.db
        .query("games")
        .withIndex("by_status", (q) => q.eq("status", "waiting"))
        .take(20);
      const cutoff = Date.now() - HOST_FRESH_MS;
      for (const candidate of waiting) {
        if (candidate.playerWhite === user._id) continue;
        const host = await getSeatPresence(ctx, candidate.playerWhite);
        if (host.online && host.lastSeen > cutoff) {
          game = candidate;
          break;
        }
      }
    }

    if (!game) return null;

    if (game.playerWhite === user._id || game.playerBlack === user._id) {
      return { gameId: game._id, roomId: game.roomId, color: game.playerWhite === user._id ? ("w" as const) : ("b" as const) };
    }

    if (game.status === "finished") throw new ConvexError("That game has already ended");
    if (await findActiveGame(ctx, user._id)) throw new ConvexError("You already have an active game");

    if (!game.playerBlack && game.status === "waiting") {
      await ctx.db.patch("games", game._id, { playerBlack: user._id, status: "in-progress", updatedAt: Date.now() });
      return { gameId: game._id, roomId: game.roomId, color: "b" as const };
    }

    return { gameId: game._id, roomId: game.roomId, color: "s" as const };
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  returns: v.union(
    v.object({
      _id: v.id("games"),
      roomId: v.string(),
      pgn: v.string(),
      fen: v.string(),
      turn: playerColor,
      status: gameStatus,
      winner: v.optional(gameWinner),
      whiteName: v.string(),
      blackName: v.string(),
      isGameOver: v.boolean(),
      isCheck: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;

    const white = await ctx.db.get("users", game.playerWhite);
    const black = game.playerBlack ? await ctx.db.get("users", game.playerBlack) : null;

    const chess = new Chess();
    if (game.pgn) {
      try {
        chess.loadPgn(game.pgn);
      } catch {
        // A corrupt PGN falls back to the starting position
      }
    }

    return {
      _id: game._id,
      roomId: game.roomId,
      pgn: game.pgn,
      fen: chess.fen(),
      turn: chess.turn(),
      status: game.status,
      winner: game.winner,
      whiteName: white?.name ?? "Unknown",
      blackName: black?.name ?? "Waiting...",
      isGameOver: chess.isGameOver(),
      isCheck: chess.isCheck(),
    };
  },
});

// Heartbeat state of both seats. Apart from getGame so a heartbeat re-runs only this small query.
export const getPresence = query({
  args: { gameId: v.id("games") },
  returns: v.union(
    v.object({
      whiteSeen: v.number(),
      blackSeen: v.optional(v.number()),
      whiteOnline: v.boolean(),
      blackOnline: v.boolean(),
      // Server time of the reading, so a wrong phone clock does not matter
      serverNow: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;
    const white = await getSeatPresence(ctx, game.playerWhite);
    const black = game.playerBlack ? await getSeatPresence(ctx, game.playerBlack) : null;
    return {
      whiteSeen: white.lastSeen,
      blackSeen: black?.lastSeen,
      whiteOnline: white.online,
      blackOnline: black?.online ?? false,
      serverNow: Date.now(),
    };
  },
});

export const makeMove = mutation({
  args: {
    token: v.string(),
    gameId: v.id("games"),
    move: v.object({ from: v.string(), to: v.string(), promotion: v.optional(v.string()) }),
  },
  returns: v.null(),
  handler: async (ctx, { token, gameId, move }) => {
    const user = await requireUser(ctx, token);
    const game = await requireGame(ctx, gameId);

    if (game.status !== "in-progress") throw new ConvexError("Game not active");

    const isWhite = game.playerWhite === user._id;
    const isBlack = game.playerBlack === user._id;
    if (!isWhite && !isBlack) throw new ConvexError("Not a player");

    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);

    const turn = chess.turn();
    if ((turn === "w" && !isWhite) || (turn === "b" && !isBlack)) throw new ConvexError("Not your turn");

    try {
      chess.move(move); // chess.js throws on an illegal move
    } catch {
      throw new ConvexError("Invalid move");
    }

    const over = chess.isGameOver();
    await ctx.db.patch("games", game._id, {
      pgn: chess.pgn(),
      updatedAt: Date.now(),
      ...(over && {
        status: "finished" as const,
        winner: chess.isCheckmate() ? (turn === "w" ? ("white" as const) : ("black" as const)) : ("draw" as const),
      }),
    });
    return null;
  },
});

export const leaveGame = mutation({
  args: { token: v.string(), gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { token, gameId }) => {
    const user = await requireUser(ctx, token);
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;

    const isWhite = game.playerWhite === user._id;
    const isBlack = game.playerBlack === user._id;
    if (!isWhite && !isBlack) return null; // spectators just disconnect

    if (game.status === "waiting") {
      await deleteGameWithMessages(ctx, game._id);
      return null;
    }

    const whiteLeft = isWhite || !!game.whiteLeft;
    const blackLeft = isBlack || !!game.blackLeft;

    if (game.status === "in-progress") {
      // Leaving mid-game is a resignation
      await ctx.db.patch("games", game._id, {
        status: "finished",
        winner: isWhite ? "black" : "white",
        whiteLeft,
        blackLeft,
        updatedAt: Date.now(),
      });
    } else if (whiteLeft && blackLeft) {
      await deleteGameWithMessages(ctx, game._id);
    } else {
      await ctx.db.patch("games", game._id, { whiteLeft, blackLeft, updatedAt: Date.now() });
    }
    return null;
  },
});

export const getActiveGame = query({
  args: { token: v.string() },
  returns: v.union(seat, v.null()),
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return null;

    const active = await findActiveGame(ctx, user._id);
    if (!active) return null;
    return { gameId: active.game._id, roomId: active.game.roomId, color: active.color };
  },
});

// Runs from a cron. Expires abandoned lobbies, ends idle games, and deletes old finished games.
export const cleanupOldGames = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    let more = false;

    const staleWaiting = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting").lt("createdAt", now - WAITING_TTL_MS))
      .take(CLEANUP_BATCH);
    for (const game of staleWaiting) await deleteGameWithMessages(ctx, game._id);
    if (staleWaiting.length === CLEANUP_BATCH) more = true;

    // Oldest first, so one batch covers every idle game that matters
    const inProgress = await ctx.db
      .query("games")
      .withIndex("by_status_updated", (q) => q.eq("status", "in-progress"))
      .take(CLEANUP_BATCH);
    for (const game of inProgress) {
      if ((game.updatedAt ?? game.createdAt) < now - IDLE_TTL_MS) {
        await ctx.db.patch("games", game._id, { status: "finished", winner: "abandoned", updatedAt: now });
      }
    }

    const finished = await ctx.db
      .query("games")
      .withIndex("by_status_updated", (q) => q.eq("status", "finished"))
      .take(CLEANUP_BATCH);
    let deletedFinished = 0;
    for (const game of finished) {
      if ((game.updatedAt ?? game.createdAt) < now - FINISHED_TTL_MS) {
        await deleteGameWithMessages(ctx, game._id);
        deletedFinished++;
      }
    }
    if (deletedFinished === CLEANUP_BATCH) more = true;

    if (more) await ctx.scheduler.runAfter(0, internal.games.cleanupOldGames, {});
    return null;
  },
});
