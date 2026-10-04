import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { MAX_MESSAGES_PER_GAME, requireGame, requireUser } from "./lib/helpers";

const MAX_TEXT_LENGTH = 200;
const GIPHY_URL = /^https:\/\/media\d*\.giphy\.com\/media\/[\w\-./]+$/;

export const send = mutation({
  args: { token: v.string(), gameId: v.id("games"), text: v.optional(v.string()), gifUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { token, gameId, text, gifUrl }) => {
    const user = await requireUser(ctx, token);
    await requireGame(ctx, gameId);

    const cleanText = text?.trim();
    if (!cleanText && !gifUrl) throw new ConvexError("Empty message");
    if (cleanText && cleanText.length > MAX_TEXT_LENGTH) throw new ConvexError("Message too long");
    if (gifUrl && (gifUrl.length > 500 || !GIPHY_URL.test(gifUrl))) throw new ConvexError("Invalid GIF");

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .take(MAX_MESSAGES_PER_GAME);
    if (existing.length >= MAX_MESSAGES_PER_GAME) throw new ConvexError("Chat limit reached for this game");

    await ctx.db.insert("messages", {
      gameId,
      userId: user._id,
      text: cleanText || undefined,
      gifUrl,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const list = query({
  args: { gameId: v.id("games") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      gameId: v.id("games"),
      userId: v.id("users"),
      text: v.optional(v.string()),
      gifUrl: v.optional(v.string()),
      createdAt: v.number(),
      sender: v.string(),
    }),
  ),
  handler: async (ctx, { gameId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(50);

    const names = new Map<string, string>();
    for (const userId of new Set(messages.map((m) => m.userId))) {
      const user = await ctx.db.get("users", userId);
      if (user) names.set(userId, user.name);
    }

    return messages.reverse().map((m) => ({ ...m, sender: names.get(m.userId) ?? "Unknown" }));
  },
});
