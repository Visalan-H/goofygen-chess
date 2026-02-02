import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Chess } from "chess.js";
import { generateRoomCode } from "./utils";

export const create = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!user) throw new Error("User not found");

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
  args: { token: v.string(), roomId: v.optional(v.string()) }, // roomId optional for matchmaking
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!user) throw new Error("Authentication failed");

    let game;
    
    if (args.roomId) {
        // Join specific room
        const roomToJoin = args.roomId;
        game = await ctx.db.query("games").withIndex("by_room_code", q => q.eq("roomId", roomToJoin)).first();
        if (!game) throw new Error("Room not found");
    } else {
        // Matchmaking: Find first waiting game where I am NOT the player
        const waitingGames = await ctx.db.query("games").withIndex("by_status", q => q.eq("status", "waiting")).take(10);
        // Find one we didn't create
        game = waitingGames.find(g => g.playerWhite !== user._id);
    }

    if (!game) return null; // No game found

    // If already in game, just return
    if (game.playerWhite === user._id || game.playerBlack === user._id) {
        return { gameId: game._id, roomId: game.roomId, color: game.playerWhite === user._id ? 'w' : 'b' };
    }

    // Join as black if open
    if (!game.playerBlack && game.status === "waiting") {
        await ctx.db.patch(game._id, {
            playerBlack: user._id,
            status: "in-progress"
        });
        return { gameId: game._id, roomId: game.roomId, color: 'b' };
    }

    // Spectator
    return { gameId: game._id, roomId: game.roomId, color: 's' };
  }
});

export const getGame = query({
    args: { gameId: v.id("games") },
    handler: async (ctx, args) => {
        const game = await ctx.db.get(args.gameId);
        if(!game) return null;
        
        const white = await ctx.db.get(game.playerWhite);
        const black = game.playerBlack ? await ctx.db.get(game.playerBlack) : null;
        
        return {
            ...game,
            whiteName: white?.name || "Unknown",
            blackName: black?.name || "Waiting...",
        }
    }
});

export const makeMove = mutation({
  args: { token: v.string(), gameId: v.id("games"), move: v.any() }, 
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("token", args.token)).first();
    const game = await ctx.db.get(args.gameId);
    if (!game || !user) throw new Error("Invalid request");
    
    if (game.status !== "in-progress" && game.status !== "waiting") throw new Error("Game not active");

    const isWhite = game.playerWhite === user._id;
    const isBlack = game.playerBlack === user._id;
    
    if (!isWhite && !isBlack) throw new Error("Not a player");

    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);

    if ((chess.turn() === 'w' && !isWhite) || (chess.turn() === 'b' && !isBlack)) {
        throw new Error("Not your turn");
    }

    try {
        const result = chess.move(args.move);
        if (!result) throw new Error("Invalid move");
    } catch (e) {
        throw new Error("Invalid move execution");
    }

    let status: "waiting" | "in-progress" | "finished" | "archived" = game.status;
    let winner = game.winner;

    if (chess.isGameOver()) {
        status = "finished";
        if (chess.isCheckmate()) {
            winner = chess.turn() === 'w' ? 'black' : 'white';
        } else if (chess.isDraw()) {
            winner = "draw";
        }
    }

    await ctx.db.patch(game._id, {
        pgn: chess.pgn(),
        status,
        winner
    });
  }
});
