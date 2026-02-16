const express = require("express");
const router = express.Router();
const { surfQueue } = require("../queue");
const redis = require("../config/redis.config");

/**
 * 🔎 Create Amazon Search Job
 */
router.post("/amazon/search", async (req, res) => {
  const { productName, targetASIN } = req.body;

  if (!productName || !targetASIN) {
    return res.status(400).json({
      error: "productName and targetASIN required",
    });
  }

  const job = await surfQueue.add("amazonSearch", {
    productName,
    targetASIN,
  });

  await redis.hset(`job:${job.id}`, {
    status: "waiting",
    productName,
    targetASIN,
    createdAt: Date.now(),
  });

  res.json({
    message: "Amazon search job created",
    jobId: job.id,
  });
});


/**
 * 📄 Get Job By ID
 */
router.get("/job/:id", async (req, res) => {
  const job = await redis.hgetall(`job:${req.params.id}`);

  if (!job || Object.keys(job).length === 0) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});


/**
 * 📋 Get Last 50 Jobs (Production Safe)
 */
router.get("/jobs", async (req, res) => {
  const jobIds = await redis.zrevrange("jobs", 0, 49);

  const jobs = [];

  for (const id of jobIds) {
    const data = await redis.hgetall(`job:${id}`);
    jobs.push({ id, ...data });
  }

  res.json(jobs);
});

module.exports = router;