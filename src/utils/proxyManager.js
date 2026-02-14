const proxies = (process.env.PROXIES || "")
  .split(",")
  .filter(Boolean)
  .map((p) => ({
    raw: p,
    success: 0,
    fail: 0,
    dead: false,
  }));

let currentIndex = 0;

// Round Robin
function getNextProxy() {
  if (!proxies.length) return null;

  let attempts = 0;

  while (attempts < proxies.length) {
    const proxy = proxies[currentIndex % proxies.length];
    currentIndex++;

    if (!proxy.dead) return proxy;
    attempts++;
  }

  return null; // all dead
}

// Mark proxy success
function markSuccess(proxy) {
  proxy.success++;
}

// Mark proxy failure
function markFailure(proxy) {
  proxy.fail++;

  if (proxy.fail >= 3) {
    proxy.dead = true;
    console.log("🚫 Proxy marked dead:", proxy.raw);
  }
}

// Parse proxy string
function parseProxy(proxyString) {
  const url = new URL(proxyString);

  return {
    server: `${url.protocol}//${url.hostname}:${url.port}`,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

module.exports = {
  getNextProxy,
  markSuccess,
  markFailure,
  parseProxy,
};