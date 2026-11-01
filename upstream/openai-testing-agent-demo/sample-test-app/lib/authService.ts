/**
 * Client-side helper: sends username/password to the backend
 * and returns the JWT (or any token string your API issues).
 */
export async function login(
  username: string,
  password: string
): Promise<string> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error("Login failed");
  }
  const data: { token: string } = await res.json();

  return data.token;
}
