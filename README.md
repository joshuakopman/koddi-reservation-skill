# Koddi Reservation Campaign Builder Skill

Automates creation of a Koddi reservation campaign in the UI:

- Creates a new reservation
- Creates multiple ad groups
- Populates creative/click/CTA fields
- Applies keyword targeting (randomized selection in UI)
- Submits and verifies success

## Repository Layout

- `skills/koddi-reservation-campaign-builder/SKILL.md`: skill instructions
- `skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh`: runner
- `skills/koddi-reservation-campaign-builder/references/campaign.template.json`: input template
- `scripts/create-koddi-reservation.js`: Playwright automation

## Prerequisites

- Node 18+ (or compatible runtime)
- `npm install`
- Access to Koddi UAT
- A campaign JSON file

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy and edit the template:

```bash
cp skills/koddi-reservation-campaign-builder/references/campaign.template.json /tmp/my-campaign.json
```

3. Run with the bundled skill runner:

```bash
./skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh /tmp/my-campaign.json
```

The browser stays open at the end so you can manually verify results.

## Input Schema

Top-level keys:

- `reservation` (object)
- `ad_groups` (array of objects)

`reservation` fields:

- `name` (string, required)
- `start_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `end_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `advertiser_name` (string, recommended)
- `total_impressions` (number, recommended/primary; auto-split evenly across all ad groups)
- `reserved_impressions_per_group` (number, recommended fallback)

Each `ad_groups[]` item:

- `name` (string, required)
- `gif_url` (string, required if click/cta/carousel not provided)
- `reserved_impressions` (number, optional; falls back to reservation default)
- `creative_id` (string, optional; defaults to name)
- `creative_friendly_name` (string, optional; defaults to name)
- `click_url` (string, optional; defaults to `gif_url`)
- `cta_url` (string, optional; defaults to `gif_url`)
- `carousel_gif` (string, optional)
- `carousel_gifs` (string array, optional; first value used)
- `keywords` (array, optional)
  - If provided: script attempts to select those exact keywords in Koddi UI.
  - If omitted or empty: script randomly selects keywords in UI for test coverage.

Impression precedence:

- If `reservation.total_impressions` is set, the script splits it across all ad groups (remainder distributed from the first group onward).
- Otherwise it uses each ad group's `reserved_impressions` if present.
- Otherwise it falls back to `reservation.reserved_impressions_per_group`.

## Full Example

```json
{
  "reservation": {
    "name": "josh test 10",
    "start_date": "2026-04-01",
    "end_date": "2026-06-30",
    "advertiser_name": "Demo Advertiser",
    "total_impressions": 4545455
  },
  "ad_groups": [
    {
      "name": "one of those things",
      "gif_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "creative_id": "one of those things",
      "creative_friendly_name": "one of those things",
      "click_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "cta_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "carousel_gifs": [
        "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX"
      ],
      "keywords": ["city", "drama", "night"]
    }
  ]
}
```

## Does It Have To Be JSON?

Runtime execution currently expects a JSON file path.

But operationally, no: you can provide a plain-language campaign brief and generate JSON from it before running.

Example brief:

```text
Create Koddi reservation "josh test 12" from 04/01/2026 to 06/30/2026.
Use advertiser "Demo Advertiser".
Use a total reservation goal of 4,545,455 impressions and split evenly across 5 ad groups.
For each ad group, set creative id/friendly name to ad group name, and set click/cta/carousel URL to the GIF URL.
Ad groups:
1) one of those things - https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
2) who's in charge? - https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
3) sus - https://giphy.com/gifs/amc-tv-sus-amc-the-city-is-ours-6ZxKFYxtMFkkjTvQ0c
4) so proud - https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-lhKDuY8bhcPRwKsL7M
5) oh shit - https://giphy.com/gifs/amc-tv-amc-the-city-is-ours-d6OvvJSLKz7vhtX8t5
```

Then convert that brief into the schema above and run the script. Include `keywords` per ad group only when you want deterministic selection; otherwise leave it empty/omitted and the script will choose random keywords.

## Validate Before Running

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('/tmp/my-campaign.json','utf8')); console.log('valid json')"
```

## Direct NPM Invocation

```bash
CAMPAIGN_FILE="/tmp/my-campaign.json" npm run create:koddi-reservation
```
