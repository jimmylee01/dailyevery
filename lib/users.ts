export type AppUser = { email: string; name: string };

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** 로그인 허용: Vercel 환경변수 ADMIN_EMAILS에 있는 계정만 */
export async function findLoginUser(email: string | null | undefined): Promise<AppUser | null> {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return adminEmails().includes(e) ? { email: e, name: e } : null;
}
