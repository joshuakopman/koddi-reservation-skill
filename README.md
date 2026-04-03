# Koddi Reservation Campaign Builder Skill

Automates Koddi reservation setup in UI from either a prompt or JSON.

Core behavior:

- Creates a reservation and multiple ad groups
- Fills creative fields (Creative ID/Friendly Name, carousel GIF, click/CTA URLs)
- Supports AdOps product names:
  - `Search Rotational` / `search`
  - `Trending Rotational` / `trending`
  - `Rotational Video Unit`
  - `Carousel`
  - `Sticker Takeover`
  - `Trending Takeover`
  - `XL Banners`
  - `Link Out GIF`
- AdOps-style targeting behavior:
  - `Search Rotational`: search query keyword targeting + country + position + ad type + ad context
  - `Trending Rotational`: same targeting structure, with search query forced to `# giphytrending #`
  - `Sticker Takeover`: trending-style search query (`# giphytrending #`) + required position targeting + API Sticker ad type
  - `Trending Takeover`: trending-style search query (`# giphytrending #`) + required position targeting + API GIF ad type
  - `Rotational Video Unit`, `Carousel`, `XL Banners`, `Link Out GIF`: app-surface/banner-style targeting with `OnO View Type`
- Computes reserved impressions from keyword inventory
  - if inventory is provided in prompt/JSON, uses it directly
  - if search keywords are term-only, opens Bouncer and fetches inventory automatically
  - if search keywords/inventory are both missing and `reservation.bouncer_campaign_url` is provided, scrapes keywords from the Bouncer campaign page first, then fetches inventory
- Submits and verifies success

## Quick Start (AdOps Prompt-First)

1. Pick one of the prompt examples in this README:
   - Example 1 when keyword inventory is already provided
   - Example 2 when only keyword terms are provided (Bouncer lookup fallback)
   - Example 4 for Bouncer campaign URL source-of-truth (minimal input)
2. Replace template values (name, dates, goals, CPMs, ad groups, GIF URLs, keywords) with your actual campaign values.
3. Run the prompt in Codex (examples already include `$koddi-reservation-campaign-builder` at the top).
4. Log in if prompted:
   - Koddi login is required when session is expired
   - Bouncer login is required only when term-only search keywords require lookup
5. Review results in the browser (automation leaves browser open at the end).

## Prompt Examples (AdOps)

These are illustrative templates. Replace all names, dates, budgets, CPMs, impression goals, ad groups, GIF URLs, and keywords with values for your actual campaign.

### Example Prompt 1: Typical Rotational Setup (Separate Search + Trending Impression Pools)

```text
$koddi-reservation-campaign-builder

Please generate a valid campaign JSON for the Koddi reservation automation, then run the skill using that JSON and leave the browser open at the end.

Requirements:
- Reservation name: Old El Paso Search + Trending Rotational 2026-04-21 to 2026-05-05
- Start date: 04/21/2026
- End date: 05/05/2026
- Advertiser name: Demo Advertiser
- impression_allocation_mode: keyword_inventory_proportional_by_campaign_type
- impression_goals_by_campaign_type:
  - search: 2,272,727
  - trending: 3,125,000
- For every group unless overridden:
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_types = ["API: GIF"]
  - ad_contexts = ["*"]
  - carousel_gifs = [gif_url]
  - click_url = gif_url
  - cta_url = gif_url
- Auto-compute reserved_impressions from keyword inventory within each campaign type pool.

Ad group 1:
- name: GIF 1
- campaign_type: search
- gif_url: https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
- keywords:
  - { "term": "happy", "available_inventory": 5518193 }
  - { "term": "yay", "available_inventory": 1734000 }
  - { "term": "omg", "available_inventory": 844000 }

Ad group 2:
- name: GIF 2
- campaign_type: search
- gif_url: https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
- keywords:
  - { "term": "march madness", "available_inventory": 122000 }
  - { "term": "basketball", "available_inventory": 1500 }
  - { "term": "score", "available_inventory": 49000 }

Ad group 3:
- name: GIF 3
- campaign_type: trending
- gif_url: https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
- keywords:
  - { "term": "# giphytrending #", "available_inventory": 122000 }

```

### Example Prompt 2: Search-Only Terms (No Provided Inventory, Bouncer Lookup Required)

Use this when keywords are provided as plain terms (no `available_inventory`). The automation will open Bouncer, fetch inventory for each term, then compute reserved impressions.

```text
$koddi-reservation-campaign-builder

Please generate a valid campaign JSON for the Koddi reservation automation, then run the skill using that JSON and leave the browser open at the end.

Requirements:
- Reservation name: Bouncer to Koddi Inventory Lookup
- Start date: 05/01/2026
- End date: 05/31/2026
- Advertiser name: Demo Advertiser
- impression_allocation_mode: keyword_inventory_proportional_by_campaign_type
- impression_goals_by_campaign_type:
  - search: 5,000,000
- reservation.cpm_per_group: 11
- For every group unless overridden:
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_types = ["API: GIF"]
  - ad_contexts = ["*"]
  - carousel_gifs = [gif_url]
  - click_url = gif_url
  - cta_url = gif_url

Ad group 1:
- name: GIF 1
- campaign_type: search
- gif_url: https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
- keywords: ["happy", "yay", "omg"]

Ad group 2:
- name: GIF 2
- campaign_type: search
- gif_url: https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
- keywords: ["march madness", "basketball", "score"]
```

### Example Prompt 3: Multiple Ad Types In One Campaign (Search, Trending, Clickable, Video, and Added Value)

Use this when you have a real campaign sheet and need a clean JSON draft first, before final keywords are ready.

```text
$koddi-reservation-campaign-builder

Please generate a valid campaign JSON for the Koddi reservation automation, then run the skill using that JSON and leave the browser open at the end.

Requirements:
- Reservation name: AMC This City Is Ours 2026-04-01 to 2026-06-30
- Start date: 04/01/2026
- End date: 06/30/2026
- Advertiser name: AMC
- For every group unless overridden:
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_contexts = ["*"]
  - click_url = https://www.amcplus.com/pages/prestige/
  - cta_url = https://www.amcplus.com/pages/prestige/
  - cta_text = "Watch Now"

Build these AdOps product buckets and split impressions evenly within each bucket (remainder +1 to earliest groups):
- Ad Product - Flight Type: Link Out GIFs
  - total impressions: 310,000
  - cpm: 10
  - ad type: Clickable
  - creatives: all 6 GIF creatives listed below
- Ad Product - Flight Type: AV Search Rotational
  - total impressions: 4,545,455
  - cpm: 0
  - ad type: API: GIF
  - creatives: all 6 GIF creatives listed below
  - keywords: []
- Ad Product - Flight Type: AV Link Out GIFs
  - total impressions: 5,000,000
  - cpm: 0
  - ad type: Clickable
  - creatives: all 6 GIF creatives listed below
- Ad Product - Flight Type: AV Rotational Video Unit
  - total impressions: 2,272,727
  - cpm: 0
  - ad type: Video
  - creatives: the 2 clip URLs listed below
  - CTA text override for "The Audacity 15s (pre premiere)" = "Learn More"

GIF creatives (use for Link Out GIFs + AV Search Rotational + AV Link Out GIFs):
- one of those things | https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
- who's in charge? | https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
- sus | https://giphy.com/gifs/amc-tv-sus-amc-the-city-is-ours-6ZxKFYxtMFkkjTvQ0c
- so proud | https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-lhKDuY8bhcPRwKsL7M
- oh shit | https://giphy.com/gifs/amc-tv-amc-the-city-is-ours-d6OvvJSLKz7vhtX8t5
- i got this | https://giphy.com/gifs/amc-tv-amc-the-city-is-ours-james-nelson-joyce-1Tr4I0P4RkQcUHfkjJ

Video-unit creatives:
- This City is Ours 15s | https://giphy.com/clips/amc-tv-amc-this-city-is-ours-2yBKmWCN8BppnYSym
- The Audacity 15s (pre premiere) | https://giphy.com/clips/amc-tv-amc-the-audacity-ZNXOI5GZ8rCw5IoY0L
```

### Example Prompt 4: Bouncer Campaign URL Source-Of-Truth (Minimal)

Use this when AdOps already configured the campaign in Bouncer and wants the skill to source campaign metadata/keywords directly from Bouncer.

```text
$koddi-reservation-campaign-builder

Please generate campaign JSON and run the skill.

Requirements:
- reservation.name: Old El Paso Search Rotational (Bouncer Source)
- reservation.advertiser_name: Demo Advertiser
- reservation.impression_allocation_mode: keyword_inventory_proportional_by_campaign_type
- reservation.bouncer_campaign_url: https://bouncer.giphy.tech/website/campaigns/d6d8222f-f55d-4103-afdf-5120e2086d23/line_items/2322/
- Source reservation values from Bouncer campaign page when available:
  - start_date, end_date, total_impressions, and search CPM

Ad groups (search):
- name: Yeehaw!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE
- name: Taco Tuesday!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-gR7pHUpITamahKVY2L
- name: On my way!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VRmInwz0lyQo25TTwS
- name: Gimme that!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-dBP8vDQjz9xojpCPVD
- name: It's taco time
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-25pbGxTTDlJlZiQ9Px
- name: Happy Cinco de Mayo!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-PLmRUJ5gJy9woVkSPz
- name: Feed me!
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC

Behavior rules:
1. If `keywords` include `available_inventory`, use those values directly (no Bouncer lookup).
2. If `keywords` are term-only, keep terms and fetch only inventory from Bouncer Inventory Explorer.
3. If both keywords and inventory are missing, use `bouncer_campaign_url` to scrape keywords by GIF ID from the Bouncer campaign page, then fetch inventory from Bouncer Inventory Explorer.
4. Use Bouncer campaign metadata (start/end date, total impressions, CPM) as source-of-truth for the reservation/search pool.
```

## Quick Start (Local JSON Runner)

Prerequisites:

- Node 18+ (or compatible runtime)
- Access to Koddi UAT

Install dependencies:

```bash
npm install
```

Install the skill in Codex (one-time, if needed):

```bash
ln -s "/absolute/path/to/koddi-reservation-skill/skills/koddi-reservation-campaign-builder" "$HOME/.codex/skills/koddi-reservation-campaign-builder"
```

If autocomplete does not update immediately, restart Codex (or reload skills).

Copy and edit the template:

```bash
cp skills/koddi-reservation-campaign-builder/references/campaign.template.json /tmp/my-campaign.json
```

Run:

```bash
./skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh /tmp/my-campaign.json
```

## Repository Layout

- `skills/koddi-reservation-campaign-builder/SKILL.md`: skill instructions
- `skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh`: runner
- `skills/koddi-reservation-campaign-builder/references/campaign.template.json`: input template
- `scripts/create-koddi-reservation.js`: Playwright automation

## Inventory Calculation Features

- Recommended mode: `impression_allocation_mode=keyword_inventory_proportional_by_campaign_type`
  - each campaign type is allocated from its own pool (for example `search` pool and `trending` pool)
  - ad group reserved impressions are the sum of proportional keyword guarantees within that campaign-type pool
- Formula used:
  - `keyword_guarantee = ROUND((keyword_available_inventory / total_keyword_inventory) * total_impressions)`
  - `ad_group_reserved_impressions = SUM(keyword_guarantee for keywords in that ad group)`
- Rounding reconciliation:
  - if rounding drift occurs, the script reconciles totals so final ad-group sums match the exact pool goal
- Inventory source behavior:
  - if `available_inventory` is provided in keywords (or via `keyword_inventory` / `keyword_inventories`), it is used directly
  - if search keywords are term-only, inventory is fetched from Bouncer and then the same math is applied
- Backward-compatible fallback modes are still supported:
  - `keyword_inventory_proportional` (single-pool legacy)
  - `even` (legacy even split)
- If no computed pool applies, the script falls back to explicit per-group `reserved_impressions`, then `reservation.reserved_impressions_per_group`.

## Input Schema

Top-level keys:

- `reservation` (object)
- `ad_groups` (array of objects)

`reservation` fields:

- `name` (string, required)
- `start_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `end_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `advertiser_name` (string, optional in JSON input; if provided, script attempts to select that exact advertiser label. Advertiser is still required by Koddi UI, so if omitted or not found the script falls back to the first advertiser option)
- `impression_allocation_mode` (string, optional; default `keyword_inventory_proportional_by_campaign_type`)
  - `keyword_inventory_proportional_by_campaign_type` (recommended/default): allocates each campaign type from its own goal pool using keyword inventory
  - `keyword_inventory_proportional` (legacy single-pool mode): allocates one `total_impressions` pool across all groups by keyword inventory
  - `even` (legacy single-pool mode): splits one `total_impressions` pool evenly across all groups
- `impression_goals_by_campaign_type` (object or array, recommended/default with the mode above)
  - object example: `{ "search": 2272727, "trending": 3125000 }`
  - array example: `[{"campaign_type":"search","impression_goal":2272727},{"campaign_type":"trending","impression_goal":3125000}]`
- `impression_goals_by_type` (alias of `impression_goals_by_campaign_type`)
- `total_impressions` (number, optional; used for legacy single-pool modes)
- `reserved_impressions_per_group` (number, recommended fallback)
- `cpm_per_group` (number, optional; defaults to `10`)
- `bouncer_campaign_url` (string, optional; Bouncer campaign line-item URL used for keyword/metadata sourcing when needed)
  - when provided, the skill can source reservation `start_date`, `end_date`, `total_impressions`, and search CPM from that Bouncer campaign page

Each `ad_groups[]` item:

- `name` (string, required)
- `gif_url` (string, required if click/cta/carousel not provided)
- `campaign_type` (string, optional technical field; `search` default, or `trending`/`banner`)
- `adops_spreadsheet_name` (string, recommended when working from AdOps docs; supports `Search Rotational`, `Trending Rotational`, `Rotational Video Unit`, `Carousel`, `Sticker Takeover`, `Trending Takeover`, `XL Banners`, `Link Out GIF`, plus aliases `search` and `trending`)
- `product_type` (string, optional; useful when mapping spreadsheet exports)
- `reserved_impressions` (number, optional; falls back to reservation default)
- `cpm` (number, optional; falls back to reservation/default CPM)
- `creative_id` (string, optional input only; runtime derives Creative ID from the last token in `gif_url` path segment)
- `creative_friendly_name` (string, optional; defaults to name)
- `click_url` (string, optional; if omitted, Click URL is left blank in UI)
- `cta_text` (string, optional; if omitted, CTA Text is left blank in UI)
- `cta_url` (string, optional; defaults to `gif_url`)
- `carousel_gif` (string, optional)
- `carousel_gifs` (string array, optional; first value used)
- `ad_types` (string array, optional; defaults to `["API: GIF"]` for search/trending, and is forced to `["Banner"]` for banner campaign type; applied in its own AND targeting group)
- `ad_contexts` (string array, optional; defaults to `["*"]` which selects all available Ad Context checkboxes; applied in its own AND targeting group)
- `ono_view_types` (string array, optional; used for Banner flows in an `OnO View Type` targeting group)
- `countries` (string array, optional; defaults to `["United States"]`; applied in its own AND targeting group)
- `positions` (string array, optional; defaults to `["Position 1"]` only for products that require Position targeting; applied in its own AND targeting group when present)
- `keywords` (array, optional)
  - For `search`: if provided, script attempts exact keyword selection; if omitted/empty, script randomizes keywords in UI while excluding `# giphytrending #`.
  - For `trending`: script always uses exactly `["# giphytrending #"]`.
  - For `banner`: script skips `search_query` keyword targeting (keywords in JSON are ignored for banner).
  - For keyword-inventory proportional splits, provide keyword objects:
    - `{ "term": "happy", "available_inventory": 5518193 }`
- `keyword_inventory` / `keyword_inventories` (optional map or array)
  - Alternative way to provide inventory for proportional allocation; example map:
    - `{ "happy": 5518193, "yay": 1734000 }`

Keyword inventory fallback behavior:

- If inventory is already provided (`keywords` objects with `available_inventory`, or `keyword_inventory` / `keyword_inventories`), the script uses it directly and skips Bouncer lookup.
- If a `search` ad group only has keyword terms (no inventory), and the selected impression allocation mode requires keyword inventory, the script looks up term inventory in Bouncer Inventory Explorer and then performs the same reserved-impression calculations.
- If a `search` ad group has no keywords and no inventory, and `reservation.bouncer_campaign_url` is provided, the script scrapes that Bouncer campaign page (matching by GIF ID from each `gif_url`) to populate keywords first, then performs inventory lookup in Bouncer Inventory Explorer.
- When `reservation.bouncer_campaign_url` is provided, Bouncer campaign metadata is used as source-of-truth for search reservation settings (start/end date, total impressions, CPM) when values are available.
- Impression allocation math always runs; only the inventory source changes.
- Startup window behavior follows the same rule:
  - if any search group has term-only keywords, startup opens both Koddi and Bouncer windows
  - if keyword inventory objects are already present, startup opens only Koddi

AdOps Product Behavior:

- `Search Rotational`: uses provided keyword targeting (or randomized keyword fallback) plus country/position/ad type/ad context.
- `Trending Rotational`: same structure as Search Rotational, but keywords are forced to `# giphytrending #`.
- `Sticker Takeover`: treated as trending-style targeting with `# giphytrending #` and API Sticker ad type.
- `Trending Takeover`: treated as trending-style targeting with `# giphytrending #` and API GIF ad type.
- `Rotational Video Unit`, `Carousel`, `XL Banners`, `Link Out GIF`: treated as app-surface/banner-style products; `OnO View Type` targeting is supported.

Impression precedence:

- If `reservation.impression_goals_by_campaign_type` (or `impression_goals_by_type`) is set, each campaign type is allocated from its own goal pool.
  - default mode `keyword_inventory_proportional_by_campaign_type` uses keyword inventory inside each campaign type pool.
  - legacy `even` mode applies even split inside each campaign type pool.
- Otherwise, if `reservation.total_impressions` is set with legacy `keyword_inventory_proportional`, the script computes single-pool per-keyword guarantees from inventory share and rolls up to each ad group.
- Otherwise, if `reservation.total_impressions` is set with legacy `even`, the script splits across all ad groups evenly (remainder distributed from the first group onward).
- Otherwise it uses each ad group's `reserved_impressions` if present.
- Otherwise it falls back to `reservation.reserved_impressions_per_group`.

Keyword inventory proportional formula (used in both single-pool and by-campaign-type pools):

- `keyword_guarantee = ROUND((keyword_available_inventory / total_keyword_inventory) * total_impressions)`
- `ad_group_reserved_impressions = SUM(keyword_guarantee in that group)`
- If rounding drift occurs, the script auto-reconciles so final ad-group totals still sum exactly to `total_impressions`.

Bouncer lookup runtime controls (optional):

- `BOUNCER_LOOKUP_ENABLED` (`1`/`0`, default `1`): enables/disables automatic fallback lookup for missing keyword inventory.
- `BOUNCER_PROFILE_DIR` (default `<PLAYWRIGHT_PROFILE_DIR>-bouncer`): Playwright profile used for Bouncer login/session.
- `BOUNCER_INVENTORY_EXPLORER_URL` (default `https://bouncer.giphy.tech/website/inventory-explorer/`)
- `BOUNCER_LOGIN_WAIT_MS` (default `1200000`): max wait for manual Bouncer login before failing.
- `BOUNCER_CAMPAIGN_URL` (optional env fallback for `reservation.bouncer_campaign_url`)

CPM precedence:

- `ad_groups[].cpm` (if provided)
- if no per-group CPM is provided and the ad group appears Added Value (`AV` prefix in `name`, `product_type`, or `ad_types`), CPM defaults to `0` for that group
- `reservation.cpm_per_group` (or `reservation.cpm`)
- default `10`

## Reservation Campaign Example JSON

```json
{
  "reservation": {
    "name": "Old El Paso Search + Trending Rotational 2026-04-21 to 2026-05-05",
    "start_date": "2026-04-21",
    "end_date": "2026-05-05",
    "advertiser_name": "Demo Advertiser",
    "impression_allocation_mode": "keyword_inventory_proportional_by_campaign_type",
    "impression_goals_by_campaign_type": {
      "search": 2272727,
      "trending": 3125000
    },
    "bouncer_campaign_url": "https://bouncer.giphy.tech/website/campaigns/d6d8222f-f55d-4103-afdf-5120e2086d23/line_items/2322/",
    "cpm_per_group": 11
  },
  "ad_groups": [
    {
      "name": "GIF 1",
      "campaign_type": "search",
      "gif_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "creative_friendly_name": "GIF 1",
      "click_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "cta_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "carousel_gifs": [
        "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX"
      ],
      "cpm": 11,
      "ad_types": ["API: GIF"],
      "ad_contexts": ["*"],
      "countries": ["United States"],
      "positions": ["Position 1"],
      "keywords": [
        { "term": "happy", "available_inventory": 5518193 },
        { "term": "yay", "available_inventory": 1734000 },
        { "term": "omg", "available_inventory": 844000 }
      ]
    },
    {
      "name": "GIF 2",
      "campaign_type": "search",
      "gif_url": "https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M",
      "creative_friendly_name": "GIF 2",
      "click_url": "https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M",
      "cta_url": "https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M",
      "carousel_gifs": [
        "https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M"
      ],
      "cpm": 11,
      "ad_types": ["API: GIF"],
      "ad_contexts": ["*"],
      "countries": ["United States"],
      "positions": ["Position 1"],
      "keywords": [
        { "term": "march madness", "available_inventory": 122000 },
        { "term": "basketball", "available_inventory": 1500 },
        { "term": "score", "available_inventory": 49000 }
      ]
    },
    {
      "name": "Yeehaw! Trending",
      "campaign_type": "trending",
      "gif_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE",
      "creative_friendly_name": "Yeehaw! Trending",
      "click_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE",
      "cta_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE",
      "carousel_gifs": [
        "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE"
      ],
      "cpm": 8,
      "ad_types": ["API: GIF"],
      "ad_contexts": ["*"],
      "countries": ["United States"],
      "positions": ["Position 1"],
      "keywords": [
        { "term": "cinco de mayo", "available_inventory": 620000 },
        { "term": "taco", "available_inventory": 410000 }
      ]
    },
    {
      "name": "Feed me! Trending",
      "campaign_type": "trending",
      "gif_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC",
      "creative_friendly_name": "Feed me! Trending",
      "click_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC",
      "cta_url": "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC",
      "carousel_gifs": [
        "https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC"
      ],
      "cpm": 8,
      "ad_types": ["API: GIF"],
      "ad_contexts": ["*"],
      "countries": ["United States"],
      "positions": ["Position 1"],
      "keywords": [
        { "term": "taco tuesday", "available_inventory": 530000 },
        { "term": "mexican food", "available_inventory": 370000 }
      ]
    }
  ]
}
```
