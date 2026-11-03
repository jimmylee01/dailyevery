import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { findLoginUser } from "@/lib/users";

// 내 컴퓨터에서 테스트할 때만 쓰는 이메일 로그인 (배포 환경에서는 절대 켜지지 않음)
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "테스트 로그인",
            credentials: { email: { label: "이메일" } },
            async authorize(c) {
              const u = await findLoginUser(String(c?.email ?? ""));
              return u ? { id: u.email, email: u.email, name: u.name } : null;
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // ADMIN_EMAILS에 있는 계정만 로그인 (나 혼자 쓰는 사이트)
    async signIn({ user }) {
      return (await findLoginUser(user.email)) !== null;
    },
  },
});
