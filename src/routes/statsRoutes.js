const express = require("express");
const router = express.Router();
const { surfQueue } = require("../queue");

/**
 * Queue stats
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

module.exports = router;