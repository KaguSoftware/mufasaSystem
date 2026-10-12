/**
 * Public certificate verification codes: 10 characters in the form XXXX-XXXX-XX.
 * The alphabet drops look-alikes (0/O, 1/I/L) so a code can be read aloud or retyped.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

/** Pure formatter: 10 raw characters to XXXX-XXXX-XX. */
export function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

/**
 * Generates a code. `random` returns a uniform byte (0..255); the default uses Web Crypto.
 * Rejection sampling keeps the distribution uniform over the 31-letter alphabet.
 */
export function generateCode(random: () => number = defaultByte): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let raw = "";
  while (raw.length < CODE_LENGTH) {
    const b = random();
    if (b >= limit) continue;
    raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return formatCode(raw);
}

function defaultByte(): number {
  const a = new Uint8Array(1);
  crypto.getRandomValues(a);
  return a[0]!;
}

/** Normalizes user input ("k7mp 2xq9 ht") to canonical form, or null when it cannot be a code. */
export function normalizeCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== CODE_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return formatCode(raw);
}

/** Child safety: minors show a first name only. */
export function recipientNameFor(displayName: string, minor: boolean): string {
  const name = displayName.trim().replace(/\s+/g, " ");
  return minor ? (name.split(" ")[0] ?? name) : name;
}

/** Public verification shows the first name only, always. */
export function firstName(fullName: string): string {
  return recipientNameFor(fullName, true);
}
