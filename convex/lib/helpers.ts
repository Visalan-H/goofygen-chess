import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function getUserByToken(ctx: QueryCtx | MutationCtx, token: string) {
  return ctx.db.query("users").withIndex("by_token", (q) => q.eq("token", token)).first();
}

export async function requireUser(ctx: MutationCtx, token: string) {
  const user = await getUserByToken(ctx, token);
  if (!user) throw new Error("Please enter your name first");
  return user;
}

export async function requireGame(ctx: MutationCtx, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game) throw new Error("Game not found");
  return game;
}

export async function userHasActiveGames(ctx: MutationCtx, userId: Id<"users">) {
  const asWhite = await ctx.db
    .query("games")
    .filter((q) =>
      q.and(
        q.eq(q.field("playerWhite"), userId),
        q.or(q.eq(q.field("status"), "waiting"), q.eq(q.field("status"), "in-progress"))
      )
    )
    .first();
  if (asWhite) return true;

  const asBlack = await ctx.db
    .query("games")
    .filter((q) =>
      q.and(
        q.eq(q.field("playerBlack"), userId),
        q.or(q.eq(q.field("status"), "waiting"), q.eq(q.field("status"), "in-progress"))
      )
    )
    .first();
  return !!asBlack;
}

export async function cleanupUserIfIdle(ctx: MutationCtx, userId: Id<"users">) {
  if (!(await userHasActiveGames(ctx, userId))) {
    const user = await ctx.db.get(userId);
    if (user) await ctx.db.patch(userId, { isOnline: false });
    return true;
  }
  return false;
}
