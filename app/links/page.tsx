import { requireUser } from "@/lib/session";
import { getItems } from "@/lib/data";
import { deleteItem } from "@/lib/actions";
import { AddItemForm, ImportForm, ItemRow } from "@/components/LinkForms";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function LinksPage() {
  await requireUser();
  const items = await getItems(true);
  const groups = [...new Set(items.map((i) => i.grp).filter(Boolean))];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">링크 관리 <span className="text-base font-normal text-stone-500">{items.filter((i) => i.active).length}개 사용 중</span></h1>
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">목록 붙여넣기로 한 번에 넣기</h2>
        <p className="text-xs text-stone-500">메모장 · 노션 · 카톡에 적어 둔 &lsquo;14. 입학설명회&rsquo; + 링크 목록을 통째로 복사해 붙여넣으세요. 링크가 여러 줄로 끊겨 있어도 이어 붙입니다. 이미 있는 주소는 건너뜁니다.</p>
        <ImportForm groups={groups} />
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">하나 추가</h2>
        <AddItemForm groups={groups} />
      </section>
      <section className="card">
        <div className="hidden gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600 sm:grid sm:grid-cols-[56px_1fr_2fr_130px_60px_auto]">
          <span className="text-right">번호</span><span>이름</span><span>링크</span><span>묶음</span><span>사용</span><span />
        </div>
        {items.map((i) => (
          <div key={i.id} className="relative">
            <ItemRow item={i} groups={groups} />
            <form action={deleteItem} className="absolute bottom-2 right-3">
              <input type="hidden" name="id" value={i.id} />
              <ConfirmButton message={`'${i.title}'을(를) 지울까요? 체크 기록도 함께 지워집니다. (잠깐 빼려면 '사용'만 끄세요)`} className="text-xs text-stone-400 hover:text-rose-700">지우기</ConfirmButton>
            </form>
          </div>
        ))}
        {items.length === 0 && <p className="p-6 text-center text-sm text-stone-400">아직 링크가 없습니다.</p>}
      </section>
      <p className="text-xs text-stone-500">번호 순서대로 오늘 화면에 나옵니다. 묶음을 정하면 오늘 화면에서 묶음별로 나뉩니다. &lsquo;사용&rsquo;을 끄면 오늘 목록에서 빠지고 기록은 남습니다.</p>
    </div>
  );
}
