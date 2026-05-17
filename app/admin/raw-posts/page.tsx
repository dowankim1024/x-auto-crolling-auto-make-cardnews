import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { NewRawPostForm } from "./new-raw-post-form";

export const dynamic = "force-dynamic";

export default async function RawPostsPage() {
  const rawPosts = await prisma.rawPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    include: {
      sourceAccount: true,
      translation: true,
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="grid gap-2">
          <p className="text-sm font-medium text-zinc-500">Admin</p>
          <h1 className="text-3xl font-semibold">Raw Post Inbox</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            X 원문을 수동으로 등록하고 이후 번역, 승인, 카드뉴스 초안 생성
            플로우로 넘기는 첫 단계입니다.
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">수동 입력</h2>
          <NewRawPostForm />
        </section>

        <section className="grid gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">최근 원문</h2>
              <p className="mt-1 text-sm text-zinc-600">
                최신 등록 30개를 표시합니다.
              </p>
            </div>
            <Link
              href="/api/admin/raw-posts"
              className="text-sm font-medium text-zinc-700 underline underline-offset-4"
            >
              JSON 보기
            </Link>
          </div>

          <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
            {rawPosts.length === 0 ? (
              <p className="p-6 text-sm text-zinc-600">
                아직 등록된 원문이 없습니다.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200">
                {rawPosts.map((post) => (
                  <article key={post.id} className="grid gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-800">
                        {post.sourceAccount?.handle
                          ? `@${post.sourceAccount.handle}`
                          : "Manual"}
                      </span>
                      <span>{post.status}</span>
                      <span>{post.postedAt.toLocaleString("ko-KR")}</span>
                      {post.language ? <span>{post.language}</span> : null}
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6">
                      {post.originalText}
                    </p>
                    <a
                      href={post.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-xs text-zinc-500 underline underline-offset-4"
                    >
                      {post.originalUrl}
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
