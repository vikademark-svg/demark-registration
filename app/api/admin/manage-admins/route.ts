import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * /api/admin/manage-admins — керування обліковими записами адмінів прямо з
 * /admin, без ручного заходу в Supabase Dashboard.
 *
 * Доступ лише для вже автентифікованих адмінів (перевіряємо JWT із сесії).
 * Використовує supabaseAdmin (service role) — Supabase Auth Admin API
 * (listUsers / createUser / deleteUser), яке недоступне анонімному/anon-ключу.
 *
 * GET    → список адмінів { id, email, created_at, last_sign_in_at }
 * POST   body: { email, password } → створює нового адміна (email одразу підтверджений)
 * DELETE body: { id } → видаляє адміна (не можна видалити самого себе)
 */

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}

export async function GET(request: NextRequest) {
  const caller = await requireAdmin(request);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    return NextResponse.json({ error: "could not load admins" }, { status: 500 });
  }

  const admins = data.users
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const caller = await requireAdmin(request);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: { email?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "вкажіть коректний email" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "пароль має містити щонайменше 6 символів" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user) {
    const msg = error?.message?.includes("already")
      ? "адмін з таким email вже існує"
      : "не вдалося створити адміна";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    admin: { id: data.user.id, email: data.user.email, created_at: data.user.created_at },
  });
}

export async function DELETE(request: NextRequest) {
  const caller = await requireAdmin(request);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: { id?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!payload.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (payload.id === caller.id) {
    return NextResponse.json({ error: "не можна видалити самого себе" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(payload.id);
  if (error) {
    return NextResponse.json({ error: "не вдалося видалити адміна" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
