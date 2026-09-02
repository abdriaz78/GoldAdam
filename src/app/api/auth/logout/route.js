import { clearAuthCookie } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const POST = handler(async () => {
  await clearAuthCookie();
  return ok();
});
