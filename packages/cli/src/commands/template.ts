import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { ThemeId } from "@agentdeck/schema";
import { parseArgs } from "../flags.js";
import { isBuiltInTheme, starterTemplatePack } from "../templates.js";
import type { CliResult } from "../types.js";

export function commandTemplate(args: string[]): CliResult {
  const [subcommand, ...rest] = args;
  if (subcommand === "init") return commandTemplateInit(rest);

  console.error("Usage: agentdeck template init <dir> [--base-theme editorial|swiss|launch|course] [--force]");
  return { code: 2 };
}

function commandTemplateInit(args: string[]): CliResult {
  const options = parseArgs(args);
  const dir = resolve(options.positionals[0] ?? "templates/custom");
  const baseTheme = themeId(options.flags["base-theme"]) ?? "swiss";
  const id = basename(dir).replace(/[^a-zA-Z0-9_-]+/g, "-") || "custom";
  const templatePath = join(dir, "template.json");

  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "layouts"), { recursive: true });
  mkdirSync(join(dir, "previews"), { recursive: true });

  if (existsSync(templatePath) && !options.flags.force) {
    throw new Error(`${templatePath} already exists. Pass --force to overwrite.`);
  }

  writeFileSync(templatePath, `${JSON.stringify(starterTemplatePack(id, baseTheme), null, 2)}\n`, "utf8");
  console.log(`Created ${templatePath}`);
  return { code: 0 };
}

function themeId(value: string | boolean | undefined): ThemeId | undefined {
  return typeof value === "string" && isBuiltInTheme(value) ? value as ThemeId : undefined;
}
