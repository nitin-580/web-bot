const { chromium } = require("playwright");
const redis = require("../config/redis.config");

async function runBot(url, jobId) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      proxy: {
        server: "http://p.webshare.io:80",
        username: process.env.WEBSHARE_USERNAME,
        password: process.env.WEBSHARE_PASSWORD,
      },
    });

    const page = await browser.newPage();

    console.log("🌍 Opening:", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.goto("https://httpbin.org/ip");
    const ip = await page.textContent("body");

    console.log("🧠 Proxy IP Used:", ip);

    await redis.hset(`job:${jobId}`, {
      ipUsed: ip,
      status: "completed",
      timestamp: Date.now(),
    });

  } catch (err) {
    console.error("❌ Job failed:", err.message);

    await redis.hset(`job:${jobId}`, {
      status: "failed",
      error: err.message,
      timestamp: Date.now(),
    });

    throw err;

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = runBot;