// Service worker для DeMark PWA: показує push-сповіщення та відкриває
// посилання при кліку. Навмисно мінімальний — без офлайн-кешування, бо
// сторінки /app і /register завжди мають показувати свіжі дані.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "DeMark", body: "", url: "/app" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // якщо тіло не JSON — залишаємо дефолтний payload
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "DeMark", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/app";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
