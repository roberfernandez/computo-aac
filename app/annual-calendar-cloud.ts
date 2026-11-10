import { authenticatedUserId, readSharedSession, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./tmb-session";
const BUCKET = "computo-annual-private";
async function auth() {
  const session = readSharedSession();
  if (!session) return null;
  const userId = await authenticatedUserId(session);
  return userId ? { token: session.access_token, userId } : null;
}
function endpoint(userId: string, year: number) {
  return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${userId}/${year}.jpg`;
}
function headers(token: string) { return { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${token}` }; }
export async function loadAnnualCalendarImage(year: number): Promise<string | null> {
  const user = await auth();
  if (!user) return null;
  const response = await fetch(endpoint(user.userId, year), { headers: headers(user.token), cache: "no-store" });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Download image: ${response.status}`);
  return URL.createObjectURL(await response.blob());
}
export async function saveAnnualCalendarImage(year: number, file: File): Promise<void> {
  const user = await auth();
  if (!user) throw new Error("Inicia sesión para guardar la imagen en la nube.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo comprimir la imagen.")), "image/jpeg", 0.78));
    if (blob.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB.");
    const response = await fetch(endpoint(user.userId, year), { method: "POST", headers: { ...headers(user.token), "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob });
    if (!response.ok) throw new Error(`Upload image: ${response.status}`);
  } finally { bitmap.close(); }
}
export async function removeAnnualCalendarImage(year: number): Promise<void> {
  const user = await auth();
  if (!user) return;
  const response = await fetch(endpoint(user.userId, year), { method: "DELETE", headers: headers(user.token) });
  if (!response.ok && response.status !== 404) throw new Error(`Delete image: ${response.status}`);
}
