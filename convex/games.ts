import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Chess } from "chess.js";
import { generateRoomCode } from "./utils";
import { requireUser, requireGame, cleanupUserIfIdle, userHasActiveGames } from "./lib/helpers";

export const create = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    if (await userHasActiveGames(ctx, user._id)) throw new Error("You already have an active game");
    const roomId = generateRoomCode();
    const gameId = await ctx.db.insert("games", {
      roomId,
      pgn: "",
      playerWhite: user._id,
      playerBlack: undefined,
      status: "waiting",
      createdAt: Date.now(),
    });
    return { gameId, roomId };
  },
});

export const join = mutation({
  args: { token: v.string(), roomId: v.optional(v.string()) },
  handler: async (ctx, { token, roomId }) => {
    const user = await requireUser(ctx, token);

    let game;
    if (roomId) {
      game = await ctx.db
        .query("games")
        .withIndex("by_room_code", (q) => q.eq("roomId", roomId.toUpperCase().trim()))
        .first();
      if (!game) throw new Error("Room not found");
    } else {
      const waiting = await ctx.db
        .query("games")
        .withIndex("by_status", (q) => q.eq("status", "waiting"))
        .take(10);
      game = waiting.find((g) => g.playerWhite !== user._id);
    }

    if (!game) return null;

    if (game.playerWhite === user._id || game.playerBlack === user._id) {
      return { gameId: game._id, roomId: game.roomId, color: game.playerWhite === user._id ? "w" : "b" };
    }

    if (await userHasActiveGames(ctx, user._id)) throw new Error("You already have an active game");

    if (!game.playerBlack && game.status === "waiting") {
      await ctx.db.patch(game._id, { playerBlack: user._id, status: "in-progress" });
      return { gameId: game._id, roomId: game.roomId, color: "b" };
    }

    return { gameId: game._id, roomId: game.roomId, color: "s" };
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) return null;

    const white = await ctx.db.get(game.playerWhite);
    const black = game.playerBlack ? await ctx.db.get(game.playerBlack) : null;

    const chess = new Chess();
    if (game.pgn) try { chess.loadPgn(game.pgn); } catch { /* ignore */ }

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

export const makeMove = mutation({
  args: {
    token: v.string(),
    gameId: v.id("games"),
    move: v.object({ from: v.string(), to: v.string(), promotion: v.optional(v.string()) }),
  },
  handler: async (ctx, { token, gameId, move }) => {
    const user = await requireUser(ctx, token);
    const game = await requireGame(ctx, gameId);

    if (game.status !== "in-progress") throw new Error("Game not active");

    const isWhite = game.playerWhite === user._id;
    const isBlack = game.playerBlack === user._id;
    if (!isWhite && !isBlack) throw new Error("Not a player");

    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);

    const turn = chess.turn();
    if ((turn === "w" && !isWhite) || (turn === "b" && !isBlack)) throw new Error("Not your turn");

    const result = chess.move(move);
    if (!result) throw new Error("Invalid move");

    let status: "waiting" | "in-progress" | "finished" | "archived" = game.status;
    let winner = game.winner;

    if (chess.isGameOver()) {
      status = "finished";
      winner = chess.isCheckmate() ? (turn === "w" ? "white" : "black") : "draw";
      await cleanupUserIfIdle(ctx, game.playerWhite);
      if (game.playerBlack) await cleanupUserIfIdle(ctx, game.playerBlack);
    }

    await ctx.db.patch(game._id, { pgn: chess.pgn(), status, winner });
    return { success: true };
  },
});

export const leaveGame = mutation({
  args: { token: v.string(), gameId: v.id("games") },
  handler: async (ctx, { token, gameId }) => {
    const user = await requireUser(ctx, token);
    const game = await requireGame(ctx, gameId);

    const isWhite = game.playerWhite === user._id;
    const isBlack = game.playerBlack === user._id;
    if (!isWhite && !isBlack) return { success: true };

    const whiteLeft = isWhite || game.whiteLeft;
    const blackLeft = isBlack || game.blackLeft;

    if (game.status === "in-progress") {
      await ctx.db.patch(game._id, {
        status: "finished",
        winner: isWhite ? "black" : "white",
        whiteLeft: isWhite ? true : game.whiteLeft,
        blackLeft: isBlack ? true : game.blackLeft,
      });
      await cleanupUserIfIdle(ctx, user._id);
      return { success: true };
    }

    if (game.status === "waiting") {
      await ctx.db.delete(game._id);
      await cleanupUserIfIdle(ctx, user._id);
      return { success: true };
    }

    await ctx.db.patch(game._id, {
      whiteLeft: isWhite ? true : game.whiteLeft,
      blackLeft: isBlack ? true : game.blackLeft,
    });

    if (whiteLeft && blackLeft) {
      const messages = await ctx.db.query("messages").withIndex("by_game", (q) => q.eq("gameId", game._id)).collect();
      for (const msg of messages) await ctx.db.delete(msg._id);
      await ctx.db.delete(game._id);
      await cleanupUserIfIdle(ctx, game.playerWhite);
      if (game.playerBlack) await cleanupUserIfIdle(ctx, game.playerBlack);
    } else {
      await cleanupUserIfIdle(ctx, user._id);
    }

    return { success: true };
  },
});
