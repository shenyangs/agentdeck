#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipVerify = args.has("--skip-verify");
const push = args.has("--push");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ""}${result.stderr || ""}`.trim();
    throw new Error(detail || `${command} ${commandArgs.join(" ")} failed`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function latestVersionTag() {
  const output = run("git", ["tag", "--list", "v[0-9]*.[0-9]*.[0-9]*", "--sort=-v:refname"], { capture: true });
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "v0.0.0";
}

function nextPatchTag(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Cannot parse version tag: ${tag}`);
  const [, major, minor, patch] = match;
  return `v${major}.${minor}.${Number(patch) + 1}`;
}

const current = latestVersionTag();
const next = nextPatchTag(current);

if (!skipVerify) run("npm", ["run", "verify"]);

if (dryRun) {
  console.log(next);
  process.exit(0);
}

const status = run("git", ["status", "--short"], { capture: true }).trim();
if (status) {
  throw new Error("Working tree is not clean. Commit and push changes before creating a release tag.");
}

run("git", ["tag", "-a", next, "-m", next]);
console.log(`Created ${next}`);

if (push) {
  run("git", ["push", "origin", next]);
  console.log(`Pushed ${next}`);
}
