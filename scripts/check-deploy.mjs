#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function activeLines(text) {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

export function checkDockerfile(text) {
  const body = activeLines(text);
  const errors = [];
  if (!/^FROM node:22/m.test(body)) errors.push("Dockerfile must start from node 22");
  if (!body.includes("USER 10001")) errors.push("Dockerfile must drop to uid 10001");
  if (!body.includes("EXPOSE 8080")) errors.push("Dockerfile must expose 8080");
  if (/privileged:\s*true/.test(body)) errors.push("Dockerfile must not set privileged");
  if (!body.includes("NITRO_PRESET=node-server")) errors.push("Image build must use the node server preset");
  return errors;
}

export function checkCompose(text) {
  const body = activeLines(text);
  const errors = [];
  const required = body.split("MERIDIAN_MASTER_KEY").length - 1;
  if (required < 3) errors.push("Compose must require MERIDIAN_MASTER_KEY for migrate, web, and worker");
  if (/privileged:\s*true/.test(body)) errors.push("Compose must not set privileged");
  if (!body.includes("DATABASE_URL:")) errors.push("Compose must point web at Postgres");
  return errors;
}

export function checkNoDiskKey(text) {
  const body = activeLines(text);
  const errors = [];
  if (body.includes("master.key")) errors.push("Master key must not be written to disk");
  if (body.includes("writeFileSync")) errors.push("Master key module must not write a key file");
  return errors;
}

export function checkHelmWorker(text) {
  const body = activeLines(text);
  const errors = [];
  if (!body.includes("runAsNonRoot: true")) errors.push("Worker must run as non-root");
  if (!body.includes("runAsUser: 10001")) errors.push("Worker must use uid 10001");
  if (!body.includes("scripts/worker.mjs")) errors.push("Worker must start scripts/worker.mjs");
  if (!body.includes("--experimental-strip-types")) errors.push("Worker must run with type stripping");
  if (/privileged:\s*true/.test(body)) errors.push("Worker must not be privileged");
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const problems = [
    ...checkDockerfile(read("../Dockerfile")),
    ...checkCompose(read("../infrastructure/docker-compose.yml")),
    ...checkHelmWorker(read("../infrastructure/helm/meridian/templates/worker-deployment.yaml")),
    ...checkNoDiskKey(read("../src/lib/platform/durable-server.ts")),
  ];
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("deploy files checked");
}
