import fs from "fs"
import path from "path";

const filePath = path.join(process.cwd(), "data", "raw-proxies.txt");


const raw = fs.readFileSync(filePath, "utf8");

const cleaned = raw
  .split("\n")
  .map(p => p.trim())
  .filter(p => {
    const parts = p.split(":");
    if (parts.length !== 2) return false;

    const [ip, port] = parts;

    // Basic IP check
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    // Remove localhost / invalid
    if (ip.startsWith("127.") || ip === "0.0.0.0") return false;

    // Valid port range
    const portNum = Number(port);
    if (portNum < 1 || portNum > 65535) return false;

    return true;
  });

fs.writeFileSync("clean-proxies.txt", cleaned.join("\n"));

console.log(`Cleaned proxies: ${cleaned.length}`);