"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { STORES } from "@/lib/stores";
import { AGE_RANGES, GENDERS } from "@/lib/options";
import { Logo } from "@/components/Logo";

type Registration = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  city: string;
  store_id: string;
  store_name: string;
  age_range: string;
  gender: string;
  distance_to_store_m: number | null;
  store_confirmed_manually: boolean;
};

const PAGE_SIZE = 50;

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">завантаження…</p>
      </main>
    );
  }

  return session ? <Dashboard /> : <LoginForm />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Невірний email або пароль.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm animate-fade-up">
        <Logo className="h-5 w-auto text-ink mx-auto mb-2" />
        <h1 className="font-display text-3xl mb-8 text-center">адмін-панель</h1>

        <label className="text-xs text-muted block mb-1">email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border-b border-line focus:border-ink py-2 mb-5 outline-none"
          required
        />

        <label className="text-xs text-muted block mb-1">пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b border-line focus:border-ink py-2 mb-6 outline-none"
          required
        />

        {error && <p className="text-sm text-sale mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink text-paper py-3 label-caps text-sm disabled:opacity-50"
        >
          {loading ? "вхід…" : "увійти"}
        </button>
      </form>
    </main>
  );
}

function Dashboard() {
  const [view, setView] = useState<"registrations" | "notifications" | "admins">("registrations");
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [storeId, setStoreId] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const cities = Array.from(new Set(STORES.map((s) => s.city)));
  const storesForCity = city ? STORES.filter((s) => s.city === city) : STORES;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    let query = supabase
      .from("registrations")
      .select(
        "id, created_at, full_name, phone, city, store_id, store_name, age_range, gender, distance_to_store_m, store_confirmed_manually",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search.trim()) {
      const term = search.trim();
      query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
    if (city) query = query.eq("city", city);
    if (storeId) query = query.eq("store_id", storeId);
    if (ageRange) query = query.eq("age_range", ageRange);
    if (gender) query = query.eq("gender", gender);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    const { data, error, count } = await query;

    if (error) {
      setErrorMsg("Не вдалося завантажити дані.");
      setRows([]);
    } else {
      setRows(data as Registration[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [search, city, storeId, ageRange, gender, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  function resetFilters() {
    setSearch("");
    setCity("");
    setStoreId("");
    setAgeRange("");
    setGender("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  function exportCsv() {
    const header = ["Ім'я", "Телефон", "Місто", "Магазин", "Вік", "Стать", "Дата"];
    const genderLabel = (v: string) => GENDERS.find((g) => g.value === v)?.label ?? v;
    const lines = rows.map((r) =>
      [
        r.full_name,
        r.phone,
        r.city,
        r.store_name,
        r.age_range,
        genderLabel(r.gender),
        new Date(r.created_at).toLocaleString("uk-UA"),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demark-registrations-page${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Logo className="h-4 w-auto text-ink mb-1" />
          <h1 className="font-display text-3xl">аудиторія</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-line">
            <button
              onClick={() => setView("registrations")}
              className={`text-xs label-caps px-4 py-2 transition-colors ${
                view === "registrations" ? "bg-ink text-paper" : "hover:bg-sand/50"
              }`}
            >
              аудиторія
            </button>
            <button
              onClick={() => setView("notifications")}
              className={`text-xs label-caps px-4 py-2 transition-colors border-l border-line ${
                view === "notifications" ? "bg-ink text-paper" : "hover:bg-sand/50"
              }`}
            >
              розсилки
            </button>
            <button
              onClick={() => setView("admins")}
              className={`text-xs label-caps px-4 py-2 transition-colors border-l border-line ${
                view === "admins" ? "bg-ink text-paper" : "hover:bg-sand/50"
              }`}
            >
              адміни
            </button>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs label-caps border border-line px-4 py-2 hover:border-ink transition-colors"
          >
            вийти
          </button>
        </div>
      </div>

      {view === "notifications" ? (
        <NotificationsPanel />
      ) : view === "admins" ? (
        <AdminsPanel />
      ) : (
        <>
      {/* Фільтри */}
      <div className="border border-line p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="text-xs text-muted block mb-1">пошук (ім&rsquo;я / телефон)</label>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            placeholder="Олена, +380…"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">місто</label>
          <select
            value={city}
            onChange={(e) => { setCity(e.target.value); setStoreId(""); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          >
            <option value="">усі</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">магазин</label>
          <select
            value={storeId}
            onChange={(e) => { setStoreId(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          >
            <option value="">усі</option>
            {storesForCity.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">вік</label>
          <select
            value={ageRange}
            onChange={(e) => { setAgeRange(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          >
            <option value="">усі</option>
            {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">стать</label>
          <select
            value={gender}
            onChange={(e) => { setGender(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          >
            <option value="">усі</option>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">дата від</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">дата до</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-2">
          <button onClick={resetFilters} className="text-xs label-caps border border-line px-4 py-2 hover:border-ink transition-colors">
            скинути фільтри
          </button>
          <button onClick={exportCsv} className="text-xs label-caps border border-ink bg-ink text-paper px-4 py-2 hover:opacity-90 transition-opacity">
            експорт csv (сторінка)
          </button>
        </div>
      </div>

      <p className="text-sm text-muted mb-3">
        знайдено: {totalCount} {totalCount === 1 ? "запис" : "записів"}
      </p>

      {errorMsg && <p className="text-sm text-sale mb-4">{errorMsg}</p>}

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="p-3 label-caps text-xs text-muted">ім&rsquo;я</th>
              <th className="p-3 label-caps text-xs text-muted">телефон</th>
              <th className="p-3 label-caps text-xs text-muted">місто</th>
              <th className="p-3 label-caps text-xs text-muted">магазин</th>
              <th className="p-3 label-caps text-xs text-muted">вік</th>
              <th className="p-3 label-caps text-xs text-muted">стать</th>
              <th className="p-3 label-caps text-xs text-muted">дата</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted text-sm">завантаження…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted text-sm">нічого не знайдено</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                  <td className="p-3">{r.full_name}</td>
                  <td className="p-3">{r.phone}</td>
                  <td className="p-3">{r.city}</td>
                  <td className="p-3">
                    {r.store_name}
                    {r.store_confirmed_manually && (
                      <span className="ml-1 text-xs text-muted">(вручну)</span>
                    )}
                  </td>
                  <td className="p-3">{r.age_range}</td>
                  <td className="p-3">{GENDERS.find((g) => g.value === r.gender)?.label ?? r.gender}</td>
                  <td className="p-3 text-muted">{new Date(r.created_at).toLocaleString("uk-UA")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="text-xs label-caps border border-line px-4 py-2 disabled:opacity-30"
        >
          ← попередня
        </button>
        <p className="text-xs text-muted">сторінка {page + 1} з {totalPages}</p>
        <button
          disabled={page + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="text-xs label-caps border border-line px-4 py-2 disabled:opacity-30"
        >
          наступна →
        </button>
      </div>
        </>
      )}
    </main>
  );
}

function NotificationsPanel() {
  const cities = Array.from(new Set(STORES.map((s) => s.city)));

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStoreId, setFilterStoreId] = useState("");
  const [filterAgeRange, setFilterAgeRange] = useState("");
  const [filterGender, setFilterGender] = useState("");

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<
    { id: string; created_at: string; title: string; body: string; sent_count: number }[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const storesForFilterCity = filterCity ? STORES.filter((s) => s.city === filterCity) : STORES;

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, title, body, sent_count")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Сесія закінчилась, увійдіть знову.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          filters: {
            city: filterCity || undefined,
            storeId: filterStoreId || undefined,
            ageRange: filterAgeRange || undefined,
            gender: filterGender || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не вдалося надіслати розсилку.");
      } else {
        setResult(
          `Надіслано ${data.sent} з ${data.matched} підписників${
            data.failed ? ` (не вдалося: ${data.failed})` : ""
          }.`
        );
        setTitle("");
        setBody("");
        setUrl("");
        fetchHistory();
      }
    } catch {
      setError("Не вдалося надіслати розсилку.");
    }
    setSending(false);
  }

  return (
    <div>
      <form onSubmit={handleSend} className="border border-line p-5 mb-6 space-y-4">
        <div>
          <label className="text-xs text-muted block mb-1">заголовок</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">текст</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-line focus:border-ink p-2 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">посилання (необов&rsquo;язково)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://demark.ua/..."
            className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted block mb-1">місто</label>
            <select
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value);
                setFilterStoreId("");
              }}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            >
              <option value="">усі</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">магазин</label>
            <select
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            >
              <option value="">усі</option>
              {storesForFilterCity.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">вік</label>
            <select
              value={filterAgeRange}
              onChange={(e) => setFilterAgeRange(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            >
              <option value="">усі</option>
              {AGE_RANGES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">стать</label>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
            >
              <option value="">усі</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-sale">{error}</p>}
        {result && <p className="text-sm text-success">{result}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full bg-ink text-paper py-3 label-caps text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {sending ? "надсилаємо…" : "надіслати розсилку"}
        </button>
      </form>

      <p className="label-caps text-xs text-muted mb-3">історія розсилок</p>
      <div className="border border-line divide-y divide-line">
        {loadingHistory ? (
          <p className="p-4 text-sm text-muted">завантаження…</p>
        ) : history.length === 0 ? (
          <p className="p-4 text-sm text-muted">розсилок ще не було</p>
        ) : (
          history.map((n) => (
            <div key={n.id} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium">{n.title}</h3>
                <span className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleString("uk-UA")}
                </span>
              </div>
              <p className="text-sm text-muted mb-1">{n.body}</p>
              <p className="text-xs text-muted">надіслано: {n.sent_count}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

function AdminsPanel() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const headers = await authHeader();
    if (!headers) {
      setLoadError("Сесія закінчилась, увійдіть знову.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/manage-admins", { headers });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Не вдалося завантажити список адмінів.");
      } else {
        setAdmins(data.admins);
      }
    } catch {
      setLoadError("Не вдалося завантажити список адмінів.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null));
    fetchAdmins();
  }, [fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);

    const headers = await authHeader();
    if (!headers) {
      setFormError("Сесія закінчилась, увійдіть знову.");
      setCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/manage-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Не вдалося створити адміна.");
      } else {
        setFormSuccess(`Адміна ${data.admin.email} створено.`);
        setEmail("");
        setPassword("");
        fetchAdmins();
      }
    } catch {
      setFormError("Не вдалося створити адміна.");
    }
    setCreating(false);
  }

  async function handleRemove(id: string, adminEmail: string | null) {
    if (!confirm(`Видалити доступ адміна ${adminEmail ?? id}?`)) return;
    setRemovingId(id);
    const headers = await authHeader();
    if (!headers) {
      setRemovingId(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/manage-admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не вдалося видалити адміна.");
      } else {
        setAdmins((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      alert("Не вдалося видалити адміна.");
    }
    setRemovingId(null);
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="border border-line p-5 mb-6 space-y-4">
        <p className="label-caps text-xs text-muted mb-1">додати нового адміна</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted block mb-1">email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">пароль (мін. 6 символів)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none text-sm"
              required
            />
          </div>
        </div>

        {formError && <p className="text-sm text-sale">{formError}</p>}
        {formSuccess && <p className="text-sm text-success">{formSuccess}</p>}

        <button
          type="submit"
          disabled={creating}
          className="bg-ink text-paper py-3 px-6 label-caps text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {creating ? "створюємо…" : "створити адміна"}
        </button>
      </form>

      <p className="label-caps text-xs text-muted mb-3">поточні адміни</p>
      {loadError && <p className="text-sm text-sale mb-4">{loadError}</p>}
      <div className="border border-line divide-y divide-line">
        {loading ? (
          <p className="p-4 text-sm text-muted">завантаження…</p>
        ) : admins.length === 0 ? (
          <p className="p-4 text-sm text-muted">адмінів не знайдено</p>
        ) : (
          admins.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {a.email}
                  {a.id === currentUserId && <span className="ml-2 text-xs text-muted">(ви)</span>}
                </p>
                <p className="text-xs text-muted">
                  створено: {new Date(a.created_at).toLocaleString("uk-UA")}
                  {a.last_sign_in_at &&
                    ` · останній вхід: ${new Date(a.last_sign_in_at).toLocaleString("uk-UA")}`}
                </p>
              </div>
              {a.id !== currentUserId && (
                <button
                  onClick={() => handleRemove(a.id, a.email)}
                  disabled={removingId === a.id}
                  className="text-xs label-caps border border-line px-3 py-2 hover:border-sale hover:text-sale transition-colors disabled:opacity-50"
                >
                  {removingId === a.id ? "видаляємо…" : "видалити"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
