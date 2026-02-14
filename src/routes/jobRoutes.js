const express = require("express");
const router = express.Router();
const { surfQueue } = require("../queue");
const redis = require("../config/redis.config");

/**
 * Add job
 */
router.post("/surf", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const job = await surfQueue.add("surfJob", { url });

  await redis.hset(`job:${job.id}`, {
    status: "waiting",
    url,
    createdAt: Date.now(),
  });

  res.json({
    message: "Job added",
    jobId: job.id,
  });
});

/**
 * Get job by ID
 */
router.get("/job/:id", async (req, res) => {
  const job = await redis.hgetall(`job:${req.params.id}`);

  if (!job || Object.keys(job).length === 0) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

/**
 * List last 50 jobs
 */
router.get("/jobs", async (req, res) => {
  const keys = await redis.keys("job:*");

  const jobs = [];
  for (const key of keys.slice(-50)) {
    const data = await redis.hgetall(key);
    jobs.push({
      id: key.split(":")[1],
      ...data,
    });
  }

  res.json(jobs);
});

module.exports = router;