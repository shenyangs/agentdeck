import { dirname, join } from "node:path";
import { writeJsonReport } from "../reports.js";
import type { VerifyReport } from "../types.js";
import { verifyStandaloneHtml } from "./verify.js";

export async function maybeVerifyWrappedOutput(
  outputPath: string,
  options: { flags: Record<string, string | boolean> },
): Promise<{ code: number; report?: VerifyReport }> {
  if (options.flags["no-verify"]) return { code: 0 };
  try {
    const report = await verifyStandaloneHtml(outputPath, { debug: Boolean(options.flags.debug) });
    const reportPath = join(dirname(outputPath), "verify-report.json");
    writeJsonReport(reportPath, report);
    if (report.status === "pass") {
      console.log(`Verify PASS (${report.slideCount} slide(s))`);
      console.log(`Wrote ${reportPath}`);
      return { code: 0, report };
    }
    console.log(`Converted with ${report.status.toUpperCase()} quality signals. See ${reportPath}`);
    for (const issue of report.issues) console.log(`${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
    return { code: report.status === "fail" ? 1 : 0, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Converted, but verify could not run: ${message}`);
    return { code: 0 };
  }
}
