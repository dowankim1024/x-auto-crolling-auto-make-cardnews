import { z } from "zod";

const sourceAccountInputSchema = z.object({
  platform: z
    .string()
    .trim()
    .min(1, "플랫폼을 입력하세요.")
    .transform((value) => value.toUpperCase()),
  handle: z
    .string()
    .trim()
    .min(1, "계정 핸들을 입력하세요.")
    .transform((value) => value.replace(/^@+/, "")),
  displayName: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  sportType: z
    .string()
    .trim()
    .min(1, "스포츠 종목을 입력하세요.")
    .transform((value) => value.toUpperCase()),
  sourceTier: z.coerce
    .number()
    .int("티어는 정수여야 합니다.")
    .min(1, "티어는 1 이상이어야 합니다.")
    .max(3, "티어는 3 이하여야 합니다."),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => parseBoolean(value)),
});

export type SourceAccountInput = {
  platform: string;
  handle: string;
  displayName?: string;
  sportType: string;
  sourceTier: number;
  isActive: boolean;
};

export class SourceAccountInputError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "SourceAccountInputError";
  }
}

export function parseSourceAccountInput(input: unknown): SourceAccountInput {
  const result = sourceAccountInputSchema.safeParse(input);

  if (!result.success) {
    throw new SourceAccountInputError(
      "SourceAccount input validation failed.",
      result.error.flatten().fieldErrors,
    );
  }

  return {
    ...result.data,
    isActive: result.data.isActive ?? true,
  };
}

function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "on", "yes"].includes(value.trim().toLowerCase());
  }

  return true;
}
