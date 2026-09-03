import https from "https";
import fs from "fs";
import path from "path";

const sitemapPath = path.resolve("public/sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  console.error("sitemap.xml not found");
  process.exit(1);
}

const sitemap = fs.readFileSync(sitemapPath, "utf-8");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

console.log(`\nTesting ${urls.length} live site URLs from sitemap.xml against https://www.autoapplycv.in ...\n`);

async function checkUrl(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (Googlebot/2.1)" }, timeout: 7000 }, (res) => {
        resolve({
          url,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          location: res.headers.location,
        });
      })
      .on("error", (err) => {
        resolve({ url, error: err.message });
      });
  });
}

async function run() {
  let successCount = 0;
  let failCount = 0;

  for (const url of urls) {
    const result = await checkUrl(url);
    if (result.statusCode === 200) {
      console.log(`  \x1b[32m✔ 200 OK\x1b[0m - ${url}`);
      successCount++;
    } else if (result.statusCode >= 300 && result.statusCode < 400) {
      console.log(`  \x1b[33m➔ ${result.statusCode} Redirect\x1b[0m (${result.location || ""}) - ${url}`);
      successCount++;
    } else {
      console.log(`  \x1b[31m✖ ${result.statusCode || "Error"}\x1b[0m (${result.error || result.statusMessage}) - ${url}`);
      failCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} reachable, ${failCount} unreachable.\n`);
}

run();
