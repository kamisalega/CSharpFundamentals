import { execSync } from "node:child_process";

execSync("npx prisma migrate deploy", {
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      "postgresql://hotel:hotel@localhost:5432/hotel_bot_test",
  },
  stdio: "inherit",
});
