export type Role = "viewer" | "creator" | "moderator";

export const RANK: Record<Role, number> = {
  viewer: 0,
  creator: 1,
  moderator: 2,
};

export function parseRole(raw?: string): Role {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "viewer" || v === "creator" || v === "moderator") return v;
  return "viewer";
}

export function isAllowed(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function canAccess(pathname: string, role: Role): boolean {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/upload" || path.startsWith("/upload/")) {
    return isAllowed(role, ["creator", "moderator"]);
  }
  if (path === "/moderate" || path.startsWith("/moderate/")) {
    return isAllowed(role, ["moderator"]);
  }
  return true;
}

