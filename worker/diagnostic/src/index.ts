/**
 * Diagnostic worker: finds a header profile Binance accepts from a
 * datacenter IP. Used once to configure the production proxy.
 */
interface Profile {
  name: string;
  headers: Record<string, string>;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PROFILES: Profile[] = [
  { name: "none", headers: {} },
  { name: "json", headers: { Accept: "application/json" } },
  { name: "server-ua", headers: { Accept: "application/json", "User-Agent": "crypto-radar-proxy/1.0" } },
  { name: "browser-min", headers: { Accept: "application/json, text/plain, */*", "User-Agent": BROWSER_UA } },
  {
    name: "browser-ref",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.binance.com/",
    },
  },
  {
    name: "browser-fetch",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.binance.com/",
      Origin: "https://www.binance.com",
      "Sec-Fetch-Site": "same-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  },
  {
    name: "browser-xhr",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.binance.com/",
      "X-Requested-With": "XMLHttpRequest",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  },
];

const TARGETS = [
  ["spot", "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"],
  ["fut", "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT"],
];

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/diag") return new Response("diag only", { status: 404 });

    const results: string[] = [];
    for (const [label, target] of TARGETS) {
      for (const profile of PROFILES) {
        try {
          const res = await fetch(target, { headers: profile.headers });
          const body = await res.text();
          results.push(
            label + " | " + profile.name + " -> " + res.status + " " + body.slice(0, 30).replace(/\s+/g, " "),
          );
          if (res.ok) break;
        } catch (error) {
          results.push(label + " | " + profile.name + " -> ERR " + String(error).slice(0, 40));
        }
      }
    }
    return new Response(results.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
