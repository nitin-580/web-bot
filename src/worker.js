const { Worker } = require("bullmq");
const { connection } = require("./queue");
const runBot = require("./bot/surfBot");

new Worker(
  "surfQueue",
  async (job) => {
    console.log("Processing:", job.data.url);

    await runBot(job.data.url, job.id);

    console.log("✅ Job completed:", job.id);
  },
  { connection }
);

console.log("Worker started");