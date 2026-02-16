const express = require("express");
const router = express.Router();
const { surfQueue } = require("../queue");
const redis = require("../config/redis.config");
const Job = require("../models/job.model");

/**
 * 🔎 Create Amazon Search Job (Single or Batch)
 */
router.post("/amazon/search", async (req, res) => {
  const { productName, targetASIN, count = 1 } = req.body;

  const created = [];

  for (let i = 0; i < count; i++) {
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

    await redis.zadd("jobs", Date.now(), job.id);

    created.push(job.id);
  }

  res.json({ jobIds: created });
});
/**
 * 📄 Get Job By ID (Redis fast lookup)
 */
router.get("/job/:id", async (req, res) => {
  const job = await redis.hgetall(`job:${req.params.id}`);

  if (!job || Object.keys(job).length === 0) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

/**
 * 📋 Get Last 50 Jobs (Redis)
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

/**
 * 📜 Full Job History (MongoDB)
 */
router.get("/jobs/history", async (req, res) => {
  const jobs = await Job.find()
    .sort({ startedAt: -1 })
    .limit(100);

  res.json(jobs);
});

/**
 * 📊 Analytics Endpoint
 */
router.get("/jobs/analytics", async (req, res) => {
  const total = await Job.countDocuments();
  const completed = await Job.countDocuments({ status: "completed" });
  const failed = await Job.countDocuments({ status: "failed" });
  const running = await Job.countDocuments({ status: "running" });

  const successRate = total
    ? ((completed / total) * 100).toFixed(2)
    : 0;

  const failureRate = total
    ? ((failed / total) * 100).toFixed(2)
    : 0;

  res.json({
    total,
    completed,
    failed,
    running,
    successRate: `${successRate}%`,
    failureRate: `${failureRate}%`,
  });
});

module.exports = router;