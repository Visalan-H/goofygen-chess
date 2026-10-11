import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { gameStatus, gameWinner } from "./lib/validators";

export default defineSchema({
  // Guests identified by a client-generated token. Written only when the name or the online flag
  // changes, so the queries that read it do not re-run on every heartbeat.
  users: defineTable({
    name: v.string(),
    token: v.string(),
    lastSeen: v.number(), // heartbeat time at the moment the user went offline
    isOnline: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_online", ["isOnline"]),

  // One row per online user, rewritten by every heartbeat. Deleted when the user goes offline.
  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_last_seen", ["lastSeen"]),

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
