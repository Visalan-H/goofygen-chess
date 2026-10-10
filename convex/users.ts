import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { getUserByToken, goOffline, MAX_NAME_LENGTH } from "./lib/helpers";

const STALE_AFTER_MS = 3 * 60 * 1000; // the client heartbeats every 20s
const BATCH = 100;

// Registers the guest. The client also calls it as the heartbeat, which only rewrites the small
// presence row. The user row changes when the name changes or the user comes back online.
export const register = mutation({
  args: { name: v.string(), token: v.string() },
  returns: v.id("users"),
  handler: async (ctx, { name, token }) => {
    if (token.length < 8 || token.length > 64) throw new ConvexError("Invalid token");
    const cleanName = name.trim().slice(0, MAX_NAME_LENGTH) || "Guest";

    const now = Date.now();
    const existing = await getUserByToken(ctx, token);
    let userId = existing?._id;
    if (existing) {
      if (existing.name !== cleanName || !existing.isOnline) {
        await ctx.db.patch("users", existing._id, { name: cleanName, isOnline: true });
      }
    } else {
      userId = await ctx.db.insert("users", { name: cleanName, token, isOnline: true, lastSeen: now });
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

// One-off: gives users who were online before the presence table existed a presence row,
// so the stale cron can sweep the ones who never come back. Remove after running on each deployment.
export const migrateToPresence = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const online = await ctx.db.query("users").withIndex("by_online", (q) => q.eq("isOnline", true)).take(1000);
    let added = 0;
    for (const user of online) {
      const live = await ctx.db.query("presence").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
      if (live) continue;
      await ctx.db.insert("presence", { userId: user._id, lastSeen: user.lastSeen });
      added++;
    }
    return added;
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
