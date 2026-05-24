import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./index.js";

describe("runCli", () => {
  it("initializes, lints, and builds a deck", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-"));
    await expect(runCli(["init", dir, "--theme", "swiss"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["lint", join(dir, "deck.md")])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "dist"), "--single-html"])).resolves.toMatchObject({ code: 0 });
    expect(readFileSync(join(dir, "dist", "index.html"), "utf8")).toContain("AgentDeck");
  });

  it("builds audience, presenter, creator, and rendered-file profile variants", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-mode-"));
    await runCli(["init", dir, "--theme", "swiss"]);
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "audience"), "--mode", "audience", "--profile", "rendered-file"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "presenter"), "--mode", "presenter"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "creator"), "--mode", "creator"])).resolves.toMatchObject({ code: 0 });

    const audienceHtml = readFileSync(join(dir, "audience", "index.html"), "utf8");
    const presenterHtml = readFileSync(join(dir, "presenter", "index.html"), "utf8");
    const creatorHtml = readFileSync(join(dir, "creator", "index.html"), "utf8");
    expect(audienceHtml).toContain('data-deck-mode="audience"');
    expect(audienceHtml).toContain('data-compat-profile="rendered-file"');
    expect(presenterHtml).toContain('data-deck-mode="presenter"');
    expect(creatorHtml).toContain("Deck Studio");
    expect(creatorHtml).toContain('data-action="overview"');
  });

  it("wraps a generic external HTML deck into the AgentDeck player", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-"));
    const source = join(dir, "external.html");
    writeFileSync(
      source,
      `<!doctype html>
<html>
      <head><title>Existing Deck</title><style>.slide{width:1920px;height:1080px;background:#111;color:#fff}</style></head>
  <body>
    <section class="slide"><h1>External Cover</h1></section>
    <section class="slide"><h2>External Detail</h2></section>
  </body>
</html>`,
      "utf8",
    );

    await expect(runCli(["wrap-html", source, "--out", join(dir, "dist")])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    const report = JSON.parse(readFileSync(join(dir, "dist", "compat-report.json"), "utf8"));
    expect(html).toContain('data-compat-profile="external-html"');
    expect(html).toContain('data-action="compare"');
    expect(html).toContain('data-action="play"');
    expect(html).toContain("External Cover");
    expect(html).toContain("Existing Deck");
    expect(report.requestedStrategy).toBe("auto");
    expect(report.selectedStrategy).toBe("dom");
    expect(report.wrappedSlides).toBe(2);
  });

  it("supports wrap as the generic compatibility entry for HTML decks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-generic-"));
    const source = join(dir, "deck.html");
    writeFileSync(source, `<!doctype html><title>Generic</title><section class="slide"><h1>One</h1></section>`, "utf8");

    await expect(runCli(["wrap", source, "--out", join(dir, "dist")])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    expect(html).toContain("Generic");
    expect(html).toContain('data-compat-profile="external-html"');
  });

  it("accepts browser file URLs for HTML wrapping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-file-url-"));
    const source = join(dir, "deck.html");
    writeFileSync(source, `<!doctype html><title>File URL</title><section class="slide"><h1>One</h1></section>`, "utf8");

    await expect(runCli(["wrap", `file://${source}`, "--out", join(dir, "dist"), "--html-strategy", "dom"])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    const report = JSON.parse(readFileSync(join(dir, "dist", "compat-report.json"), "utf8"));
    expect(html).toContain("File URL");
    expect(html).toContain('data-compat-profile="external-html"');
    expect(report.requestedStrategy).toBe("dom");
    expect(report.selectedStrategy).toBe("dom");
  });
});

const describeDarwin = process.platform === "darwin" ? describe : describe.skip;
const canQuickLook = process.platform === "darwin" && commandAvailable("qlmanage");
const canCreateDocx = process.platform === "darwin" && commandAvailable("textutil");

describeDarwin("runCli native office fallbacks", () => {
  const itQuickLook = canQuickLook ? it : it.skip;
  const itDocx = canQuickLook && canCreateDocx ? it : it.skip;

  itDocx("wraps a multi-page docx via the Quick Look preview fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-docx-"));
    const source = createMultiPageDocxFixture(dir);

    await expect(runCli(["wrap", source, "--out", join(dir, "dist"), "--dpi", "120", "--office-backend", "quicklook-preview"])).resolves.toMatchObject({ code: 0 });

    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    const report = JSON.parse(readFileSync(join(dir, "dist", "asset-report.json"), "utf8"));
    expect(html).toContain('data-compat-profile="rendered-file"');
    expect(report.officeConverterBackend).toBe("quicklook-preview");
    expect(report.rendererBackend).toMatch(/pdftoppm|pdftocairo|pypdfium2|pdf2image/);
    expect(report.pages.length).toBeGreaterThan(1);
  });

  itQuickLook("wraps an xlsx via the Quick Look preview fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-xlsx-"));
    const source = createXlsxFixture(dir);

    await expect(runCli(["wrap", source, "--out", join(dir, "dist"), "--dpi", "120", "--office-backend", "quicklook-preview"])).resolves.toMatchObject({ code: 0 });

    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    const report = JSON.parse(readFileSync(join(dir, "dist", "asset-report.json"), "utf8"));
    expect(html).toContain('data-compat-profile="rendered-file"');
    expect(report.officeConverterBackend).toBe("quicklook-preview");
    expect(report.rendererBackend).toMatch(/pdftoppm|pdftocairo|pypdfium2|pdf2image/);
    expect(report.pages.length).toBeGreaterThan(0);
  });
});

function commandAvailable(command: string): boolean {
  return spawnSync("sh", ["-lc", `command -v '${command}'`], { encoding: "utf8" }).status === 0;
}

function createMultiPageDocxFixture(dir: string): string {
  const rtfPath = join(dir, "sample.rtf");
  const docxPath = join(dir, "sample.docx");
  const parts = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0 Times New Roman;}}",
    "\\fs24",
  ];
  for (let page = 1; page <= 5; page += 1) {
    parts.push(`AgentDeck Quick Look page ${page}\\par`);
    for (let line = 1; line <= 70; line += 1) {
      parts.push(`Line ${line} on page ${page} for the multi-page docx regression sample.\\par`);
    }
    parts.push("\\page");
  }
  parts.push("}");
  writeFileSync(
    rtfPath,
    parts.join(""),
    "utf8",
  );
  const result = spawnSync("textutil", ["-convert", "docx", rtfPath, "-output", docxPath], { encoding: "utf8" });
  if (result.status !== 0 || !existsSync(docxPath)) {
    throw new Error((result.stderr || result.stdout || "").trim() || "textutil failed to create docx fixture");
  }
  return docxPath;
}

function createXlsxFixture(dir: string): string {
  const rootDir = join(dir, "xlsx-src");
  mkdirSync(join(rootDir, "_rels"), { recursive: true });
  mkdirSync(join(rootDir, "docProps"), { recursive: true });
  mkdirSync(join(rootDir, "xl", "_rels"), { recursive: true });
  mkdirSync(join(rootDir, "xl", "worksheets"), { recursive: true });

  writeFileSync(
    join(rootDir, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "_rels", ".rels"),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "docProps", "core.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>AgentDeck Sheet</dc:title>
</cp:coreProperties>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "docProps", "app.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>AgentDeck</Application>
</Properties>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "xl", "workbook.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "xl", "_rels", "workbook.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    "utf8",
  );
  writeFileSync(
    join(rootDir, "xl", "worksheets", "sheet1.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Hello</t></is></c>
      <c r="B1" t="inlineStr"><is><t>AgentDeck</t></is></c>
    </row>
    <row r="2">
      <c r="A2"><v>42</v></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>Quick Look fallback</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
    "utf8",
  );

  const xlsxPath = join(dir, "sample.xlsx");
  const result = spawnSync("zip", ["-qr", xlsxPath, ".", "-x", "out/*"], { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0 || !existsSync(xlsxPath)) {
    throw new Error((result.stderr || result.stdout || "").trim() || "zip failed to create xlsx fixture");
  }
  return xlsxPath;
}
