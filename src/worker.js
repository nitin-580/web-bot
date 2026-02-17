const { Worker } = require("bullmq");
const { connection } = require("./queue");
const Redis = require("ioredis");
const runBot = require("./bot/surfBot");
const connectMongo = require("./config/mongo.config");
const Job = require("./models/job.model");

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  await connectMongo();
  console.log("✅ Worker connected to MongoDB");
})();

const worker = new Worker(
  "surfQueue",
  async (job) => {
    const proxyUsed = job.data.proxy || "SOAX";

    try {
      console.log(`🟢 Processing Job ${job.id}`);

      // 🔥 Ensure document exists
      await Job.findOneAndUpdate(
        { jobId: job.id },
        {
          status: "running",
          startedAt: new Date(),
          proxy: proxyUsed,
        },
        { upsert: true }
      );

      await redis.publish(
        "jobEvents",
        JSON.stringify({
          jobId: job.id,
          status: "running",
          proxy: proxyUsed,
        })
      );

      let result = null;

      if (job.name === "amazonSearch") {
        const { productName, targetASIN } = job.data;
        result = await runBot(productName, targetASIN, job.id);
      }

      await Job.findOneAndUpdate(
        { jobId: job.id },
        {
          status: "completed",
          finishedAt: new Date(),
          rankPosition: result?.rankPosition,
          price: result?.price,
        }
      );

      await redis.publish(
        "jobEvents",
        JSON.stringify({
          jobId: job.id,
          status: "completed",
          proxy: proxyUsed,
          rankPosition: result?.rankPosition,
          price: result?.price,
        })
      );

      console.log(`✅ Job ${job.id} completed`);

    } catch (err) {

      console.error(`❌ Job ${job.id} failed`);

      await Job.findOneAndUpdate(
        { jobId: job.id },
        {
          status: "failed",
          failedAt: new Date(),
          error: err.message,
        },
        { upsert: true }
      );

      await redis.publish(
        "jobEvents",
        JSON.stringify({
          jobId: job.id,
          status: "failed",
          error: err.message,
        })
      );

      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

console.log("🚀 Worker started");