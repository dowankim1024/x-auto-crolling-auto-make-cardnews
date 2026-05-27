import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const { createXApiClientFromEnv } = await import("@/lib/x-api");
  const {
    getActiveXSourceAccounts,
    syncConfiguredXSourceAccounts,
  } = await import("@/lib/x-source-accounts");
  const { prisma } = await import("@/lib/prisma");

  try {
    await syncConfiguredXSourceAccounts();
    const accounts = await getActiveXSourceAccounts();
    const client = createXApiClientFromEnv();
    const result = await client.syncWatchedAccountRule(accounts);

    console.log(
      JSON.stringify(
        {
          activeAccounts: accounts.map((account) => account.handle),
          ruleValue: result.ruleValue,
          unchanged: result.unchanged,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}
