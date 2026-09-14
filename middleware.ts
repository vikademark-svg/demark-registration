import { NextRequest, NextResponse } from "next/server";

/**
 * Обмежує піддомен адмінки (ADMIN_HOSTNAME, напр. admin.demark.ua) лише
 * маршрутом /admin (+ його API /api/admin/**) — той самий Next.js-деплой,
 * без окремого проєкту/білду. На основному домені (demark.ua) все працює
 * як раніше: /register, /app, /admin — без змін.
 *
 * Налаштування: додайте ADMIN_HOSTNAME=admin.demark.ua у змінні середовища
 * (Vercel → Project Settings → Environment Variables) і прив'яжіть цей же
 * піддомен до проєкту в Vercel → Settings → Domains.
 */

const ADMIN_HOSTNAME = process.env.ADMIN_HOSTNAME;

const ALLOWED_PREFIXES = ["/admin", "/api/admin", "/_next", "/favicon.ico", "/icon", "/manifest"];

export function middleware(request: NextRequest) {
  if (!ADMIN_HOSTNAME) return NextResponse.next();

  const host = request.headers.get("host") || "";
  const isAdminHost = host === ADMIN_HOSTNAME || host.startsWith(`${ADMIN_HOSTNAME}:`);
  if (!isAdminHost) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const allowed = ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!allowed) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
