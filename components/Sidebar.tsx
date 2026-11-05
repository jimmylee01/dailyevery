import Link from "next/link";
import { color, DEFAULT_LIST, type Label, type List } from "@/lib/task-types";
import { AddLabelForm, AddListForm } from "@/components/ListForms";

type Counts = { today: number; important: number; planned: number; inbox: number; overdue: number };

export function Sidebar({ active, counts, lists, labels }: { active: string; counts: Counts; lists: List[]; labels: Label[] }) {
  const item = (key: string, href: string, icon: string, label: string, n?: number, cls = "") => (
    <Link key={key} href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${active === key ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"}`}>
      <span className={`w-5 text-center ${cls}`}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!n && <span className="text-xs tabular-nums text-stone-500">{n}</span>}
    </Link>
  );
  return (
    <nav className="space-y-0.5 rounded-xl bg-stone-100/80 p-2 lg:sticky lg:top-4">
      {item("today", "/", "☀", "오늘 할 일", counts.today, "text-indigo-600")}
      {item("important", "/?v=important", "★", "중요", counts.important, "text-rose-700")}
      {item("planned", "/?v=planned", "📅", "계획된 일정", counts.planned)}
      {item("inbox", "/?v=inbox", "🏠", DEFAULT_LIST, counts.inbox)}
      <div className="my-2 border-t border-stone-200" />
      {item("done", "/?v=done", "✓", "끝난 일", undefined, "text-emerald-700")}
      {lists.map((l) => (
        <Link key={l.id} href={`/?v=list&id=${l.id}`}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${active === `list${l.id}` ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"}`}>
          <span className="flex w-5 justify-center"><span className={`h-2.5 w-2.5 rounded-full ${color(l.color).dot}`} /></span>
          <span className="min-w-0 flex-1 truncate">{l.name}</span>
          {!!l.open && <span className="text-xs tabular-nums text-stone-500">{l.open}</span>}
        </Link>
      ))}
      <AddListForm />
      <div className="my-2 border-t border-stone-200" />
      <div className="px-2.5 pb-0.5 text-[11px] font-semibold text-stone-500">라벨</div>
      {labels.map((l) => (
        <Link key={l.id} href={`/?v=label&id=${l.id}`}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1 text-sm ${active === `label${l.id}` ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"}`}>
          <span className={`flex w-5 justify-center ${color(l.color).text}`}>#</span>
          <span className="min-w-0 flex-1 truncate">{l.name}</span>
          {!!l.open && <span className="text-xs tabular-nums text-stone-500">{l.open}</span>}
        </Link>
      ))}
      <AddLabelForm />
    </nav>
  );
}
