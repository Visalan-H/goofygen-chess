import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("mark stale users offline", { minutes: 1 }, internal.users.markStaleOffline);
crons.interval("clean up games", { minutes: 10 }, internal.games.cleanupOldGames);

export default crons;
