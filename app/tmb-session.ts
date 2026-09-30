export const SESSION_KEY = "sb-hhenkvendzengggrgook-auth-token";
export const SUPABASE_URL = "https://hhenkvendzengggrgook.supabase.co";
export const SUPABASE_PUBLIC_KEY = "sb_publishable_QSPDTmh3fd0FH-VvAjH5KQ_Rfvzr2x_";

export type SharedSession = { access_token: string; expires_at: number; user?: { id?: string } };

export function readSharedSession(): SharedSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as SharedSession | null;
    if (!session?.access_token || !Number.isFinite(session.expires_at) || session.expires_at * 1000 <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function authenticatedUserId(session = readSharedSession()) {
  if (!session) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user.id : null;
}
