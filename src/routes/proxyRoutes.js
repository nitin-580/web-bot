const express = require("express");
const router = express.Router();
const redis = require("../config/redis.config");

router.get("/live", async (req, res) => {
  const proxyIds = await redis.smembers("activeProxies");
  const result = [];

  for (const id of proxyIds) {
    const meta = await redis.hgetall(`proxy:${id}`);
    const live = await redis.hgetall(`proxy:live:${id}`);
    const stats = await redis.hgetall(`proxy:stats:${id}`);

    result.push({
      id,
      provider: meta.provider,
      country: meta.country,
      status: live.status || "idle",
      currentPing: live.currentPing || 0,
      jobId: live.jobId || null,
      avgPing: stats.avgPing || 0,
      success: stats.success || 0,
      fail: stats.fail || 0,
    });
  }

  res.json(result);
});

module.exports = router;