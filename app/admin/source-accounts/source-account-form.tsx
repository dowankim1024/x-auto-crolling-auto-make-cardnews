"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function SourceAccountForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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

    const response = await fetch("/api/admin/source-accounts", {
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
        message: body?.message ?? "SourceAccount 저장에 실패했습니다.",
      });
      return;
    }

    event.currentTarget.reset();
    setState({ status: "success", message: "SourceAccount를 저장했습니다." });
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="platform" className="text-sm font-medium">
            Platform
          </label>
          <input
            id="platform"
            name="platform"
            defaultValue="X"
            required
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="handle" className="text-sm font-medium">
            Handle
          </label>
          <input
            id="handle"
            name="handle"
            placeholder="@FabrizioRomano"
            required
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="displayName" className="text-sm font-medium">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            placeholder="Fabrizio Romano"
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="sportType" className="text-sm font-medium">
            Sport type
          </label>
          <input
            id="sportType"
            name="sportType"
            placeholder="PL"
            required
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="sourceTier" className="text-sm font-medium">
            Source tier
          </label>
          <select
            id="sourceTier"
            name="sourceTier"
            defaultValue="1"
            className="h-11 border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>

        <label className="flex items-center gap-3 pt-8 text-sm font-medium">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            value="true"
            className="h-4 w-4"
          />
          Active
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="h-11 bg-zinc-950 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {state.status === "submitting" ? "저장 중" : "SourceAccount 저장"}
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
