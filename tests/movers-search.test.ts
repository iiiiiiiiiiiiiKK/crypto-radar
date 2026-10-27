import { describe, expect, it } from "vitest";
import { rankMovers, moverValue } from "@/features/command/movers";
import { searchRows, scoreSymbol, quoteBonus } from "@/features/search/search";
import { makeRow } from "./helpers";

describe("rankMovers", () => {
  const rows = [
    makeRow({ symbol: "AUSDT", key: "spot:AUSDT", changePercent: 12, quoteVolume24h: 900_000 }),
    makeRow({ symbol: "BUSDT", key: "spot:BUSDT", changePercent: -8, quoteVolume24h: 800_000 }),
    makeRow({ symbol: "CUSDT", key: "spot:CUSDT", changePercent: 3, quoteVolume24h: 80_000_000 }),
    makeRow({ symbol: "DUST", key: "spot:DUST", changePercent: 40, quoteVolume24h: 10 }),
  ];

  it("sorts gainers and drops dust pairs", () => {
    const list = rankMovers(rows, "gainers");
    expect(list[0].symbol).toBe("AUSDT");
    expect(list.map((row) => row.symbol)).not.toContain("DUST");
  });

  it("sorts losers ascending", () => {
    expect(rankMovers(rows, "losers")[0].symbol).toBe("BUSDT");
  });

  it("sorts by turnover", () => {
    expect(rankMovers(rows, "turnover")[0].symbol).toBe("CUSDT");
  });

  it("only ranks futures rows with funding", () => {
    const list = rankMovers(
      [
        makeRow({ market: "spot", fundingRate: 0.01 }),
        makeRow({ market: "futures", symbol: "PUSDT", key: "futures:PUSDT", fundingRate: -0.02 }),
      ],
      "funding",
    );
    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe("PUSDT");
  });

  it("hides volume metrics that are not measurable yet", () => {
    const list = rankMovers([makeRow({ d: { ...makeRow().d, volumeSurge: null } })], "surge");
    expect(list).toHaveLength(0);
  });

  it("formats board values with the right unit", () => {
    const row = makeRow({
      changePercent: 3.456,
      quoteVolume24h: 2_500_000,
      fundingRate: 0.0001,
      d: { ...makeRow().d, volumeSurge: 2.5, oiChange: -6.4 },
    });
    expect(moverValue(row, "gainers").text).toBe("+3.46%");
    expect(moverValue(row, "turnover").text).toBe("2.50M");
    expect(moverValue(row, "surge").text).toBe("2.50×");
    expect(moverValue(row, "funding").text).toBe("+0.0100%");
    expect(moverValue(row, "oi").text).toBe("-6.40%");
  });
});

describe("search", () => {
  const rows = [
    makeRow({ symbol: "BTCUSDT", base: "BTC", quote: "USDT", quoteVolume24h: 9e9 }),
    makeRow({ symbol: "BTCBIDR", base: "BTC", quote: "BIDR", quoteVolume24h: 9e12 }),
    makeRow({ symbol: "ETHUSDT", base: "ETH", quote: "USDT", quoteVolume24h: 5e9 }),
    makeRow({ symbol: "SOLUSDT", base: "SOL", quote: "USDT", quoteVolume24h: 1e9 }),
  ];

  it("ranks exact matches first", () => {
    expect(scoreSymbol("BTCUSDT", rows[0])).toBe(100);
    expect(scoreSymbol("btc", rows[0])).toBe(100);
  });

  it("prefers USDⓈ quotes over exotic ones", () => {
    const hits = searchRows(rows, "BTC");
    expect(hits[0].symbol).toBe("BTCUSDT");
  });

  it("matches by base asset and substring", () => {
    const hits = searchRows(rows, "eth");
    expect(hits[0].symbol).toBe("ETHUSDT");
  });

  it("supports subsequence matching", () => {
    expect(scoreSymbol("slu", rows[3])).toBeGreaterThan(0);
  });

  it("returns nothing for an empty query", () => {
    expect(searchRows(rows, "   ")).toHaveLength(0);
  });

  it("limits the result count", () => {
    expect(searchRows(rows, "usdt", 2)).toHaveLength(2);
  });

  it("scores preferred quotes higher", () => {
    expect(quoteBonus("USDT")).toBeGreaterThan(quoteBonus("BIDR"));
  });
});
