import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken } from "./lib/helpers";

export const register = mutation({
  args: { name: v.string(), token: v.string() },
  handler: async (ctx, { name, token }) => {
    const usersWithToken = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", token))
      .collect();

    // Handle duplicates (cleanup race condition edge case)
    if (usersWithToken.length > 1) {
      const [keep, ...duplicates] = usersWithToken;
      for (const dup of duplicates) await ctx.db.delete(dup._id);
      await ctx.db.patch(keep._id, { name, lastSeen: Date.now(), isOnline: true });
      return keep._id;
    }

    // Existing user
    if (usersWithToken.length === 1) {
      const existing = usersWithToken[0];
      await ctx.db.patch(existing._id, { name, lastSeen: Date.now(), isOnline: true });
      return existing._id;
    }

    // Double-check before insert
    const recheck = await getUserByToken(ctx, token);
    if (recheck) {
      await ctx.db.patch(recheck._id, { name, lastSeen: Date.now(), isOnline: true });
      return recheck._id;
    }

    // New user
    return await ctx.db.insert("users", { name, token, isOnline: true, lastSeen: Date.now() });
  },
});

export const setOffline = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (user) await ctx.db.patch(user._id, { isOnline: false });
  },
});

export const getOnlineCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * 60 * 1000;
    const online = await ctx.db
      .query("users")
      .withIndex("by_online", (q) => q.eq("isOnline", true))
      .filter((q) => q.gt(q.field("lastSeen"), cutoff))
      .collect();

    if (online.length === 0) return 0;

    const games = await ctx.db
      .query("games")
      .filter((q) => q.or(q.eq(q.field("status"), "waiting"), q.eq(q.field("status"), "in-progress")))
      .collect();

    const playerIds = new Set<string>();
    games.forEach((g) => {
      playerIds.add(g.playerWhite);
      if (g.playerBlack) playerIds.add(g.playerBlack);
    });

    return online.filter((u) => !playerIds.has(u._id)).length;
  },
});

export const getActivePlayersCount = query({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .filter((q) => q.or(q.eq(q.field("status"), "waiting"), q.eq(q.field("status"), "in-progress")))
      .collect();

    const playerIds = new Set<string>();
    games.forEach((g) => {
      playerIds.add(g.playerWhite);
      if (g.playerBlack) playerIds.add(g.playerBlack);
    });
    return playerIds.size;
  },
});
