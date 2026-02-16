const express = require("express");
const router = express.Router();
const { surfQueue } = require("../queue");
const Job = require("../models/job.model"); // ✅ ADD THIS

/**
 * Queue stats (Redis/Bull)
 */
router.get("/queue", async (req, res) => {
  const waiting = await surfQueue.getWaitingCount();
  const active = await surfQueue.getActiveCount();
  const completed = await surfQueue.getCompletedCount();
  const failed = await surfQueue.getFailedCount();

  res.json({
    waiting,
    active,
    completed,
    failed,
  });
});

/**
 * Health check
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Analytics (MongoDB)
 */
router.get("/analytics", async (req, res) => {
  try {
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

  } catch (err) {
    console.error("Analytics error:", err.message);
    res.status(500).json({ error: "Analytics failed" });
  }
});

module.exports = router;