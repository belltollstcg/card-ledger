# Card Ledger

A phone-friendly web app for tracking graded Pokémon cards you buy and sell. Take a photo of a slab, and the app reads the grader, grade, cert number, card name and set for you. It keeps your inventory, records sales, and works out profit per card and in total.

The app is a single static page hosted on **GitHub Pages**. **Supabase** handles everything on the back end: the database, login, slab and receipt photo storage, and the `read-slab` and `read-receipt` edge functions that read those photos.

## Features

- **Buy**: take a photo of a slab or pick one from your library. The `read-slab` function fills in grader, grade, cert number, card name and set. Then you add the price paid, fees and date, and save the card to inventory. The photo goes to storage with the card.
- **Sell**: photograph the slab to find the matching in-stock card by cert number, or pick it from a list. Enter the sale price, fees and date, and mark it sold.
- **Inventory**: a list of every card with its slab thumbnail, plus totals: the number of cards in stock and what they cost, the number sold and the revenue from them, and net profit.
- **Look up**: photograph a slab, or open a card from Inventory and tap **Look up**, to check prices. The search text is built from name, set, grader and grade. It links to eBay sold and active listings, Card Ladder and ALT, with a "Copy search text" button for pasting into an app. A cert page link (PSA, CGC or Beckett) appears when the grader is recognised. Look-ups aren't saved.
- **Edit / delete**: tap a card to fix any field, change its status, or delete it along with its photo.
- **Expenses**: photograph a receipt and the `read-receipt` function fills in vendor, date, time, amount, tax, category, payment method and a summary for the notes. Check the fields and save; the receipt photo is stored with the expense. The list below shows each expense with its receipt thumbnail. Tap one to edit or delete it (deleting also removes the photo). A year filter (default: this year) shows the year's total and a total per category, and **Export expenses CSV** downloads that year.
- **CSV export**: download the whole ledger, including profit per sold card.
- **Backup**: **Backup everything (zip)** on the Inventory tab downloads `card-ledger-backup-YYYY-MM-DD.zip` with `cards.csv`, `expenses.csv`, and every photo in `slab-photos/` and `receipt-photos/`. Photos are named by date plus cert or vendor (e.g. `2026-01-01_PSA-10_Charizard_12345678.jpg`, `2026-03-15_Staples_45.10.jpg`), and each CSV has a `photo_file` column pointing to its photo. Any photo that can't be downloaded is listed in `missing-photos.txt`.
- **Installable**: a web app manifest and icon, so you can add it to your home screen.

Profit for a sold card = `sold_for − sell_fees − cost − buy_fees`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles and JavaScript (uses `@supabase/supabase-js` v2 from jsDelivr, and loads JSZip 3.10.1 from cdnjs only when you make a backup) |
| `manifest.json` | Web app manifest for installing to the home screen |
| `icon.svg` | App icon |

The app has no build step and no dependencies to install.

## Supabase setup

### Auth

The app signs in with email and password (`signInWithPassword`). It has no sign-up screen, so create users in the Supabase dashboard under **Authentication → Users**.

### Database: `cards` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `user_id` | uuid | default `auth.uid()`, references `auth.users` |
| `created_at` | timestamptz | default `now()`; the list is sorted by this column, newest first |
| `cert` | text | required |
| `grader` | text | e.g. PSA, BGS, CGC |
| `grade` | text | |
| `name` | text | card name |
| `set_name` | text | set / year |
| `cost` | numeric | price paid |
| `buy_fees` | numeric | default `0` |
| `bought_on` | date | |
| `status` | text | `inventory` (default) or `sold` |
| `sold_for` | numeric | |
| `sell_fees` | numeric | default `0` |
| `sold_on` | date | |
| `photo` | text | storage path in the `slabs` bucket |

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

### Storage: `slabs` and `receipts` buckets

Both are **private** buckets. Photos are resized to at most 1280 px and saved as JPEG at `<user id>/<timestamp>.jpg`. The app shows them through signed URLs that last 24 hours. Add storage policies that limit each user to objects under their own `<user id>/` folder.

### Edge function: `read-slab`

The app calls it with `supabase.functions.invoke('read-slab', { body: { image } })`, where `image` is a base64-encoded JPEG with no `data:` prefix. It should return JSON like:

```json
{ "grader": "PSA", "grade": "10", "cert": "12345678", "name": "Charizard", "set": "Base Set 1999" }
```

Any field it can't read can be left out. If the call fails, the app falls back to manual entry.

### Edge function: `read-receipt`

Called the same way (`supabase.functions.invoke('read-receipt', { body: { image } })`). It should return JSON like:

```json
{ "vendor": "Staples", "date": "2026-03-15", "time": "14:05", "total": 45.10, "tax": 3.10, "category": "Supplies", "payment_method": "Visa", "summary": "Penny sleeves and top loaders" }
```

The app converts other date and time formats (such as `03/15/2026` or `2:05 PM`) to ISO, strips `$` from amounts, and maps the category to the closest one in the list, falling back to Other.

### Connecting the app

Near the top of the script in `index.html`, set `SUPABASE_URL` and `SUPABASE_KEY` to your project's URL and publishable (anon) key, from **Project Settings → API**. The publishable key is meant to be public. Row Level Security and the storage policies are what keep each user's data private.

## Hosting (GitHub Pages)

The site is served straight from the repository's root. To set it up, go to **Settings → Pages**, choose **Deploy from a branch**, and pick the default branch with the `/ (root)` folder. Changes go live once they're pushed.

To run it locally, serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```
