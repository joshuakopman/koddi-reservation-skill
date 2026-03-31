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
- `reservation.advertiser_name` (exact advertiser option label shown in UI)
- `reservation.total_impressions` (recommended/primary; auto-split evenly across all ad groups)
- `reservation.reserved_impressions_per_group` (default fallback for each ad group)
- `ad_groups[]` with at minimum:
  - `name`
  - `gif_url` (or `click_url`/`cta_url`)

Optional ad group fields:

- `reserved_impressions`
- `creative_id`
- `creative_friendly_name`
- `click_url`
- `cta_url`
- `carousel_gif` or `carousel_gifs[0]`
- `keywords` (optional; when provided, script attempts exact keyword selection in UI; otherwise random keywords are selected)

Impression precedence:

- `reservation.total_impressions` (if present, split evenly across all groups)
- `ad_groups[].reserved_impressions`
- `reservation.reserved_impressions_per_group`

## Behavior

The automation:

- Opens Koddi reservation flow directly at `/reservations/reserve`
- Selects `Targeted Reservation` and `Multiple Ad Group Test Flow`
- Selects advertiser from `Select an advertiser`
- Fills reservation name/dates
- Creates all ad groups with impressions and asset fields
- Clicks final `Submit`
- Verifies submit success (success modal/navigation/toast checks)
- Captures diagnostics under `artifacts/` on failures

## Operational Notes

- Keep `PLAYWRIGHT_PROFILE_DIR` stable to avoid repeated logins.
- If a previous run is still open, close it before starting a new run to avoid profile lock errors.
- Treat `artifacts/*.png` + `artifacts/*.html` as source of truth for fast UI debugging.
