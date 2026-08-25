// Клієнтські хелпери для встановлення PWA й підписки на Web Push.
// Викликаються лише з client-компонентів (app/register, app/app).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "no-vapid-key" | "error" };

/**
 * Реєструє service worker, просить дозвіл на сповіщення й підписує пристрій
 * на Web Push, після чого зберігає підписку на сервері (прив'язану до
 * accessToken цієї реєстрації). Працює лише там, де є Push API — на iOS це
 * лише всередині вже встановленого на головний екран застосунку (Safari
 * 16.4+), у звичайній вкладці браузера iOS підписка неможлива.
 */
export async function subscribeToPush(accessToken: string): Promise<SubscribeResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return { ok: false, reason: "no-vapid-key" };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied" };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: accessToken,
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      return { ok: false, reason: "error" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Перевіряє, чи є вже АКТИВНА push-підписка в цьому браузері (без запиту
 * дозволу і без реєстрації нового service worker) — викликати при
 * завантаженні /app, щоб не показувати кнопку "увімкнути сповіщення" тому,
 * хто вже підписаний раніше.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** iOS Safari не має жодного API для програмного запуску "Додати на головний
 * екран" — це свідоме обмеження Apple. Визначаємо iOS Safari, щоб показати
 * текстову інструкцію замість (неіснуючої) кнопки встановлення. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}
