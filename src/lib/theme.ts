export const ACCENTS = ["mint", "lavender", "peach", "sky"] as const;
export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: Accent = "mint";

export function parseAccent(value: string | undefined): Accent {
  return (ACCENTS as readonly string[]).includes(value ?? "")
    ? (value as Accent)
    : DEFAULT_ACCENT;
}
