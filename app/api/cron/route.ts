import { sendReminder } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Vercel Cron이 매일 아침 부름 (vercel.json). CRON_SECRET이 맞아야만 보냄 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await sendReminder());
}
