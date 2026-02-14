const { Worker } = require("bullmq");
const { connection } = require("./queue");
const redis = require("./config/redis.config");
const runBot = require("./bot/surfBot");

const worker = new Worker(
  "surfQueue",
  async (job) => {
    console.log("Processing:", job.data.url);

    await redis.hset(`job:${job.id}`, {
      status: "active",
      startedAt: Date.now(),
    });

    await runBot(job.data.url, job.id);

    console.log("✅ Job completed:", job.id);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`🎉 Completed: ${job.id}`);
});

worker.on("failed", async (job, err) => {
  console.log(`❌ Failed: ${job.id}`, err.message);

  await redis.hset(`job:${job.id}`, {
    status: "failed",
    error: err.message,
    failedAt: Date.now(),
  });
});

console.log("Worker started");