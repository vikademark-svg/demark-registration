"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/constants";
import { subscribeToPush, resyncExistingSubscription, isIosSafari, isStandalone } from "@/lib/push";
import { GENDERS } from "@/lib/options";

type Profile = {
  fullName: string;
  phone: string;
  city: string;
  storeName: string;
  ageRange: string;
  gender: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
};

type PushState = "idle" | "subscribing" | "subscribed" | "denied" | "unsupported";

function DataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}

/**
 * Персональний кабінет DeMark (start_url PWA-маніфесту). Ідентифікація —
 * без логіну/пароля: за access_token у localStorage, який записується один
 * раз під час реєстрації на /register (див. lib/constants.ts).
 */
export default function AppPage() {
  const [status, setStatus] = useState<"loading" | "no-token" | "ready" | "error">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [debug, setDebug] = useState<unknown>(null);

  const loadData = useCallback(async () => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    } catch {
      // localStorage недоступний — поводимось як "без токена"
    }
    if (!token) {
      setStatus("no-token");
      return;
    }

    // Якщо підписка вже активна з минулого разу — одразу показуємо
    // "✓ увімкнено" (без повторного запиту дозволу), і заодно перепрописуємо
    // на сервері, що ця підписка належить САМЕ ПОТОЧНОМУ access_token —
    // інакше після перевстановлення застосунку вона могла б лишитись
    // прив'язаною до старої реєстрації з іншими даними/фільтрами.
    resyncExistingSubscription(token).then((ok) => {
      if (ok) setPushState("subscribed");
    });

    try {
      const res = await fetch(`/api/me?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) {
        setStatus("no-token");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setNotifications(data.notifications ?? []);
      setDebug(data.debug ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadData();

    // iOS часто не перезавантажує встановлений PWA при поверненні зі
    // згорнутого стану — сторінка просто "розморожується" зі старим React-
    // станом, без повторного mount. Тому дані (особливо стрічку новин)
    // явно оновлюємо ще й при поверненні видимості вкладки/застосунку.
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        loadData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", loadData);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", loadData);
    };
  }, [loadData]);

  async function handleEnableNotifications() {
    let token: string | null = null;
    try {
      token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (!token) return;
    setPushState("subscribing");
    const result = await subscribeToPush(token);
    if (result.ok) {
      setPushState("subscribed");
    } else if (result.reason === "denied") {
      setPushState("denied");
    } else {
      setPushState("unsupported");
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">завантаження…</p>
      </main>
    );
  }

  if (status === "no-token") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center animate-fade-up">
          <Logo className="h-9 w-auto text-ink mx-auto mb-6" />
          <h1 className="font-display text-3xl mb-4">ще не реєструвались</h1>
          <p className="text-muted mb-8">
            Щоб побачити свої дані й отримувати новини DeMark, спочатку зареєструйтесь у
            магазині.
          </p>
          <a
            href="/register"
            className="block w-full bg-ink text-paper py-3 label-caps text-sm hover:opacity-90 transition-opacity"
          >
            до реєстрації
          </a>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center animate-fade-up">
          <Logo className="h-9 w-auto text-ink mx-auto mb-6" />
          <h1 className="font-display text-3xl mb-4">не вдалося завантажити</h1>
          <p className="text-muted mb-8">
            Тимчасова проблема з сервером. Спробуйте оновити сторінку за хвилину — ваші
            дані та знижка нікуди не поділись.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="block w-full border border-ink py-3 label-caps text-sm hover:bg-ink hover:text-paper transition-colors"
          >
            оновити
          </button>
        </div>
      </main>
    );
  }

  const genderLabel = profile
    ? GENDERS.find((g) => g.value === profile.gender)?.label ?? profile.gender
    : "";
  const showIosInstallHint = isIosSafari() && !isStandalone();

  return (
    <main className="min-h-screen px-6 py-10 max-w-xl mx-auto">
      <div className="flex justify-center mb-8">
        <Logo className="h-9 w-auto text-ink" />
      </div>

      {profile && (
        <section className="border border-line p-5 mb-8">
          <p className="label-caps text-xs text-muted mb-3">ваші дані</p>
          <div className="space-y-2">
            <DataLine label="ім'я" value={profile.fullName} />
            <DataLine label="телефон" value={profile.phone} />
            <DataLine label="магазин" value={`${profile.storeName}, ${profile.city}`} />
            <DataLine label="вік" value={profile.ageRange} />
            <DataLine label="стать" value={genderLabel} />
          </div>
        </section>
      )}

      <section className="mb-8">
        <p className="label-caps text-xs text-muted mb-3">сповіщення</p>
        {showIosInstallHint ? (
          <p className="text-sm text-muted border border-line p-4">
            Щоб отримувати сповіщення на iPhone: натисніть кнопку «Поділитись» у Safari й
            оберіть «На екран Домівка» — після цього відкрийте застосунок з головного
            екрана і ввімкніть сповіщення тут.
          </p>
        ) : pushState === "subscribed" ? (
          <p className="text-sm text-success">✓ сповіщення увімкнено</p>
        ) : (
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={pushState === "subscribing"}
            className="w-full border border-ink py-3 text-sm label-caps hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
          >
            {pushState === "subscribing" ? "вмикаємо…" : "увімкнути сповіщення"}
          </button>
        )}
        {pushState === "denied" && (
          <p className="mt-2 text-sm text-sale">
            Дозвіл на сповіщення відхилено. Дозвольте його в налаштуваннях браузера, щоб
            отримувати новини.
          </p>
        )}
        {pushState === "unsupported" && (
          <p className="mt-2 text-sm text-muted">Цей браузер не підтримує push-сповіщення.</p>
        )}
      </section>

      {debug !== null && (
        <pre className="mb-6 p-3 border border-sale text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}

      <section>
        <p className="label-caps text-xs text-muted mb-3">новини</p>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted">поки що немає новин — зазирніть пізніше</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <article key={n.id} className="border-b border-line pb-4">
                <p className="text-xs text-muted mb-1">
                  {new Date(n.createdAt).toLocaleString("uk-UA")}
                </p>
                <h3 className="font-display text-xl mb-1">{n.title}</h3>
                <p className="text-sm text-ink">{n.body}</p>
                {n.url && (
                  <a
                    href={n.url}
                    className="text-sm text-sale underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {n.url}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
