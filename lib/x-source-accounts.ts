import { prisma } from "@/lib/prisma";
import { normalizeXHandle } from "@/lib/x-stream";
import { WATCHED_X_SOURCE_ACCOUNTS } from "@/config/x-source-accounts";

export async function syncConfiguredXSourceAccounts() {
  return Promise.all(
    WATCHED_X_SOURCE_ACCOUNTS.map((account) =>
      prisma.sourceAccount.upsert({
        where: {
          handle: normalizeXHandle(account.handle),
        },
        create: {
          platform: "X",
          handle: normalizeXHandle(account.handle),
          displayName: account.displayName,
          sportType: account.sportType,
          sourceTier: account.sourceTier,
          isActive: account.isActive,
        },
        update: {
          displayName: account.displayName,
          sportType: account.sportType,
          sourceTier: account.sourceTier,
          isActive: account.isActive,
        },
      }),
    ),
  );
}

export async function getActiveXSourceAccounts() {
  return prisma.sourceAccount.findMany({
    where: {
      platform: "X",
      isActive: true,
    },
    orderBy: [
      { sourceTier: "asc" },
      { handle: "asc" },
    ],
  });
}
