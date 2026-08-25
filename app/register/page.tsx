"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { STORES, findNearestStore, type Store } from "@/lib/stores";
import { AGE_RANGES, GENDERS, type Gender } from "@/lib/options";
import { Logo } from "@/components/Logo";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/constants";

const DISCOUNT_PERCENT = 10;

const GEO_TOLERANCE_M = 200;

// Скільки разів можна перезавантажити сторінку й досі бачити екран знижки
// (наприклад, якщо продавець чи відвідувач випадково оновить вкладку) —
// на (MAX_DISCOUNT_RELOADS + 1)-й раз екран знижки зникає і показується форма.
const DISCOUNT_STORAGE_KEY = "demark_discount_v1";
const MAX_DISCOUNT_RELOADS = 3;

type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "error" | "unsupported";

type DiscountRecord = {
  fullName: string;
  phone: string;
  city: string;
  storeName: string;
  ageRange: string;
  genderLabel: string;
  reloads: number;
};

function citiesFromStores(): string[] {
  return Array.from(new Set(STORES.map((s) => s.city)));
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="label-caps text-xs text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");

  const [phone, setPhone] = useState("");
  const [phonePicked, setPhonePicked] = useState(false);
  const [contactPickerError, setContactPickerError] = useState<string | null>(null);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [autoConfirmed, setAutoConfirmed] = useState(false);

  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [storeConfirmedManually, setStoreConfirmedManually] = useState(false);

  const [ageRange, setAgeRange] = useState<string>("");
  const [gender, setGender] = useState<Gender | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discountRecord, setDiscountRecord] = useState<DiscountRecord | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  // Якщо відвідувач чи продавець перезавантажить сторінку одразу після
  // реєстрації, екран знижки не повинен просто зникнути — відновлюємо його
  // з localStorage до MAX_DISCOUNT_RELOADS разів, далі повертаємось до форми.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as DiscountRecord;
      const reloads = (saved.reloads ?? 0) + 1;
      if (reloads > MAX_DISCOUNT_RELOADS) {
        localStorage.removeItem(DISCOUNT_STORAGE_KEY);
        return;
      }
      const updated: DiscountRecord = { ...saved, reloads };
      localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(updated));
      setDiscountRecord(updated);
    } catch {
      // localStorage недоступний (приватний режим тощо) — просто показуємо форму
    }
  }, []);

  const supportsContactPicker =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    typeof window !== "undefined" &&
    "ContactsManager" in window;

  const cities = useMemo(() => citiesFromStores(), []);
  const storesForCity = useMemo(
    () => STORES.filter((s) => s.city === selectedCity),
    [selectedCity]
  );
  const selectedStore: Store | undefined = useMemo(
    () => STORES.find((s) => s.id === selectedStoreId),
    [selectedStoreId]
  );

  async function handlePickContact() {
    setContactPickerError(null);
    try {
      // @ts-expect-error - Contact Picker API
      const contacts = await navigator.contacts.select(["tel", "name"], { multiple: false });
      if (contacts && contacts[0]) {
        const c = contacts[0];
        if (c.tel && c.tel[0]) {
          setPhone(String(c.tel[0]).trim());
          setPhonePicked(true);
        } else {
          setContactPickerError("У вибраному контакті немає номера телефону.");
        }
        if (c.name && c.name[0] && !fullName) {
          setFullName(String(c.name[0]).trim());
        }
      }
    } catch (e) {
      setContactPickerError("Не вдалося отримати контакт. Спробуйте ще раз або введіть номер вручну.");
    }
  }

  function handleRequestGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("requesting");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        const { store, distance } = findNearestStore(latitude, longitude);
        setNearestDistance(distance);
        if (store) {
          if (distance <= GEO_TOLERANCE_M) {
            setSelectedCity(store.city);
            setSelectedStoreId(store.id);
            setAutoConfirmed(true);
            setStoreConfirmedManually(false);
          } else {
            // Похибка більша за допустиму — пропонуємо найближчий, але просимо підтвердити вручну
            setSelectedCity(store.city);
            setSelectedStoreId(store.id);
            setAutoConfirmed(false);
          }
        }
        setGeoStatus("granted");
      },
      (err) => {
        setGeoStatus("denied");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Доступ до геолокації заборонено. Дозвольте доступ у налаштуваннях браузера або оберіть магазин вручну нижче."
            : "Не вдалося визначити геопозицію. Оберіть магазин вручну нижче."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handleManualCityChange(city: string) {
    setSelectedCity(city);
    setStoreConfirmedManually(true);
    setAutoConfirmed(false);
    const firstStore = STORES.find((s) => s.city === city);
    setSelectedStoreId(firstStore ? firstStore.id : "");
  }

  function handleManualStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    setStoreConfirmedManually(true);
    setAutoConfirmed(false);
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    phone.trim().length >= 7 &&
    selectedStoreId &&
    selectedCity &&
    ageRange &&
    gender &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedStore) return;
    setSubmitting(true);
    setSubmitError(null);

    // Генерується на пристрої — це "ключ" до персонального кабінету /app
    // (особисті дані + стрічка розсилок) без окремого логіну/пароля.
    const accessToken = crypto.randomUUID();

    const { error } = await supabase.from("registrations").insert({
      full_name: fullName.trim(),
      phone: phone.trim(),
      city: selectedCity,
      store_id: selectedStore.id,
      store_name: selectedStore.name,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      geo_accuracy_m: coords?.accuracy ?? null,
      distance_to_store_m: nearestDistance,
      store_confirmed_manually: storeConfirmedManually,
      age_range: ageRange,
      gender,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      access_token: accessToken,
    });

    setSubmitting(false);

    if (error) {
      // Унікальний індекс на нормалізованому номері телефону (див.
      // supabase/schema.sql) не дає одній людині отримати знижку двічі —
      // Postgres повертає код 23505 (порушення unique constraint).
      if (error.code === "23505") {
        setAlreadyUsed(true);
        return;
      }
      setSubmitError("Не вдалося надіслати форму. Спробуйте ще раз.");
      return;
    }

    const record: DiscountRecord = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      city: selectedCity,
      storeName: selectedStore.name,
      ageRange,
      genderLabel: GENDERS.find((g) => g.value === gender)?.label ?? gender,
      reloads: 0,
    };
    try {
      localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(record));
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    } catch {
      // localStorage недоступний — знижка все одно покажеться для цієї сесії,
      // просто не переживе перезавантаження сторінки
    }
    setDiscountRecord(record);
  }

  if (alreadyUsed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center animate-fade-up">
          <Logo className="h-9 w-auto text-ink mx-auto mb-6" />
          <h1 className="font-display text-4xl mb-4">знижку вже використано</h1>
          <p className="text-ink">
            За цим номером телефону знижку {DISCOUNT_PERCENT}% вже було надано раніше — вона
            діє лише один раз на людину.
          </p>
          <div className="mt-8 border border-sale text-sale px-6 py-4">
            <p className="label-caps text-xs">продавцю: не застосовувати знижку повторно</p>
          </div>
        </div>
      </main>
    );
  }

  if (discountRecord) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center animate-fade-up">
          <Logo className="h-9 w-auto text-ink mx-auto mb-6" />
          <h1 className="font-display text-4xl mb-4">дякуємо!</h1>
          <p className="text-muted mb-8">
            Вашу реєстрацію отримано. До зустрічі в магазині {discountRecord.storeName},{" "}
            {discountRecord.city}.
          </p>

          <div className="border-2 border-sale px-6 py-8 text-left">
            <p className="label-caps text-sale text-xs mb-2 text-center">ваша знижка</p>
            <p className="font-display text-6xl text-sale mb-6 text-center">
              -{DISCOUNT_PERCENT}%
            </p>

            <div className="border-t border-line pt-5 space-y-2.5">
              <DataRow label="ім'я" value={discountRecord.fullName} />
              <DataRow label="телефон" value={discountRecord.phone} />
              <DataRow
                label="магазин"
                value={`${discountRecord.storeName}, ${discountRecord.city}`}
              />
              <DataRow label="вік" value={discountRecord.ageRange} />
              <DataRow label="стать" value={discountRecord.genderLabel} />
            </div>

            <p className="text-sm text-ink text-center mt-6">
              Покажіть цей екран продавцю на касі — знижка діє одноразово для цієї
              покупки.
            </p>
          </div>

          <a
            href="/app"
            className="mt-8 block w-full border border-ink py-3 text-sm label-caps hover:bg-ink hover:text-paper transition-colors"
          >
            встановити застосунок і отримувати новини
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line">
        <div className="max-w-xl mx-auto px-6 py-7 flex items-center justify-center">
          <Logo className="h-9 w-auto text-ink" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-up">
          <p className="label-caps text-muted text-xs mb-2">реєстрація відвідувача</p>
          <h1 className="font-display text-4xl leading-tight mb-3">
            привіт. розкажи трохи про себе
          </h1>
          <p className="text-muted text-sm">
            Це займе менше хвилини. Дані потрібні лише для того, щоб краще розуміти
            наших відвідувачів у магазинах DeMark.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Ім'я */}
          <section className="animate-fade-up">
            <label htmlFor="fullName" className="label-caps text-xs text-muted block mb-2">
              ім&rsquo;я
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Як до вас звертатись?"
              className="w-full bg-transparent border-b border-line focus:border-ink py-3 text-lg outline-none transition-colors placeholder:text-muted/60"
              required
              minLength={2}
            />
          </section>

          {/* Телефон */}
          <section className="animate-fade-up">
            <label className="label-caps text-xs text-muted block mb-2">номер телефону</label>

            {supportsContactPicker ? (
              <div>
                <button
                  type="button"
                  onClick={handlePickContact}
                  className="w-full border border-ink py-3 text-sm label-caps hover:bg-ink hover:text-paper transition-colors"
                >
                  {phonePicked ? "змінити контакт" : "поділитись номером з контактів"}
                </button>
                {phone && (
                  <p className="mt-3 text-lg">{phone}</p>
                )}
                {contactPickerError && (
                  <p className="mt-2 text-sm text-sale">{contactPickerError}</p>
                )}
              </div>
            ) : (
              <div>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380"
                  className="w-full bg-transparent border-b border-line focus:border-ink py-3 text-lg outline-none transition-colors placeholder:text-muted/60"
                  required
                />
                <p className="mt-2 text-xs text-muted">
                  Вибір номера з контактів недоступний у цьому браузері — введіть його вручну.
                </p>
              </div>
            )}
          </section>

          {/* Геолокація / магазин */}
          <section className="animate-fade-up">
            <label className="label-caps text-xs text-muted block mb-2">твій магазин</label>

            {geoStatus === "idle" && (
              <button
                type="button"
                onClick={handleRequestGeo}
                className="w-full border border-ink py-3 text-sm label-caps hover:bg-ink hover:text-paper transition-colors"
              >
                поділитись геопозицією
              </button>
            )}

            {geoStatus === "requesting" && (
              <p className="text-sm text-muted py-3">визначаємо місцезнаходження…</p>
            )}

            {geoStatus === "unsupported" && (
              <p className="text-sm text-sale py-2">
                Геолокація не підтримується цим браузером. Оберіть магазин вручну нижче.
              </p>
            )}

            {geoStatus === "denied" && geoError && (
              <p className="text-sm text-sale py-2">{geoError}</p>
            )}

            {geoStatus === "granted" && (
              <div className="mb-2">
                {autoConfirmed ? (
                  <p className="text-sm text-success py-2">
                    ✓ магазин визначено автоматично (похибка ≈{Math.round(nearestDistance ?? 0)} м)
                  </p>
                ) : (
                  <p className="text-sm text-sale py-2">
                    Не вдалося точно визначити магазин (найближчий — за {Math.round(nearestDistance ?? 0)} м, це
                    більше за допустиму похибку {GEO_TOLERANCE_M} м). Будь ласка, підтвердьте або оберіть магазин вручну.
                  </p>
                )}
              </div>
            )}

            {(geoStatus === "granted" || geoStatus === "denied" || geoStatus === "unsupported") && (
              <div className="grid grid-cols-1 gap-4 mt-3">
                <div>
                  <label htmlFor="city" className="text-xs text-muted block mb-1">місто</label>
                  <select
                    id="city"
                    value={selectedCity}
                    onChange={(e) => handleManualCityChange(e.target.value)}
                    className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none"
                    required
                  >
                    <option value="" disabled>Оберіть місто</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="store" className="text-xs text-muted block mb-1">магазин</label>
                  <select
                    id="store"
                    value={selectedStoreId}
                    onChange={(e) => handleManualStoreChange(e.target.value)}
                    className="w-full bg-transparent border-b border-line focus:border-ink py-2 outline-none disabled:opacity-50"
                    required
                    disabled={!selectedCity}
                  >
                    <option value="" disabled>Оберіть магазин</option>
                    {storesForCity.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Вік */}
          <section className="animate-fade-up">
            <label className="label-caps text-xs text-muted block mb-3">вік</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {AGE_RANGES.map((range) => (
                <button
                  type="button"
                  key={range}
                  onClick={() => setAgeRange(range)}
                  className={`border py-2 text-sm transition-colors ${
                    ageRange === range
                      ? "bg-ink text-paper border-ink"
                      : "border-line hover:border-ink"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </section>

          {/* Стать */}
          <section className="animate-fade-up">
            <label className="label-caps text-xs text-muted block mb-3">стать</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`border py-2 text-sm transition-colors ${
                    gender === g.value
                      ? "bg-ink text-paper border-ink"
                      : "border-line hover:border-ink"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </section>

          {submitError && <p className="text-sm text-sale">{submitError}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-ink text-paper py-4 label-caps text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {submitting ? "надсилаємо…" : "завершити реєстрацію"}
          </button>
        </form>
      </div>
    </main>
  );
}
