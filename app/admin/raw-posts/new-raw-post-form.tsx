"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function NewRawPostForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    const payload = {
      sourceHandle: formData.get("sourceHandle"),
      originalText: formData.get("originalText"),
      originalUrl: formData.get("originalUrl"),
      postedAt: formData.get("postedAt"),
      language: formData.get("language"),
    };

    const response = await fetch("/api/admin/raw-posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setState({
        status: "error",
        message: body?.message ?? "원문 저장에 실패했습니다.",
      });
      return;
    }

    event.currentTarget.reset();
    setState({ status: "success", message: "원문을 저장했습니다." });
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-2">
        <label htmlFor="sourceHandle" className="text-sm font-medium">
          X 계정
        </label>
        <input
          id="sourceHandle"
          name="sourceHandle"
          placeholder="@FabrizioRomano"
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="originalUrl" className="text-sm font-medium">
          원문 URL
        </label>
        <input
          id="originalUrl"
          name="originalUrl"
          type="url"
          required
          placeholder="https://x.com/account/status/..."
          className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="originalText" className="text-sm font-medium">
          원문 텍스트
        </label>
        <textarea
          id="originalText"
          name="originalText"
          required
          rows={8}
          placeholder="X 게시물 원문을 붙여넣으세요."
          className="resize-y border border-zinc-300 p-3 text-sm leading-6 outline-none focus:border-zinc-950"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="postedAt" className="text-sm font-medium">
            게시 시간
          </label>
          <input
            id="postedAt"
            name="postedAt"
            type="datetime-local"
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="language" className="text-sm font-medium">
            원문 언어
          </label>
          <input
            id="language"
            name="language"
            placeholder="en"
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="h-11 bg-zinc-950 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {state.status === "submitting" ? "저장 중" : "원문 저장"}
        </button>
        {state.message ? (
          <p
            className={
              state.status === "error"
                ? "text-sm text-red-600"
                : "text-sm text-zinc-600"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
