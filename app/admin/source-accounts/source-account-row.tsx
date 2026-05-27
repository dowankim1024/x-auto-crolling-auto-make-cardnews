"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SourceAccount = {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  sportType: string;
  sourceTier: number;
  isActive: boolean;
  _count: {
    rawPosts: number;
  };
};

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "error"; message: string };

export function SourceAccountRow({ sourceAccount }: { sourceAccount: SourceAccount }) {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    const payload = {
      platform: formData.get("platform"),
      handle: formData.get("handle"),
      displayName: formData.get("displayName"),
      sportType: formData.get("sportType"),
      sourceTier: formData.get("sourceTier"),
      isActive: formData.get("isActive"),
    };

    const response = await fetch(`/api/admin/source-accounts/${sourceAccount.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setState({
        status: "error",
        message: body?.message ?? "저장에 실패했습니다.",
      });
      return;
    }

    setState({ status: "idle" });
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`@${sourceAccount.handle}을(를) 삭제할까요?`)) {
      return;
    }

    setState({ status: "submitting" });
    const response = await fetch(`/api/admin/source-accounts/${sourceAccount.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setState({
        status: "error",
        message: body?.message ?? "삭제에 실패했습니다.",
      });
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="grid gap-4 p-5">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]">
        <input
          name="platform"
          defaultValue={sourceAccount.platform}
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
        <input
          name="handle"
          defaultValue={sourceAccount.handle}
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
        <input
          name="displayName"
          defaultValue={sourceAccount.displayName ?? ""}
          placeholder="Display name"
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
        <input
          name="sportType"
          defaultValue={sourceAccount.sportType}
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
        <input
          name="sourceTier"
          type="number"
          min={1}
          max={3}
          defaultValue={sourceAccount.sourceTier}
          className="h-11 w-20 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={sourceAccount.isActive}
          />
          Active
        </label>
        <span className="text-xs text-zinc-500">
          Raw posts: {sourceAccount._count.rawPosts}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="h-10 bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={state.status === "submitting"}
          className="h-10 border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          삭제
        </button>
        {state.message ? (
          <p className="text-sm text-red-600">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
