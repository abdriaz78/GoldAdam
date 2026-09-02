import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const POST = handler(async (req) => {
  const { email, password } = await req.json();
  if (!email || !password) return fail("Email and password are required");

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.active) return fail("Invalid credentials", 401);

  const good = await verifyPassword(password, user.passwordHash);
  if (!good) return fail("Invalid credentials", 401);

  const token = signToken({ sub: user._id.toString(), role: user.role });
  await setAuthCookie(token);

  return ok({
    token, // also returned so the extension can store a Bearer token
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      agentId: user.agentId,
    },
  });
});
