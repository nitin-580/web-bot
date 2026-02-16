const { chromium } = require("playwright");
const redis = require("../config/redis.config");

async function runBot(productName, targetASIN, jobId) {
  let browser;

  try {
    console.log("🔥 runBot STARTED");

    const useProxy = true;

    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (useProxy) {
      const sessionId = Math.random().toString(36).substring(2, 10);

      const proxyUsername =
        `package-335365-country-in-sessionid-${sessionId}-sessionlength-300`;

      launchOptions.proxy = {
        server: "http://proxy.soax.com:5000",
        username: proxyUsername,
        password: process.env.SOAX_PASSWORD,
      };

      console.log("🌐 Using Proxy:", proxyUsername);
    }

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
    // VERIFY PROXY IP
    // =========================
    if (useProxy) {
      console.log("🧪 Checking Proxy IP...");

      await page.goto("https://ipinfo.io/json", {
        waitUntil: "domcontentloaded",
      });

      const ipData = JSON.parse(await page.textContent("body"));

      console.log("🌍 Proxy IP:", ipData.ip);
      console.log("🌎 Country:", ipData.country);
      console.log("🏢 ISP:", ipData.org);
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

        const newPagePromise = context.waitForEvent("page");

        await link.click();

        const newPage = await newPagePromise;

        await newPage.waitForLoadState("domcontentloaded");

        await newPage.waitForSelector("#productTitle", {
          timeout: 30000,
        });

        console.log("✅ Product page loaded");

        page = newPage;
        found = true;
        break;
      }
    }

    if (!found) {
      await redis.hset(`job:${jobId}`, {
        status: "not_found",
        finishedAt: Date.now(),
      });
      return;
    }

    // =========================
    // HUMAN SIMULATION
    // =========================
    console.log("Simulating Human Behaiviour")
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await page.mouse.move(
        Math.random() * 1200,
        Math.random() * 800
      );
      await page.waitForTimeout(1200);
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
    } catch {}

    // =========================
    // EXTRACT PRICE
    // =========================
    let price = "N/A";
    try {
      price = await page
        .locator(".a-price .a-offscreen")
        .first()
        .textContent();
    } catch {}

    const screenshotPath = `/tmp/product-${jobId}.png`;

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    await redis.hset(`job:${jobId}`, {
      status: "completed",
      rankPosition,
      price,
      screenshot: screenshotPath,
      finishedAt: Date.now(),
    });

    console.log("🔥 SUCCESS");

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