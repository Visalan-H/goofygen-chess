import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { getUserByToken, MAX_NAME_LENGTH } from "./lib/helpers";

const STALE_AFTER_MS = 3 * 60 * 1000; // the client heartbeats every 60s
const BATCH = 100;

// Registers the guest. The client also calls it as the heartbeat.
export const register = mutation({
  args: { name: v.string(), token: v.string() },
  returns: v.id("users"),
  handler: async (ctx, { name, token }) => {
    if (token.length < 8 || token.length > 64) throw new ConvexError("Invalid token");
    const cleanName = name.trim().slice(0, MAX_NAME_LENGTH) || "Guest";

    const existing = await getUserByToken(ctx, token);
    if (existing) {
      await ctx.db.patch("users", existing._id, { name: cleanName, lastSeen: Date.now(), isOnline: true });
      return existing._id;
    }
    return await ctx.db.insert("users", { name: cleanName, token, isOnline: true, lastSeen: Date.now() });
  },
});

export const setOffline = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (user) await ctx.db.patch("users", user._id, { isOnline: false });
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
      .query("users")
      .withIndex("by_online", (q) => q.eq("isOnline", true).lt("lastSeen", cutoff))
      .take(BATCH);
    for (const user of stale) await ctx.db.patch("users", user._id, { isOnline: false });
    if (stale.length === BATCH) await ctx.scheduler.runAfter(0, internal.users.markStaleOffline, {});
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
