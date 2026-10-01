#!/usr/bin/env node
/**
 * Always-on worker. With DATABASE_URL it claims jobs, webhook deliveries, and
 * notification rows. Without DATABASE_URL the web process pumps the embedded
 * database, and this process stays idle so it does not lock that file.
 */
import { spawn } from "node:child_process";

if (!process.execArgv.includes("--experimental-strip-types")) {
  const child = spawn(process.execPath, ["--experimental-strip-types", process.argv[1]], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  const { runForever } = await import("../src/lib/jobs/worker-loop.ts");
  await runForever();
}
