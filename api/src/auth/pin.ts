// A PIN is weak if it is easy to guess. FR-AUTH-09: reject these when a PIN is set or reset.
export function isWeakPin(pin: string): boolean {
  return new Set(pin).size === 1; // every digit is the same: 0000, 1111, ...
}
