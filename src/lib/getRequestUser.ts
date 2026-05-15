import { cookies } from "next/headers";
import { getSession } from "./authStore";

export async function getRequestUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("codcrm_session")?.value;
  if (!token) return null;
  return getSession(token); // now async → returns Promise<User | null>
}
