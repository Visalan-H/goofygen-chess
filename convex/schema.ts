import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users: Ephemeral or persistent based on token
  users: defineTable({
    name: v.string(),
    token: v.string(), // Client-side generated UUID
    lastSeen: v.number(),
    isOnline: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_online", ["isOnline", "lastSeen"]), // For counting online users

  // Games: The core state
  games: defineTable({
    roomId: v.string(), // 6-char code
    pgn: v.string(),    // Standard chess notation standard
    playerWhite: v.id("users"),
    playerBlack: v.optional(v.id("users")),
    status: v.union(
      v.literal("waiting"),
      v.literal("in-progress"),
      v.literal("finished"),
      v.literal("archived")
    ),
    winner: v.optional(v.union(
      v.literal("white"),
      v.literal("black"),
      v.literal("draw")
    )),
    createdAt: v.number(),
  })
    .index("by_room_code", ["roomId"])
    .index("by_status", ["status"]), // For matchmaking

  // Messages: Chat per game
  messages: defineTable({
    gameId: v.id("games"),
    userId: v.id("users"),
    text: v.optional(v.string()),
    gifUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_game", ["gameId", "createdAt"]),
});
