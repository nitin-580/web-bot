const { Worker } = require("bullmq");
const { connection } = require("./queue");
const redis = require("./config/redis.config");
const runBot = require("./bot/surfBot");

const worker = new Worker(
  "surfQueue",
  async (job) => {
    try {
      console.log(`🟢 Processing Job ${job.id}`);
      console.log("Job name:", job.name);
      console.log("Job data:", job.data);

      await redis.hset(`job:${job.id}`, {
        status: "active",
        startedAt: Date.now(),
      });

      // 🔎 Amazon Search Job
      if (job.name === "amazonSearch") {
        const { productName, targetASIN } = job.data;

        console.log("Calling runBot...");
        await runBot(productName, targetASIN, job.id);
      }

      // 🌐 Generic Surf Job
      if (job.name === "surfJob") {
        const { url } = job.data;

        console.log("Calling runBot (generic)...");
        await runBot(url, null, job.id);
      }

      console.log(`✅ Job ${job.id} completed`);
    } catch (err) {
      console.error(`❌ Job ${job.id} failed:`, err.message);

      await redis.hset(`job:${job.id}`, {
        status: "failed",
        error: err.message,
        failedAt: Date.now(),
      });

      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`🎉 Completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.log(`❌ Failed Event: ${job.id}`, err.message);
});

console.log("🚀 Worker started");