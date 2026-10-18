// Public, local-only demo values. Never reuse this comparison for real auth.
export const mockCredentials = { username: "atelier", password: "demo123" } as const;

export function normalizeMockInput(value: string) {
  // Hebrew/RTL copy-paste may carry invisible directional formatting marks.
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

export function acceptsMockCredentials(username: string, password: string) {
  return (
    normalizeMockInput(username).toLowerCase() === mockCredentials.username &&
    normalizeMockInput(password) === mockCredentials.password
  );
}
