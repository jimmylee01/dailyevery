import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findLoginUser, type AppUser } from "@/lib/users";

export const currentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth();
  return findLoginUser(session?.user?.email);
});

export async function requireUser(): Promise<AppUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
