import { execSync } from "node:child_process";

execSync("npx prisma migrate deploy", {
    env: {...process.env,  DATABASE_URL: "file:./prisma/test.db"},
    stdio: "inherit",
});


