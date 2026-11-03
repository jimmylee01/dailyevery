import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, devLoginEnabled } from "@/auth";
import { currentUser } from "@/lib/session";

const ERRORS: Record<string, string> = {
  AccessDenied: "허용된 계정이 아닙니다. Vercel 환경변수 ADMIN_EMAILS에 이 구글 계정이 있는지 확인하세요.",
  CredentialsSignin: "등록된 이메일이 아닙니다.",
  Configuration: "로그인 설정에 문제가 있습니다. 관리자에게 알려 주세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: nextRaw } = await searchParams;
  // 메일 링크 등에서 넘어온 '로그인 뒤 갈 곳' (우리 사이트 안 주소만)
  const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  if (!error && (await currentUser())) redirect(next);
  return (
    <div className="mx-auto mt-16 max-w-sm card p-6">
      <h1 className="text-lg font-semibold">DailyEvery</h1>
      <p className="mt-1 text-sm text-stone-500">내 구글 계정으로 로그인하세요.</p>
      {error && <p className="mt-4 rounded bg-rose-50 p-2 text-sm text-rose-700">{ERRORS[error] ?? "로그인하지 못했습니다."}</p>}
      <form
        className="mt-5"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: next });
        }}
      >
        <button className="btn w-full !py-2">Google 계정으로 로그인</button>
      </form>
      {devLoginEnabled && (
        <form
          className="mt-6 border-t border-dashed border-stone-300 pt-4"
          action={async (fd: FormData) => {
            "use server";
            try {
              await signIn("dev", { email: String(fd.get("email") ?? ""), redirectTo: next });
            } catch (e) {
              if (e instanceof AuthError) redirect("/login?error=CredentialsSignin");
              throw e;
            }
          }}
        >
          <p className="label">테스트 로그인 (내 컴퓨터에서만 보임)</p>
          <div className="flex gap-2">
            <input name="email" className="input" placeholder="등록된 이메일" />
            <button className="btn-ghost">입장</button>
          </div>
        </form>
      )}
    </div>
  );
}
