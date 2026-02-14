const { chromium } = require("playwright");
const { getRandomProxy } = require("../utils/proxy");
const fs = require("fs");
const path = require("path");

async function runBot(url, jobId) {
  const proxy = getRandomProxy();

  console.log("Using proxy:", proxy ? proxy.server : "NO PROXY");

  const browser = await chromium.launch({
    headless: true,
    proxy: proxy || undefined,
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
  } catch (err) {
    console.log("Page load timeout, continuing...");
  }

  await page.screenshot({
    path: `screenshots/job-${jobId}.png`,
    fullPage: true,
  });

  await browser.close();
}

module.exports = runBot;