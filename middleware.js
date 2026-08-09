import { next } from "@vercel/functions";

const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "Siber2026";

function isAuthorized(request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  try {
    const encoded = authHeader.slice(6).trim();
    const decoded = atob(encoded);

    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return false;
    }

    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);

    return user === AUTH_USER && pass === AUTH_PASS;
  } catch {
    return false;
  }
}

export default function middleware(request) {
  if (!isAuthorized(request)) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Evidence Board"',
        "Cache-Control": "no-store",
      },
    });
  }

  return next();
}