import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: { name: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      if (existing.name !== args.name) {
        await ctx.db.patch(existing._id, { name: args.name });
      }
      await ctx.db.patch(existing._id, { lastSeen: Date.now(), isOnline: true });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      name: args.name,
      token: args.token,
      isOnline: true,
      lastSeen: Date.now(),
    });
  },
});

export const keepAlive = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (user) {
      await ctx.db.patch(user._id, { lastSeen: Date.now(), isOnline: true });
    }
  },
});

export const getOnlineCount = query({
  args: {},
  handler: async (ctx) => {
    const activeUsers = await ctx.db
        .query("users")
        .withIndex("by_online", q => q.eq("isOnline", true))
        .collect();
    // Filter for truly active < 5 min in case cron didn't clean up
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return activeUsers.filter(u => u.lastSeen > fiveMinAgo).length;
  },
});
