import { NextResponse } from "next/server";

export function ok(data = {}, init) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Wrap a route handler with error handling. Handlers may throw errors that
 * carry a `.status` (e.g. from requireUser/requireAdmin).
 */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      const status = e?.status || 500;
      if (status >= 500) console.error("[api] error:", e);
      return fail(e?.message || "Server error", status);
    }
  };
}
