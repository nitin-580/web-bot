const { chromium } = require("playwright");
const redis = require("../config/redis.config");

async function runBot(productName, targetASIN, jobId) {
  let browser;

  const log = (msg, data = "") => {
    console.log(`[JOB ${jobId}] ${msg}`, data || "");
  };

  try {
    log("🔥 STARTED", { productName, targetASIN });

    await redis.hset(`job:${jobId}`, {
      status: "running",
      startedAt: Date.now(),
    });

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    log("🚀 Browser Launched");

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-IN",
    });

    const page = await context.newPage();
    log("📄 Page Created");

    // =========================
    // OPEN AMAZON
    // =========================
    await page.goto("https://www.amazon.in", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForSelector("#twotabsearchtextbox");
    log("✅ Amazon Loaded");

    // =========================
    // SEARCH (Human Typing)
    // =========================
    await page.click("#twotabsearchtextbox");

for (let char of productName) {
  await page.keyboard.type(char, {
    delay: 80 + Math.random() * 120,
  });
}

await page.keyboard.press("Enter");

await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(4000);

log("📦 Search Results Loaded");

let rankPosition = null;
let activePage = page;
let found = false;

let currentPage = 1;
const maxPages = 5;

while (currentPage <= maxPages && !found) {

  log(`📄 Scanning Page ${currentPage}`);

  const results = page.locator(
    'div[data-component-type="s-search-result"]'
  );

  const count = await results.count();
  log("🔢 Products Found", { count });

  for (let i = 0; i < count; i++) {
    const item = results.nth(i);
    const asin = await item.getAttribute("data-asin");

    if (!asin || asin.trim() === "") continue;

    // Scroll like human while scanning
    await item.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400 + Math.random() * 700);

    if (asin === targetASIN) {

      // Global rank across pages
      rankPosition = ((currentPage - 1) * count) + (i + 1);

      log("🎯 ASIN MATCHED", { rankPosition });

      // Try multiple link selectors
      let link = item.locator('a[href*="/dp/"]').first();

      if ((await link.count()) === 0) {
        link = item.locator(".s-product-image-container a").first();
      }

      if ((await link.count()) === 0) {
        link = item.locator("h2 a").first();
      }

      if ((await link.count()) === 0) {
        throw new Error("ASIN matched but product link missing");
      }

      // ---- ENHANCED HOVER BEFORE CLICK ----
      await link.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const box = await link.boundingBox();

      if (box) {
        await page.mouse.move(
          box.x + box.width / 2 + (Math.random() * 8 - 4),
          box.y + box.height / 2 + (Math.random() * 8 - 4),
          { steps: 15 }
        );
      }

      await link.hover();
      await page.waitForTimeout(800 + Math.random() * 1200);

      const newPagePromise = context
        .waitForEvent("page")
        .catch(() => null);

      await link.click({ delay: 120 + Math.random() * 80 });

      const newPage = await newPagePromise;

      if (newPage) {
        log("🆕 New Tab Opened");
        activePage = newPage;
        await activePage.waitForLoadState("domcontentloaded");
      } else {
        log("📄 Same Tab Navigation");
        await page.waitForLoadState("domcontentloaded");
      }

      log("🔗 Final URL", activePage.url());

      await activePage.waitForSelector("#productTitle", {
        timeout: 30000,
      });

      log("🛍 Product Page Confirmed");

      found = true;
      break;
    }
  }

  // Move to next page if not found
  if (!found) {
    const nextButton = page.locator("a.s-pagination-next");

    if ((await nextButton.count()) > 0) {
      log("➡ Moving To Next Page");

      await nextButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);

      await nextButton.click({ delay: 100 });

      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      currentPage++;
    } else {
      log("❌ No More Pages Available");
      break;
    }
  }
}

if (!found) {
  throw new Error(
    `ASIN ${targetASIN} not found in first ${maxPages} pages`
  );
}
    // =========================
    // HUMAN SIMULATION ON PRODUCT PAGE
    // =========================
    log("🧠 Simulating 50s Human Behaviour");

const start = Date.now();
const minDuration = 50000; // 50 seconds

while (Date.now() - start < minDuration) {

  // Random mouse move
  await activePage.mouse.move(
    Math.random() * 1200,
    Math.random() * 800,
    { steps: 15 }
  );

  // Random scroll
  await activePage.evaluate(() => {
    window.scrollBy(0, Math.random() * 600 - 300);
  });

  // Random pause (like reading)
  await activePage.waitForTimeout(
    1500 + Math.random() * 4000
  );

  // Occasionally hover image
  if (Math.random() > 0.7) {
    const image = activePage.locator("#landingImage");
    if (await image.count()) {
      await image.hover();
      await activePage.waitForTimeout(2000);
    }
  }

}

    // =========================
    // EXTRACT PRICE
    // =========================
    let price = "N/A";
    try {
      price = await activePage
        .locator(".a-price .a-offscreen")
        .first()
        .textContent();
    } catch {}

    log("💰 Price", { price });

    // =========================
    // ADD TO CART (Human Click)
    // =========================
    try {
      const addToCart = activePage.locator("#add-to-cart-button");

      if ((await addToCart.count()) > 0) {
        await addToCart.hover();
        await activePage.waitForTimeout(800);
        await addToCart.click({ delay: 120 });
        log("🛒 Added To Cart");
      } else {
        log("⚠ Add To Cart Not Available");
      }
    } catch {
      log("⚠ Add To Cart Failed");
    }

    // =========================
    // SCREENSHOT
    // =========================
    const screenshotPath = `/app/screenshots/job-${jobId}.png`;

    await activePage.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    log("📸 Screenshot Saved");

    await redis.hset(`job:${jobId}`, {
      status: "completed",
      rankPosition,
      price,
      url: activePage.url(),
      screenshot: screenshotPath,
      finishedAt: Date.now(),
    });

    log("🔥 SUCCESS");

  } catch (err) {
    log("❌ ERROR", err.message);

    await redis.hset(`job:${jobId}`, {
      status: "failed",
      error: err.message,
      failedAt: Date.now(),
    });
  } finally {
    if (browser) {
      await browser.close();
      log("🛑 Browser Closed");
    }
  }
}

module.exports = runBot;

