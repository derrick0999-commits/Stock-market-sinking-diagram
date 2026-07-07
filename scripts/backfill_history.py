#!/usr/bin/env python3
"""One-time backfill of historical close prices into price-history.json."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))

from fetch_price import (  # noqa: E402
    CONFIG_PATH,
    HISTORY_PATH,
    compute_metrics,
    load_json,
    save_json,
)

TAIPEI = timezone(timedelta(hours=8))
START_DATE = "2026-06-25"


def main() -> int:
    config = load_json(CONFIG_PATH)
    ticker = config["ticker"]
    end_date = (datetime.now(TAIPEI) + timedelta(days=1)).strftime("%Y-%m-%d")

    hist = yf.Ticker(ticker).history(start=START_DATE, end=end_date)
    if hist.empty:
        print(f"No historical data for {ticker} between {START_DATE} and {end_date}", file=sys.stderr)
        return 1

    history = load_json(HISTORY_PATH)
    by_date = {entry["date"]: entry for entry in history.get("entries", [])}

    for ts, row in hist.iterrows():
        date_str = ts.strftime("%Y-%m-%d")
        close_price = float(row["Close"])
        if close_price != close_price or close_price <= 0:  # skip NaN / invalid
            continue
        metrics = compute_metrics(config, close_price)
        by_date[date_str] = {
            "date": date_str,
            "close_price": round(close_price, 2),
            **metrics,
        }

    entries = sorted(by_date.values(), key=lambda item: item["date"])
    history["entries"] = entries
    history["last_updated"] = datetime.now(TAIPEI).isoformat()
    history["config_snapshot"] = {
        "ticker": config["ticker"],
        "stock_name": config["stock_name"],
        "buy_price": config["buy_price"],
        "shares": config["shares"],
        "cost_basis": config["cost_basis"],
    }
    save_json(HISTORY_PATH, history)

    print(
        f"Backfilled {len(entries)} entries "
        f"({entries[0]['date']} → {entries[-1]['date']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
