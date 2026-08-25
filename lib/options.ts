export const AGE_RANGES = ["16-24", "25-35", "36-45", "46-55", "56+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const GENDERS = [
  { value: "male", label: "чоловік" },
  { value: "female", label: "жінка" },
  { value: "not_specified", label: "не хочу зазначати" },
] as const;
export type Gender = (typeof GENDERS)[number]["value"];
