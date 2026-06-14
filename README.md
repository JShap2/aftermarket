# AFTERMARKET

A Bloomberg-terminal-style **ticker** for the New York Times Obituaries RSS feed.
Each obituary is treated as a listed security: the headline becomes a ticker
symbol, the decedent's age is the "last price", and how that age compares to the
day's average age drives the green/red change column and the scrolling tape.

No graphs, no maps — the ticker is the point.

```
▚ AFTERMARKET   OBITUARIES TERMINAL    FEED: NYT/OBITS   INDEX·AVG AGE: 79.8 ...
─────────────────────────────────────────────────────────────────────────────
 EVAN 91 ▲ +11.3 (+14.1%)   MBEL 78 ▼ -1.8 (-2.2%)   PNAI 84 ▲ +4.3 ...  (tape)
─────────────────────────────────────────────────────────────────────────────
 SYM   DECEDENT          SECTOR        LAST   CHG    %CHG    TAPE      │ DETAIL
 EVAN  Eleanor Vance     Architecture    91  +11.3  +14.1%   5m       │  ...
 ...
CMD> type to filter — or HELP, REFRESH, SORT AGE, LIVE…
```

## Run it

Requires Node 18+ (uses the built-in `fetch`). No dependencies to install.

```bash
npm start
# → http://localhost:3000
```

Set a different port with `PORT=8080 npm start`.

## How it works

- **`server.js`** — a tiny dependency-free HTTP server. Serves the static
  frontend in `public/` and a JSON API at `/api/obits`.
- **`lib/feed.js`** — fetches the NYT Obituaries RSS, parses it (small regex
  parser; the feed is single and well-formed), and transforms each item into a
  ticker row. Results are cached for 5 minutes.
- **`lib/sample-data.js`** — clearly-labeled **fictional** fallback entries.
  If the live feed can't be reached (no network, rate limiting, an egress
  policy, or a `403` like NYT sometimes returns to unknown clients), the app
  serves these instead and flags the source as `SAMPLE` in the top bar.

### The ticker metaphor

| Market term | Obituary meaning                                            |
| ----------- | ---------------------------------------------------------- |
| Symbol      | Initials/surname derived from the headline (e.g. `EVAN`)  |
| Last        | Age at death (parsed from "Dies at 91")                   |
| Index       | Average age across the day's listings                      |
| Change      | Age − index (above average = green ▲, below = red ▼)       |
| Sector      | The obituary's RSS category                                |
| Tape time   | How long ago the item was published                        |

The change column is a deliberately stylistic metric — it is derived from real
ages, not invented market noise, but it is not a quote of anything.

## Terminal controls

Click the `CMD>` line (or press `/`) and type:

- **Any text** — live-filters the board by symbol, name, sector, or headline.
- `SORT AGE | SYM | NAME | CHG | TAPE` — re-sort the board.
- `REFRESH` / `LIVE` — force a fresh pull from the feed.
- `CLEAR` — clear the filter. `HELP` — list commands.

Keyboard: `↑/↓` move the selection, `Enter` opens the selected obituary's source
article, `Esc` clears the filter.

## Config

- `PORT` — HTTP port (default `3000`).
- `FEED_URL` — override the RSS source (default is the NYT Obituaries feed).
