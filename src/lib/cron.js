import { requireAdmin } from "./auth";

/**
 * Auth for endpoints Vercel Cron calls on a schedule (no logged-in user).
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * cron-triggered requests when a CRON_SECRET env var is set on the project.
 * Falls back to a normal admin session/bearer token so the same route can
 * still be hit manually (e.g. for testing) without the secret.
 */
export async function requireCronOrAdmin(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req?.headers?.get?.("authorization") || "";
  if (secret && auth === `Bearer ${secret}`) return { via: "cron" };
  return requireAdmin(req);
}
