import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

type Ctx = QueryCtx | MutationCtx;

export const MAX_MESSAGES_PER_GAME = 300;
export const MAX_NAME_LENGTH = 24;

export async function getUserByToken(ctx: Ctx, token: string) {
  return ctx.db.query("users").withIndex("by_token", (q) => q.eq("token", token)).first();
}

export async function requireUser(ctx: MutationCtx, token: string) {
  const user = await getUserByToken(ctx, token);
  if (!user) throw new ConvexError("Please enter your name first");
  return user;
}

export async function requireGame(ctx: MutationCtx, gameId: Id<"games">) {
  const game = await ctx.db.get("games", gameId);
  if (!game) throw new ConvexError("Game not found");
  return game;
}

// Finds the user's waiting or in-progress game through the player indexes.
export async function findActiveGame(ctx: Ctx, userId: Id<"users">) {
  for (const status of ["waiting", "in-progress"] as const) {
    const asWhite = await ctx.db
      .query("games")
      .withIndex("by_player_white", (q) => q.eq("playerWhite", userId).eq("status", status))
      .first();
    if (asWhite) return { game: asWhite, color: "w" as const };

    const asBlack = await ctx.db
      .query("games")
      .withIndex("by_player_black", (q) => q.eq("playerBlack", userId).eq("status", status))
      .first();
    if (asBlack) return { game: asBlack, color: "b" as const };
  }
  return null;
}

// Chat is capped per game on send, so this read stays small.
export async function deleteGameWithMessages(ctx: MutationCtx, gameId: Id<"games">) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .take(MAX_MESSAGES_PER_GAME + 100);
  for (const msg of messages) await ctx.db.delete("messages", msg._id);
  await ctx.db.delete("games", gameId);
}
