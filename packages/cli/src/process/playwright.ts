export async function loadPlaywright(): Promise<any> {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is required for export, verify, HTML raster wrapping, and image compression. Install it with: npm install -D playwright && npx playwright install chromium");
  }
}
