const { proxies } = require("./proxyManager");

function printProxyStats() {
  console.log("📊 Proxy Stats:");
  proxies.forEach((p) => {
    console.log(
      p.raw,
      "| success:",
      p.success,
      "| fail:",
      p.fail,
      "| dead:",
      p.dead
    );
  });
}

setInterval(printProxyStats, 60000);