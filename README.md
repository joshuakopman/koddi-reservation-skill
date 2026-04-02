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

2. Install the skill in Codex (one-time):

```bash
ln -s "/absolute/path/to/koddi-reservation-skill/skills/koddi-reservation-campaign-builder" "$HOME/.codex/skills/koddi-reservation-campaign-builder"
```

If autocomplete does not update immediately, restart Codex (or reload skills).

3. Copy and edit the template:

```bash
cp skills/koddi-reservation-campaign-builder/references/campaign.template.json /tmp/my-campaign.json
```

4. Run with the bundled skill runner:

```bash
./skills/koddi-reservation-campaign-builder/scripts/run-koddi-campaign.sh /tmp/my-campaign.json
```

On first run (or when not already authenticated), Chrome will open and you must log in to Koddi manually. The automation will continue after login.

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
- `advertiser_name` (string, optional in JSON input; if provided, script attempts to select that exact advertiser label. Advertiser is still required by Koddi UI, so if omitted or not found the script falls back to the first advertiser option)
- `total_impressions` (number, recommended/primary; split mode controlled by `impression_allocation_mode`)
- `impression_allocation_mode` (string, optional; default `even`)
  - `even`: splits `total_impressions` evenly across all ad groups (remainder goes to earliest groups)
  - `keyword_inventory_proportional`: allocates from each keyword's inventory share, then sums to ad-group totals
- `reserved_impressions_per_group` (number, recommended fallback)
- `cpm_per_group` (number, optional; defaults to `10`)

Each `ad_groups[]` item:

- `name` (string, required)
- `gif_url` (string, required if click/cta/carousel not provided)
- `campaign_type` (string, optional per ad group; `search` default, or `trending`/`banner`)
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
- `positions` (string array, optional; defaults to `["Position 1"]`; applied in its own AND targeting group)
- `keywords` (array, optional)
  - For `search`: if provided, script attempts exact keyword selection; if omitted/empty, script randomizes keywords in UI while excluding `# giphytrending #`.
  - For `trending`: script always uses exactly `["# giphytrending #"]`.
  - For `banner`: script skips `search_query` keyword targeting (keywords in JSON are ignored for banner).
  - For keyword-inventory proportional splits, provide keyword objects:
    - `{ "term": "happy", "available_inventory": 5518193 }`
- `keyword_inventory` / `keyword_inventories` (optional map or array)
  - Alternative way to provide inventory for proportional allocation; example map:
    - `{ "happy": 5518193, "yay": 1734000 }`

Campaign type behavior:

- `search`: uses existing keyword behavior + country/position/ad type/ad context targeting groups.
- `trending`: same as search, except keywords are forced to `# giphytrending #` only.
- `banner`: forces ad type to `Banner`, skips `search_query`, and adds an `OnO View Type` targeting group.
- For banner, if `ono_view_types` is omitted, defaults to `["Details Page", "Home Page", "Search Page"]`.
- You can mix all three in one reservation by setting `ad_groups[].campaign_type` per ad group.

Impression precedence:

- If `reservation.total_impressions` is set and `reservation.impression_allocation_mode = keyword_inventory_proportional`, the script computes per-keyword guarantees from inventory share and then rolls up to each ad group.
- If `reservation.total_impressions` is set and split mode is omitted (or set to `even`), the script splits across all ad groups evenly (remainder distributed from the first group onward).
- Otherwise it uses each ad group's `reserved_impressions` if present.
- Otherwise it falls back to `reservation.reserved_impressions_per_group`.

Keyword inventory proportional formula:

- `keyword_guarantee = ROUND((keyword_available_inventory / total_keyword_inventory) * total_impressions)`
- `ad_group_reserved_impressions = SUM(keyword_guarantee in that group)`
- If rounding drift occurs, the script auto-reconciles so final ad-group totals still sum exactly to `total_impressions`.

CPM precedence:

- `ad_groups[].cpm` (if provided)
- if no per-group CPM is provided and the ad group appears Added Value (`AV` prefix in `name`, `product_type`, or `ad_types`), CPM defaults to `0` for that group
- `reservation.cpm_per_group` (or `reservation.cpm`)
- default `10`

## Reservation Campaign Example JSON

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
      "campaign_type": "search",
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

## Instructions for AdOps (Creating JSON via Prompts)

Runtime execution currently expects a JSON file path.

Operationally, you can provide a plain-language campaign brief and generate JSON from it before running.

Invoke the skill by starting your prompt with `$koddi-reservation-campaign-builder`.

Copy/paste prompt examples non-technical users can run in Codex:

### Example Prompt 1: Typical Rotational Setup (Separate Search + Trending Impression Pools)

```text
$koddi-reservation-campaign-builder

Please generate a valid campaign JSON for the Koddi reservation automation, then run the skill using that JSON and leave the browser open at the end.

Requirements:
- Reservation name: Old El Paso Search + Trending + Takeovers 2026-04-21 to 2026-05-05
- Start date: 04/21/2026
- End date: 05/05/2026
- Advertiser name: Demo Advertiser
- impression_allocation_mode: keyword_inventory_proportional_by_campaign_type
- impression_goals_by_campaign_type:
  - search: 2,272,727
  - trending: 3,125,000
- This means:
  - all Search Rotational ad groups are allocated from the Search pool only
  - all Trending Rotational ad groups are allocated from the Trending pool only
  - each pool is proportional to keyword inventory inside that pool
- Keep non-rotational takeovers as explicit fixed values:
  - Trending Takeover reserved_impressions: 9,000,000
  - AV Sticker Takeover reserved_impressions: 5,000,000
- For rotational groups, include keyword inventory using objects:
  - { "term": "...", "available_inventory": ... }
- For every group unless overridden:
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_types = ["API: GIF"] (banner groups still force Banner)
  - ad_contexts = ["*"]
  - carousel_gifs = [gif_url]
  - cta_url = gif_url

Ad group structure to build:
- Search Rotational groups (campaign_type: search): use keyword inventory and auto-compute reserved_impressions from the search pool.
- Trending Rotational groups (campaign_type: trending): use keyword inventory and auto-compute reserved_impressions from the trending pool.
- Trending Takeover + AV Sticker Takeover groups: set explicit reserved_impressions as fixed values, do not include them in impression_goals_by_campaign_type pools.

```

### Example Prompt 2: Uneven Impression Split (Search Only)

```text
Please generate a valid campaign JSON file for the Koddi reservation automation based on the following requirements, then execute the Koddi Reservation Builder skill based on that JSON, and leave the browser open at the end.

Requirements:
- Reservation name: testing uneven impression counts for lisa
- Start date: 04/01/2026
- End date: 06/30/2026
- Advertiser name: optional in your JSON input. Koddi UI still requires an advertiser; if you omit it, the automation selects the first advertiser option in the dropdown.
- Do not set reservation.total_impressions.
- CPM per ad group: 10
- For every ad group:
  - creative_id is auto-derived by parsing the ID at the end of `gif_url`
  - creative_friendly_name = ad group name
  - click_url is optional; include only if explicitly provided
  - cta_text is optional; include only if explicitly provided
  - cta_url is optional (if omitted, automation defaults to `gif_url`)
  - carousel_gifs = [gif_url]
  - countries = ["United States"]
  - positions = ["Position 1"]
  - ad_types = ["API: GIF"]
  - ad_contexts = ["*"]
  - keywords = [] (randomized in UI)

Ad groups (4):
1) one of those things
   gif_url: https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX
   campaign_type: search
   reserved_impressions: 500000
2) who's in charge?
   gif_url: https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M
   campaign_type: search
   reserved_impressions: 300000
3) sus
   gif_url: https://giphy.com/gifs/amc-tv-sus-amc-the-city-is-ours-6ZxKFYxtMFkkjTvQ0c
   campaign_type: search
   reserved_impressions: 100000
4) so proud
   gif_url: https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-lhKDuY8bhcPRwKsL7M
   campaign_type: search
   reserved_impressions: 100000

```

### Example Prompt 3: Separate Even Splits by Campaign Type (Search + Trending)

```text
Please generate a valid campaign JSON file for the Koddi reservation automation based on the following requirements, then execute the Koddi Reservation Builder skill based on that JSON, and leave the browser open at the end.

Requirements:
- Reservation name: Old El Paso Search + Trending Rotational 2026-04-21 to 2026-05-05
- Start date: 04/21/2026
- End date: 05/05/2026
- Advertiser name: optional in your JSON input. Koddi UI still requires an advertiser; if you omit it, the automation selects the first advertiser option in the dropdown.
- Build only Search Rotational and Trending Rotational ad groups.
- Do not include Trending Takeover or AV Sticker Takeover groups.
- Do not set reservation.total_impressions.

Search Rotational requirements:
- campaign_type: search
- Impression goal total: 2,272,727
- Split evenly across the 7 Search groups (distribute remainder +1 to earliest groups)
- CPM: 11

Trending Rotational requirements:
- campaign_type: trending
- Impression goal total: 3,125,000
- Split evenly across the 6 Trending groups (distribute remainder +1 to earliest groups)
- CPM: 8

For every ad group:
- creative_id auto-derived from the ID at the end of gif_url
- creative_friendly_name = ad group name
- click_url = gif_url
- cta_url = gif_url
- carousel_gifs = [gif_url]
- countries = ["United States"]
- positions = ["Position 1"]
- ad_types = ["API: GIF"]
- ad_contexts = ["*"]
- for search groups: keywords = []
- for trending groups: omit keywords (automation forces "# giphytrending #")

Ad groups (13):
1) Yeehaw! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE
2) Taco Tuesday! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-qR7pHUplTamahKVY2L
3) On my way! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VRmlnwz0lyQo25TTwS
4) Gimme that! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-dBP8vDQiz9xojpCPVD
5) It's taco time - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-25pbGxTTDIJlZiQ9Px
6) Happy Cinco de Mayo! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-PLmRUJ5qJy9woVkSPz
7) Feed me! - Search Rotational
   campaign_type: search
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC
8) Yeehaw! - Trending Rotational
   campaign_type: trending
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-NRsLUVqZEwujd4NiuE
9) Taco Tuesday! - Trending Rotational
   campaign_type: trending
   gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-qR7pHUplTamahKVY2L
10) On my way! - Trending Rotational
    campaign_type: trending
    gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VRmlnwz0lyQo25TTwS
11) Gimme that! - Trending Rotational
    campaign_type: trending
    gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-dBP8vDQiz9xojpCPVD
12) It's taco time - Trending Rotational
    campaign_type: trending
    gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-25pbGxTTDIJlZiQ9Px
13) Feed me! - Trending Rotational
    campaign_type: trending
    gif_url: https://giphy.com/gifs/OldElPaso-cinco-de-mayo-old-el-paso-taco-shells-VPMiVMq3nFdBrULMDC

```

### Example Prompt 4: Compute Ad Group Reserved Impressions from Keyword Inventory

```text
$koddi-reservation-campaign-builder

Please generate a valid campaign JSON for the Koddi reservation automation, then run the skill using that JSON and leave the browser open at the end.

Requirements:
- Reservation name: GIF split test using keyword inventory
- Start date: 04/03/2026
- End date: 06/30/2026
- Advertiser name: Demo Advertiser
- total_impressions: 5000000
- impression_allocation_mode: keyword_inventory_proportional
- cpm_per_group: 10
- campaign_type for both groups: search
- Compute each ad group's reserved_impressions from keyword inventory automatically
- For keywords, use object format: { "term": "...", "available_inventory": ... }

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

Use defaults unless specified:
- countries: ["United States"]
- positions: ["Position 1"]
- ad_types: ["API: GIF"]
- ad_contexts: ["*"]
- cta_url = gif_url
- carousel_gifs = [gif_url]
```
