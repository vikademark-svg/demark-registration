export type Store = {
  id: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
};

// Координати взято з наданих посилань Google Maps.
export const STORES: Store[] = [
  {
    id: "ternopil-ornava",
    city: "Тернопіль",
    name: 'ТЦ "Орнава"',
    lat: 49.5456188,
    lng: 25.5893798,
  },
  {
    id: "ternopil-podolyany",
    city: "Тернопіль",
    name: 'ТРЦ "Подоляни"',
    lat: 49.5754693,
    lng: 25.6388411,
  },
  {
    id: "ternopil-sheptytskoho",
    city: "Тернопіль",
    name: "вул. Шептицького",
    lat: 49.5483712,
    lng: 25.5948932,
  },
  {
    id: "if-mickiewicza",
    city: "Івано-Франківськ",
    name: "вул. Міцкевича",
    lat: 48.9215779,
    lng: 24.7113266,
  },
  {
    id: "if-veles",
    city: "Івано-Франківськ",
    name: 'ТРЦ "Велес"',
    lat: 48.9399728,
    lng: 24.7378917,
  },
];

/** Відстань між двома точками (метри), формула гаверсинуса. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Знаходить найближчий до координат магазин та відстань до нього (м). */
export function findNearestStore(lat: number, lng: number) {
  let nearest: Store | null = null;
  let minDist = Infinity;
  for (const store of STORES) {
    const d = distanceMeters(lat, lng, store.lat, store.lng);
    if (d < minDist) {
      minDist = d;
      nearest = store;
    }
  }
  return { store: nearest, distance: minDist };
}
