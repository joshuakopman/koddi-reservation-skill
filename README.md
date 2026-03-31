# Koddi Reservation Campaign Builder Skill

Automates creation of a Koddi reservation campaign in the UI:

- Creates a new reservation
- Creates multiple ad groups
- Populates creative/click/CTA fields
- Applies targeting with AND groups: search_query + country + position + ad type + ad context (each in its own targeting group)
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

By default, this automation uses its own Playwright profile and does not require copying your Chrome profile.
Any profile/CDP flags are optional troubleshooting tools for local login edge cases.

## Input Schema

Top-level keys:

- `reservation` (object)
- `ad_groups` (array of objects)

`reservation` fields:

- `name` (string, required)
- `start_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `end_date` (string, required, `YYYY-MM-DD` or `MM/DD/YYYY`)
- `advertiser_name` (string, optional in JSON input; advertiser is still required by Koddi UI, and if omitted the script satisfies it by selecting the first advertiser option)
- `total_impressions` (number, recommended/primary; auto-split evenly across all ad groups)
- `reserved_impressions_per_group` (number, recommended fallback)
- `cpm_per_group` (number, optional; defaults to `10`)

Each `ad_groups[]` item:

- `name` (string, required)
- `gif_url` (string, required if click/cta/carousel not provided)
- `reserved_impressions` (number, optional; falls back to reservation default)
- `cpm` (number, optional; falls back to reservation/default CPM)
- `creative_id` (string, optional input only; runtime derives Creative ID from the last token in the final `click_url` path segment)
- `creative_friendly_name` (string, optional; defaults to name)
- `click_url` (string, optional; defaults to `gif_url`)
- `cta_url` (string, optional; defaults to `gif_url`)
- `carousel_gif` (string, optional)
- `carousel_gifs` (string array, optional; first value used)
- `ad_types` (string array, optional; defaults to `["API: GIF"]`; applied in its own AND targeting group)
- `ad_contexts` (string array, optional; defaults to `["*"]` which selects all available Ad Context checkboxes; applied in its own AND targeting group)
- `countries` (string array, optional; defaults to `["United States"]`; applied in its own AND targeting group)
- `positions` (string array, optional; defaults to `["Position 1"]`; applied in its own AND targeting group)
- `keywords` (array, optional)
  - If provided: script attempts to select those exact keywords in Koddi UI.
  - If omitted or empty: script randomly selects keywords in UI for test coverage.

Impression precedence:

- If `reservation.total_impressions` is set, the script splits it across all ad groups (remainder distributed from the first group onward).
- Otherwise it uses each ad group's `reserved_impressions` if present.
- Otherwise it falls back to `reservation.reserved_impressions_per_group`.

CPM precedence:

- `ad_groups[].cpm` (if provided)
- `reservation.cpm_per_group` (or `reservation.cpm`)
- default `10`

## Full Example

```json
{
  "reservation": {
    "name": "josh test 10",
    "start_date": "2026-04-01",
    "end_date": "2026-06-30",
    "advertiser_name": "Demo Advertiser",
    "total_impressions": 4545455,
    "cpm_per_group": 10
  },
  "ad_groups": [
    {
      "name": "one of those things",
      "gif_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "creative_id": "1iHDjCqdmDJOqZFYAX",
      "creative_friendly_name": "one of those things",
      "click_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "cta_url": "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX",
      "carousel_gifs": [
        "https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX"
      ],
      "ad_types": ["API: GIF"],
      "ad_contexts": ["*"],
      "countries": ["United States"],
      "positions": ["Position 1"],
      "keywords": ["city", "drama", "night"]
    }
  ]
}
```

## Does It Have To Be JSON?

Runtime execution currently expects a JSON file path.

But operationally, no: you can provide a plain-language campaign brief and generate JSON from it before running.

Copy/paste prompt non-technical users can run in Codex:

```text
Please generate a valid campaign JSON file for the Koddi reservation automation.

Requirements:
- Reservation name: josh test 12
- Start date: 04/01/2026
- End date: 06/30/2026
- Advertiser name: optional in your JSON input. Koddi UI still requires an advertiser; if you omit it, the automation selects the first advertiser option in the dropdown.
- Total impressions: 4,545,455 (split evenly across all ad groups)
- CPM per ad group: 10
- For every ad group:
  - creative_id is auto-derived by parsing the ID at the end of `click_url` (for example `...-1iHDjCqdmDJOqZFYAX` -> `1iHDjCqdmDJOqZFYAX`)
  - creative_friendly_name = ad group name
  - click_url = gif_url
  - cta_url = gif_url
  - carousel_gifs = [gif_url]
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_types = ["API: GIF"]
  - ad_contexts = ["*"] (means select all Ad Context checkboxes)
  - keywords = [] (leave empty so automation randomizes keywords in Koddi UI)

Ad groups (5):
1) one of those things - https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
2) who's in charge? - https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
3) sus - https://giphy.com/gifs/amc-tv-sus-amc-the-city-is-ours-6ZxKFYxtMFkkjTvQ0c
4) so proud - https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-lhKDuY8bhcPRwKsL7M
5) oh shit - https://giphy.com/gifs/amc-tv-amc-the-city-is-ours-d6OvvJSLKz7vhtX8t5

Output only raw JSON, no markdown.
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
