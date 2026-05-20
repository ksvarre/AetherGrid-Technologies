---
name: tastytrade CSV Parsing Reference
description: How tastytrade CSV data is parsed and normalized into ChainTrace's data model
---

# tastytrade CSV Parsing — Reference

## Overview

ChainTrace supports importing option transaction data from **tastytrade** via CSV export. The tastytrade parser (`src/lib/tastytrade_parser.ts`) acts as an **adapter/normalizer** — it converts tastytrade's unique CSV format into the same `Transaction[]` shape that the Fidelity parser produces. All downstream logic (chain building, strategy classification, P&L computation, dashboards) works identically regardless of broker.

## Architecture

```
User → Upload UI (broker selector) → API Server → Router
                                                     ↓
                                        broker = 'fidelity'    → csv_parser.ts
                                        broker = 'tastytrade'  → tastytrade_parser.ts
                                                     ↓
                                              Transaction[]
                                                     ↓
                                        Chain Builder (unchanged)
                                                     ↓
                                        Strategy Engine (unchanged)
```

**Zero impact on Fidelity parsing.** The broker routing is additive — all existing Fidelity logic is unchanged.

## tastytrade CSV Format

### Headers
```
Symbol, Status, MarketOrFill, Price, TIF, Time, TimeStampAtType, Order #, Description
```

### Key Differences from Fidelity

| Feature           | Fidelity                        | tastytrade                          |
|-------------------|---------------------------------|-------------------------------------|
| Multi-leg orders  | One row per leg                 | Single row, legs in Description     |
| Expiration dates  | Full date (MM/DD/YYYY)          | Month + Day only (e.g., "Sep 19")   |
| Price format      | Separate Price/Amount columns   | Net price with "db"/"cr" suffix     |
| Action            | Separate Action column          | Embedded per-leg in Description     |
| Commission        | Explicit column                 | Not available                       |

### Description Field

Multi-leg orders encode all legs as separate lines within a quoted Description field:

```csv
CRM,Filled,Market,"3.34 db",GTC,"9/4/2025","8:34:44 AM",#12345,"1 Sep 19 Exp 242.5 Call BTO
-1 Sep 19 Exp 252.5 Call STO"
```

Each leg line follows the pattern:
```
{qty} {month} {day} Exp {strike} {Call|Put} {BTO|STO|BTC|STC}
```

## Parsing Logic

### 1. CSV Row Parsing
The custom `parse_csv_rows()` function handles quoted fields containing newlines — a standard `split('\n')` would break multi-leg orders.

### 2. Leg Parsing
Each Description line is matched against:
```regex
/^(-?\d+)\s+(\w+)\s+(\d{1,2})\s+Exp\s+(\d+(?:\.\d+)?)\s+(Call|Put)\s+(BTO|STO|BTC|STC)$/i
```

### 3. Expiration Year Inference
tastytrade dates have no year. The inference rule:
- If expiration month/day ≥ transaction date → **same year**
- If expiration month/day < transaction date → **next year**

### 4. Action Type Mapping
| tastytrade Action | ActionType      | Quantity Sign |
|-------------------|-----------------|---------------|
| BTO               | OPENING         | Positive (+)  |
| STO               | OPENING         | Negative (-)  |
| BTC               | CLOSING         | Positive (+)  |
| STC               | CLOSING         | Negative (-)  |

### 5. Price Allocation (Option C)
For multi-leg orders:
- **Primary leg** (first in Description) gets the full net amount × 100
- **All other legs** get amount = 0
- This preserves atomic strategy integrity while avoiding artificial price splitting

### 6. Spread Detection
Multi-leg orders set `account_type: 'Margin'` so the chain builder recognizes them as spread partners — identical to how Fidelity Margin-tagged legs are grouped.

### 7. Order Traceability
The `Order #` field is stored in `Transaction.order_id` so users can trace entries back to their broker.

## Known Limitations & Future Work

> [!IMPORTANT]
> The following scenarios need additional test data and implementation work:

- **Partial closes on multi-leg strategies** — When one leg of a multi-leg strategy is closed independently
- **Partial rolls** — When legs are rolled to new expirations at different times
- **Expired / Called Away / Assigned transactions** — The CSV format for these events is unknown and needs sample data
- See the Future Tasks section in the project docs for tracking

## Files

| File | Role |
|------|------|
| `src/lib/tastytrade_parser.ts` | Core tastytrade parsing module |
| `src/types.ts` | `order_id?: string` on Transaction |
| `src/lib/csv_parser.ts` | Broker routing to tastytrade parser |
| `src/lib/csv_parser_v2.ts` | Broker param in V2 options |
| `src/lib/api_client.ts` | Broker param in remote API call |
| `api-server/src/index.ts` | Server-side broker routing |
| `src/components/data/DataImportProvider.tsx` | Broker selector UI + context |

## Testing

### Fidelity Regression
Load demo data or upload a Fidelity CSV with "Fidelity" selected → verify dashboard renders correctly.

### tastytrade Verification
1. Select "tastytrade" in the broker selector
2. Upload the tastytrade demo CSV
3. Verify chains are created with correct:
   - Strike prices and expirations
   - Quantity signs (BTO positive, STO negative)
   - Price allocation on primary leg
   - Order IDs preserved
