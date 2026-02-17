const redis = require("../config/redis.config");

const LIVE_TTL = 120; // 2 minutes safety

async function markProxyBusy(proxyId, jobId) {
  await redis.hset(`proxy:live:${proxyId}`, {
    status: "busy",
    jobId,
    startedAt: Date.now(),
    currentPing: 0,
  });

  await redis.expire(`proxy:live:${proxyId}`, LIVE_TTL);
}

async function updateLivePing(proxyId, ping) {
  await redis.hset(`proxy:live:${proxyId}`, {
    currentPing: ping,
  });

  await redis.expire(`proxy:live:${proxyId}`, LIVE_TTL);
}

async function markProxyIdle(proxyId) {
  await redis.hset(`proxy:live:${proxyId}`, {
    status: "idle",
    currentPing: 0,
  });

  await redis.expire(`proxy:live:${proxyId}`, LIVE_TTL);
}

module.exports = {
  markProxyBusy,
  updateLivePing,
  markProxyIdle,
};