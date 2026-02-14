require("dotenv").config();
const express = require("express");
const Redis = require("ioredis");

const jobRoutes = require("./routes/jobRoutes");
const proxyRoutes = require("./routes/proxyRoutes");
const statsRoutes = require("./routes/statsRoutes");

const app = express();
app.use(express.json());

// -------------------
// Redis Connection
// -------------------
const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

// -------------------
// HEALTH ROUTE (no auth)
// -------------------
app.get("/health", async (req, res) => {
  try {
    await redis.ping();
    res.json({
      status: "ok",
      redis: "connected",
      uptime: process.uptime(),
    });
  } catch {
    res.status(500).json({ status: "error" });
  }
});

// -------------------
// API KEY AUTH
// -------------------
app.use((req, res, next) => {
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// -------------------
// ROUTES
// -------------------
app.use("/api", jobRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/stats", statsRoutes);

// -------------------
app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});