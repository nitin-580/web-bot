function parseProxy(proxyString) {
    const url = new URL(proxyString);
  
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  }
  
  function getRandomProxy() {
    const proxies = process.env.PROXIES
      ? process.env.PROXIES.split(",")
      : [];
  
    if (!proxies.length) return null;
  
    const random = proxies[Math.floor(Math.random() * proxies.length)];
    return parseProxy(random);
  }
  
  module.exports = { getRandomProxy };