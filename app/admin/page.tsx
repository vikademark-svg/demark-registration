"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { STORES } from "@/lib/stores";
import { AGE_RANGES, GENDERS } from "@/lib/options";

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
        <p className="label-caps text-clay text-xs mb-2 text-center">demark</p>
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

        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

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
          <p className="label-caps text-clay text-xs mb-1">demark</p>
          <h1 className="font-display text-3xl">аудиторія</h1>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs label-caps border border-line px-4 py-2 hover:border-ink transition-colors"
        >
          вийти
        </button>
      </div>

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

      {errorMsg && <p className="text-sm text-red-700 mb-4">{errorMsg}</p>}

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
    </main>
  );
}
