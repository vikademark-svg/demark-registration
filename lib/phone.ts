/**
 * Валідація та нормалізація українських номерів телефону.
 *
 * Приймає лише українські номери (код країни +380) у будь-якому з
 * поширених записів — з пробілами/дефісами/дужками, з "+" чи без нього,
 * і в локальному форматі з провідним 0:
 *   +380 50 123 45 67 · 380501234567 · 0501234567
 *
 * Навмисно НЕ приймає номери інших країн (+1, +44, +7 тощо) — і ручне
 * поле, і номер, обраний через Contact Picker, мають відповідати цьому
 * формату, інакше реєстрація не приймається.
 */

const UKRAINE_INTERNATIONAL = /^380\d{9}$/;
const UKRAINE_LOCAL = /^0\d{9}$/;

/** Повертає нормалізований вигляд +380XXXXXXXXX або null, якщо номер не валідний/не український. */
export function normalizeUkrainianPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  if (UKRAINE_INTERNATIONAL.test(digits)) {
    return `+${digits}`;
  }
  if (UKRAINE_LOCAL.test(digits)) {
    return `+380${digits.slice(1)}`;
  }
  return null;
}

export function isValidUkrainianPhone(raw: string): boolean {
  return normalizeUkrainianPhone(raw) !== null;
}
