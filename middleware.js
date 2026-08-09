import { NextResponse } from "next/server";

/**
 * Vercel Edge Middleware — HTTP Basic Auth
 * ------------------------------------------------------------------
 * Melindungi SELURUH deployment Evidence Board dengan HTTP Basic Auth
 * standar (dialog login bawaan browser), berjalan di Vercel Edge Runtime
 * SEBELUM request menyentuh aplikasi React di dalamnya.
 *
 * Kredensial dibaca dari environment variable Vercel:
 *   AUTH_USER  -> fallback default: "admin"
 *   AUTH_PASS  -> fallback default: "Siber2026"
 *
 * PENTING (produksi): jangan andalkan fallback default di atas — selalu
 * set AUTH_USER & AUTH_PASS lewat Vercel Dashboard
 * (Project Settings -> Environment Variables) untuk environment
 * Production/Preview, supaya kredensial asli tidak pernah ada di source code.
 */

const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "Siber2026";

function isAuthorized(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice("Basic ".length).trim();
    // atob tersedia sebagai Web API bawaan di Vercel Edge Runtime
    const decoded = atob(base64Credentials);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return false;

    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    return user === AUTH_USER && pass === AUTH_PASS;
  } catch (err) {
    // base64 tidak valid / rusak -> anggap tidak terautentikasi
    return false;
  }
}

export function middleware(request) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  // Kredensial salah / kosong -> 401 + minta browser menampilkan dialog login
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}

// Terapkan Basic Auth ke seluruh route (termasuk asset statis, agar
// papan kasus tidak bisa diakses sama sekali tanpa login).
export const config = {
  matcher: "/:path*",
};
