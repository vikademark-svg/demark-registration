"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { isIosSafari, isStandalone } from "@/lib/push";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Жорсткий гейт: реєстрація відкривається ЛИШЕ зі встановленого на головний
 * екран застосунку. Без цього — тільки інструкція встановлення, без обхідної
 * кнопки "продовжити без встановлення". Свідоме рішення: мета — максимальна
 * кількість встановлень (щоб потім реально доходили push-розсилки), а не
 * максимум реєстрацій за будь-яку ціну.
 *
 * iOS Safari не дає жодного програмного способу перевірити "чи людина вже
 * натиснула Додати на головний екран" — єдиний надійний сигнал це те, що
 * сторінка ЗАПУЩЕНА в standalone-режимі (тобто відкрита зі значка). Тому тут
 * лише інструкція + очікування, поки людина сама відкриє застосунок зі
 * значка. На Android/Chrome натомість є справжній нативний install-prompt.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<"idle" | "prompting" | "installed" | "dismissed">(
    "idle"
  );

  useEffect(() => {
    setStandalone(isStandalone());
    setReady(true);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setInstallState("installed");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    setInstallState("prompting");
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallState(outcome === "accepted" ? "installed" : "dismissed");
    setInstallPrompt(null);
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">завантаження…</p>
      </main>
    );
  }

  if (standalone) {
    return <>{children}</>;
  }

  const iosHint = isIosSafari();

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center animate-fade-up">
        <Logo className="h-9 w-auto text-ink mx-auto mb-6" />
        <p className="label-caps text-sale text-xs mb-2">знижка 10% лише в застосунку</p>
        <h1 className="font-display text-3xl mb-4">спершу встанови застосунок DeMark</h1>
        <p className="text-muted mb-8">
          Реєстрація й знижка доступні лише в застосунку DeMark на головному екрані — це
          займе 10 секунд.
        </p>

        {iosHint ? (
          <div className="border border-line p-5 text-left text-sm space-y-2">
            <p>
              1. Натисни <strong>«Поділитись»</strong> внизу екрана Safari (іконка
              квадрата зі стрілкою вгору).
            </p>
            <p>
              2. Обери <strong>«На екран Домівка»</strong>.
            </p>
            <p>
              3. Натисни <strong>«Додати»</strong> — і відкрий застосунок DeMark зі
              значка на головному екрані.
            </p>
          </div>
        ) : installPrompt ? (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installState === "prompting"}
            className="w-full bg-ink text-paper py-4 label-caps text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {installState === "prompting" ? "встановлюємо…" : "встановити застосунок"}
          </button>
        ) : (
          <div className="border border-line p-5 text-left text-sm space-y-2">
            <p>
              Відкрий меню браузера (зазвичай три крапки чи «⋮») і обери{" "}
              <strong>«Додати на головний екран»</strong> або{" "}
              <strong>«Встановити застосунок»</strong>.
            </p>
          </div>
        )}

        {installState === "installed" && (
          <p className="mt-4 text-sm text-success">
            ✓ Встановлено. Відкрий застосунок DeMark зі значка на головному екрані, щоб
            продовжити.
          </p>
        )}
        {installState === "dismissed" && (
          <p className="mt-4 text-sm text-muted">
            Без встановлення реєстрація й знижка, на жаль, недоступні.
          </p>
        )}
      </div>
    </main>
  );
}
