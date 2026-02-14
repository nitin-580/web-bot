const { chromium } = require("playwright");
const redis = require("../config/redis.config");

async function runBot(url, jobId) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      proxy: {
        server: `http://${process.env.SOAX_HOST}:${process.env.SOAX_PORT}`,
        username: process.env.SOAX_USERNAME,
        password: process.env.SOAX_PASSWORD,
      },
    });

    console.log("Proxy user:", process.env.SOAX_USERNAME);

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      locale: "en-IN",
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Small human-like delay
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Check proxy IP
    await page.goto("https://httpbin.org/ip", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const ip = await page.textContent("body");
    console.log("🌍 Proxy IP:", ip);

    console.log("🌍 Opening:", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await redis.hset(`job:${jobId}`, {
      status: "completed",
      ipUsed: ip,
      finishedAt: Date.now(),
    });

    console.log("✅ Job completed:", jobId);
  } catch (err) {
    console.error("❌ Error:", err.message);

    await redis.hset(`job:${jobId}`, {
      status: "failed",
      error: err.message,
      failedAt: Date.now(),
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = runBot;