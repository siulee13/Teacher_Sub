import { router } from "./trpc.js";
import { substitutionRouter } from "./substitution.js";
import { dbAdminRouter } from "./db-admin.js";

export const appRouter = router({
  substitution: substitutionRouter,
  db: dbAdminRouter,
});

export type AppRouter = typeof appRouter;
