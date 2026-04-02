---
name: koddi-reservation-campaign-builder
description: Create Koddi reservation campaigns (Targeted Reservation + Multiple Ad Group Test Flow) from structured campaign input and run the Playwright automation end-to-end. Use when Ad Ops needs to build reservations/ad groups quickly, set per-group impressions, populate asset fields, select advertiser, and submit with verification/diagnostics.
---

# Koddi Reservation Campaign Builder

Use the bundled runner to execute Koddi UI campaign creation from a campaign JSON file.

## Quick Start

1. Prepare input JSON using [`references/campaign.template.json`](references/campaign.template.json).
2. Run the automation:

```bash
./skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh /absolute/path/to/campaign.json
```

3. If Koddi login appears in the automation browser, log in there and continue.

## Input Contract

Use this shape:

- `reservation.name`
- `reservation.start_date` (`YYYY-MM-DD` or `MM/DD/YYYY`)
- `reservation.end_date` (`YYYY-MM-DD` or `MM/DD/YYYY`)
- `reservation.advertiser_name` (optional in JSON input; if provided, script attempts to select that exact advertiser label. Advertiser is still required by Koddi UI, so if omitted or not found the script falls back to the first advertiser option)
- `reservation.total_impressions` (recommended/primary; split mode controlled by `reservation.impression_allocation_mode`)
- `reservation.impression_allocation_mode` (optional; default `even`)
  - `even`
  - `keyword_inventory_proportional`
- `reservation.reserved_impressions_per_group` (default fallback for each ad group)
- `reservation.cpm_per_group` (optional CPM fallback; defaults to `10`)
- `ad_groups[]` with at minimum:
  - `name`
  - `gif_url` (or `click_url`/`cta_url`)

Optional ad group fields:

- `reserved_impressions`
- `cpm` (optional per-group CPM override)
- `campaign_type` (optional per group; defaults to `search`, or set `trending`/`banner`)
- `product_type` (optional; useful when mapping spreadsheet exports)
- `creative_id`
- `creative_friendly_name`
- `click_url` (optional; if omitted, Click URL is left blank in UI)
- `cta_text` (optional; if omitted, CTA Text is left blank in UI)
- `cta_url`
- `carousel_gif` or `carousel_gifs[0]`
- `ad_types` (optional string array; for `search`/`trending` defaults to `["API: GIF"]`, and for `banner` it is forced to `["Banner"]`)
- `ono_view_types` (optional string array for banner targeting dimension `OnO View Type`)
- `countries` (optional string array; defaults to `["United States"]`)
- `positions` (optional string array; defaults to `["Position 1"]`)
- `keywords` (optional; when provided, script attempts exact keyword selection in UI; otherwise random keywords are selected, excluding `# giphytrending #`)
  - For `keyword_inventory_proportional` mode, keywords can be objects like `{ "term": "happy", "available_inventory": 5518193 }`
- `keyword_inventory` / `keyword_inventories` (optional map or array; alternate place to provide per-keyword inventory for proportional allocation)

Campaign type behavior:

- `search` (default): keyword targeting behaves normally, and random keyword fallback excludes `# giphytrending #`.
- `trending`: keywords are forced to exactly `# giphytrending #`.
- `banner`: skips `search_query` (keywords ignored), forces ad type `Banner`, and adds `OnO View Type` targeting.
- Reservation can contain a mix of ad group types by setting `ad_groups[].campaign_type`.

Impression precedence:

- `reservation.total_impressions` + `reservation.impression_allocation_mode=keyword_inventory_proportional` (if present, split by keyword inventory share and sum to ad-group totals)
- `reservation.total_impressions` (if present and mode is omitted/`even`, split evenly across all groups)
- `ad_groups[].reserved_impressions`
- `reservation.reserved_impressions_per_group`

CPM precedence:

- `ad_groups[].cpm`
- if no per-group CPM is provided and the ad group appears Added Value (`AV` prefix in `name`, `product_type`, or `ad_types`), CPM defaults to `0` for that group
- `reservation.cpm_per_group` (or `reservation.cpm`)
- default `10`

Prompting tip for proportional guarantees:

- Say: "Set `reservation.total_impressions`, set `reservation.impression_allocation_mode` to `keyword_inventory_proportional`, and provide each ad group's keywords as `{term, available_inventory}` so reserved impressions are auto-computed per ad group."

## Behavior

The automation:

- Opens Koddi reservation flow directly at `/reservations/reserve`
- Selects `Targeted Reservation` and `Multiple Ad Group Test Flow`
- Selects advertiser from `Select an advertiser`
- Fills reservation name/dates
- Creates targeting as AND groups. For `search`/`trending`: `search_query` then country, position, ad type, ad context. For `banner`: skips `search_query`, forces ad type `Banner`, and adds `OnO View Type`
- Clicks final `Submit`
- Verifies submit success (success modal/navigation/toast checks)
- Captures diagnostics under `artifacts/` on failures

## Operational Notes

- Keep `PLAYWRIGHT_PROFILE_DIR` stable to avoid repeated logins.
- If a previous run is still open, close it before starting a new run to avoid profile lock errors.
- Treat `artifacts/*.png` + `artifacts/*.html` as source of truth for fast UI debugging.
