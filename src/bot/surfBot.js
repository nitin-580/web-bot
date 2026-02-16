const { chromium } = require("playwright");
const redis = require("../config/redis.config");

async function runBot(productName, targetASIN, jobId) {
  let browser;

  try {
    console.log("🔥 runBot STARTED");
    console.log("Product:", productName);
    console.log("Target ASIN:", targetASIN);

    // =========================
    // PROXY TOGGLE
    // =========================
    const useProxy = false; // change to true when using proxy

    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (useProxy) {
      launchOptions.proxy = {
        server: "http://proxy.soax.com:5000",
        username: process.env.SOAX_USERNAME,
        password: process.env.SOAX_PASSWORD,
      };
      console.log("🌐 Using Proxy:", process.env.SOAX_USERNAME);
    }

    browser = await chromium.launch(launchOptions);
    console.log("🚀 Browser launched");

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      locale: "en-IN",
      viewport: { width: 1366, height: 768 },
    });

    // Basic stealth
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    let page = await context.newPage();

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

    console.log("📄 Current URL:", page.url());

    // Robot check detection
    if ((await page.locator("text=Robot Check").count()) > 0) {
      throw new Error("Amazon Robot Check Triggered");
    }

    // =========================
    // FIND PRODUCT USING /dp/
    // =========================
    await page.waitForSelector("a[href*='/dp/']", {
      timeout: 30000,
    });

    const productLinks = page.locator("a[href*='/dp/']");
    const linkCount = await productLinks.count();

    console.log("Links found:", linkCount);

    let found = false;
    let rankPosition = null;

    for (let i = 0; i < linkCount; i++) {
      const link = productLinks.nth(i);
      const href = await link.getAttribute("href");

      if (!href) continue;

      if (href.includes(targetASIN)) {
        console.log("✅ ASIN FOUND IN URL");
        rankPosition = i + 1;

        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);

        console.log("🖱 Clicking product (new tab expected)");

        const newPagePromise = context.waitForEvent("page");

        await link.click();

        const newPage = await newPagePromise;

        console.log("🆕 New tab opened");

        await newPage.waitForLoadState("domcontentloaded");

        await newPage.waitForSelector("#productTitle", {
          timeout: 30000,
        });

        console.log("✅ Product page loaded:", newPage.url());

        page = newPage;
        found = true;
        break;
      }
    }

    if (!found) {
      console.log("❌ ASIN not found");

      await redis.hset(`job:${jobId}`, {
        status: "not_found",
        finishedAt: Date.now(),
      });

      return;
    }

    // =========================
    // HUMAN SIMULATION
    // =========================
    console.log("📦 Product opened");
    console.log("🏆 Rank Position:", rankPosition);

    const start = Date.now();
    while (Date.now() - start < 20000) {
      await page.mouse.move(
        Math.random() * 1200,
        Math.random() * 800
      );
      await page.waitForTimeout(1500);
    }

    // =========================
    // ADD TO CART
    // =========================
    try {
      await page.waitForSelector("#add-to-cart-button", {
        timeout: 15000,
      });

      await page.click("#add-to-cart-button");
      console.log("🛒 Added to cart");

      await page.waitForTimeout(3000);
    } catch {
      console.log("⚠ Add to cart not found");
    }

    // =========================
    // EXTRACT PRICE
    // =========================
    let price = "N/A";
    try {
      price = await page
        .locator(".a-price .a-offscreen")
        .first()
        .textContent();
      console.log("💰 Price:", price);
    } catch {}

    // =========================
    // SCREENSHOT
    // =========================
    const screenshotPath = `/tmp/product-${jobId}.png`;

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    console.log("📸 Screenshot saved");

    // =========================
    // SAVE TO REDIS
    // =========================
    await redis.hset(`job:${jobId}`, {
      status: "completed",
      rankPosition,
      price,
      screenshot: screenshotPath,
      finishedAt: Date.now(),
    });

    console.log("🔥 runBot FINISHED SUCCESSFULLY");

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    await redis.hset(`job:${jobId}`, {
      status: "failed",
      error: err.message,
      failedAt: Date.now(),
    });

  } finally {
    if (browser) {
      await browser.close();
      console.log("🛑 Browser closed");
    }
  }
}

module.exports = runBot;