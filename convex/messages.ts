import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: { token: v.string(), gameId: v.id("games"), text: v.optional(v.string()), gifUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("token", args.token)).first();
    if (!user) throw new Error("Unauthorized");

    if (args.text && args.text.length > 200) throw new Error("Message too long");

    await ctx.db.insert("messages", {
        gameId: args.gameId,
        userId: user._id,
        text: args.text,
        gifUrl: args.gifUrl,
        createdAt: Date.now()
    });
  }
});

export const list = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const messages = await ctx.db.query("messages")
        .withIndex("by_game", q => q.eq("gameId", args.gameId))
        .order("desc") // Get newest first
        .take(50);
    
    const userIds = [...new Set(messages.map(m => m.userId))];
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
    const userMap = new Map();
    users.forEach(u => u && userMap.set(u._id, u.name));

    return messages.reverse().map(m => ({ // Return in chronological order
        ...m,
        sender: userMap.get(m.userId) || "Unknown"
    }));
  }
});
