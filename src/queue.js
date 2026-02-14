const Redis = require("ioredis");
const { Queue } = require("bullmq");

const connection = new Redis({
  host: "redis", // docker service name
  port: 6379,
  maxRetriesPerRequest: null,   // 🔥 REQUIRED FOR BULLMQ
});

connection.on("connect", () => {
  console.log("✅ Connected to Redis");
});

connection.on("error", (err) => {
  console.error("Redis error:", err);
});

const surfQueue = new Queue("surfQueue", { connection });

module.exports = { surfQueue, connection };