export type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner (the site does not depend on clsx/tailwind-merge). */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
