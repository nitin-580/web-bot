import fs from "fs";
import axios from "axios";
import pLimit from "p-limit";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import path from "path"


const proxies = fs
  .readFileSync("clean-proxies.txt", "utf8")
  .split("\n")
  .filter(Boolean);

const limit = pLimit(20); 
const working = [];

function getAgent(proxy) {
  if (proxy.includes(":1080") || proxy.startsWith("socks")) {
    return new SocksProxyAgent(`socks://${proxy}`);
  }
  return new HttpsProxyAgent(`http://${proxy}`);
}

async function testProxy(proxy) {
  try {
    const agent = getAgent(proxy);

    const response = await axios.get(
      "https://api.ipify.org?format=json",
      {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 7000,
      }
    );

    return response.data.ip;
  } catch {
    return null;
  }
}

(async () => {
  console.log(`Testing ${proxies.length} proxies...\n`);

  const tasks = proxies.map((proxy) =>
    limit(async () => {
      console.log("Testing:", proxy);

      const ip = await testProxy(proxy);

      if (ip) {
        console.log(`✅ Working: ${proxy} → IP: ${ip}`);
        working.push(proxy);

        // Save progressively
        fs.appendFileSync("working-proxies.txt", proxy + "\n");
      } else {
        console.log(`❌ Dead: ${proxy}`);
      }
    })
  );

  await Promise.all(tasks);

  console.log("\nDone.");
  console.log("Total working:", working.length);
})();