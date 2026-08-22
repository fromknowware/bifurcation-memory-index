#!/usr/bin/env python3
"""
Fetches current price data for the 11-stock RAM ecosystem and writes
docs/data/stocks.json. Run via GitHub Actions every 15 min on market days.
"""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("yfinance not installed — run: pip install yfinance")
    sys.exit(1)

TICKERS = [
    {
        "symbol": "MU",
        "name": "Micron Technology",
        "tier": "manufacturer",
        "tier_label": "DRAM Manufacturer",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "005930.KS",
        "name": "Samsung Electronics",
        "tier": "manufacturer",
        "tier_label": "DRAM Manufacturer",
        "exchange": "KRX",
        "currency": "KRW",
    },
    {
        "symbol": "000660.KS",
        "name": "SK Hynix",
        "tier": "manufacturer",
        "tier_label": "DRAM Manufacturer",
        "exchange": "KRX",
        "currency": "KRW",
    },
    {
        "symbol": "NVDA",
        "name": "NVIDIA",
        "tier": "demand_driver",
        "tier_label": "HBM Demand",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "TSM",
        "name": "TSMC",
        "tier": "demand_driver",
        "tier_label": "HBM Demand",
        "exchange": "NYSE",
    },
    {
        "symbol": "AMD",
        "name": "Advanced Micro Devices",
        "tier": "demand_driver",
        "tier_label": "HBM Demand",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "INTC",
        "name": "Intel",
        "tier": "downstream",
        "tier_label": "Downstream Consumer",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "QCOM",
        "name": "Qualcomm",
        "tier": "downstream",
        "tier_label": "Downstream Consumer",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "WDC",
        "name": "Western Digital",
        "tier": "downstream",
        "tier_label": "Downstream Consumer",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "STX",
        "name": "Seagate Technology",
        "tier": "downstream",
        "tier_label": "Downstream Consumer",
        "exchange": "NASDAQ",
    },
    {
        "symbol": "688825.SS",
        "name": "CXMT Corporation",
        "tier": "manufacturer",
        "tier_label": "DRAM Manufacturer",
        "exchange": "STAR Market",
        "currency": "CNY",
    },
]

OUT_PATH = Path(__file__).parent.parent.parent / "docs" / "data" / "stocks.json"


def round2(v):
    if v is None:
        return None
    v = float(v)
    return round(v, 2) if math.isfinite(v) else None


def fetch_ticker(meta: dict) -> dict | None:
    sym = meta["symbol"]
    try:
        t = yf.Ticker(sym)
        info = t.fast_info

        price = info.last_price
        prev  = info.previous_close
        if price is None or prev is None or not math.isfinite(price) or not math.isfinite(prev):
            print(f"  {sym}: no price data")
            return None

        change     = round2(price - prev)
        change_pct = round2((price - prev) / prev * 100)

        # market cap — fast_info gives it in native currency
        mkt_cap = getattr(info, "market_cap", None)
        mkt_cap_b = round(mkt_cap / 1e9, 1) if mkt_cap else None

        # sparkline: last 10 trading-day closes (drop any NaN/missing sessions)
        hist = t.history(period="3mo", interval="1d")
        closes_all = [round2(v) for v in hist["Close"].tolist()]
        closes_all = [c for c in closes_all if c is not None]
        closes = closes_all[-10:]

        result = {**meta, "price": round2(price), "prev_close": round2(prev),
                  "change": change, "change_pct": change_pct,
                  "mkt_cap_b": mkt_cap_b, "sparkline": closes}
        print(f"  {sym}: {price:.2f}  {'+' if change_pct >= 0 else ''}{change_pct:.2f}%")
        return result

    except Exception as e:
        print(f"  {sym}: ERROR — {e}")
        return None


MIN_SPARKLINE_POINTS = 3


def main():
    print(f"Fetching {len(TICKERS)} tickers …")
    results = []
    errors  = []

    existing_map = {}
    if OUT_PATH.exists():
        try:
            existing = json.loads(OUT_PATH.read_text())
            existing_map = {t["symbol"]: t for t in existing.get("tickers", [])}
        except Exception:
            pass

    for meta in TICKERS:
        row = fetch_ticker(meta)
        if row:
            # STAR Market / newly-listed tickers can return thin yfinance
            # history — keep the last known-good sparkline rather than
            # overwrite a full trend with a near-empty one.
            cached = existing_map.get(row["symbol"])
            if len(row["sparkline"]) < MIN_SPARKLINE_POINTS and cached and cached.get("sparkline"):
                print(f"  {row['symbol']}: sparse history ({len(row['sparkline'])} pts) — keeping cached sparkline")
                row["sparkline"] = cached["sparkline"]
            results.append(row)
        else:
            errors.append(meta["symbol"])

    if not results:
        print("No data fetched — aborting write.")
        sys.exit(1)

    # Preserve existing entries for any tickers that errored
    if errors:
        for sym in errors:
            if sym in existing_map:
                results.append(existing_map[sym])
                print(f"  {sym}: using cached value")

    # Sort back to canonical order
    order = [t["symbol"] for t in TICKERS]
    results.sort(key=lambda r: order.index(r["symbol"]) if r["symbol"] in order else 99)

    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "yfinance via GitHub Actions",
        "tickers": results,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {len(results)} tickers → {OUT_PATH}")
    if errors:
        print(f"Errors (used cache): {errors}")


if __name__ == "__main__":
    main()
