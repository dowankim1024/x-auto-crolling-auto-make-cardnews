import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const { syncConfiguredXSourceAccounts } = await import("@/lib/x-source-accounts");
  const { prisma } = await import("@/lib/prisma");

  try {
    const accounts = await syncConfiguredXSourceAccounts();
    console.log(
      JSON.stringify(
        {
          synced: accounts.map((account) => ({
            handle: account.handle,
            sportType: account.sportType,
            sourceTier: account.sourceTier,
            isActive: account.isActive,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}
