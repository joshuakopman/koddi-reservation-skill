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
- `reservation.advertiser_name` (optional in JSON input; advertiser is still required by Koddi UI, and if omitted the script satisfies it by selecting the first advertiser option)
- `reservation.total_impressions` (recommended/primary; auto-split evenly across all ad groups)
- `reservation.reserved_impressions_per_group` (default fallback for each ad group)
- `reservation.cpm_per_group` (optional CPM fallback; defaults to `10`)
- `ad_groups[]` with at minimum:
  - `name`
  - `gif_url` (or `click_url`/`cta_url`)

Optional ad group fields:

- `reserved_impressions`
- `cpm` (optional per-group CPM override)
- `creative_id`
- `creative_friendly_name`
- `click_url`
- `cta_url`
- `carousel_gif` or `carousel_gifs[0]`
- `ad_types` (optional string array; defaults to `["API: GIF"]`)
- `countries` (optional string array; defaults to `["United States"]`)
- `positions` (optional string array; defaults to `["Position 1"]`)
- `keywords` (optional; when provided, script attempts exact keyword selection in UI; otherwise random keywords are selected)

Impression precedence:

- `reservation.total_impressions` (if present, split evenly across all groups)
- `ad_groups[].reserved_impressions`
- `reservation.reserved_impressions_per_group`

CPM precedence:

- `ad_groups[].cpm`
- `reservation.cpm_per_group` (or `reservation.cpm`)
- default `10`

## Behavior

The automation:

- Opens Koddi reservation flow directly at `/reservations/reserve`
- Selects `Targeted Reservation` and `Multiple Ad Group Test Flow`
- Selects advertiser from `Select an advertiser`
- Fills reservation name/dates
- Creates targeting as AND groups: search_query in the first group, then country, position, ad type, and ad context each in its own + Add new group
- Clicks final `Submit`
- Verifies submit success (success modal/navigation/toast checks)
- Captures diagnostics under `artifacts/` on failures

## Operational Notes

- Keep `PLAYWRIGHT_PROFILE_DIR` stable to avoid repeated logins.
- If a previous run is still open, close it before starting a new run to avoid profile lock errors.
- Treat `artifacts/*.png` + `artifacts/*.html` as source of truth for fast UI debugging.
