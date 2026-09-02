import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import User from "./models/User";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
const COOKIE_NAME = "ga_crm_token";
const TOKEN_TTL = "7d";

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function setAuthCookie(token) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
export async function clearAuthCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Resolve the current user from either the auth cookie (web app) or a
 * Bearer token (browser extension). Returns a lean user doc or null.
 */
export async function getCurrentUser(req) {
  let token = null;

  // Bearer header (extension)
  const auth = req?.headers?.get?.("authorization");
  if (auth && auth.startsWith("Bearer ")) token = auth.slice(7);

  // Cookie (web app)
  if (!token) {
    const store = await cookies();
    token = store.get(COOKIE_NAME)?.value || null;
  }
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.sub) return null;

  await connectDB();
  const user = await User.findById(decoded.sub).lean();
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return user;
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role !== "admin") {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return user;
}

export { COOKIE_NAME };
