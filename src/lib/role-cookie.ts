import { cookies } from "next/headers";

import { parseRole, type Role } from "./roles";

export const COOKIE_NAME = "role";

export async function getRoleFromCookies(): Promise<Role> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  return parseRole(raw);
}

export async function setRoleCookie(role: Role): Promise<void> {
  const c = await cookies();
  c.set({
    name: COOKIE_NAME,
    value: role,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Intentionally not HttpOnly so client UI can read/reflect role if needed.
  });
}
