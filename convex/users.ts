import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { getUserByToken, goOffline, MAX_NAME_LENGTH } from "./lib/helpers";

const STALE_AFTER_MS = 3 * 60 * 1000; // the client heartbeats every 20s
const BATCH = 100;
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Registers the guest. The client also calls it as the heartbeat, which only rewrites the small
// presence row. The user row changes when the name changes or the user comes back online.
export const register = mutation({
  args: { name: v.optional(v.string()), token: v.string() },
  returns: v.id("users"),
  handler: async (ctx, { name, token }) => {
    if (token.length < 8 || token.length > 64) throw new ConvexError("Invalid token");
    // A blank name keeps the stored one, so an empty input never renames a player to "Guest"
    const typedName = name?.trim().slice(0, MAX_NAME_LENGTH) || undefined;

    const now = Date.now();
    const existing = await getUserByToken(ctx, token);
    let userId = existing?._id;
    if (existing) {
      const newName = typedName ?? existing.name;
      if (existing.name !== newName || !existing.isOnline) {
        await ctx.db.patch("users", existing._id, { name: newName, isOnline: true });
      }
    } else {
      userId = await ctx.db.insert("users", { name: typedName ?? "Guest", token, isOnline: true, lastSeen: now });
    }
    if (!userId) throw new ConvexError("Invalid token");

    const live = await ctx.db.query("presence").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (live) await ctx.db.patch("presence", live._id, { lastSeen: now });
    else await ctx.db.insert("presence", { userId, lastSeen: now });
    return userId;
  },
});

export const setOffline = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (user) await goOffline(ctx, user._id, Date.now());
    return null;
  },
});

// Queries can't rely on Date.now() because they don't re-run as time passes,
// so a cron flips isOnline for users whose heartbeat stopped.
export const markStaleOffline = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const stale = await ctx.db
      .query("presence")
      .withIndex("by_last_seen", (q) => q.lt("lastSeen", cutoff))
      .take(BATCH);
    for (const row of stale) await goOffline(ctx, row.userId, row.lastSeen);
    if (stale.length === BATCH) await ctx.scheduler.runAfter(0, internal.users.markStaleOffline, {});
    return null;
  },
});

// Every browser registers a user, so drop guests who left a month ago. They re-register on return.
export const pruneInactiveUsers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    const old = await ctx.db
      .query("users")
      .withIndex("by_online", (q) => q.eq("isOnline", false).lt("lastSeen", cutoff))
      .take(BATCH);
    for (const user of old) {
      const asWhite = await ctx.db.query("games").withIndex("by_player_white", (q) => q.eq("playerWhite", user._id)).first();
      const asBlack = await ctx.db.query("games").withIndex("by_player_black", (q) => q.eq("playerBlack", user._id)).first();
      if (!asWhite && !asBlack) await ctx.db.delete("users", user._id);
    }
    if (old.length === BATCH) await ctx.scheduler.runAfter(0, internal.users.pruneInactiveUsers, {});
    return null;
  },
});

export const getStats = query({
  args: {},
  returns: v.object({ browsing: v.number(), playing: v.number() }),
  handler: async (ctx) => {
    const online = await ctx.db
      .query("users")
      .withIndex("by_online", (q) => q.eq("isOnline", true))
      .take(1000);
    const inProgress = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "in-progress"))
      .take(500);
    const playing = inProgress.length * 2;
    return { browsing: Math.max(0, online.length - playing), playing };
  },
});
