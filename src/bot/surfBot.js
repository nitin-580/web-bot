const { chromium } = require("playwright");
const redis = require("../config/redis.config");
const Job = require("../models/job.model");

async function runBot(productName, targetASIN, jobId) {
  let browser;
  let sessionId = null;
  let proxyIP = null;
  let proxyCountry = null;

  try {
    console.log("🔥 runBot STARTED");

    const useProxy = true;

    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    // =========================
    // PROXY SETUP
    // =========================
    if (useProxy) {
      sessionId = Math.random().toString(36).substring(2, 10);

      const proxyUsername =
        `package-335365-country-in-sessionid-${sessionId}-sessionlength-300`;

      launchOptions.proxy = {
        server: "http://proxy.soax.com:5000",
        username: proxyUsername,
        password: process.env.SOAX_PASSWORD,
      };

      console.log("🌐 Using Proxy:", proxyUsername);
    }

    // =========================
    // UPDATE REDIS → RUNNING
    // =========================
    await redis.hset(`job:${jobId}`, {
      status: "running",
      startedAt: Date.now(),
    });

    // =========================
    // CREATE JOB IN MONGO (history starts here)
    // =========================
    await Job.create({
      jobId,
      productName,
      targetASIN,
      sessionId,
      status: "running",
      startedAt: new Date(),
    });

    browser = await chromium.launch(launchOptions);
    console.log("🚀 Browser launched");

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      locale: "en-IN",
      viewport: { width: 1366, height: 768 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    let page = await context.newPage();

    // =========================
    // CHECK PROXY IP
    // =========================
    if (useProxy) {
      console.log("🧪 Checking Proxy IP...");

      await page.goto("https://ipinfo.io/json", {
        waitUntil: "domcontentloaded",
      });

      const ipData = JSON.parse(await page.textContent("body"));

      proxyIP = ipData.ip;
      proxyCountry = ipData.country;

      console.log("🌍 Proxy IP:", proxyIP);
      console.log("🌎 Country:", proxyCountry);

      await Job.updateOne(
        { jobId },
        {
          proxyIP,
          proxyCountry,
        }
      );
    }

    // =========================
    // OPEN AMAZON
    // =========================
    console.log("🌍 Opening Amazon...");
    await page.goto("https://www.amazon.in", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForSelector("#twotabsearchtextbox", {
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // =========================
    // SEARCH
    // =========================
    console.log("🔎 Searching...");
    await page.fill("#twotabsearchtextbox", productName);
    await page.keyboard.press("Enter");

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000);

    if ((await page.locator("text=Robot Check").count()) > 0) {
      throw new Error("Amazon Robot Check Triggered");
    }

    // =========================
    // FIND PRODUCT
    // =========================
    await page.waitForSelector("a[href*='/dp/']", {
      timeout: 30000,
    });

    const productLinks = page.locator("a[href*='/dp/']");
    const linkCount = await productLinks.count();

    let found = false;
    let rankPosition = null;

    for (let i = 0; i < linkCount; i++) {
      const link = productLinks.nth(i);
      const href = await link.getAttribute("href");

      if (!href) continue;

      if (href.includes(targetASIN)) {
        rankPosition = i + 1;

        const newPagePromise = context.waitForEvent("page");
        await link.click();
        const newPage = await newPagePromise;

        await newPage.waitForLoadState("domcontentloaded");
        await newPage.waitForSelector("#productTitle");

        page = newPage;
        found = true;
        break;
      }
    }

    if (!found) {
      await Job.updateOne(
        { jobId },
        {
          status: "failed",
          error: "ASIN not found",
          finishedAt: new Date(),
        }
      );

      await redis.hset(`job:${jobId}`, {
        status: "failed",
        error: "ASIN not found",
        finishedAt: Date.now(),
      });

      return;
    }

    // =========================
    // HUMAN SIMULATION
    // =========================
    const start = Date.now();
    while (Date.now() - start < 10000) {
      await page.mouse.move(
        Math.random() * 1200,
        Math.random() * 800
      );
      await page.waitForTimeout(1000);
    }

    // =========================
    // GET PRICE
    // =========================
    let price = "N/A";
    try {
      price = await page
        .locator(".a-price .a-offscreen")
        .first()
        .textContent();
    } catch {}

    // =========================
    // SUCCESS
    // =========================
    await Job.updateOne(
      { jobId },
      {
        status: "completed",
        rankPosition,
        price,
        finishedAt: new Date(),
      }
    );

    await redis.hset(`job:${jobId}`, {
      status: "completed",
      rankPosition,
      price,
      finishedAt: Date.now(),
    });

    console.log("🔥 SUCCESS");

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    await Job.updateOne(
      { jobId },
      {
        status: "failed",
        error: err.message,
        finishedAt: new Date(),
      }
    );

    await redis.hset(`job:${jobId}`, {
      status: "failed",
      error: err.message,
      finishedAt: Date.now(),
    });

  } finally {
    if (browser) {
      await browser.close();
      console.log("🛑 Browser closed");
    }

    // =========================
    // OPTIONAL: CLEAN REDIS AFTER FINISH
    // =========================
    await redis.zrem("jobs", jobId);
  }
}

module.exports = runBot;