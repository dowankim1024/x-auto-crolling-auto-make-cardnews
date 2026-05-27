import { prisma } from "@/lib/prisma";
import { SourceAccountForm } from "./source-account-form";
import { SourceAccountRow } from "./source-account-row";

export const dynamic = "force-dynamic";

export default async function SourceAccountsPage() {
  const sourceAccounts = await prisma.sourceAccount.findMany({
    orderBy: [
      { platform: "asc" },
      { sourceTier: "asc" },
      { handle: "asc" },
    ],
    include: {
      _count: {
        select: {
          rawPosts: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="grid gap-2">
          <p className="text-sm font-medium text-zinc-500">Admin</p>
          <h1 className="text-3xl font-semibold">Source Accounts</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            자동 수집할 X 계정을 등록하고, 티어와 활성 상태를 관리합니다.
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">계정 추가</h2>
          <SourceAccountForm />
        </section>

        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">등록된 계정</h2>
            <p className="mt-1 text-sm text-zinc-600">
              총 {sourceAccounts.length}개 계정
            </p>
          </div>

          <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
            {sourceAccounts.length === 0 ? (
              <p className="p-6 text-sm text-zinc-600">
                아직 등록된 SourceAccount가 없습니다.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200">
                {sourceAccounts.map((sourceAccount) => (
                  <div key={sourceAccount.id} className="grid gap-2">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-5 pt-5">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium">
                          @{sourceAccount.handle}
                        </span>
                        <span className="text-zinc-500">
                          {sourceAccount.platform}
                        </span>
                        <span className="text-zinc-500">
                          tier {sourceAccount.sourceTier}
                        </span>
                        <span className="text-zinc-500">
                          raw posts {sourceAccount._count.rawPosts}
                        </span>
                      </div>
                      <span
                        className={
                          sourceAccount.isActive
                            ? "text-xs font-medium text-emerald-700"
                            : "text-xs font-medium text-zinc-500"
                        }
                      >
                        {sourceAccount.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <SourceAccountRow sourceAccount={sourceAccount} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
