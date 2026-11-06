# Card Ledger

A phone-first web app for buying, selling and trading graded Pokémon cards. Scan a slab and the app reads the grader, grade, cert number, card name and set for you. PSA slabs are verified with PSA. It keeps your inventory, records sales and trades, tracks expenses, and works out profit in two ways (cash only, or tax view at market value).

The app is static files hosted on **GitHub Pages**. **Supabase** does everything on the back end: the database, login, slab and receipt photo storage, and the `read-slab`, `read-receipt` and `psa-cert` edge functions.

The previous version of the app is kept at **`/classic/`** as a fallback. It uses the same Supabase project, tables and login. The old `/beta/` address now redirects to the main app.

## Features

- **Design**: dark collector look built for speed at card shows. The bottom tab bar has Inventory, Sold, a raised gold **Scan** button, Expenses and Trades.
- **Inventory**: in-stock count and stock value, search, PSA / CGC / BGS filters, and a 2-column gallery of slab photos with "Paid $X · Nd held". Tap a card for its detail screen.
- **Scan** (gold button): **Live scan (barcode)**, **Take photo** or **Choose from photos**.
  - **Barcode first.** The browser's `BarcodeDetector` (Chrome on Android) reads the slab label's barcode or QR code, from the live camera view or the photo, in milliseconds. A cert URL in a QR code (psacard.com, cgccards.com, beckett.com) names the grader. For a plain number, the grader is guessed from its length, and the PSA lookup confirms it.
    - **PSA:** goes straight to the `psa-cert` lookup, with no AI reading.
    - **CGC / BGS / others:** fill in the cert and grader and ask you to confirm the rest. **Read details from photo** runs the AI reading on request.
  - **AI reading only as a fallback** (`read-slab`, photo shrunk to 800 px on the long side): when no barcode is found, or PSA can't be reached.
  - **Fast:** the **Scanned** screen opens straight away with the photo, and fields fill in as each step finishes, with a scanning animation meanwhile. Anything you type is never overwritten. The slab photo (resized to 1280 px) uploads to storage in the background and is attached when you save; an abandoned scan's photo is deleted when you scan again.
  - The **Scanned** screen shows the photo with name, year and set, a "Verified with PSA" badge, grade and cert, a link to the grader's cert page, and value links.
  - From there:
    - **Add to inventory**: a big "Price paid" number, fees / shipping, date, and "Bought from" pills. A duplicate-cert warning appears with **Save anyway**.
    - **Sell**: a big "Sold for" number, fees, date, "Sold on" pills, and a live profit / paid / days-held preview. If several in-stock cards share the cert, you pick which one. A card with no photo gets the scanned one.
  - Trades read barcodes first too.
- **Value links** (Scanned and Card detail screens). The exact text each link searches for is shown under the buttons.
  - **Card Ladder:** copies the cert ("Cert copied, paste in Card Ladder") and opens the installed Android app (`intent://…package=com.ladderstudios.cardladder`), falling back to cardladder.com. Other devices open Card Ladder's cert search page.
  - **ALT:** for PSA and BGS slabs, copies the cert, since ALT's search accepts PSA/BGS cert numbers but has no search link. For other graders, copies the detailed search text. Either way it then opens ALT.
  - **eBay:** sold listings in Collectible Card Games individual cards (category 183454).
    - The search is built from name, card number, set, year, variant, language and the grade in quotes (e.g. `"PSA 10"`), using PSA's verified details when present, with `-lot -proxy -custom -reprint`.
    - It adds eBay's Graded, Professional Grader (PSA, BGS) and Grade filters, plus Language for non-English cards.
- **Card detail**: large photo, Paid / Held / Source tiles, a timeline (bought, sold or traded), value links, and **Sell** and **Trade** buttons. The pencil icon opens **Edit**, where you can change any field, change the status (which moves the card between Inventory and Sold), or delete the card with its photo. A traded card's status is locked to Traded; delete the trade to put it back in stock.
- **Sold**: cards sold or traded away, newest first, with the **My view / Tax view** toggle, revenue and net profit.
  - **My view** (carryover): profit counts only when a card is sold for cash. Cards you trade for carry over the cost of what you gave up.
  - **Tax view** (market value): a trade counts as selling the outgoing cards and buying the incoming ones at their trade values on the trade date. A sale's profit uses the card's market-value basis.
  - Purchased cards use cost + fees in both views.
- **Trades**: **New trade** runs a 3-step flow:
  1. **Cards going out**: scan a slab or pick from the list, and enter a trade value for each.
  2. **Cash**: trade date, cash paid and cash received.
  3. **Cards coming in**: take or choose a photo of each slab (read by `read-slab`, verified with PSA) or add one by hand, and enter a trade value for each. Optional counterparty and notes.

  A balance check compares (values out + cash paid) with (values in + cash received). It warns when they differ but still lets you save. The trade is saved in one transaction by `record_trade`. The trade history opens each trade in full, and **Delete trade** undoes it in one transaction with `delete_trade`.
- **Expenses**:
  - **Add receipt** photographs a receipt, and `read-receipt` fills in vendor, date, time, amount, tax, category, payment method and notes. You can also add an expense without a photo.
  - The year pills show the year's total and a total per category.
  - Tap an expense to edit or delete it (deleting removes the photo too).
  - **Export expenses CSV** downloads the selected year.
- **⋯ menu**: Install app, Export cards CSV, Export trades CSV, **Backup everything (zip)**, Open classic app, Sign out.
  - The backup is `card-ledger-backup-YYYY-MM-DD.zip`, with `cards.csv`, `trades.csv`, `expenses.csv`, and every photo in `slab-photos/` and `receipt-photos/`. Photos are named by date plus cert or vendor, and each CSV has a `photo_file` column. Photos that can't be downloaded are listed in `missing-photos.txt`.
- **Install**: when Chrome offers to install the app (`beforeinstallprompt`), a one-time "Install the app" banner appears on Inventory. **Install app** is always in the ⋯ menu when the app isn't running installed: it opens Chrome's prompt if available, otherwise it explains how to install from Chrome's own menu.
- **Back gesture**: every screen change is a browser history entry, so Android's back gesture steps back through screens (tabs, card detail, scan, price screens, edit), and it reopens the right card or trade. Chrome skips history entries a page adds without a recent tap, so entries are only added during a tap:
  - The scan or receipt screen is added when you tap Take photo / Choose from photos, before the camera opens.
  - The exit guard is added on your first tap.
  - Anything finishing later (a photo read, a save) replaces entries instead of adding them.
  - After a tap, the first back on Inventory shows "Swipe back again to exit", and a second back leaves. Backing out of a trade in progress asks first. If Android reloads the page while the camera is open, the app keeps its history.

### How trades are valued

- **Carryover basis (my view)**: cost of the cards going out (cost + buy_fees) + cash paid − cash received. It's split across the incoming cards in proportion to their trade values (equally if every value is 0), rounded to cents. Each incoming card stores its share in `cost`, with `buy_fees` = 0. If the total would go below zero, the incoming cards get 0 and the excess is recorded as profit on the trade (`trades.carryover_gain`).
- **Market-value basis (tax view)**: each incoming card's trade value, stored in `fmv_basis`.
- **Outgoing cards**: status `traded`, plus `disposed_trade_id`, `trade_value_out` and `trade_gain` = trade value − (cost + buy_fees). In tax view, the gain is trade value − market-value basis when the card itself came from an earlier trade.
- **Profit on a sale**: my view = `sold_for − sell_fees − cost − buy_fees`; tax view = `sold_for − sell_fees − fmv_basis` (or cost + buy_fees when there's no `fmv_basis`).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app's markup and styles (Space Grotesk and Inter from Google Fonts) |
| `app.js` | The app's JavaScript (uses `@supabase/supabase-js` v2 from jsDelivr, and loads JSZip 3.10.1 from cdnjs only when you make a backup). `index.html` loads it as `app.js?v=…`; bump that version when `app.js` changes so phones fetch the new file. |
| `manifest.json` | Web app manifest: "Card Ledger", start URL and scope at the site root. It has no `id`, like the original app's manifest, so the installed app keeps the same identity (`/card-ledger/`) and updates in place. |
| `sw.js` | Minimal service worker, registered at the root scope. Chrome needs one before it offers to install. It caches nothing, only handles this site's page loads, and never touches Supabase or edge function calls. Bump `VERSION` when the app changes. |
| `icon.svg`, `icon-192.png`, `icon-512.png` | App icons |
| `classic/` | The previous version of the app, unchanged, as a fallback |
| `beta/index.html` | Redirects old beta links and home-screen icons to the main app, and removes the old beta service worker |
| `supabase/record_trade.sql` | The `record_trade` database function that saves a trade in one transaction |
| `supabase/delete_trade.sql` | The `delete_trade` database function that undoes a trade in one transaction |
| `supabase/functions/psa-cert/index.ts` | The `psa-cert` edge function that verifies PSA certs |
| `supabase/functions/read-slab/index.ts` | The `read-slab` edge function (Claude Haiku 5.5) that reads a slab label when there's no barcode |

The app has no build step and no dependencies to install.

## Supabase setup

### Auth

The app signs in with email and password (`signInWithPassword`). It has no sign-up screen, so create users in the Supabase dashboard under **Authentication → Users**.

### Database: `cards` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `user_id` | uuid | default `auth.uid()`, references `auth.users` |
| `created_at` | timestamptz | default `now()` |
| `cert` | text | required |
| `grader` | text | e.g. PSA, BGS, CGC |
| `grade` | text | |
| `name` | text | card name (your own copy; never PSA's data) |
| `set_name` | text | set / year |
| `cost` | numeric | price paid |
| `buy_fees` | numeric | default `0` |
| `bought_on` | date | |
| `bought_from` | text | eBay, Card show, Local shop, Other |
| `status` | text | `inventory` (default), `sold` or `traded` |
| `sold_for` | numeric | |
| `sell_fees` | numeric | default `0` |
| `sold_on` | date | |
| `sold_platform` | text | eBay, Card show, Local, Other |
| `photo` | text | storage path in the `slabs` bucket |
| `acquired_via`, `acquired_trade_id`, `disposed_trade_id`, `trade_value_in`, `trade_value_out`, `fmv_basis`, `trade_gain` | | trade fields (see below) |
| `psa_data` | jsonb | PSA verification result (see PSA rules below) |

Turn on **Row Level Security** and add policies so that each user can only select, insert, update and delete rows where `user_id = auth.uid()`.

### Database: `expenses` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | default `auth.uid()` |
| `vendor` | text | |
| `expense_date` | date | ISO `YYYY-MM-DD` |
| `expense_time` | time | nullable; saved as null when left blank |
| `amount` | numeric | required in the app |
| `tax` | numeric | |
| `category` | text | one of: Grading fees, Shipping and postage, Supplies, Selling and platform fees, Travel, Meals, Show and booth fees, Software and subscriptions, Other |
| `payment_method` | text | |
| `notes` | text | |
| `photo` | text | storage path in the `receipts` bucket |
| `raw` | jsonb | the full `read-receipt` response, kept for reference |
| `created_at` | timestamptz | |

Use the same Row Level Security policies as `cards`.

### Database: trades

`trades` has `trade_date`, `cash_paid`, `cash_received`, `counterparty`, `notes` and `carryover_gain`. `cards` gains `acquired_via` (`purchase` or `trade`), `acquired_trade_id`, `disposed_trade_id`, `trade_value_in`, `trade_value_out`, `fmv_basis` and `trade_gain`, and its status can be `traded`.

Run `supabase/record_trade.sql` once in the Supabase SQL Editor. It adds `trades.carryover_gain` if it's missing and creates `record_trade(p jsonb)`, which the app calls with `supabase.rpc`. The function runs as the signed-in user, so Row Level Security still applies. It checks that every outgoing card is still in stock, then saves the trade and updates every card. If anything fails, nothing is saved. Incoming slab photos are uploaded first and deleted again if the trade isn't saved.

Also run `supabase/delete_trade.sql`, which creates `delete_trade(p_trade_id text)`. It restores the outgoing cards to in stock (clearing their trade fields), deletes the incoming cards and the trade, and returns the incoming cards' photo paths so the app can remove them from storage. It refuses if any incoming card has been sold or traded since.

### Storage: `slabs` and `receipts` buckets

Both are **private** buckets. Photos are resized to at most 1280 px and saved as JPEG at `<user id>/<timestamp>.jpg`. The app shows them through signed URLs that last 24 hours. Add storage policies that limit each user to objects under their own `<user id>/` folder.

### Edge function: `read-slab`

`supabase/functions/read-slab/index.ts` reads the slab label with Claude Haiku 5.5 (`claude-haiku-5-5`, `max_tokens` 200, thinking off, effort low, structured JSON output). It uses the `ANTHROPIC_API_KEY` secret. The app calls it with `supabase.functions.invoke('read-slab', { body: { image } })`, where `image` is a base64-encoded JPEG (800 px on the long side) with no `data:` prefix, and only when it couldn't read the slab's barcode. It returns:

```json
{ "grader": "PSA", "grade": "10", "cert": "12345678", "name": "Charizard Holo 4/102", "set": "1999 Pokemon Base Set" }
```

Any field it can't read is an empty string. If the call fails, the app falls back to manual entry.

### Edge function: `read-receipt`

Called the same way (`supabase.functions.invoke('read-receipt', { body: { image } })`). It should return JSON like:

```json
{ "vendor": "Staples", "date": "2026-03-15", "time": "14:05", "total": 45.10, "tax": 3.10, "category": "Supplies", "payment_method": "Visa", "summary": "Penny sleeves and top loaders" }
```

The app converts other date and time formats (such as `03/15/2026` or `2:05 PM`) to ISO, strips `$` from amounts, and maps the category to the closest one in the list, falling back to Other.

### Edge function: `psa-cert` (PSA verification)

`supabase/functions/psa-cert/index.ts` looks up a cert with PSA's public API (`GET https://api.psacard.com/publicapi/cert/GetByCertNumber/{cert}`) using the `PSA_API_TOKEN` secret. It returns only `verified`, `cert`, `name`, `year`, `set` and `grade`, never the full PSA response.

PSA data rules (PSA API licence):
- Only `verified`, `verified_at`, `name`, `year`, `set`, `grade` and `cert` are stored, only in `cards.psa_data`.
- Each cert is looked up at most once: the app reuses `psa_data` already stored on any card with that cert, and results from earlier scans in the same session.
- The card's own columns (name, set, grade) keep the photo reading or your edits. The app shows PSA's verified details when present, so clearing `psa_data` removes every trace of PSA data in one step.
- `psa_data` is never included in CSV exports or the Backup zip.
- If PSA can't be reached, the scan falls back to the photo reading and nothing is stored.

### Connecting the app

Near the top of `app.js`, set `SUPABASE_URL` and `SUPABASE_KEY` to your project's URL and publishable (anon) key, from **Project Settings → API**. (`classic/index.html` has its own copy of these.) The publishable key is meant to be public. Row Level Security and the storage policies are what keep each user's data private.

## Hosting (GitHub Pages)

The site is served straight from the repository's root. To set it up, go to **Settings → Pages**, choose **Deploy from a branch**, and pick the default branch with the `/ (root)` folder. Changes go live once they're pushed.

To run it locally, serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```
