/** Pure age helpers. Birth year only by design (child safety), so ages are approximate. */

export const ADULT_AGE = 18;

export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date()): number | null {
  return birthYear ? now.getFullYear() - birthYear : null;
}

/**
 * Managed children are always minors. Otherwise a known age under 18 is a minor.
 * An unknown birth year for a student is treated as a minor (safe default);
 * for other roles (parents, staff) unknown means adult.
 */
export function isMinor(
  input: { isManagedChild?: boolean | null; birthYear?: number | null; role?: string | null },
  now = new Date(),
): boolean {
  if (input.isManagedChild) return true;
  const age = ageFromBirthYear(input.birthYear, now);
  if (age !== null) return age < ADULT_AGE;
  return (input.role ?? "student") === "student";
}

/** Valid birth year range for the sign-up forms. */
export function isPlausibleBirthYear(year: number, now = new Date()): boolean {
  return Number.isInteger(year) && year >= now.getFullYear() - 100 && year <= now.getFullYear();
}

/** Can this person create their own student account (13+)? */
export function canSelfSignup(birthYear: number, minAge = 13, now = new Date()): boolean {
  return isPlausibleBirthYear(birthYear, now) && now.getFullYear() - birthYear >= minAge;
}
