import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/session";
import { signOut } from "@/auth";

export const metadata: Metadata = {
  title: "DailyEvery",
  description: "DailyEvery — 매일 확인하는 링크 체크리스트 · 기록표",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const links = user ? [["/", "오늘"], ["/board", "기록표"], ["/links", "링크 관리"]] : [];
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2 font-semibold text-brand">
              <span className="inline-block h-6 w-6 rounded-md bg-brand text-center text-sm leading-6 text-white">✓</span>
              DailyEvery
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="rounded px-2.5 py-1 text-stone-700 hover:bg-stone-100">{label}</Link>
              ))}
            </nav>
            {user && (
              <form className="ml-auto flex items-center gap-2 text-xs text-stone-500" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                <span>{user.email}</span>
                <button className="btn-ghost !px-2 !py-1 text-xs">로그아웃</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
