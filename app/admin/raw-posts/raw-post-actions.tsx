"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RawPostActionsProps = {
  rawPostId: string;
  status: string;
};

export function RawPostActions({ rawPostId, status }: RawPostActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canAccept = status === "NEW" || status === "ERROR" || status === "ACCEPTED";

  async function accept() {
    setError(null);

    const response = await fetch(`/api/admin/raw-posts/${rawPostId}/accept`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.message ?? "Accept 처리에 실패했습니다.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 sm:justify-items-end">
      <button
        type="button"
        onClick={accept}
        disabled={!canAccept || isPending}
        className="inline-flex min-h-9 items-center justify-center border border-zinc-900 bg-zinc-900 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
      >
        {isPending ? "처리 중" : status === "TRANSLATED" ? "초안 생성됨" : "Accept"}
      </button>
      {error ? <p className="max-w-xs text-xs leading-5 text-red-600">{error}</p> : null}
    </div>
  );
}
