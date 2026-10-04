import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { gameStatus, gameWinner } from "./lib/validators";

export default defineSchema({
  // Guests identified by a client-generated token
  users: defineTable({
    name: v.string(),
    token: v.string(),
    lastSeen: v.number(),
    isOnline: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_online", ["isOnline", "lastSeen"]),

  games: defineTable({
    roomId: v.string(), // 6-char code
    pgn: v.string(),
    playerWhite: v.id("users"),
    playerBlack: v.optional(v.id("users")),
    whiteLeft: v.optional(v.boolean()),
    blackLeft: v.optional(v.boolean()),
    status: gameStatus,
    winner: v.optional(gameWinner),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // last move, join, or leave
  })
    .index("by_room_code", ["roomId"])
    .index("by_status", ["status", "createdAt"]) // matchmaking and waiting-room expiry
    .index("by_status_updated", ["status", "updatedAt"]) // idle and finished cleanup
    .index("by_player_white", ["playerWhite", "status"])
    .index("by_player_black", ["playerBlack", "status"]),

  messages: defineTable({
    gameId: v.id("games"),
    userId: v.id("users"),
    text: v.optional(v.string()),
    gifUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_game", ["gameId", "createdAt"]),
});
