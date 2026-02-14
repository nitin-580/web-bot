const express = require("express");
const router = express.Router();
const redis = require("../config/redis.config");

/**
 * Add proxy
 */
router.post("/add", async (req, res) => {
  const { proxy } = req.body;

  if (!proxy) return res.status(400).json({ error: "Proxy required" });

  await redis.sadd("activeProxies", proxy);

  res.json({ message: "Proxy added" });
});

/**
 * Remove proxy
 */
router.delete("/remove", async (req, res) => {
  const { proxy } = req.body;

  await redis.srem("activeProxies", proxy);
  await redis.del(`proxy:${proxy}`);

  res.json({ message: "Proxy removed" });
});

/**
 * List proxies
 */
router.get("/list", async (req, res) => {
  const proxies = await redis.smembers("activeProxies");
  res.json(proxies);
});

/**
 * Proxy health stats
 */
router.get("/stats", async (req, res) => {
  const proxies = await redis.smembers("activeProxies");

  const stats = [];

  for (const proxy of proxies) {
    const data = await redis.hgetall(`proxy:${proxy}`);
    stats.push({
      proxy,
      success: data.success || 0,
      fail: data.fail || 0,
      lastUsed: data.lastUsed || null,
    });
  }

  res.json(stats);
});

module.exports = router;