# AdOps One-Click Launcher (No Skill Changes)

This wrapper adds a push-button flow without modifying the existing `koddi-reservation-campaign-builder` skill.

Flow:

1. Export the AdOps spreadsheet as CSV.
2. Drop the CSV in `adops-one-click/inbox/`.
3. Run `adops-one-click/Run-Koddi-From-Latest-Sheet.command` (double-click in Finder) or:

```bash
./adops-one-click/scripts/run-latest-sheet.sh
```

The wrapper will:

- pick the newest CSV in `adops-one-click/inbox/`
- convert it to campaign JSON under `tmp/adops-one-click/`
- call the existing runner:
  - `skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh`

For a safe pipeline check without launching browser automation:

```bash
DRY_RUN=1 ./adops-one-click/scripts/run-latest-sheet.sh
```

## CSV Columns

Minimum required reservation fields (can be repeated on every row):

- `reservation_name` (or `campaign_name`)
- `start_date`
- `end_date`

Minimum required ad-group fields per row:

- `gif_url` (or `creative_url`)
- `name` (optional; auto-falls back to `Ad Group N`)

Supported aliases include common AdOps labels such as:

- `ad_product_flight_type` -> `adops_spreadsheet_name`
- `product_type`
- `campaign_type`
- `reserved_impressions`
- `cpm`
- `countries`, `positions`, `ad_types`, `ad_contexts`, `ono_view_types`
- `keywords`
- `keyword_inventory` (format `term:inventory|term2:inventory2` or JSON)

Reservation-level optional fields:

- `advertiser_name`
- `impression_allocation_mode`
- `impression_goals_by_campaign_type` (JSON/object-like text)
- `search_impression_goal`, `trending_impression_goal`, `banner_impression_goal`
- `total_impressions`
- `reserved_impressions_per_group`
- `cpm_per_group`

## Notes

- Existing skill logic remains unchanged.
- For Bouncer-to-Koddi enrichment, include a **Bouncer line-item URL** (either `reservation.bouncer_line_item_url` in JSON or `--line-item-url` when running the script). This is required when ad groups are missing keyword inventory.
- Matching is GIF-ID based: the script uses the last URL segment from each ad group's `gif_url` and matches it to `GIF ID` on the Bouncer line-item creative cards.
- In Bouncer enrichment mode, the script now treats the Bouncer line-item page as source-of-truth for:
  - `reservation.start_date`
  - `reservation.end_date`
  - `reservation.total_impressions` (and `impression_goals_by_campaign_type.search`)
  - Search CPM (`reservation.cpm_per_group` and per-search-ad-group `cpm`)
- Search Rotational fallback defaults are auto-applied when missing:
  - `positions: ["Position 1"]`
  - `ad_contexts: ["*"]`

## Minimal Prompt/Input (Bouncer-First)

For AdOps usage, prompts/JSON no longer need seed values for dates, totals, CPM, position, or ad context.
Provide only:

- `reservation.name`
- `reservation.advertiser_name`
- `reservation.impression_allocation_mode`
- `reservation.bouncer_line_item_url`
- `ad_groups[]` with:
  - `name`
  - `campaign_type` (`search` for this flow)
  - `gif_url`

## Example Prompt: Bouncer-First Search Rotational

```md
$koddi-reservation-campaign-builder

Create a Koddi reservation campaign JSON from the inputs below, then enrich keyword inventory from Bouncer.
Do not run Koddi UI launch yet.

Inputs:
- advertiser_name: Demo Advertiser
- impression_allocation_mode: keyword_inventory_proportional_by_campaign_type
- bouncer_line_item_url: https://bouncer.giphy.tech/website/campaigns/d6d8222f-f55d-4103-afdf-5120e2086d23/line_items/2322/

Ad groups (Search Rotational only):
- name: Yeehaw! - Search Rotational
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE
- name: Taco Tuesday! - Search Rotational
  campaign_type: search
  gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-gR7pHUpITamahKVY2L

Rules:
- Pull from Bouncer line-item page:
  - reservation start_date/end_date
  - reservation total_impressions
  - search CPM (or compute from spend/total impressions if not directly shown)
- Match creative keywords by GIF ID (last segment of gif_url).
- For each keyword, lookup inventory in Inventory Explorer and write:
  - keywords: [{"term":"<keyword>","available_inventory":<count>}]
- Apply Search Rotational defaults if missing:
  - positions: ["Position 1"]
  - ad_contexts: ["*"]
- Return the final enriched campaign JSON.
```
