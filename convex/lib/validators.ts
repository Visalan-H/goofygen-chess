import { v } from "convex/values";

export const gameStatus = v.union(
  v.literal("waiting"),
  v.literal("in-progress"),
  v.literal("finished"),
);

export const gameWinner = v.union(
  v.literal("white"),
  v.literal("black"),
  v.literal("draw"),
  v.literal("abandoned"),
);

// "s" is a spectator
export const seatColor = v.union(v.literal("w"), v.literal("b"), v.literal("s"));

export const playerColor = v.union(v.literal("w"), v.literal("b"));
