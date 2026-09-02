import { getCurrentUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const GET = handler(async (req) => {
  const user = await getCurrentUser(req);
  if (!user) return fail("Unauthorized", 401);
  return ok({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      agentId: user.agentId,
    },
  });
});
