const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const PROFILE_DIR = process.env.PLAYWRIGHT_PROFILE_DIR || '.playwright-koddi-profile';
const DIAG_DIR = process.env.DIAG_DIR || 'artifacts';
const CAMPAIGN_FILE = process.env.CAMPAIGN_FILE || '';
const PLAYWRIGHT_CHANNEL = process.env.PLAYWRIGHT_CHANNEL || '';
const BROWSER_EXECUTABLE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '';
const USE_CDP = process.env.USE_CDP === '1';
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const CHROME_PROFILE_DIRECTORY = process.env.CHROME_PROFILE_DIRECTORY || '';
const CLEAR_SINGLETON_LOCKS = process.env.CLEAR_SINGLETON_LOCKS === '1';
const ADGROUPS_URL = process.env.ADGROUPS_URL || 'https://k1-uat.koddi.app/#/clients/3500/reservations';
const LOGIN_URL = process.env.LOGIN_URL || 'https://k1-uat.koddi.app/#/giphy/login';
const LOGIN_READY_URL_REGEX = /\/clients\/3500\/dashboard\/publisher/i;
const READY_APP_URL_REGEX = /\/clients\/3500\/(dashboard\/publisher|reservations)/i;
const LOGIN_WAIT_MS = Number(process.env.LOGIN_WAIT_MS || 300000);
let RESERVED_IMPS_PER_GROUP = Number(process.env.RESERVED_IMPS_PER_GROUP || 757576);
let RESERVATION_NAME = process.env.RESERVATION_NAME || 'josh test';
let START_DATE = process.env.START_DATE || '04/01/2026';
let END_DATE = process.env.END_DATE || '06/30/2026';
let ADVERTISER_NAME = process.env.ADVERTISER_NAME || '';
let TOTAL_IMPRESSIONS = Number(process.env.TOTAL_IMPRESSIONS || 0);
let IMPRESSION_ALLOCATION_MODE = String(process.env.IMPRESSION_ALLOCATION_MODE || 'keyword_inventory_proportional_by_campaign_type');
let IMPRESSION_GOALS_BY_CAMPAIGN_TYPE = {};
let CPM_PER_GROUP = Number.isFinite(Number(process.env.CPM_PER_GROUP)) && Number(process.env.CPM_PER_GROUP) >= 0
  ? Number(process.env.CPM_PER_GROUP)
  : 10;
const KEEP_BROWSER_OPEN = process.env.KEEP_BROWSER_OPEN !== '0';
const CAPTURE_SUCCESS_DIAGNOSTICS = process.env.CAPTURE_SUCCESS_DIAGNOSTICS === '1';
const SLOW_MO = Number(process.env.SLOW_MO || 0);
const DEBUG_KEYWORD_FAILURES = process.env.DEBUG_KEYWORD_FAILURES === '1';
const PROFILE_FALLBACK = process.env.PLAYWRIGHT_PROFILE_FALLBACK === '1';
const ENABLE_CHROME_EXTENSIONS = process.env.ENABLE_CHROME_EXTENSIONS === '1';
const TARGETING_SETTLE_MS = Number(process.env.TARGETING_SETTLE_MS || 350);
const COUNTRY_PICK_DELAY_MS = Number(process.env.COUNTRY_PICK_DELAY_MS || 250);
const ATTRIBUTE_LOAD_WAIT_MS = Number(process.env.ATTRIBUTE_LOAD_WAIT_MS || 450);
const TARGETING_GROUP_STEP_DELAY_MS = Number(process.env.TARGETING_GROUP_STEP_DELAY_MS || 500);
const DEFAULT_CAMPAIGN_TYPE = 'search';
const DEFAULT_TRENDING_KEYWORDS = ['# giphytrending #'];
const RESERVED_TRENDING_KEYWORD_TOKEN = 'giphytrending';
const DEFAULT_COUNTRIES = ['United States'];
const DEFAULT_AD_TYPES = ['API: GIF'];
const DEFAULT_POSITIONS = ['Position 1'];
const DEFAULT_AD_CONTEXTS = ['*'];
const DEFAULT_APP_SURFACE_AD_CONTEXTS = ['GIPHY Web', 'GIPHY Android', 'GIPHY IOS'];
const DEFAULT_ONO_VIEW_TYPES = ['Details Page', 'Home Page', 'Search Page'];
const SEARCH_ROTATIONAL_NAME_SUFFIX = ' - Search Rotational';
const TRENDING_ROTATIONAL_NAME_SUFFIX = ' - Trending Rotational';
const ADDED_VALUE_MIN_CPM = 0.01;
const BOUNCER_INVENTORY_EXPLORER_URL = process.env.BOUNCER_INVENTORY_EXPLORER_URL || 'https://bouncer.giphy.tech/website/inventory-explorer/';
const BOUNCER_LOOKUP_ENABLED = process.env.BOUNCER_LOOKUP_ENABLED !== '0';
const BOUNCER_PROFILE_DIR = process.env.BOUNCER_PROFILE_DIR || `${PROFILE_DIR}-bouncer`;
const BOUNCER_LOGIN_WAIT_MS = Number(process.env.BOUNCER_LOGIN_WAIT_MS || 20 * 60 * 1000);
const BOUNCER_CAMPAIGN_URL = process.env.BOUNCER_CAMPAIGN_URL || '';
const BOUNCER_LINE_ITEM_ENRICHMENT_ENABLED = process.env.BOUNCER_LINE_ITEM_ENRICHMENT_ENABLED !== '0';

const ADOPS_PRODUCT_RULES = {
  search: {
    defaultCampaignType: 'search',
    requiresSearchQuery: true,
    forceTrendingKeywords: false,
    requiresPosition: true,
    defaultAdTypes: DEFAULT_AD_TYPES,
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  'search rotational': {
    defaultCampaignType: 'search',
    requiresSearchQuery: true,
    forceTrendingKeywords: false,
    requiresPosition: true,
    defaultAdTypes: DEFAULT_AD_TYPES,
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  trending: {
    defaultCampaignType: 'trending',
    requiresSearchQuery: true,
    forceTrendingKeywords: true,
    requiresPosition: true,
    defaultAdTypes: DEFAULT_AD_TYPES,
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  'trending rotational': {
    defaultCampaignType: 'trending',
    requiresSearchQuery: true,
    forceTrendingKeywords: true,
    requiresPosition: true,
    defaultAdTypes: DEFAULT_AD_TYPES,
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  'rotational video unit': {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Video'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  video: {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Video'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  carousel: {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Carousel'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  'sticker takeover': {
    defaultCampaignType: 'trending',
    requiresSearchQuery: true,
    forceTrendingKeywords: true,
    requiresPosition: true,
    forceAdTypes: ['API: Sticker'],
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  'trending takeover': {
    defaultCampaignType: 'trending',
    requiresSearchQuery: true,
    forceTrendingKeywords: true,
    requiresPosition: true,
    forceAdTypes: ['API: GIF'],
    defaultAdContexts: DEFAULT_AD_CONTEXTS,
    defaultOnOViewTypes: []
  },
  'xl banners': {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Banner'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  'xl banner': {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Banner'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  banner: {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Banner'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  banners: {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: false,
    forceAdTypes: ['Banner'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  'link out gif': {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: true,
    forceAdTypes: ['Clickable'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  },
  clickable: {
    defaultCampaignType: 'banner',
    requiresSearchQuery: false,
    forceTrendingKeywords: false,
    requiresPosition: true,
    forceAdTypes: ['Clickable'],
    defaultAdContexts: DEFAULT_APP_SURFACE_AD_CONTEXTS,
    defaultOnOViewTypes: DEFAULT_ONO_VIEW_TYPES
  }
};

const DEFAULT_AD_GROUPS = [
  {
    name: 'one of those things',
    gifUrl: 'https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-1iHDjCqdmDJOqZFYAX',
    keywords: ['city', 'street', 'night', 'drama', 'crew', 'boss', 'hustle', 'loyalty', 'conflict', 'grit', 'downtown', 'pressure', 'plan', 'squad', 'chase', 'intense', 'mood', 'deal', 'power', 'watch']
  },
  {
    name: "who's in charge?",
    gifUrl: 'https://giphy.com/gifs/amc-tv-amc-whos-in-charge-the-city-is-ours-qHe3kPRC3GeRZUIA5M',
    keywords: ['leader', 'captain', 'control', 'decision', 'authority', 'strategy', 'command', 'teamwork', 'debate', 'question', 'focus', 'meeting', 'responsibility', 'direction', 'vote', 'manager', 'priority', 'agenda', 'execute', 'resolve']
  },
  {
    name: 'sus',
    gifUrl: 'https://giphy.com/gifs/amc-tv-sus-amc-the-city-is-ours-6ZxKFYxtMFkkjTvQ0c',
    keywords: ['suspicious', 'sideeye', 'doubt', 'uncertain', 'mystery', 'secret', 'investigate', 'clue', 'alibi', 'caught', 'awkward', 'nervous', 'hmmm', 'plot', 'truth', 'lie', 'exposed', 'tense', 'twist', 'reaction']
  },
  {
    name: 'so proud',
    gifUrl: 'https://giphy.com/gifs/amc-tv-amc-sean-bean-the-city-is-ours-lhKDuY8bhcPRwKsL7M',
    keywords: ['proud', 'win', 'achievement', 'success', 'celebrate', 'victory', 'congrats', 'support', 'respect', 'applause', 'milestone', 'accomplished', 'champion', 'inspire', 'joy', 'smile', 'highfive', 'recognition', 'moment', 'amazing']
  },
  {
    name: 'oh shit',
    gifUrl: 'https://giphy.com/gifs/amc-tv-amc-the-city-is-ours-d6OvvJSLKz7vhtX8t5',
    keywords: ['shock', 'surprised', 'omg', 'no_way', 'panic', 'wild', 'unexpected', 'chaos', 'intense', 'reaction', 'yikes', 'gasp', 'uh_oh', 'stunned', 'sudden', 'breakdown', 'rush', 'alarm', 'dramatic', 'what_happened']
  }
];
let AD_GROUPS = DEFAULT_AD_GROUPS.map((g) => ({
  ...g,
  campaignType: DEFAULT_CAMPAIGN_TYPE,
  countries: Array.isArray(g.countries) && g.countries.length ? g.countries : DEFAULT_COUNTRIES,
  adTypes: Array.isArray(g.adTypes) && g.adTypes.length ? g.adTypes : DEFAULT_AD_TYPES,
  positions: Array.isArray(g.positions) && g.positions.length ? g.positions : DEFAULT_POSITIONS,
  adContexts: Array.isArray(g.adContexts) && g.adContexts.length ? g.adContexts : DEFAULT_AD_CONTEXTS,
  onoViewTypes: Array.isArray(g.onoViewTypes) && g.onoViewTypes.length ? g.onoViewTypes : [],
  reservedImpressions: RESERVED_IMPS_PER_GROUP,
  cpm: CPM_PER_GROUP
}));

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toNonNegativeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toPositiveInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeCampaignType(value, fallback = DEFAULT_CAMPAIGN_TYPE) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  const productRule = getAdOpsProductRule(raw);
  if (productRule?.defaultCampaignType) return productRule.defaultCampaignType;
  if (raw === 'search') return 'search';
  if (raw === 'trending') return 'trending';
  if (raw === 'banner' || raw === 'banners') return 'banner';
  return fallback;
}

function normalizeAdOpsRuleKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAdOpsProductRule(value) {
  const key = normalizeAdOpsRuleKey(value);
  if (!key) return null;
  const candidates = new Set([key]);

  const maybeAdd = (variant) => {
    const normalized = normalizeAdOpsRuleKey(variant);
    if (normalized) candidates.add(normalized);
  };

  if (key.startsWith('av ')) maybeAdd(key.slice(3));
  if (key.startsWith('added value ')) maybeAdd(key.slice('added value '.length));

  // Common spreadsheet pluralization variants.
  for (const candidate of Array.from(candidates)) {
    maybeAdd(candidate.replace(/\bgifs\b/g, 'gif'));
    maybeAdd(candidate.replace(/\bbanners\b/g, 'banner'));
  }

  for (const candidate of candidates) {
    if (ADOPS_PRODUCT_RULES[candidate]) return ADOPS_PRODUCT_RULES[candidate];
  }
  return null;
}

function resolveAdGroupShapeDefaults({ adOpsSpreadsheetName = '', campaignType = DEFAULT_CAMPAIGN_TYPE } = {}) {
  const rule = getAdOpsProductRule(adOpsSpreadsheetName) || getAdOpsProductRule(campaignType);
  const defaultCampaignType = normalizeCampaignType(
    rule?.defaultCampaignType || campaignType,
    DEFAULT_CAMPAIGN_TYPE
  );
  const requiresSearchQuery = rule?.requiresSearchQuery != null
    ? Boolean(rule.requiresSearchQuery)
    : defaultCampaignType !== 'banner';
  const forceTrendingKeywords = rule?.forceTrendingKeywords != null
    ? Boolean(rule.forceTrendingKeywords)
    : defaultCampaignType === 'trending';
  const requiresPosition = rule?.requiresPosition != null
    ? Boolean(rule.requiresPosition)
    : defaultCampaignType !== 'banner';
  const defaultAdTypes = Array.isArray(rule?.defaultAdTypes) && rule.defaultAdTypes.length > 0
    ? [...rule.defaultAdTypes]
    : [...DEFAULT_AD_TYPES];
  const forceAdTypes = Array.isArray(rule?.forceAdTypes) && rule.forceAdTypes.length > 0
    ? [...rule.forceAdTypes]
    : [];
  const defaultAdContexts = Array.isArray(rule?.defaultAdContexts) && rule.defaultAdContexts.length > 0
    ? [...rule.defaultAdContexts]
    : [...DEFAULT_AD_CONTEXTS];
  const defaultOnOViewTypes = Array.isArray(rule?.defaultOnOViewTypes) && rule.defaultOnOViewTypes.length > 0
    ? [...rule.defaultOnOViewTypes]
    : [];

  return {
    rule,
    defaultCampaignType,
    requiresSearchQuery,
    forceTrendingKeywords,
    requiresPosition,
    defaultAdTypes,
    forceAdTypes,
    defaultAdContexts,
    defaultOnOViewTypes
  };
}

function normalizeImpressionAllocationMode(value, fallback = 'keyword_inventory_proportional_by_campaign_type') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'even') return 'legacy_even';
  if (
    raw === 'keyword_inventory_proportional_by_campaign_type'
    || raw === 'keyword-inventory-proportional-by-campaign-type'
    || raw === 'proportional_by_campaign_type'
    || raw === 'proportional-by-campaign-type'
    || raw === 'by_campaign_type'
    || raw === 'by-campaign-type'
  ) {
    return 'keyword_inventory_proportional_by_campaign_type';
  }
  if (
    raw === 'keyword_inventory_proportional'
    || raw === 'keyword-inventory-proportional'
    || raw === 'inventory_proportional'
    || raw === 'inventory-proportional'
    || raw === 'keyword_inventory'
    || raw === 'keyword-inventory'
    || raw === 'proportional'
  ) {
    return 'legacy_keyword_inventory_proportional';
  }
  return fallback;
}

function normalizeCampaignTypeGoalKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('trend')) return 'trending';
  if (raw.includes('search')) return 'search';
  if (raw.includes('banner')) return 'banner';
  if (raw === 'trending') return 'trending';
  if (raw === 'search') return 'search';
  if (raw === 'banner' || raw === 'banners') return 'banner';
  return raw;
}

function parseImpressionGoalsByCampaignType(rawValue) {
  const out = {};
  if (!rawValue) return out;

  const addGoal = (keyRaw, goalRaw) => {
    const key = normalizeCampaignTypeGoalKey(keyRaw);
    const goal = toPositiveInt(goalRaw, 0);
    if (!key || goal <= 0) return;
    out[key] = (out[key] || 0) + goal;
  };

  if (Array.isArray(rawValue)) {
    for (const row of rawValue) {
      if (!row || typeof row !== 'object') continue;
      addGoal(
        row.campaign_type ?? row.campaignType ?? row.type ?? row.key,
        row.impression_goal ?? row.impressionGoal ?? row.goal ?? row.total_impressions ?? row.totalImpressions
      );
    }
    return out;
  }

  if (typeof rawValue === 'object') {
    for (const [key, goal] of Object.entries(rawValue)) {
      addGoal(key, goal);
    }
  }
  return out;
}

function isAddedValuePrefixed(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return /^av(?:[\s:_-]|$)/.test(normalized);
}

function isAddedValueGroup({ name = '', productType = '', adTypeValues = [] } = {}) {
  if (isAddedValuePrefixed(name)) return true;
  if (isAddedValuePrefixed(productType)) return true;
  if (Array.isArray(adTypeValues) && adTypeValues.some((v) => isAddedValuePrefixed(v))) return true;
  return false;
}

function parseKeywordTerm(rawValue) {
  if (typeof rawValue === 'string') {
    const term = rawValue.trim();
    return term || '';
  }
  if (!rawValue || typeof rawValue !== 'object') return '';

  const candidates = [
    rawValue.term,
    rawValue.keyword,
    rawValue.search_term,
    rawValue.searchTerm,
    rawValue.name,
    rawValue.value
  ];
  for (const candidate of candidates) {
    const term = String(candidate ?? '').trim();
    if (term) return term;
  }
  return '';
}

function parseKeywordInventoryValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'string' && rawValue.trim() === '') return null;
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function collectKeywordInventoryRows(rawValue) {
  const rows = [];
  if (!rawValue) return rows;

  const maybePush = (termRaw, invRaw) => {
    const term = parseKeywordTerm(termRaw);
    const availableInventory = parseKeywordInventoryValue(invRaw);
    if (!term || availableInventory === null) return;
    rows.push({ term, availableInventory });
  };

  if (Array.isArray(rawValue)) {
    for (const entry of rawValue) {
      if (!entry) continue;
      if (typeof entry === 'object' && !Array.isArray(entry)) {
        const term = parseKeywordTerm(entry);
        const inventoryCandidate = entry.available_inventory
          ?? entry.availableInventory
          ?? entry.avail_inventory
          ?? entry.availInventory
          ?? entry.inventory;
        maybePush(term, inventoryCandidate);
        continue;
      }
      maybePush(entry, null);
    }
    return rows;
  }

  if (typeof rawValue === 'object') {
    for (const [term, inventory] of Object.entries(rawValue)) {
      maybePush(term, inventory);
    }
  }
  return rows;
}

function mergeKeywordInventoryRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const merged = [];
  const seenByNormalizedTerm = new Map();
  for (const row of rows) {
    const term = parseKeywordTerm(row?.term);
    const availableInventory = parseKeywordInventoryValue(row?.availableInventory);
    if (!term || availableInventory === null) continue;
    const key = normalizeUiText(term);
    const existingIndex = seenByNormalizedTerm.get(key);
    if (existingIndex === undefined) {
      seenByNormalizedTerm.set(key, merged.length);
      merged.push({ term, availableInventory });
      continue;
    }
    merged[existingIndex].availableInventory += availableInventory;
  }
  return merged;
}

function distributeImpressionsByKeywordInventory(totalImpressions, groups) {
  if (!Number.isFinite(totalImpressions) || totalImpressions <= 0) {
    return { groupSplits: [], keywordRows: [], totalInventory: 0 };
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    return { groupSplits: [], keywordRows: [], totalInventory: 0 };
  }

  const keywordRows = [];
  const missingInventoryGroups = [];
  groups.forEach((group, groupIndex) => {
    const rows = Array.isArray(group?.keywordInventoryRows) ? group.keywordInventoryRows : [];
    if (rows.length === 0) {
      missingInventoryGroups.push(String(group?.name || `Ad Group ${groupIndex + 1}`));
      return;
    }
    rows.forEach((row) => {
      const availableInventory = parseKeywordInventoryValue(row?.availableInventory);
      if (availableInventory === null || availableInventory <= 0) return;
      keywordRows.push({
        groupIndex,
        groupName: String(group?.name || `Ad Group ${groupIndex + 1}`),
        term: String(row?.term || '').trim(),
        availableInventory
      });
    });
  });

  if (keywordRows.length === 0) {
    const details = missingInventoryGroups.length > 0
      ? ` Missing inventory for: ${missingInventoryGroups.join(', ')}.`
      : '';
    throw new Error(
      `impression_allocation_mode=keyword_inventory_proportional requires keyword inventory on ad_groups.`
      + ` Provide keywords as objects with available_inventory (or keyword_inventory maps).${details}`
    );
  }
  if (missingInventoryGroups.length > 0) {
    throw new Error(
      `impression_allocation_mode=keyword_inventory_proportional requires inventory for every ad group. `
      + `Missing inventory for: ${missingInventoryGroups.join(', ')}`
    );
  }

  const total = Math.floor(totalImpressions);
  const totalInventory = keywordRows.reduce((sum, row) => sum + row.availableInventory, 0);
  if (!Number.isFinite(totalInventory) || totalInventory <= 0) {
    throw new Error('keyword inventory totals must be > 0 when using impression_allocation_mode=keyword_inventory_proportional');
  }

  const provisional = keywordRows.map((row, idx) => {
    const exact = (total * row.availableInventory) / totalInventory;
    const rounded = Math.round(exact);
    return { idx, exact, allocated: rounded };
  });

  const provisionalTotal = provisional.reduce((sum, row) => sum + row.allocated, 0);
  let diff = total - provisionalTotal;
  if (diff !== 0) {
    const sorted = [...provisional].sort((a, b) => {
      const aDown = a.exact - a.allocated;
      const bDown = b.exact - b.allocated;
      const aUp = a.allocated - a.exact;
      const bUp = b.allocated - b.exact;
      if (diff > 0) {
        if (bDown !== aDown) return bDown - aDown;
      } else if (bUp !== aUp) {
        return bUp - aUp;
      }
      if (keywordRows[b.idx].availableInventory !== keywordRows[a.idx].availableInventory) {
        return keywordRows[b.idx].availableInventory - keywordRows[a.idx].availableInventory;
      }
      return a.idx - b.idx;
    });

    let cursor = 0;
    let safety = Math.abs(diff) * 5 + sorted.length + 5;
    while (diff !== 0 && sorted.length > 0 && safety > 0) {
      const candidate = sorted[cursor % sorted.length];
      if (diff > 0) {
        candidate.allocated += 1;
        diff -= 1;
      } else if (candidate.allocated > 0) {
        candidate.allocated -= 1;
        diff += 1;
      }
      cursor += 1;
      safety -= 1;
      if (cursor % sorted.length === 0 && diff < 0) {
        // Re-order after a full pass while reducing in case some rows reached zero.
        sorted.sort((a, b) => {
          const aUp = a.allocated - a.exact;
          const bUp = b.allocated - b.exact;
          if (bUp !== aUp) return bUp - aUp;
          if (keywordRows[b.idx].availableInventory !== keywordRows[a.idx].availableInventory) {
            return keywordRows[b.idx].availableInventory - keywordRows[a.idx].availableInventory;
          }
          return a.idx - b.idx;
        });
      }
    }
    if (diff !== 0) {
      throw new Error('Could not reconcile keyword inventory allocation to the requested total_impressions');
    }
  }

  provisional.sort((a, b) => a.idx - b.idx);
  const groupSplits = Array.from({ length: groups.length }, () => 0);
  provisional.forEach((row) => {
    const keyword = keywordRows[row.idx];
    groupSplits[keyword.groupIndex] += row.allocated;
    keyword.allocatedImpressions = row.allocated;
  });

  const finalTotal = groupSplits.reduce((sum, n) => sum + n, 0);
  if (finalTotal !== total) {
    throw new Error(`Keyword inventory allocation mismatch: expected ${total}, got ${finalTotal}`);
  }

  return { groupSplits, keywordRows, totalInventory };
}

function allocateImpressionsByCampaignTypeGoals(groups, goalsByType = {}, mode = 'keyword_inventory_proportional') {
  if (!Array.isArray(groups) || groups.length === 0) {
    return { splits: [], summaries: [], assignedGroupCount: 0, totalGoals: 0 };
  }
  const goals = Object.entries(goalsByType || {}).filter(([, goal]) => toPositiveInt(goal, 0) > 0);
  if (goals.length === 0) {
    return { splits: Array.from({ length: groups.length }, () => null), summaries: [], assignedGroupCount: 0, totalGoals: 0 };
  }

  const splits = Array.from({ length: groups.length }, () => null);
  const summaries = [];
  let totalGoals = 0;
  let assignedGroupCount = 0;
  const seenGroupIndices = new Set();

  for (const [goalKey, goalRaw] of goals) {
    const goal = toPositiveInt(goalRaw, 0);
    if (goal <= 0) continue;
    const key = normalizeCampaignTypeGoalKey(goalKey);
    const matching = groups
      .map((group, idx) => ({ group, idx }))
      .filter(({ group }) => normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE) === key);

    if (matching.length === 0) {
      throw new Error(`impression_goals_by_campaign_type includes "${goalKey}" but no ad_groups matched campaign_type "${key}"`);
    }

    const allocationStrategy = (mode === 'even' || key === 'trending')
      ? 'even'
      : 'keyword_inventory_proportional';
    let localSplits = [];
    let totalInventory = 0;
    if (allocationStrategy === 'even') {
      localSplits = distributeImpressionsEvenly(goal, matching.length);
    } else {
      const proportional = distributeImpressionsByKeywordInventory(goal, matching.map((x) => x.group));
      localSplits = proportional.groupSplits;
      totalInventory = proportional.totalInventory;
    }
    if (localSplits.some((n) => n <= 0)) {
      throw new Error(
        `impression goal (${goal}) for campaign_type="${key}" is too small for ${matching.length} matching ad groups; `
        + 'each group must receive at least 1 impression.'
      );
    }

    matching.forEach((entry, localIdx) => {
      splits[entry.idx] = localSplits[localIdx];
      if (!seenGroupIndices.has(entry.idx)) {
        seenGroupIndices.add(entry.idx);
        assignedGroupCount += 1;
      }
    });
    totalGoals += goal;
    summaries.push({
      key,
      goal,
      groupCount: matching.length,
      totalInventory,
      splits: localSplits,
      strategy: allocationStrategy
    });
  }

  return { splits, summaries, assignedGroupCount, totalGoals };
}

function distributeImpressionsEvenly(totalImpressions, groupCount) {
  if (!Number.isFinite(totalImpressions) || totalImpressions <= 0 || groupCount <= 0) return [];
  const total = Math.floor(totalImpressions);
  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  return Array.from({ length: groupCount }, (_, idx) => base + (idx < remainder ? 1 : 0));
}

function normalizeDate(inputDate, fallback) {
  if (!inputDate || typeof inputDate !== 'string') return fallback;
  const trimmed = inputDate.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) return `${ymd[2]}/${ymd[3]}/${ymd[1]}`;
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (mdy) return `${mdy[1].padStart(2, '0')}/${mdy[2].padStart(2, '0')}/${mdy[3]}`;
  return fallback;
}

function deriveCreativeIdFromUrl(urlValue, fallback = '') {
  const raw = String(urlValue || '').trim();
  if (!raw) return String(fallback || '').trim();

  let lastSegment = '';
  try {
    const parsed = new URL(raw);
    const segments = parsed.pathname.split('/').filter(Boolean);
    lastSegment = segments[segments.length - 1] || '';
  } catch {
    const withoutQuery = raw.split(/[?#]/)[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    lastSegment = segments[segments.length - 1] || '';
  }

  lastSegment = decodeURIComponent(String(lastSegment || '')).trim();
  if (!lastSegment) return String(fallback || '').trim();

  const parts = lastSegment.split('-').filter(Boolean);
  const token = parts.length > 0 ? parts[parts.length - 1] : lastSegment;
  return String(token || fallback || '').trim();
}

function extractBouncerCampaignUrlFromCampaign(parsed = {}, reservation = {}) {
  const fromReservation = [
    reservation?.bouncer_campaign_url,
    reservation?.bouncerCampaignUrl
  ].find((x) => String(x || '').trim());
  if (fromReservation) return String(fromReservation).trim();

  const fromParsed = [
    parsed?.bouncer_campaign_url,
    parsed?.bouncerCampaignUrl
  ].find((x) => String(x || '').trim());
  if (fromParsed) return String(fromParsed).trim();

  if (String(BOUNCER_CAMPAIGN_URL || '').trim()) return String(BOUNCER_CAMPAIGN_URL).trim();
  return '';
}

function normalizeBouncerGifId(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function parseLooseNumber(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').replace(/[^0-9.+-]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseUsDatePartsLoose(value) {
  const raw = String(value || '').trim();
  const mdy4 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mdy4) {
    return { month: Number(mdy4[1]), day: Number(mdy4[2]), year: Number(mdy4[3]) };
  }
  const mdy2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(raw);
  if (mdy2) {
    const yy = Number(mdy2[3]);
    const yyyy = yy <= 69 ? 2000 + yy : 1900 + yy;
    return { month: Number(mdy2[1]), day: Number(mdy2[2]), year: yyyy };
  }
  return null;
}

function normalizeUsDateLoose(value) {
  const parts = parseUsDatePartsLoose(value);
  if (!parts) return '';
  return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${String(parts.year)}`;
}

function computeBouncerLineItemMetadata(rawMeta = {}) {
  const startDate = normalizeUsDateLoose(rawMeta.startDateRaw || '');
  const endDate = normalizeUsDateLoose(rawMeta.endDateRaw || '');

  const delivered = parseLooseNumber(rawMeta.impressionsDeliveredRaw);
  const remaining = parseLooseNumber(rawMeta.impressionsRemainingRaw);
  const totalImpressions = (
    Number.isFinite(delivered) && Number.isFinite(remaining)
      ? Math.floor(delivered + remaining)
      : (Number.isFinite(remaining) ? Math.floor(remaining) : (Number.isFinite(delivered) ? Math.floor(delivered) : null))
  );

  const spent = parseLooseNumber(rawMeta.spentRaw);
  const spendRemaining = parseLooseNumber(rawMeta.spendRemainingRaw);
  const totalBudget = (
    Number.isFinite(spent) && Number.isFinite(spendRemaining)
      ? spent + spendRemaining
      : (Number.isFinite(spendRemaining) ? spendRemaining : (Number.isFinite(spent) ? spent : null))
  );

  const cpmDirect = parseLooseNumber(rawMeta.cpmRaw);
  const cpmDerived = (
    Number.isFinite(totalBudget) && Number.isFinite(totalImpressions) && totalImpressions > 0
      ? (totalBudget * 1000) / totalImpressions
      : null
  );
  const cpm = Number.isFinite(cpmDirect) ? cpmDirect : (Number.isFinite(cpmDerived) ? cpmDerived : null);

  return {
    startDate,
    endDate,
    totalImpressions: Number.isFinite(totalImpressions) && totalImpressions > 0 ? totalImpressions : null,
    cpm: Number.isFinite(cpm) && cpm >= 0 ? Math.round(cpm * 100) / 100 : null
  };
}

async function ensureBouncerCampaignLoggedIn(page) {
  if (/\/website\/campaigns\//i.test(page.url())) return;
  console.log('Bouncer campaign login required. Waiting for campaign page after login...');
  await page.waitForURL(/\/website\/campaigns\//i, { timeout: BOUNCER_LOGIN_WAIT_MS });
}

async function waitForBouncerLineItemCreativeCards(page, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hasCards = await page.evaluate(() => /GIF ID:/i.test(String(document.body?.innerText || ''))).catch(() => false);
    if (hasCards) return true;
    await page.waitForTimeout(300).catch(() => null);
  }
  return false;
}

function toBouncerViewOnlyUrl(urlValue) {
  const raw = String(urlValue || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.pathname = parsed.pathname.replace(/\/edit\/?$/i, '/');
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return raw.replace(/\/edit\/?$/i, '/');
  }
}

function isBouncerLineItemUrl(urlValue) {
  return /\/line_items\/\d+(?:\/|$)/i.test(String(urlValue || ''));
}

function scoreBouncerLineItemText(text, campaignType = '') {
  const normalized = normalizeUiText(text);
  const type = normalizeCampaignType(campaignType, DEFAULT_CAMPAIGN_TYPE);
  if (!normalized) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (type === 'search') {
    if (/\bsearch rotational\b/.test(normalized)) score += 100;
    if (/\bsearch\b/.test(normalized)) score += 40;
    if (/\btrending\b/.test(normalized)) score -= 30;
    if (/\btakeover\b/.test(normalized)) score -= 20;
  } else if (type === 'trending') {
    if (/\btrending rotational\b/.test(normalized)) score += 120;
    if (/\btrending\b/.test(normalized)) score += 40;
    if (/\btakeover\b/.test(normalized)) score -= 120;
    if (/\bsticker\b/.test(normalized)) score -= 80;
    if (/\bsearch\b/.test(normalized)) score -= 40;
  } else {
    if (/\brotational\b/.test(normalized)) score += 10;
  }

  return score;
}

async function resolveBouncerLineItemUrlsByType(page, campaignUrl, campaignTypes = []) {
  const rootUrl = toBouncerViewOnlyUrl(campaignUrl);
  if (!rootUrl) return {};

  await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ensureBouncerCampaignLoggedIn(page);
  if (normalizeUiText(page.url()) !== normalizeUiText(rootUrl)) {
    await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForTimeout(600).catch(() => null);
  await page.waitForFunction(
    () => /line item/i.test(String(document.body?.innerText || '')),
    { timeout: 6000 }
  ).catch(() => null);

  const waitForLineItemLabel = async (pattern, timeoutMs = 8000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const hasLabel = await page.getByText(pattern).first().isVisible().catch(() => false);
      if (hasLabel) return true;
      await page.waitForTimeout(180).catch(() => null);
    }
    return false;
  };

  const resolved = {};
  const preferredLabelByType = {
    search: /search rotational/i,
    trending: /trending rotational/i
  };

  for (const campaignType of campaignTypes) {
    const labelPattern = preferredLabelByType[campaignType];
    if (!labelPattern) continue;

    if (normalizeUiText(page.url()) !== normalizeUiText(rootUrl)) {
      await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
    }
    await waitForLineItemLabel(labelPattern, 9000).catch(() => null);

    let clicked = false;
    const clickLocators = [
      page.locator('a[href*="/line_items/"]').filter({ hasText: labelPattern }).first(),
      page.getByText(labelPattern).first(),
      page.locator('tr, [role="row"], li, article, section, div').filter({ hasText: labelPattern }).first()
    ];
    for (const locator of clickLocators) {
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;
      const didClick = await locator.click({ force: true, timeout: 1800 }).then(() => true).catch(() => false);
      if (!didClick) continue;
      const movedToLineItem = await page.waitForURL(/\/line_items\/\d+/i, { timeout: 2500 }).then(() => true).catch(() => false);
      if (movedToLineItem) {
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      const needle = String(labelPattern.source || '').replace(/\\s\+/g, ' ').trim().toLowerCase();
      clicked = await page.evaluate((needleText) => {
        const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const looksClickable = (el) => {
          if (!el) return false;
          if (el.tagName === 'A' || el.tagName === 'BUTTON') return true;
          const role = String(el.getAttribute?.('role') || '').toLowerCase();
          if (role === 'row' || role === 'button' || role === 'link') return true;
          const onclick = String(el.getAttribute?.('onclick') || '').trim();
          if (onclick) return true;
          const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
          return Boolean(style && style.cursor === 'pointer');
        };

        const nodes = Array.from(document.querySelectorAll('*'));
        const matches = nodes
          .map((el) => ({ el, text: normalize(el.textContent || '') }))
          .filter((x) => x.text && x.text.includes(needleText))
          .sort((a, b) => b.text.length - a.text.length);
        if (matches.length === 0) return false;

        const target = matches[0].el;
        const chain = [];
        let cursor = target;
        for (let i = 0; i < 10 && cursor; i += 1) {
          chain.push(cursor);
          cursor = cursor.parentElement;
        }

        for (const candidate of chain) {
          if (!looksClickable(candidate)) continue;
          try {
            candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            candidate.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            if (typeof candidate.click === 'function') candidate.click();
            return true;
          } catch {
            // continue up the chain
          }
        }
        return false;
      }, needle).catch(() => false);
      if (clicked) {
        const movedToLineItem = await page.waitForURL(/\/line_items\/\d+/i, { timeout: 3000 }).then(() => true).catch(() => false);
        clicked = movedToLineItem;
      }
    }

    if (clicked) {
      const maybeLineItemUrl = toBouncerViewOnlyUrl(page.url());
      if (isBouncerLineItemUrl(maybeLineItemUrl)) {
        resolved[campaignType] = maybeLineItemUrl;
      }
    }
  }

  const unresolvedTypes = campaignTypes.filter((type) => !resolved[type]);
  if (unresolvedTypes.length === 0) return resolved;

  const links = await page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const anchors = Array.from(document.querySelectorAll('a[href*="/line_items/"]'));
    return anchors.map((anchor) => {
      const href = anchor.getAttribute('href') || '';
      let node = anchor;
      for (let i = 0; i < 6 && node?.parentElement; i += 1) {
        const txt = normalize(node.textContent || '');
        if (txt.length >= 8) break;
        node = node.parentElement;
      }
      const contextNode = node?.closest?.('tr, [role="row"], li, article, section') || node || anchor;
      const text = normalize(contextNode?.textContent || anchor.textContent || '');
      return { href, text };
    });
  }).catch(() => []);

  const candidates = links
    .map((entry) => {
      const abs = (() => {
        try {
          return new URL(entry.href, rootUrl).toString();
        } catch {
          return '';
        }
      })();
      return {
        url: toBouncerViewOnlyUrl(abs),
        text: String(entry.text || '')
      };
    })
    .filter((entry) => isBouncerLineItemUrl(entry.url));

  const uniqueByUrl = new Map();
  for (const candidate of candidates) {
    if (!uniqueByUrl.has(candidate.url)) {
      uniqueByUrl.set(candidate.url, candidate);
    }
  }
  const deduped = Array.from(uniqueByUrl.values());

  for (const type of unresolvedTypes) {
    const scored = deduped
      .map((entry) => ({ ...entry, score: scoreBouncerLineItemText(entry.text, type) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score || a.text.length - b.text.length);
    const best = scored.find((entry) => entry.score > 0) || null;
    if (best) {
      resolved[type] = best.url;
      continue;
    }
    if (deduped.length === 1) {
      resolved[type] = deduped[0].url;
    }
  }

  return resolved;
}

async function scrapeBouncerLineItemCreativesAndMetadata(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeTerm = (value) => normalize(String(value || '').toLowerCase());
    const normalizeId = (value) => normalize(value).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const dedupe = (values) => {
      const out = [];
      const seen = new Set();
      for (const raw of values) {
        const v = normalizeTerm(raw);
        if (!v || seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
      return out;
    };

    const bodyText = normalize(document.body?.innerText || '');
    const dateRangeMatch = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    const nodes = Array.from(document.querySelectorAll('span, div, p, td, th'));
    const looksLikeValue = (text) => /(^\$?\s*[0-9][0-9,]*(\.[0-9]+)?$)|(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(text);
    const findLabelValue = (exactLabel) => {
      const target = normalizeTerm(exactLabel);
      for (const node of nodes) {
        const labelText = normalizeTerm(node.textContent || '');
        if (labelText !== target) continue;
        const parent = node.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children || []);
          const idx = siblings.indexOf(node);
          for (let j = idx - 1; j >= 0; j -= 1) {
            const candidate = normalize(siblings[j].textContent || '');
            if (candidate && looksLikeValue(candidate)) return candidate;
          }
          const first = normalize(parent.firstElementChild?.textContent || '');
          if (first && looksLikeValue(first)) return first;
        }
      }
      return '';
    };
    const findInputValueNearLabel = (exactLabel) => {
      const target = normalizeTerm(exactLabel);
      const labels = Array.from(document.querySelectorAll('label, span, div, p, th, td'))
        .filter((el) => normalizeTerm(el.textContent || '') === target);
      for (const label of labels) {
        let cursor = label;
        for (let depth = 0; depth < 6 && cursor; depth += 1) {
          const root = cursor.parentElement || cursor;
          const input = root.querySelector?.('input, textarea');
          if (input) {
            const value = normalize(input.value || input.getAttribute('value') || input.textContent || '');
            if (value) return value;
          }
          const combo = root.querySelector?.('[role="combobox"]');
          if (combo) {
            const value = normalize(combo.textContent || combo.getAttribute('value') || '');
            if (value) return value;
          }
          cursor = cursor.parentElement;
        }
      }
      return '';
    };
    const findGreenValueNearLabel = (exactLabel) => {
      const target = normalizeTerm(exactLabel);
      const labels = Array.from(document.querySelectorAll('label, span, div, p, th, td'))
        .filter((el) => normalizeTerm(el.textContent || '') === target);
      for (const label of labels) {
        let cursor = label;
        for (let depth = 0; depth < 6 && cursor; depth += 1) {
          const root = cursor.parentElement || cursor;
          const green = Array.from(root.querySelectorAll?.('span, div, p') || [])
            .map((el) => normalize(el.textContent || ''))
            .find((text) => /^\$?\s*[0-9][0-9,]*(\.[0-9]+)?$/.test(text));
          if (green) return green;
          cursor = cursor.parentElement;
        }
      }
      return '';
    };

    const findCardRoot = (idNode) => {
      let node = idNode;
      for (let i = 0; i < 10 && node; i += 1) {
        const text = String(node.textContent || '');
        const idHits = (text.match(/GIF ID:/gi) || []).length;
        const hasImage = !!node.querySelector?.('img');
        if (idHits === 1 && hasImage) return node;
        node = node.parentElement;
      }
      return idNode.parentElement || idNode;
    };

    let idValueSpans = Array.from(document.querySelectorAll('span.font-normal.text-giphyWhite'))
      .filter((el) => /GIF ID:/i.test(String(el.parentElement?.textContent || '')));
    if (idValueSpans.length === 0) {
      idValueSpans = Array.from(document.querySelectorAll('span'))
        .filter((el) => /GIF ID:/i.test(String(el.textContent || '')))
        .map((el) => el.querySelector('span') || el);
    }

    const seenIds = new Set();
    const creatives = [];
    for (const idValue of idValueSpans) {
      const rawId = normalize(idValue.textContent || '');
      const normalizedId = normalizeId(rawId);
      if (!normalizedId || seenIds.has(normalizedId)) continue;
      seenIds.add(normalizedId);

      const card = findCardRoot(idValue.parentElement || idValue);
      const termNodes = Array.from(card.querySelectorAll('div.rounded.bg-giphyDarkGrey'));
      const terms = dedupe(termNodes.map((el) => el.textContent || ''));
      creatives.push({ gifId: rawId, normalizedGifId: normalizedId, terms });
    }

    return {
      creatives,
      metadata: {
        startDateRaw: dateRangeMatch?.[1] || '',
        endDateRaw: dateRangeMatch?.[2] || '',
        impressionsDeliveredRaw: findLabelValue('Impressions Delivered'),
        impressionsRemainingRaw: findLabelValue('Impressions Remaining'),
        spentRaw: findLabelValue('Spent'),
        spendRemainingRaw: findLabelValue('Spend Remaining'),
        cpmRaw: findGreenValueNearLabel('CPM') || findLabelValue('CPM') || findInputValueNearLabel('CPM')
      }
    };
  });
}

async function enrichFromBouncerLineItem(groups, lineItemUrl, options = {}) {
  if (!BOUNCER_LINE_ITEM_ENRICHMENT_ENABLED) return { groups, metadata: null, enrichedGroups: 0 };
  if (!lineItemUrl || !Array.isArray(groups) || groups.length === 0) return { groups, metadata: null, enrichedGroups: 0 };

  let context = options?.bouncerSession?.context || null;
  let page = options?.bouncerSession?.page || null;
  let ownsSession = false;
  if (!context || !page || page.isClosed()) {
    const launched = await launchBouncerWindowAtStart();
    context = launched.context;
    page = launched.page;
    ownsSession = true;
  }

  try {
    await page.goto(lineItemUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureBouncerCampaignLoggedIn(page);
    // If login redirected to a generic campaigns page, navigate back to the exact line-item URL before scraping.
    if (normalizeUiText(page.url()) !== normalizeUiText(lineItemUrl)) {
      await page.goto(lineItemUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    const ready = await waitForBouncerLineItemCreativeCards(page, 30000);
    if (!ready) {
      throw new Error('Bouncer line-item page loaded but no creative cards (GIF ID) were detected.');
    }

    const scraped = await scrapeBouncerLineItemCreativesAndMetadata(page);
    const creatives = Array.isArray(scraped?.creatives) ? scraped.creatives : [];
    const metadata = computeBouncerLineItemMetadata(scraped?.metadata || {});
    const byGifId = new Map();
    for (const creative of creatives) {
      const key = normalizeBouncerGifId(creative?.normalizedGifId || creative?.gifId || '');
      if (!key) continue;
      byGifId.set(key, creative);
    }

    let enrichedGroups = 0;
    const outGroups = groups.map((group) => {
      const hasKeywords = Array.isArray(group?.keywords) && group.keywords.length > 0;
      const hasInventory = Array.isArray(group?.keywordInventoryRows) && group.keywordInventoryRows.length > 0;
      if (hasKeywords || hasInventory) return group;

      const key = normalizeBouncerGifId(group?.creativeId || deriveCreativeIdFromUrl(group?.gifUrl, group?.name));
      const creative = byGifId.get(key);
      if (!creative || !Array.isArray(creative.terms) || creative.terms.length === 0) return group;
      enrichedGroups += 1;
      return {
        ...group,
        keywords: dedupeStrings(creative.terms)
      };
    });

    return { groups: outGroups, metadata, enrichedGroups };
  } finally {
    if (ownsSession && !options?.keepWindowOpen) {
      await context.close().catch(() => null);
    }
  }
}

async function enrichFromBouncerCampaignSource(groups, campaignSourceUrl, options = {}) {
  if (!BOUNCER_LINE_ITEM_ENRICHMENT_ENABLED) {
    return { groups, metadataByType: {}, enrichedGroups: 0, resolvedLineItems: {} };
  }
  if (!campaignSourceUrl || !Array.isArray(groups) || groups.length === 0) {
    return { groups, metadataByType: {}, enrichedGroups: 0, resolvedLineItems: {} };
  }

  const sourceUrl = toBouncerViewOnlyUrl(campaignSourceUrl);
  const presentTypes = Array.from(new Set(
    groups
      .map((group) => normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE))
      .filter((type) => type === 'search' || type === 'trending')
  ));

  let context = options?.bouncerSession?.context || null;
  let page = options?.bouncerSession?.page || null;
  let ownsSession = false;
  if (!context || !page || page.isClosed()) {
    const launched = await launchBouncerWindowAtStart();
    context = launched.context;
    page = launched.page;
    ownsSession = true;
  }

  try {
    if (isBouncerLineItemUrl(sourceUrl)) {
      const single = await enrichFromBouncerLineItem(
        groups,
        sourceUrl,
        { bouncerSession: { context, page }, keepWindowOpen: true }
      );
      const targetType = presentTypes.length === 1 ? presentTypes[0] : 'search';
      return {
        groups: single.groups,
        metadataByType: single.metadata ? { [targetType]: single.metadata } : {},
        enrichedGroups: single.enrichedGroups,
        resolvedLineItems: { [targetType]: sourceUrl }
      };
    }

    const typesToResolve = presentTypes.length > 0 ? presentTypes : ['search'];
    const resolvedLineItems = await resolveBouncerLineItemUrlsByType(page, sourceUrl, typesToResolve);
    const metadataByType = {};
    let enrichedGroups = 0;
    const outGroups = [...groups];

    for (const campaignType of typesToResolve) {
      const lineItemUrl = resolvedLineItems[campaignType];
      if (!lineItemUrl) {
        console.warn(`Could not resolve Bouncer line item URL for campaign_type="${campaignType}" from campaign source URL.`);
        continue;
      }

      const indices = [];
      const scopedGroups = [];
      outGroups.forEach((group, index) => {
        if (normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE) !== campaignType) return;
        indices.push(index);
        scopedGroups.push(group);
      });
      if (scopedGroups.length === 0) continue;

      const scopedResult = await enrichFromBouncerLineItem(
        scopedGroups,
        lineItemUrl,
        { bouncerSession: { context, page }, keepWindowOpen: true }
      );
      if (scopedResult?.metadata) {
        metadataByType[campaignType] = scopedResult.metadata;
      }
      enrichedGroups += Number(scopedResult?.enrichedGroups || 0);
      indices.forEach((originalIndex, scopedIndex) => {
        outGroups[originalIndex] = scopedResult.groups[scopedIndex];
      });
    }

    return { groups: outGroups, metadataByType, enrichedGroups, resolvedLineItems };
  } finally {
    if (ownsSession && !options?.keepWindowOpen) {
      await context.close().catch(() => null);
    }
  }
}

function normalizeGroup(raw, fallbackImps, fallbackCpm) {
  const name = raw?.name || raw?.gif_name || raw?.creative_friendly_name || raw?.creative_id;
  const gifUrl = raw?.gifUrl || raw?.gif_url || raw?.click_url || raw?.cta_url || raw?.carousel_gif || raw?.carousel_gifs?.[0];
  if (!name || !gifUrl) return null;

  const asArray = (value) => {
    if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
    if (value == null) return [];
    const one = String(value).trim();
    return one ? [one] : [];
  };

  const clickUrl = raw?.click_url ? String(raw.click_url).trim() : '';
  const adOpsSpreadsheetName = String(
    raw?.adops_spreadsheet_name
    ?? raw?.adOpsSpreadsheetName
    ?? raw?.ad_ops_spreadsheet_name
    ?? raw?.ad_product_flight_type
    ?? raw?.adProductFlightType
    ?? raw?.spreadsheet_name
    ?? raw?.spreadsheetName
    ?? raw?.product_type
    ?? raw?.productType
    ?? ''
  ).trim();
  const normalizedKeywords = dedupeStrings(
    Array.isArray(raw?.keywords)
      ? raw.keywords.map((kw) => parseKeywordTerm(kw)).filter(Boolean)
      : []
  );
  const keywordInventoryRows = mergeKeywordInventoryRows([
    ...collectKeywordInventoryRows(raw?.keywords),
    ...collectKeywordInventoryRows(raw?.keyword_inventory),
    ...collectKeywordInventoryRows(raw?.keyword_inventories)
  ]);
  const keywordInventoryTerms = keywordInventoryRows.map((row) => row.term);
  const resolvedKeywords = normalizedKeywords.length > 0
    ? normalizedKeywords
    : dedupeStrings(keywordInventoryTerms);
  const derivedCreativeId = deriveCreativeIdFromUrl(gifUrl, String(name));
  const explicitCampaignTypeRaw = raw?.campaign_type ?? raw?.campaignType;
  const hasExplicitCampaignType = String(explicitCampaignTypeRaw ?? '').trim().length > 0;
  const shapeDefaults = resolveAdGroupShapeDefaults({
    adOpsSpreadsheetName,
    campaignType: hasExplicitCampaignType ? explicitCampaignTypeRaw : DEFAULT_CAMPAIGN_TYPE
  });
  const campaignType = hasExplicitCampaignType
    ? normalizeCampaignType(explicitCampaignTypeRaw, shapeDefaults.defaultCampaignType)
    : shapeDefaults.defaultCampaignType;

  const adTypesRaw = asArray(raw?.ad_types ?? raw?.adTypes ?? raw?.ad_type);
  const adTypes = adTypesRaw.length > 0 ? adTypesRaw : shapeDefaults.defaultAdTypes;
  const productType = String(raw?.product_type ?? raw?.productType ?? raw?.product ?? raw?.ad_product ?? raw?.adProduct ?? '').trim();
  const countriesRaw = asArray(raw?.countries ?? raw?.country);
  const positionsRaw = asArray(raw?.positions ?? raw?.position);
  const adContextsRaw = asArray(raw?.ad_contexts ?? raw?.adContexts ?? raw?.ad_context);
  const onoViewTypesRaw = asArray(raw?.ono_view_types ?? raw?.onoViewTypes ?? raw?.ono_view_type ?? raw?.onoViewType);
  const countries = countriesRaw.length > 0 ? countriesRaw : DEFAULT_COUNTRIES;
  const positions = positionsRaw.length > 0
    ? positionsRaw
    : (shapeDefaults.requiresPosition ? DEFAULT_POSITIONS : []);
  const adContexts = adContextsRaw.length > 0 ? adContextsRaw : shapeDefaults.defaultAdContexts;
  const onoViewTypes = onoViewTypesRaw.length > 0 ? onoViewTypesRaw : shapeDefaults.defaultOnOViewTypes;
  const ratings = asArray(raw?.ratings ?? raw?.rating);
  const dayOfWeek = asArray(raw?.day_of_week ?? raw?.dayOfWeek ?? raw?.dayofweek);
  const genders = asArray(raw?.genders ?? raw?.gender);
  const ages = asArray(raw?.ages ?? raw?.age);
  const rawCpm = raw?.cpm ?? raw?.reservation_cpm ?? raw?.reservationCpm ?? raw?.cpm_per_group ?? raw?.cpmPerGroup;
  const hasExplicitGroupCpm = rawCpm !== undefined && rawCpm !== null && String(rawCpm).trim() !== '';
  const addedValueGroup = isAddedValueGroup({ name, productType, adTypeValues: adTypes });
  const parsedGroupCpm = toNonNegativeNumber(rawCpm, fallbackCpm);
  let resolvedCpm;
  if (hasExplicitGroupCpm) {
    resolvedCpm = addedValueGroup && parsedGroupCpm < ADDED_VALUE_MIN_CPM
      ? ADDED_VALUE_MIN_CPM
      : parsedGroupCpm;
  } else {
    resolvedCpm = addedValueGroup ? ADDED_VALUE_MIN_CPM : parsedGroupCpm;
  }

  return {
    name: String(name),
    gifUrl: String(gifUrl),
    campaignType,
    adOpsSpreadsheetName,
    keywords: resolvedKeywords,
    keywordInventoryRows,
    countries,
    adTypes,
    forceAdTypes: shapeDefaults.forceAdTypes,
    positions,
    adContexts,
    onoViewTypes,
    ratings,
    dayOfWeek,
    genders,
    ages,
    requiresSearchQueryTargeting: shapeDefaults.requiresSearchQuery,
    requiresPositionTargeting: shapeDefaults.requiresPosition,
    forceTrendingKeywords: shapeDefaults.forceTrendingKeywords,
    reservedImpressions: toNumber(raw?.reserved_impressions ?? raw?.reservedImpressions, fallbackImps),
    cpm: resolvedCpm,
    productType,
    addedValueGroup,
    creativeId: derivedCreativeId,
    creativeFriendlyName: raw?.creative_friendly_name || name,
    clickUrl: clickUrl,
    ctaText: raw?.cta_text || raw?.ctaText || '',
    ctaUrl: raw?.cta_url || gifUrl,
    carouselGif: raw?.carousel_gif || raw?.carousel_gifs?.[0] || gifUrl
  };
}

function toMonthName(monthNumber) {
  const idx = Number(monthNumber) - 1;
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return names[idx] || '';
}

function toOrdinalSuffix(dayNum) {
  const day = Number(dayNum);
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
}

function parseUsDateParts(value) {
  const raw = String(value || '').trim();
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!mdy) return null;
  const month = Number(mdy[1]);
  const day = Number(mdy[2]);
  const year = Number(mdy[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    month,
    day,
    year,
    monthName: toMonthName(month)
  };
}

function toBouncerAriaDateLabel(mdyDate) {
  const parsed = parseUsDateParts(mdyDate);
  if (!parsed?.monthName) return '';
  return `${parsed.monthName} ${parsed.day}${toOrdinalSuffix(parsed.day)}, ${parsed.year}`;
}

async function clickFirstVisibleLocator(locator) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    const visible = await item.isVisible().catch(() => false);
    if (!visible) continue;
    const clicked = await item.click({ force: true }).then(() => true).catch(() => false);
    if (clicked) return true;
  }
  return false;
}

async function ensureBouncerLoggedIn(page) {
  const url = page.url();
  if (!/\/users\/login\//i.test(url)) return;
  console.log('Bouncer login required. Waiting for Bouncer app after login...');
  await page.waitForURL(/\/website\/(?:inventory-explorer|campaigns)\//i, { timeout: BOUNCER_LOGIN_WAIT_MS });
}

async function ensureBouncerKeywordsGroupsExpanded(page) {
  const header = page.locator('div[role="button"][aria-controls]').filter({ hasText: /Keywords & Groups/i }).first();
  const visible = await header.isVisible().catch(() => false);
  if (!visible) return;
  const expanded = await header.getAttribute('aria-expanded').catch(() => 'true');
  if (expanded === 'false') {
    await header.click({ force: true }).catch(() => null);
    await page.waitForTimeout(180);
  }
}

async function setBouncerGifs(page) {
  await clickFirstVisibleLocator(page.locator('button').filter({ hasText: /^\s*GIFs\s*$/i }));
}

async function setBouncerImpressionGoal(page, value) {
  const input = page.locator('input[placeholder="0"]').first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.click({ force: true });
  await input.fill('');
  await input.type(String(Math.max(1, Math.floor(Number(value) || 0))), { delay: 12 });
}

async function gotoBouncerMonth(page, monthName, yearNumber) {
  const targetCaption = `${monthName} ${yearNumber}`;
  for (let i = 0; i < 18; i += 1) {
    const visible = await page.locator(`.rdp-caption_label:has-text("${targetCaption}")`).first().isVisible().catch(() => false);
    if (visible) return true;
    const moved = await clickFirstVisibleLocator(
      page.locator('button[aria-label*="next month" i], button[aria-label*="Go to next month" i], .rdp-button_next')
    );
    if (!moved) break;
    await page.waitForTimeout(120);
  }
  return false;
}

async function setBouncerDates(page, startDate, endDate) {
  const startBtn = page.locator('#start-date-label + button[role="combobox"]').first();
  const endBtn = page.locator('#end-date-label + button[role="combobox"]').first();
  const startParts = parseUsDateParts(startDate);
  const endParts = parseUsDateParts(endDate);
  if (!startParts || !endParts) return false;

  const startAria = toBouncerAriaDateLabel(startDate);
  const endAria = toBouncerAriaDateLabel(endDate);
  if (!startAria || !endAria) return false;

  await startBtn.click({ force: true }).catch(() => null);
  await page.waitForTimeout(120);
  await gotoBouncerMonth(page, startParts.monthName, startParts.year);
  await page.locator(`button[aria-label*="${startAria}"]`).first().click({ force: true }).catch(() => null);
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(120);

  await endBtn.click({ force: true }).catch(() => null);
  await page.waitForTimeout(120);
  await gotoBouncerMonth(page, endParts.monthName, endParts.year);
  await page.locator(`button[aria-label*="${endAria}"]`).first().click({ force: true }).catch(() => null);
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(120);

  return true;
}

async function deleteBouncerGroupByTerm(page, term) {
  const pill = page.locator('button[data-testid="keyword-group"]').filter({ hasText: new RegExp(escapeRegExp(term), 'i') }).first();
  const visible = await pill.isVisible().catch(() => false);
  if (!visible) return false;
  const del = pill.locator('[aria-label="delete keyword"]').first();
  const delVisible = await del.isVisible().catch(() => false);
  if (!delVisible) return false;
  await del.click({ force: true }).catch(() => null);
  const deleteConfirm = page.locator('button:has-text("Delete")').first();
  const confirmVisible = await deleteConfirm.isVisible().catch(() => false);
  if (confirmVisible) {
    await deleteConfirm.click({ force: true }).catch(() => null);
  }
  await page.waitForTimeout(220);
  return true;
}

async function clearAllBouncerGroups(page) {
  for (let i = 0; i < 24; i += 1) {
    const firstPill = page.locator('button[data-testid="keyword-group"]').first();
    const visible = await firstPill.isVisible().catch(() => false);
    if (!visible) break;
    const del = firstPill.locator('[aria-label="delete keyword"]').first();
    const delVisible = await del.isVisible().catch(() => false);
    if (!delVisible) break;
    await del.click({ force: true }).catch(() => null);
    const deleteConfirm = page.locator('button:has-text("Delete")').first();
    const confirmVisible = await deleteConfirm.isVisible().catch(() => false);
    if (confirmVisible) {
      await deleteConfirm.click({ force: true }).catch(() => null);
    }
    await page.waitForTimeout(160);
  }
}

async function openBouncerGroup(page, term) {
  const pill = page.locator('button[data-testid="keyword-group"]').filter({ hasText: new RegExp(escapeRegExp(term), 'i') }).first();
  await pill.waitFor({ state: 'visible', timeout: 12000 });
  await pill.click({ force: true, position: { x: 24, y: 18 } }).catch(() => null);
  await page.waitForTimeout(160);
}

async function captureBouncerKeywordState(page, term) {
  const state = await page.evaluate((needle) => {
    const normalize = (s) => String(s || '').replace(/["']/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const target = normalize(needle);
    const input = document.querySelector('input[placeholder="Input any number of Tags"]');
    if (!input) return { found: false, count: null, noMatch: false, pending: false };
    const minY = input.getBoundingClientRect().bottom - 4;
    const chips = Array.from(document.querySelectorAll('[data-testid="keyword-item"]'))
      .filter((el) => el.getBoundingClientRect().top >= minY);

    for (const chip of chips) {
      const full = normalize(chip.textContent || '');
      const termText = normalize(
        Array.from(chip.childNodes || [])
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent || '')
          .join(' ')
      ) || normalize(full.replace(/\b[0-9][0-9,]*\b/g, '').replace(/\bx\b/gi, ''));
      if (termText !== target) continue;
      const noMatch = /\bn\/a\b/.test(full) || /\bno\s*match\b/.test(full) || /\bno\s*results?\b/.test(full);
      const pending = /\bloading\b/.test(full) || /\bsearching\b/.test(full) || /\bcalculating\b/.test(full);
      const spans = Array.from(chip.querySelectorAll('span')).map((s) => String(s.textContent || '').trim());
      for (const s of spans) {
        const m = s.match(/\b([0-9][0-9,]*)\b/);
        if (!m) continue;
        const n = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(n) && n >= 0) return { found: true, count: n, noMatch, pending: false };
      }
      return { found: true, count: null, noMatch, pending };
    }
    return { found: false, count: null, noMatch: false, pending: false };
  }, term).catch(() => null);
  if (!state || typeof state !== 'object') {
    return { found: false, count: null, noMatch: false, pending: false };
  }
  return {
    found: Boolean(state.found),
    count: Number.isFinite(state.count) ? Number(state.count) : null,
    noMatch: Boolean(state.noMatch),
    pending: Boolean(state.pending)
  };
}

async function lookupSingleTermInventory(page, term) {
  await ensureBouncerKeywordsGroupsExpanded(page);
  const input = page.locator('input[placeholder="Search for a Keyword Group"]').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.click({ force: true });
  await input.fill('');
  await input.type(term, { delay: 14 });
  await clickFirstVisibleLocator(page.locator('button[aria-label="add tag"]').first());
  await page.waitForTimeout(260);
  await openBouncerGroup(page, term);

  let count = null;
  let unresolvedSeenAt = null;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    const state = await captureBouncerKeywordState(page, term);
    if (Number.isFinite(state.count)) {
      count = state.count;
      break;
    }
    if (state.noMatch) {
      count = 0;
      break;
    }
    if (state.found && !state.pending) {
      if (unresolvedSeenAt == null) {
        unresolvedSeenAt = Date.now();
      } else if (Date.now() - unresolvedSeenAt >= 1800) {
        count = 0;
        break;
      }
    } else {
      unresolvedSeenAt = null;
    }
    await page.waitForTimeout(120);
  }

  await deleteBouncerGroupByTerm(page, term).catch(() => null);
  return Number.isFinite(count) ? count : null;
}

function resolveLookupImpressionGoalForCampaignType(campaignType, goalsByType = {}, groups = []) {
  const key = normalizeCampaignTypeGoalKey(campaignType);
  const byTypeGoal = toPositiveInt(goalsByType?.[key], 0);
  if (byTypeGoal > 0) return byTypeGoal;
  const byGroupReserved = groups
    .filter((g) => normalizeCampaignType(g?.campaignType, DEFAULT_CAMPAIGN_TYPE) === key)
    .reduce((sum, g) => sum + toPositiveInt(g?.reservedImpressions, 0), 0);
  if (byGroupReserved > 0) return byGroupReserved;
  return toPositiveInt(TOTAL_IMPRESSIONS, 0);
}

async function launchBouncerWindowAtStart(startUrl = BOUNCER_INVENTORY_EXPLORER_URL) {
  const staleLockNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'RunningChromeVersion'];
  const clearLocks = async (profileDir) => {
    for (const name of staleLockNames) {
      const p = path.join(profileDir, name);
      await fs.unlink(p).catch(() => null);
    }
  };

  const base = {
    headless: false,
    viewport: { width: 1600, height: 1000 },
    slowMo: SLOW_MO,
    ...(BROWSER_EXECUTABLE_PATH ? { executablePath: BROWSER_EXECUTABLE_PATH } : {}),
    ...(PLAYWRIGHT_CHANNEL ? { channel: PLAYWRIGHT_CHANNEL } : {}),
    args: ['--disable-crash-reporter', '--disable-crashpad', '--disable-breakpad']
  };

  const profileCandidates = [BOUNCER_PROFILE_DIR, `${BOUNCER_PROFILE_DIR}-fresh-${Date.now()}`];
  let lastError = null;

  for (let p = 0; p < profileCandidates.length; p += 1) {
    const profileDir = profileCandidates[p];
    if (CLEAR_SINGLETON_LOCKS || p > 0) {
      await clearLocks(profileDir);
    }
    if (p > 0) {
      await fs.rm(profileDir, { recursive: true, force: true }).catch(() => null);
    }
    try {
      const context = await chromium.launchPersistentContext(profileDir, base);
      const page = context.pages()[0] || (await context.newPage());
      const url = page.url();
      const desiredStartUrl = String(startUrl || BOUNCER_INVENTORY_EXPLORER_URL).trim() || BOUNCER_INVENTORY_EXPLORER_URL;
      if (url === 'about:blank' || !/\/website\/(?:inventory-explorer|campaigns)\/|\/users\/login\//i.test(url)) {
        await page.goto(desiredStartUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
      } else if (url === 'about:blank') {
        await page.goto(desiredStartUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
      }
      if (/\/users\/login\//i.test(page.url())) {
        console.log('Opened Bouncer window at login. Please log in there before campaign enrichment and inventory lookup run.');
      } else if (/\/website\/campaigns\//i.test(page.url())) {
        console.log('Opened Bouncer campaign window.');
      } else {
        console.log('Opened Bouncer Inventory Explorer window.');
      }
      return { context, page, profileDir };
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || error).split('\n')[0];
      console.warn(`Bouncer window launch failed (profile=${profileDir}): ${msg}`);
    }
  }
  throw lastError || new Error('Unable to launch Bouncer window.');
}

async function shouldOpenBouncerWindowAtStart() {
  if (!BOUNCER_LOOKUP_ENABLED) return false;
  if (!CAMPAIGN_FILE) return false;

  try {
    const raw = await fs.readFile(CAMPAIGN_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const reservation = parsed?.reservation || {};
    const lineItemUrl = extractBouncerCampaignUrlFromCampaign(parsed, reservation);

    const mode = normalizeImpressionAllocationMode(
      reservation.impression_allocation_mode
      || reservation.impression_split_mode
      || reservation.impression_split
      || parsed.impression_allocation_mode
      || parsed.impression_split_mode
      || parsed.impression_split
      || IMPRESSION_ALLOCATION_MODE,
      'keyword_inventory_proportional_by_campaign_type'
    );
    const goalsByType = parseImpressionGoalsByCampaignType(
      reservation.impression_goals_by_campaign_type
      || reservation.impression_goals_by_type
      || reservation.impression_goals
      || parsed.impression_goals_by_campaign_type
      || parsed.impression_goals_by_type
      || parsed.impression_goals
      || {}
    );
    const hasCampaignTypeGoals = Object.keys(goalsByType).length > 0;
    const totalImpressions = toPositiveInt(
      reservation.total_impressions
      || reservation.total_reserved_impressions
      || parsed.total_impressions
      || parsed.total_reserved_impressions
      || 0,
      0
    );
    const modeForTypeGoals = mode === 'legacy_even' ? 'even' : 'keyword_inventory_proportional';
    const inventoryLookupNeeded = (
      (hasCampaignTypeGoals && modeForTypeGoals === 'keyword_inventory_proportional')
      || (!hasCampaignTypeGoals && totalImpressions > 0 && mode === 'legacy_keyword_inventory_proportional')
    );

    const rawGroups = parsed.ad_groups || parsed.adGroups || reservation.ad_groups || [];
    if (!Array.isArray(rawGroups) || rawGroups.length === 0) return false;
    const normalizedGroups = rawGroups
      .map((g) => normalizeGroup(g, RESERVED_IMPS_PER_GROUP, CPM_PER_GROUP))
      .filter(Boolean);

    if (lineItemUrl) {
      const needsLineItemKeywordBackfill = normalizedGroups.some((group) => {
        const type = normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE);
        const hasInventory = Array.isArray(group?.keywordInventoryRows) && group.keywordInventoryRows.length > 0;
        const hasTerms = Array.isArray(group?.keywords) && group.keywords.length > 0;
        return type === 'search' && !hasInventory && !hasTerms;
      });
      if (needsLineItemKeywordBackfill) return true;
    }

    if (!inventoryLookupNeeded) return false;

    return normalizedGroups.some((group) => {
      const type = normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE);
      const hasInventory = Array.isArray(group?.keywordInventoryRows) && group.keywordInventoryRows.length > 0;
      const hasTerms = Array.isArray(group?.keywords) && group.keywords.length > 0;
      return type === 'search' && !hasInventory && hasTerms;
    });
  } catch (error) {
    console.warn(`Bouncer preflight check failed; defaulting to Koddi-only startup. ${String(error?.message || error).split('\n')[0]}`);
    return false;
  }
}

async function resolveBouncerStartupUrl() {
  if (!CAMPAIGN_FILE) return BOUNCER_INVENTORY_EXPLORER_URL;
  try {
    const raw = await fs.readFile(CAMPAIGN_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const reservation = parsed?.reservation || {};
    const campaignUrl = extractBouncerCampaignUrlFromCampaign(parsed, reservation);
    if (!campaignUrl) return BOUNCER_INVENTORY_EXPLORER_URL;
    return toBouncerViewOnlyUrl(campaignUrl);
  } catch {
    return BOUNCER_INVENTORY_EXPLORER_URL;
  }
}

async function populateMissingKeywordInventoryFromBouncer(groups, goalsByType = {}, options = {}) {
  if (!BOUNCER_LOOKUP_ENABLED) return groups;
  if (!Array.isArray(groups) || groups.length === 0) return groups;

  const lookupCandidates = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => {
      const type = normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE);
      const hasInventory = Array.isArray(group?.keywordInventoryRows) && group.keywordInventoryRows.length > 0;
      const hasTerms = Array.isArray(group?.keywords) && group.keywords.length > 0;
      return type === 'search' && !hasInventory && hasTerms;
    });

  if (lookupCandidates.length === 0) return groups;
  console.log(`Missing keyword inventory detected for ${lookupCandidates.length} ad group(s); running Bouncer lookup.`);

  let context = options?.bouncerSession?.context || null;
  let page = options?.bouncerSession?.page || null;
  let ownsSession = false;
  if (!context || !page || page.isClosed()) {
    const launched = await launchBouncerWindowAtStart();
    context = launched.context;
    page = launched.page;
    ownsSession = true;
  }

  try {
    const pageUrl = page.url();
    if (!/\/website\/inventory-explorer\/|\/users\/login\//i.test(pageUrl)) {
      await page.goto(BOUNCER_INVENTORY_EXPLORER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await ensureBouncerLoggedIn(page);
    await ensureBouncerKeywordsGroupsExpanded(page);
    await setBouncerGifs(page);
    await setBouncerDates(page, START_DATE, END_DATE);

    const byType = new Map();
    for (const entry of lookupCandidates) {
      const type = normalizeCampaignType(entry.group.campaignType, DEFAULT_CAMPAIGN_TYPE);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(entry);
    }

    for (const [type, entries] of byType.entries()) {
      const goal = resolveLookupImpressionGoalForCampaignType(type, goalsByType, groups);
      if (goal > 0) {
        await setBouncerImpressionGoal(page, goal);
      }
      await clearAllBouncerGroups(page);

      const uniqueTerms = dedupeStrings(entries.flatMap(({ group }) => Array.isArray(group.keywords) ? group.keywords : []));
      const inventoryMap = new Map();
      for (const term of uniqueTerms) {
        const count = await lookupSingleTermInventory(page, term);
        const normalizedTerm = normalizeUiText(term);
        if (count == null) {
          console.warn(`Bouncer lookup returned no inventory for keyword "${term}"; defaulting to 0.`);
          inventoryMap.set(normalizedTerm, 0);
          continue;
        }
        inventoryMap.set(normalizedTerm, count);
        console.log(`Bouncer inventory ${type}:${term}=${count}`);
      }

      for (const { group, index } of entries) {
        const rows = dedupeStrings(group.keywords).map((term) => ({
          term,
          availableInventory: toNonNegativeNumber(inventoryMap.get(normalizeUiText(term)), 0)
        }));
        groups[index] = {
          ...group,
          keywordInventoryRows: rows
        };
      }
    }
  } finally {
    if (ownsSession && !options?.keepWindowOpen) {
      await context.close().catch(() => null);
    }
  }

  return groups;
}

async function applyCampaignOverrides(options = {}) {
  if (!CAMPAIGN_FILE) return;

  const raw = await fs.readFile(CAMPAIGN_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const reservation = parsed?.reservation || {};
  const bouncerCampaignUrl = extractBouncerCampaignUrlFromCampaign(parsed, reservation);

  RESERVATION_NAME = reservation.name || parsed.reservation_name || RESERVATION_NAME;
  START_DATE = normalizeDate(reservation.start_date || parsed.start_date, START_DATE);
  END_DATE = normalizeDate(reservation.end_date || parsed.end_date, END_DATE);
  ADVERTISER_NAME = reservation.advertiser_name || parsed.advertiser_name || ADVERTISER_NAME;
  RESERVED_IMPS_PER_GROUP = toNumber(
    reservation.reserved_impressions_per_group || parsed.reserved_impressions_per_group,
    RESERVED_IMPS_PER_GROUP
  );
  TOTAL_IMPRESSIONS = toPositiveInt(
    reservation.total_impressions || reservation.total_reserved_impressions || parsed.total_impressions || parsed.total_reserved_impressions || TOTAL_IMPRESSIONS,
    TOTAL_IMPRESSIONS
  );
  IMPRESSION_ALLOCATION_MODE = normalizeImpressionAllocationMode(
    reservation.impression_allocation_mode
    || reservation.impression_split_mode
    || reservation.impression_split
    || parsed.impression_allocation_mode
    || parsed.impression_split_mode
    || parsed.impression_split
    || IMPRESSION_ALLOCATION_MODE,
    'keyword_inventory_proportional_by_campaign_type'
  );
  IMPRESSION_GOALS_BY_CAMPAIGN_TYPE = parseImpressionGoalsByCampaignType(
    reservation.impression_goals_by_campaign_type
    || reservation.impression_goals_by_type
    || reservation.impression_goals
    || parsed.impression_goals_by_campaign_type
    || parsed.impression_goals_by_type
    || parsed.impression_goals
    || {}
  );
  CPM_PER_GROUP = toNonNegativeNumber(
    reservation.cpm_per_group ?? reservation.cpm ?? parsed.cpm_per_group ?? parsed.cpm,
    CPM_PER_GROUP
  );

  const rawGroups = parsed.ad_groups || parsed.adGroups || reservation.ad_groups || [];
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const missingCampaignTypeIndexes = rawGroups
      .map((g, idx) => ({ idx, type: g?.campaign_type ?? g?.campaignType }))
      .filter((x) => !String(x.type ?? '').trim())
      .map((x) => x.idx + 1);
    if (missingCampaignTypeIndexes.length > 0) {
      console.warn(`No campaign_type provided for ad_groups index(es) ${missingCampaignTypeIndexes.join(', ')}; defaulting those groups to "search".`);
    }

    const normalized = rawGroups.map((g) => normalizeGroup(g, RESERVED_IMPS_PER_GROUP, CPM_PER_GROUP)).filter(Boolean);
    if (normalized.length === 0) {
      throw new Error(`CAMPAIGN_FILE has ad_groups but none had required fields "name" and gif URL (${CAMPAIGN_FILE})`);
    }
    AD_GROUPS = normalized;
  }

  AD_GROUPS = AD_GROUPS.map((g) => ({
    ...g,
    campaignType: normalizeCampaignType(g.campaignType, DEFAULT_CAMPAIGN_TYPE)
  }));

  if (bouncerCampaignUrl) {
    const lineItemEnrichment = await enrichFromBouncerCampaignSource(
      AD_GROUPS,
      bouncerCampaignUrl,
      { bouncerSession: options?.bouncerSession, keepWindowOpen: true }
    );
    AD_GROUPS = Array.isArray(lineItemEnrichment?.groups) ? lineItemEnrichment.groups : AD_GROUPS;
    if (lineItemEnrichment?.enrichedGroups > 0) {
      console.log(`Backfilled keywords from bouncer_campaign_url for ${lineItemEnrichment.enrichedGroups} ad group(s).`);
    }

    const resolvedLineItems = lineItemEnrichment?.resolvedLineItems || {};
    if (resolvedLineItems.search) {
      console.log(`Resolved Bouncer line item for search: ${resolvedLineItems.search}`);
    }
    if (resolvedLineItems.trending) {
      console.log(`Resolved Bouncer line item for trending: ${resolvedLineItems.trending}`);
    }

    const metadataByType = lineItemEnrichment?.metadataByType || {};
    const searchMetadata = metadataByType.search || null;
    const trendingMetadata = metadataByType.trending || null;
    const metadataWithDates = [searchMetadata, trendingMetadata].filter(Boolean);
    const firstMetadata = metadataWithDates[0] || null;

    if (firstMetadata?.startDate) START_DATE = normalizeDate(firstMetadata.startDate, START_DATE);
    if (firstMetadata?.endDate) END_DATE = normalizeDate(firstMetadata.endDate, END_DATE);

    const applyTypeMetadata = (campaignType, metadata) => {
      if (!metadata) return false;
      let updatedGoals = false;
      if (Number.isFinite(metadata.totalImpressions) && metadata.totalImpressions > 0) {
        const hasTypeGroups = AD_GROUPS.some(
          (g) => normalizeCampaignType(g?.campaignType, DEFAULT_CAMPAIGN_TYPE) === campaignType
        );
        if (hasTypeGroups) {
          IMPRESSION_GOALS_BY_CAMPAIGN_TYPE = {
            ...IMPRESSION_GOALS_BY_CAMPAIGN_TYPE,
            [campaignType]: metadata.totalImpressions
          };
          updatedGoals = true;
        }
      }
      if (Number.isFinite(metadata.cpm) && metadata.cpm >= 0) {
        CPM_PER_GROUP = metadata.cpm;
        AD_GROUPS = AD_GROUPS.map((group) => {
          const type = normalizeCampaignType(group?.campaignType, DEFAULT_CAMPAIGN_TYPE);
          if (type !== campaignType || group?.addedValueGroup) return group;
          return { ...group, cpm: metadata.cpm };
        });
      }
      return updatedGoals;
    };

    const searchGoalsUpdated = applyTypeMetadata('search', searchMetadata);
    const trendingGoalsUpdated = applyTypeMetadata('trending', trendingMetadata);
    if (searchGoalsUpdated || trendingGoalsUpdated) {
      const goalsTotal = Object.values(IMPRESSION_GOALS_BY_CAMPAIGN_TYPE)
        .reduce((sum, value) => sum + toPositiveInt(value, 0), 0);
      if (goalsTotal > 0) {
        TOTAL_IMPRESSIONS = goalsTotal;
      }
    }
  }

  const hasCampaignTypeGoals = Object.keys(IMPRESSION_GOALS_BY_CAMPAIGN_TYPE).length > 0;
  const modeForTypeGoals = IMPRESSION_ALLOCATION_MODE === 'legacy_even'
    ? 'even'
    : 'keyword_inventory_proportional';
  const inventoryLookupNeeded = (
    (hasCampaignTypeGoals && modeForTypeGoals === 'keyword_inventory_proportional')
    || (!hasCampaignTypeGoals && TOTAL_IMPRESSIONS > 0 && IMPRESSION_ALLOCATION_MODE === 'legacy_keyword_inventory_proportional')
  );
  if (inventoryLookupNeeded) {
    AD_GROUPS = await populateMissingKeywordInventoryFromBouncer(
      AD_GROUPS,
      IMPRESSION_GOALS_BY_CAMPAIGN_TYPE,
      { bouncerSession: options?.bouncerSession, keepWindowOpen: true }
    );
  }

  if (hasCampaignTypeGoals && AD_GROUPS.length > 0) {
    const allocation = allocateImpressionsByCampaignTypeGoals(
      AD_GROUPS,
      IMPRESSION_GOALS_BY_CAMPAIGN_TYPE,
      modeForTypeGoals
    );
    AD_GROUPS = AD_GROUPS.map((g, idx) => (
      allocation.splits[idx] == null
        ? g
        : { ...g, reservedImpressions: allocation.splits[idx] }
    ));

    for (const summary of allocation.summaries) {
      if (summary.strategy === 'even') {
        console.log(
          `Using impression_goals_by_campaign_type for campaign_type=${summary.key}: goal=${summary.goal}, `
          + `groups=${summary.groupCount}, even splits=${summary.splits.join(', ')}`
        );
      } else {
        console.log(
          `Using impression_goals_by_campaign_type for campaign_type=${summary.key}: goal=${summary.goal}, `
          + `groups=${summary.groupCount}, total keyword inventory=${summary.totalInventory}, splits=${summary.splits.join(', ')}`
        );
      }
    }
    if (allocation.assignedGroupCount < AD_GROUPS.length) {
      const unassigned = AD_GROUPS.filter((_, idx) => allocation.splits[idx] == null).map((g) => g.name).join(', ');
      console.warn(
        `impression_goals_by_campaign_type did not include goals for ${AD_GROUPS.length - allocation.assignedGroupCount} `
        + `ad group(s); keeping existing reserved_impressions for: ${unassigned}`
      );
    }
    if (TOTAL_IMPRESSIONS > 0 && allocation.totalGoals !== TOTAL_IMPRESSIONS) {
      console.warn(
        `total_impressions (${TOTAL_IMPRESSIONS}) does not equal sum(impression_goals_by_campaign_type) `
        + `(${allocation.totalGoals}); campaign-type goals were applied as source of truth.`
      );
    }
  }

  if (!hasCampaignTypeGoals && TOTAL_IMPRESSIONS > 0 && AD_GROUPS.length > 0) {
    if (IMPRESSION_ALLOCATION_MODE === 'keyword_inventory_proportional_by_campaign_type') {
      throw new Error(
        'impression_allocation_mode=keyword_inventory_proportional_by_campaign_type requires '
        + 'reservation.impression_goals_by_campaign_type (or impression_goals_by_type).'
      );
    }
    let splits = [];
    if (IMPRESSION_ALLOCATION_MODE === 'legacy_keyword_inventory_proportional') {
      const proportional = distributeImpressionsByKeywordInventory(TOTAL_IMPRESSIONS, AD_GROUPS);
      splits = proportional.groupSplits;
      console.log(
        `Using total_impressions=${TOTAL_IMPRESSIONS} with legacy single-pool allocation mode=keyword_inventory_proportional`
        + ` (total keyword inventory=${proportional.totalInventory}); splits: ${splits.join(', ')}`
      );
    } else {
      splits = distributeImpressionsEvenly(TOTAL_IMPRESSIONS, AD_GROUPS.length);
      console.log(`Using total_impressions=${TOTAL_IMPRESSIONS}; split across ${AD_GROUPS.length} ad groups as: ${splits.join(', ')}`);
    }
    if (splits.some((n) => n <= 0)) {
      throw new Error(`total_impressions (${TOTAL_IMPRESSIONS}) is too small for ${AD_GROUPS.length} ad groups; each group must receive at least 1 impression.`);
    }
    AD_GROUPS = AD_GROUPS.map((g, idx) => ({
      ...g,
      reservedImpressions: splits[idx]
    }));
  }

  if (!String(ADVERTISER_NAME || '').trim()) {
    console.log('No advertiser_name provided; script will select the first advertiser option in UI.');
  }
  console.log(`Using ad-group campaign types: ${AD_GROUPS.map((g, idx) => `${idx + 1}:${g.campaignType}`).join(', ')}`);
}

async function launchBrowserContext() {
  if (USE_CDP) {
    try {
      const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
      const contexts = browser.contexts();
      const context = contexts[0] || (await browser.newContext());
      console.log(`Connected to existing Chrome via CDP at ${CDP_ENDPOINT}`);
      return { context, browser, viaCdp: true };
    } catch (error) {
      const msg = String(error?.message || error).split('\n')[0];
      console.warn(`CDP connect failed at ${CDP_ENDPOINT}; falling back to Playwright-launched browser. ${msg}`);
    }
  }

  const staleLockNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'RunningChromeVersion'];
  const clearLocks = async (profileDir) => {
    for (const name of staleLockNames) {
      const p = path.join(profileDir, name);
      await fs.unlink(p).catch(() => null);
    }
  };

  const base = {
    headless: false,
    viewport: { width: 1600, height: 1000 },
    slowMo: SLOW_MO,
    ...(ENABLE_CHROME_EXTENSIONS
      ? { ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'] }
      : {}),
    args: [
      '--disable-crash-reporter',
      '--disable-crashpad',
      '--disable-breakpad',
      ...(CHROME_PROFILE_DIRECTORY ? [`--profile-directory=${CHROME_PROFILE_DIRECTORY}`] : [])
    ]
  };

  const attempts = [];
  if (ENABLE_CHROME_EXTENSIONS) {
    console.log('Chrome extension mode enabled: Playwright default extension-disable args are removed.');
  }
  if (BROWSER_EXECUTABLE_PATH) {
    attempts.push({ label: `executablePath=${BROWSER_EXECUTABLE_PATH}`, opts: { executablePath: BROWSER_EXECUTABLE_PATH } });
  }
  if (PLAYWRIGHT_CHANNEL) {
    attempts.push({ label: `channel=${PLAYWRIGHT_CHANNEL}`, opts: { channel: PLAYWRIGHT_CHANNEL } });
  }
  attempts.push({ label: 'bundled-chromium', opts: {} });

  const profileCandidates = [PROFILE_DIR];
  if (PROFILE_FALLBACK) {
    const fallbackProfileDir = `${PROFILE_DIR}-fresh-${Date.now()}`;
    profileCandidates.push(fallbackProfileDir);
  }

  let lastError = null;
  for (let p = 0; p < profileCandidates.length; p += 1) {
    const profileDir = profileCandidates[p];
    if (CLEAR_SINGLETON_LOCKS || p > 0) {
      await clearLocks(profileDir);
    }
    if (p > 0) {
      await fs.rm(profileDir, { recursive: true, force: true }).catch(() => null);
      console.warn(`Primary profile failed previously; retrying with fresh profile: ${profileDir}`);
    }

    for (const attempt of attempts) {
      try {
        const ctx = await chromium.launchPersistentContext(profileDir, { ...base, ...attempt.opts });
        console.log(`Launched browser using profile: ${profileDir} (${attempt.label})`);
        return { context: ctx, browser: null, viaCdp: false };
      } catch (error) {
        lastError = error;
        const msg = String(error?.message || error).split('\n')[0];
        console.warn(`Browser launch attempt failed (${attempt.label}, profile=${profileDir}): ${msg}`);
      }
    }
  }
  throw lastError || new Error('Unable to launch browser context.');
}

function tsLabel() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureArtifactsDir() {
  await fs.mkdir(DIAG_DIR, { recursive: true });
}

async function captureDiagnostics(page, label) {
  await ensureArtifactsDir();
  const stamp = tsLabel();
  const base = path.join(DIAG_DIR, `${stamp}-${label}`);
  if (!page || page.isClosed()) {
    await fs.writeFile(`${base}.note.txt`, 'Page was closed before diagnostics could be captured.', 'utf8').catch(() => null);
    return;
  }
  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => null);
  const html = await page.content().catch(() => '');
  await fs.writeFile(`${base}.html`, html, 'utf8').catch(() => null);
  await fs.writeFile(`${base}.url.txt`, page.url(), 'utf8').catch(() => null);
  console.log(`Captured diagnostics: ${base}.*`);
}

async function clickFirst(page, selectors, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      try {
        const loc = page.locator(selector).first();
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        const enabled = await loc.isEnabled().catch(() => true);
        if (!enabled) continue;
        await loc.click({ timeout: 350 }).catch(() => null);
        return selector;
      } catch {
        // next
      }
    }
    await page.waitForTimeout(40);
  }
  return null;
}

async function fillFirst(page, selectors, value, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      try {
        const loc = page.locator(selector).first();
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        await loc.fill('').catch(() => null);
        await loc.fill(String(value)).catch(() => null);
        const now = await loc.inputValue().catch(() => '');
        if (now === String(value)) return selector;
      } catch {
        // next
      }
    }
    await page.waitForTimeout(40);
  }
  return null;
}

function parseNumericInput(value) {
  const cleaned = String(value || '').replace(/,/g, '').replace(/[^0-9.+-]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '-' || cleaned === '+') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fillNumericFirst(page, selectors, value, timeoutMs = 6000) {
  const targetNum = Number(value);
  if (!Number.isFinite(targetNum)) return null;

  const textCandidates = [targetNum.toFixed(2), String(targetNum)];
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      try {
        const loc = page.locator(selector).first();
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;

        for (const textValue of textCandidates) {
          await loc.fill('').catch(() => null);
          await loc.fill(textValue).catch(() => null);
          const now = await loc.inputValue().catch(() => '');
          const nowNumeric = parseNumericInput(now);
          if (now === textValue) return selector;
          if (nowNumeric != null && Math.abs(nowNumeric - targetNum) < 0.000001) return selector;
        }
      } catch {
        // next
      }
    }
    await page.waitForTimeout(40);
  }
  return null;
}

async function fillDirect(page, selector, value, timeoutMs = 2500) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: timeoutMs });
  await loc.fill('');
  await loc.fill(String(value));
  return true;
}

async function firstVisibleLocator(page, selectors, timeoutMs = 8000, pollMs = 60) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      const visible = await loc.isVisible().catch(() => false);
      if (visible) return loc;
    }
    await page.waitForTimeout(pollMs);
  }
  return null;
}

async function verifyInputValue(locator, expected, timeoutMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const val = await locator.inputValue().catch(() => '');
    if (val === String(expected)) return true;
    await locator.evaluate((el, v) => {
      const input = el;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(expected)).catch(() => {});
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

async function setAdGroupNameStrict(page, adgroupNum, value) {
  const loc = await firstVisibleLocator(page, [
    `input[name="adgroup.${adgroupNum}.adgroup_name"]:visible`,
    `input[data-test="adgroup.${adgroupNum}.adgroup_name-field--input"]:visible`,
    'input[data-test$=".adgroup_name-field--input"]:visible',
    'input[name$=".adgroup_name"]:visible'
  ], 8000);
  if (!loc) return false;

  // Use real UI typing/fill to avoid React-controlled state resets.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await loc.click({ timeout: 800 }).catch(() => null);
    await loc.fill('').catch(() => null);
    await loc.fill(String(value)).catch(() => null);
    await page.keyboard.press('Tab').catch(() => null);

    const ok = await verifyInputValue(loc, value, 600);
    if (ok) return true;
    await page.waitForTimeout(60);
  }

  return false;
}

async function ensureAdGroupNameBeforeDone(page, adgroupNum, value) {
  const loc = await firstVisibleLocator(page, [
    `input[name="adgroup.${adgroupNum}.adgroup_name"]:visible`,
    `input[data-test="adgroup.${adgroupNum}.adgroup_name-field--input"]:visible`,
    'input[data-test$=".adgroup_name-field--input"]:visible',
    'input[name$=".adgroup_name"]:visible'
  ], 1800);
  if (!loc) return false;
  const current = await loc.inputValue().catch(() => '');
  if (current === String(value)) return true;
  return setAdGroupNameStrict(page, adgroupNum, value);
}

async function dismissDatePickerPopover(page, adgroupNum = null) {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(40);
  }

  const selectors = Number.isInteger(adgroupNum)
    ? [
      `input[name="adgroup.${adgroupNum}.adgroup_name"]:visible`,
      `input[data-test="adgroup.${adgroupNum}.adgroup_name-field--input"]:visible`,
      'input[data-test$=".adgroup_name-field--input"]:visible',
      'input[name$=".adgroup_name"]:visible',
      '[data-test="campaign-action-row"]',
      'body'
    ]
    : [
      'input[data-test$=".adgroup_name-field--input"]:visible',
      'input[name$=".adgroup_name"]:visible',
      '[data-test="campaign-action-row"]',
      'body'
    ];

  const focusTarget = await firstVisibleLocator(page, selectors, 900, 50);
  if (focusTarget) {
    await focusTarget.click({ force: true, timeout: 400 }).catch(() => null);
  }

  await page.waitForTimeout(70);
  await page.keyboard.press('Escape').catch(() => null);
}

async function hasFormConfigError(page) {
  return page.getByText(/Could not find form configuration/i).first().isVisible().catch(() => false);
}

async function waitUntilLoggedIn(page, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const url = page.url();
    if (LOGIN_READY_URL_REGEX.test(url) || READY_APP_URL_REGEX.test(url)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function selectFromPlaceholder(page, placeholderText, preferredValue = '') {
  const placeholder = page.getByText(new RegExp(`^${placeholderText}$`, 'i')).first();
  const needsSelection = await placeholder.isVisible().catch(() => false);
  if (!needsSelection) return true;

  await placeholder.click({ force: true }).catch(() => null);
  await page.waitForTimeout(120);

  let preferredClicked = false;
  const preferredLabel = String(preferredValue || '').trim();
  if (preferredLabel) {
    const preferredExact = page
      .locator('[role="option"], [id*="-option-"], [class*="option"]')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(preferredLabel)}\\s*$`, 'i') })
      .first();
    const preferredVisible = await preferredExact.isVisible().catch(() => false);
    if (preferredVisible) {
      preferredClicked = await preferredExact.click({ force: true, timeout: 700 }).then(() => true).catch(() => false);
    }
    if (!preferredClicked) {
      const preferredContains = page
        .locator('[role="option"], [id*="-option-"], [class*="option"]')
        .filter({ hasText: new RegExp(escapeRegExp(preferredLabel), 'i') })
        .first();
      const containsVisible = await preferredContains.isVisible().catch(() => false);
      if (containsVisible) {
        preferredClicked = await preferredContains.click({ force: true, timeout: 700 }).then(() => true).catch(() => false);
      }
    }
    if (!preferredClicked) {
      console.warn(`Preferred value "${preferredLabel}" was not found for ${placeholderText}; falling back to first option.`);
    }
  }

  if (!preferredClicked) {
    const picked = await clickFirst(page, [
      '[role="option"]',
      '[id*="-option-0"]',
      '[class*="option"]'
    ], 800);
    if (!picked) {
      await page.keyboard.press('ArrowDown').catch(() => null);
      await page.keyboard.press('Enter').catch(() => null);
    }
  }

  await page.waitForTimeout(180);
  const stillPlaceholder = await page.getByText(new RegExp(`^${placeholderText}$`, 'i')).first().isVisible().catch(() => false);
  return !stillPlaceholder;
}

async function clickCreateReservation(page, timeoutMs = 12000) {
  const isOnReservationDetailsStep = async () => {
    if (/\/reservations\/reserve/i.test(page.url())) return true;
    const onExperienceStep = await page.getByText(/Targeted Reservation/i).first().isVisible().catch(() => false);
    if (onExperienceStep) return true;
    const nameVisible = await page
      .locator('input[data-test="reservation-reserve.reservation_name-field--input"]')
      .first()
      .isVisible()
      .catch(() => false);
    return nameVisible;
  };

  if (await isOnReservationDetailsStep()) return true;

  const startedAt = Date.now();
  const selectors = [
    'button[data-test="add-reservation"]',
    '[data-test="add-reservation"]',
    'button:has-text("+ Create")',
    'button:has-text("Create")',
    '[role="button"]:has-text("Create")'
  ];

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      const visible = await loc.isVisible().catch(() => false);
      if (!visible) continue;

      await loc.scrollIntoViewIfNeeded().catch(() => null);
      const disabled = await loc.isDisabled().catch(() => false);
      if (disabled) continue;

      const clicked = await loc.click({ timeout: 450 }).then(() => true).catch(() => false);
      if (!clicked) {
        await loc.evaluate((el) => {
          el.click();
        }).catch(() => null);
      }
      await page.waitForURL(/\/reservations\/reserve/i, { timeout: 1600 }).catch(() => null);
      if (await isOnReservationDetailsStep()) return true;
    }
    await page.waitForTimeout(60);
  }

  return false;
}

async function ensureRequiredReservationSelections(page) {
  // If advertiser_name is provided, try to select that exact label. Otherwise pick first option.
  const advertiserOk = await selectFromPlaceholder(page, 'Select an advertiser', ADVERTISER_NAME);
  if (!advertiserOk) return false;

  // These may or may not exist depending on Koddi configuration; select if present.
  await selectFromPlaceholder(page, 'Select a member group').catch(() => null);
  await selectFromPlaceholder(page, 'Select an experience').catch(() => null);
  return true;
}

async function gotoAdGroupsStepFromReservations(page) {
  const alreadyReady = READY_APP_URL_REGEX.test(page.url());
  if (!alreadyReady) {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(350);
    console.log('Koddi login required for this run. Waiting for login completion in browser...');
    const ok = await waitUntilLoggedIn(page, LOGIN_WAIT_MS);
    if (!ok) return false;
  }
  if (!/\/reservations/i.test(page.url())) {
    await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(350);
  }

  const onExperienceStep = (
    /\/reservations\/reserve/i.test(page.url())
    || await page.getByText(/Targeted Reservation/i).first().isVisible().catch(() => false)
  );
  if (!onExperienceStep) {
    let createClicked = await clickCreateReservation(page, 12000);

    if (!createClicked) {
      await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(500);
      createClicked = await clickCreateReservation(page, 12000);
    }
    if (!createClicked) return false;
  }

  let reachedDetails = await page
    .locator('input[data-test="reservation-reserve.reservation_name-field--input"]')
    .first()
    .isVisible()
    .catch(() => false);
  for (let attempt = 0; attempt < 3 && !reachedDetails; attempt += 1) {
    await clickFirst(page, [
      '[data-test^="workflow-experience-"][data-test$="--radio"]:has-text("Targeted Reservation")',
      '[data-test^="workflow-experience-"][data-test$="--container"]:has-text("Targeted Reservation")',
      'label:has-text("Targeted Reservation")',
      'text=Targeted Reservation'
    ]).catch(() => null);
    await page.waitForTimeout(1000);
    await clickFirst(page, [
      '[data-test^="workflow-config-"][data-test$="--radio"]:has-text("Targeted Reservations")',
      '[data-test^="workflow-config-"][data-test$="--container"]:has-text("Targeted Reservations")',
      '[data-test^="workflow-config-"][data-test$="--label"]:has-text("Targeted Reservations")',
      'label:has-text("Targeted Reservations")',
      'text=Targeted Reservations',
      'text=Multiple Ad Group Test Flow'
    ]).catch(() => null);
    await page.waitForTimeout(1000);
    await clickFirst(page, ['[data-test="campaign-action-row--next"]', 'button:has-text("Next")'], 3500).catch(() => null);
    await page.waitForTimeout(900);

    const configError = await hasFormConfigError(page);
    if (configError) {
      console.log('Form configuration toast detected; retrying experience/config selection.');
      await page.keyboard.press('Escape').catch(() => null);
      await page.waitForTimeout(300);
      continue;
    }

    const nameVisible = await page
      .locator('input[data-test="reservation-reserve.reservation_name-field--input"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (nameVisible) {
      reachedDetails = true;
    }
  }

  if (!reachedDetails) return false;

  const requiredSelectionsOk = await ensureRequiredReservationSelections(page);
  if (!requiredSelectionsOk) return false;

  try {
    await fillDirect(
      page,
      'input[data-test="reservation-reserve.reservation_name-field--input"]',
      RESERVATION_NAME,
      2500
    );
    await fillDirect(
      page,
      'input[data-test="reservation-reserve.reserve_dates.start_date--date-input"]',
      START_DATE,
      2500
    );
    await fillDirect(
      page,
      'input[data-test="reservation-reserve.reserve_dates.end_date--date-input"]',
      END_DATE,
      2500
    );
  } catch {
    return false;
  }
  // Date picker popover can stay open and intercept Next clicks.
  await dismissDatePickerPopover(page).catch(() => null);
  await clickFirst(page, [
    'input[data-test="reservation-reserve.reservation_name-field--input"]',
    '[data-test="campaign-action-row"]',
    'body'
  ], 700).catch(() => null);
  await page.waitForTimeout(120);

  let movedToAdGroups = false;
  for (let attempt = 0; attempt < 3 && !movedToAdGroups; attempt += 1) {
    const nextAfterDetails = await clickFirst(
      page,
      ['button[data-test="campaign-action-row--next"]', 'button:has-text("Next")'],
      2500
    );
    if (!nextAfterDetails) break;
    await page.waitForTimeout(500);
    movedToAdGroups = await page
      .locator('[data-test="create-card--Ad Groups"], button:has-text("New Ad Groups"), [data-test="adgroup-button"]')
      .first()
      .isVisible()
      .catch(() => false);
  }

  return movedToAdGroups;
}

function shuffledIndices(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUiText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getConventionalAdGroupName(name, campaignType = DEFAULT_CAMPAIGN_TYPE) {
  const rawName = String(name || '').trim();
  if (!rawName) return rawName;

  const normalizedType = normalizeCampaignType(campaignType, DEFAULT_CAMPAIGN_TYPE);
  if (normalizedType === 'search') {
    const suffixNormalized = normalizeUiText(SEARCH_ROTATIONAL_NAME_SUFFIX);
    const rawNormalized = normalizeUiText(rawName);
    if (rawNormalized.endsWith(suffixNormalized) || /\bsearch\s+rotational\b/i.test(rawName)) return rawName;
    return `${rawName}${SEARCH_ROTATIONAL_NAME_SUFFIX}`;
  }

  if (normalizedType === 'trending') {
    const suffixNormalized = normalizeUiText(TRENDING_ROTATIONAL_NAME_SUFFIX);
    const rawNormalized = normalizeUiText(rawName);
    if (rawNormalized.endsWith(suffixNormalized) || /\btrending\s+rotational\b/i.test(rawName)) return rawName;
    return `${rawName}${TRENDING_ROTATIONAL_NAME_SUFFIX}`;
  }

  return rawName;
}

function isReservedTrendingKeywordValue(value) {
  const normalized = normalizeUiText(value);
  if (!normalized) return false;
  if (normalized.includes(RESERVED_TRENDING_KEYWORD_TOKEN)) return true;
  return DEFAULT_TRENDING_KEYWORDS.some((kw) => normalizeUiText(kw) === normalized);
}

function dedupeStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    if (!out.some((x) => normalizeUiText(x) === normalizeUiText(value))) out.push(value);
  }
  return out;
}

async function getTargetingGroup(page, targetGroupIndex = null) {
  const allGroups = page.locator('[data-test="targeting-group"]');
  const count = await allGroups.count().catch(() => 0);
  if (count === 0) return null;
  if (Number.isInteger(targetGroupIndex) && targetGroupIndex >= 0 && targetGroupIndex < count) {
    return allGroups.nth(targetGroupIndex);
  }
  return allGroups.nth(count - 1);
}

async function findNewestEmptyTargetingGroup(page) {
  const allGroups = page.locator('[data-test="targeting-group"]');
  const count = await allGroups.count().catch(() => 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const candidate = allGroups.nth(i);
    const trigger = candidate
      .locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button')
      .first();
    const triggerVisible = await trigger.isVisible().catch(() => false);
    if (!triggerVisible) continue;
    const txt = normalizeUiText(await trigger.innerText().catch(() => ''));
    if (!txt || txt.includes('select dimension')) {
      return { group: candidate, index: i };
    }
  }
  return null;
}

async function openPanelFromTrigger(page, trigger, timeoutMs = 2200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const visible = await trigger.isVisible().catch(() => false);
    if (!visible) return null;

    await trigger.scrollIntoViewIfNeeded().catch(() => null);
    await trigger.click({ force: true, timeout: 700 }).catch(() => null);

    const panelId = await trigger.getAttribute('aria-controls').catch(() => '');
    if (!panelId) {
      await page.waitForTimeout(70);
      continue;
    }
    const panel = page.locator(`[id="${panelId}"]`);
    const panelVisible = await panel.isVisible().catch(() => false);
    if (panelVisible) return panel;

    const waited = await panel.waitFor({ state: 'visible', timeout: 500 }).then(() => true).catch(() => false);
    if (waited) return panel;

    await page.waitForTimeout(70);
  }
  return null;
}

async function clickLabelInPanel(page, panel, label) {
  const exact = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'i');
  const contains = new RegExp(escapeRegExp(label), 'i');
  const normalizedLabel = normalizeUiText(label);
  const variants = [
    label,
    label.toLowerCase(),
    label.toLowerCase().replace(/\s+/g, '_')
  ];

  for (let attempt = 0; attempt < 7; attempt += 1) {
    await panel.locator('[role="option"], [data-value]').first().waitFor({ state: 'visible', timeout: 450 }).catch(() => null);

    for (const loc of [
      panel.getByRole('option', { name: exact }).first(),
      panel.getByRole('option', { name: contains }).first(),
      panel.locator(`[data-value="${variants[0]}"]`).first(),
      panel.locator(`[data-value="${variants[1]}"]`).first(),
      panel.locator(`[data-value="${variants[2]}"]`).first(),
      panel.getByText(exact).first()
    ]) {
      const visible = await loc.isVisible().catch(() => false);
      if (!visible) continue;
      const clicked = await loc.click({ force: true, timeout: 500 }).then(() => true).catch(() => false);
      if (clicked) return true;
    }

    for (const globalLoc of [
      page.getByRole('option', { name: exact }).first(),
      page.locator(`[data-value="${variants[0]}"]`).first(),
      page.locator(`[data-value="${variants[1]}"]`).first(),
      page.locator(`[data-value="${variants[2]}"]`).first()
    ]) {
      const visible = await globalLoc.isVisible().catch(() => false);
      if (!visible) continue;
      const clicked = await globalLoc.click({ force: true, timeout: 500 }).then(() => true).catch(() => false);
      if (clicked) return true;
    }

    await panel.evaluate((root) => {
      const scrollable = Array.from(root.querySelectorAll('*')).find(
        (el) => el.scrollHeight > el.clientHeight + 8
      );
      if (scrollable) {
        scrollable.scrollTop += 220;
      }
    }).catch(() => null);
    await page.waitForTimeout(110);
  }

  return panel.evaluate((root, needle) => {
    const normalizeText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const candidates = Array.from(
      root.querySelectorAll('[role="option"], [data-value], button, div')
    );
    for (const el of candidates) {
      const txt = normalizeText(el.textContent || '');
      if (!txt || txt !== needle) continue;
      if (typeof el.click === 'function') {
        el.click();
        return true;
      }
    }
    return false;
  }, normalizedLabel).catch(() => false);
}

async function waitForAttributeChoices(panel, timeoutMs = 2400) {
  const startedAt = Date.now();
  const checkboxLocator = panel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"]');
  while (Date.now() - startedAt < timeoutMs) {
    const count = await checkboxLocator.count().catch(() => 0);
    if (count > 0) return true;
    await new Promise((r) => setTimeout(r, 90));
  }
  return false;
}

async function setExactAttributeSelections(page, panel, values = [], opts = {}) {
  const cleanValues = dedupeStrings(values);
  const normalizedTargets = cleanValues.map((v) => normalizeUiText(v));
  if (normalizedTargets.length === 0) {
    return { ok: true, unmatched: [], matchedCount: 0, checkedCount: 0 };
  }

  const searchInput = panel.locator('input[placeholder*="Search"]').first();
  const hasSearch = await searchInput.isVisible().catch(() => false);
  if (hasSearch) {
    await searchInput.fill('').catch(() => {});
  }

  // First clear all checked values so only the requested values remain selected.
  for (let pass = 0; pass < 4; pass += 1) {
    const checked = panel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"][aria-checked="true"]');
    const checkedCount = await checked.count().catch(() => 0);
    if (checkedCount === 0) break;
    for (let i = 0; i < checkedCount; i += 1) {
      await checked.first().click({ force: true, timeout: 280 }).catch(() => {});
    }
    await page.waitForTimeout(30);
  }

  const maxAttemptsPerValue = Number.isFinite(opts.maxAttemptsPerValue) ? Math.max(1, Math.floor(opts.maxAttemptsPerValue)) : 6;
  const retryDelayMs = Number.isFinite(opts.retryDelayMs) ? Math.max(30, Math.floor(opts.retryDelayMs)) : 120;

  const unmatched = [];
  for (let valueIndex = 0; valueIndex < normalizedTargets.length; valueIndex += 1) {
    const rawValue = cleanValues[valueIndex];
    const value = normalizedTargets[valueIndex];
    let matched = false;
    for (let attempt = 0; attempt < maxAttemptsPerValue && !matched; attempt += 1) {
      if (hasSearch) {
        await searchInput.fill('').catch(() => {});
        await searchInput.fill(rawValue).catch(() => {});
        await page.waitForTimeout(55);
      }
      matched = await panel.evaluate((root, needleValue) => {
        const normalizeText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const canonicalText = (s) => normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim();
        const matchesTarget = (rowText, target) => {
          if (!rowText || !target) return false;
          if (rowText === target) return true;
          const canonicalRow = canonicalText(rowText);
          const canonicalTarget = canonicalText(target);
          if (!canonicalRow || !canonicalTarget) return false;
          if (canonicalRow === canonicalTarget) return true;
          return false;
        };
        const containers = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"]'));
        for (const container of containers) {
          const button = container.querySelector('button[role="checkbox"]');
          if (!button) continue;
          const parent = container.parentElement;
          const labelNode = container.nextElementSibling
            || Array.from(parent?.children || []).find((el) => el !== container)
            || parent?.querySelector?.('div.line-clamp-2')
            || parent;
          const rowText = normalizeText(labelNode?.textContent || '');
          if (!matchesTarget(rowText, needleValue)) continue;

          const isChecked = button.getAttribute('aria-checked') === 'true';
          if (!isChecked) {
            button.click();
          }
          return button.getAttribute('aria-checked') === 'true';
        }
        return false;
      }, value).catch(() => false);

      if (matched) break;
      await page.mouse.wheel(0, 420).catch(() => {});
      await page.waitForTimeout(retryDelayMs);
    }
    if (hasSearch) {
      await searchInput.fill('').catch(() => {});
    }
    if (!matched) unmatched.push(value);
  }

  const enforceResult = await panel.evaluate((root, targets) => {
    const normalizeText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const canonicalText = (s) => normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim();
    const matchesTarget = (rowText, target) => {
      if (!rowText || !target) return false;
      if (rowText === target) return true;
      const canonicalRow = canonicalText(rowText);
      const canonicalTarget = canonicalText(target);
      if (!canonicalRow || !canonicalTarget) return false;
      if (canonicalRow === canonicalTarget) return true;
      return false;
    };
    const containers = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"]'));
    let checkedCount = 0;
    let matchedCount = 0;
    for (const container of containers) {
      const button = container.querySelector('button[role="checkbox"]');
      if (!button) continue;
      const parent = container.parentElement;
      const labelNode = container.nextElementSibling
        || Array.from(parent?.children || []).find((el) => el !== container)
        || parent?.querySelector?.('div.line-clamp-2')
        || parent;
      const rowText = normalizeText(labelNode?.textContent || '');
      const shouldBeChecked = targets.some((t) => matchesTarget(rowText, t));

      let isChecked = button.getAttribute('aria-checked') === 'true';
      if (isChecked !== shouldBeChecked) {
        button.click();
        isChecked = button.getAttribute('aria-checked') === 'true';
      }
      if (isChecked) checkedCount += 1;
      if (shouldBeChecked && isChecked) matchedCount += 1;
    }
    return { checkedCount, matchedCount };
  }, normalizedTargets).catch(() => ({ checkedCount: 0, matchedCount: 0 }));

  if (hasSearch) {
    await searchInput.fill('').catch(() => {});
  }

  const ok = unmatched.length === 0
    && enforceResult.matchedCount === normalizedTargets.length
    && enforceResult.checkedCount === normalizedTargets.length;

  return {
    ok,
    unmatched,
    matchedCount: enforceResult.matchedCount,
    checkedCount: enforceResult.checkedCount
  };
}

async function setAllAttributeSelections(page, panel) {
  const searchInput = panel.locator('input[placeholder*="Search"]').first();
  const hasSearch = await searchInput.isVisible().catch(() => false);
  if (hasSearch) {
    await searchInput.fill('').catch(() => {});
  }

  let stablePasses = 0;
  let previousCheckedCount = -1;
  for (let pass = 0; pass < 18 && stablePasses < 3; pass += 1) {
    const result = await panel.evaluate((root) => {
      const containers = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"]'));
      let changed = 0;
      let checkedCount = 0;
      for (const container of containers) {
        const button = container.querySelector('button[role="checkbox"]');
        if (!button) continue;
        let isChecked = button.getAttribute('aria-checked') === 'true';
        if (!isChecked) {
          button.click();
          isChecked = button.getAttribute('aria-checked') === 'true';
          if (isChecked) changed += 1;
        }
        if (isChecked) checkedCount += 1;
      }

      const scrollable = Array.from(root.querySelectorAll('*')).find(
        (el) => el.scrollHeight > el.clientHeight + 8
      );
      if (scrollable) {
        const nearBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 6;
        scrollable.scrollTop = nearBottom
          ? 0
          : (scrollable.scrollTop + Math.max(220, Math.floor(scrollable.clientHeight * 0.8)));
      }

      return { changed, checkedCount };
    }).catch(() => ({ changed: 0, checkedCount: 0 }));

    if (result.checkedCount === previousCheckedCount && result.changed === 0) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
    }
    previousCheckedCount = result.checkedCount;
    await page.waitForTimeout(110);
  }

  const finalState = await panel.evaluate((root) => {
    const checkboxes = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"] button[role="checkbox"]'));
    const checkedCount = checkboxes.filter((cb) => cb.getAttribute('aria-checked') === 'true').length;
    return { checkedCount, total: checkboxes.length };
  }).catch(() => ({ checkedCount: 0, total: 0 }));

  return { ok: finalState.checkedCount > 0, checkedCount: finalState.checkedCount, total: finalState.total };
}

async function selectOnlyFirstAttributeOption(page, panel) {
  for (let pass = 0; pass < 3; pass += 1) {
    const checked = panel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"][aria-checked="true"]');
    const checkedCount = await checked.count().catch(() => 0);
    if (checkedCount === 0) break;
    for (let i = 0; i < checkedCount; i += 1) {
      await checked.first().click({ force: true, timeout: 240 }).catch(() => {});
    }
    await page.waitForTimeout(20);
  }

  const first = panel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"]').first();
  const visible = await first.isVisible().catch(() => false);
  if (!visible) return false;

  const wasChecked = (await first.getAttribute('aria-checked').catch(() => 'false')) === 'true';
  if (!wasChecked) {
    await first.click({ force: true, timeout: 400 }).catch(() => {});
  }
  const nowChecked = (await first.getAttribute('aria-checked').catch(() => 'false')) === 'true';
  if (!nowChecked) return false;

  const allChecked = panel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"][aria-checked="true"]');
  const checkedCount = await allChecked.count().catch(() => 0);
  return checkedCount === 1;
}

async function setKeywords(page, targetCount = 20, requestedKeywords = [], opts = {}) {
  const startedAt = Date.now();
  const maxMs = 8000;
  const targetGroupIndex = Number.isInteger(opts.targetGroupIndex) ? opts.targetGroupIndex : 0;
  const adgroupNum = Number.isInteger(opts.adgroupNum) ? opts.adgroupNum : null;

  await dismissDatePickerPopover(page, adgroupNum);

  const activeGroup = await getTargetingGroup(page, targetGroupIndex);
  if (!activeGroup) return false;

  const dimensionTrigger = activeGroup.locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button').first();
  const dimensionVisible = await dimensionTrigger.isVisible().catch(() => false);
  if (!dimensionVisible) return false;

  const dimensionText = normalizeUiText(await dimensionTrigger.innerText().catch(() => ''));
  if (!dimensionText.includes('search_query')) {
    const dimensionPanel = await openPanelFromTrigger(page, dimensionTrigger, 2200);
    if (!dimensionPanel) return false;
    const selectedSearchDimension = await clickLabelInPanel(page, dimensionPanel, 'search_query');
    if (!selectedSearchDimension) return false;
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(80);

  const attributeTrigger = activeGroup.locator('[data-testid="attribute-select--trigger--button"], [data-testid="attribute-select--trigger"] button').first();
  const attributeVisible = await attributeTrigger.isVisible().catch(() => false);
  if (!attributeVisible) return false;

  const attributePanel = await openPanelFromTrigger(page, attributeTrigger, 2200);
  if (!attributePanel) return false;
  const panelReady = await waitForAttributeChoices(attributePanel, 2200);
  if (!panelReady) return false;

  const searchInput = attributePanel.locator('input[placeholder*="Search"]').first();
  const hasSearch = await searchInput.isVisible().catch(() => false);
  if (hasSearch) {
    await searchInput.fill('').catch(() => {});
  }

  for (let pass = 0; pass < 3; pass += 1) {
    const checked = attributePanel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"][aria-checked="true"]');
    const checkedCount = await checked.count().catch(() => 0);
    if (checkedCount === 0) break;
    for (let i = 0; i < checkedCount; i += 1) {
      await checked.first().click({ force: true, timeout: 250 }).catch(() => {});
    }
    await page.waitForTimeout(25);
  }

  const desiredKeywords = dedupeStrings(requestedKeywords).slice(0, targetCount);

  if (desiredKeywords.length > 0) {
    const exactSelection = await setExactAttributeSelections(page, attributePanel, desiredKeywords, {
      maxAttemptsPerValue: 8,
      retryDelayMs: 120
    });

    if (hasSearch) {
      await searchInput.fill('').catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    if (DEBUG_KEYWORD_FAILURES && !exactSelection.ok) {
      const unmatched = exactSelection.unmatched || [];
      const details = unmatched.length
        ? `unmatched keywords: ${unmatched.join(', ')}`
        : `matched=${exactSelection.matchedCount}, checked=${exactSelection.checkedCount}, expected=${desiredKeywords.length}`;
      console.warn(`Requested keywords were not set exactly for this group (${details})`);
    }
    return exactSelection.ok;
  }

  let totalChecked = 0;
  for (let pass = 0; pass < 3 && totalChecked < targetCount; pass += 1) {
    if (Date.now() - startedAt > maxMs) break;
    const checkboxes = attributePanel.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"]');
    const count = await checkboxes.count().catch(() => 0);
    if (count === 0) break;

    const order = shuffledIndices(Math.min(count, 40));
    for (const i of order) {
      const cb = checkboxes.nth(i);
      const optionLabel = await cb
        .locator('xpath=ancestor::*[@data-testid="attribute-select--checkbox"]/following-sibling::*[1]')
        .innerText()
        .catch(() => '');
      if (isReservedTrendingKeywordValue(optionLabel)) {
        continue;
      }
      const isChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (isChecked) continue;
      await cb.click({ force: true, timeout: 250 }).catch(() => {});
      const nowChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (nowChecked) totalChecked += 1;
      if (Date.now() - startedAt > maxMs) break;
      if (totalChecked >= targetCount) break;
    }

    if (totalChecked < targetCount && pass < 2) {
      await page.mouse.wheel(0, 700).catch(() => {});
      await page.waitForTimeout(40);
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  return totalChecked > 0;
}

async function getKeywordSelectionCount(page, targetGroupIndex = 0) {
  const activeGroup = await getTargetingGroup(page, targetGroupIndex);
  if (!activeGroup) return 0;
  const trigger = activeGroup
    .locator('[data-testid="attribute-select--trigger--button"], [data-testid="attribute-select--trigger"] button')
    .first();
  const txt = (await trigger.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const m = txt.match(/\+(\d+)\s+selected/i);
  return m ? Number(m[1]) : 0;
}

async function verifyExactSelectedKeywords(page, requestedKeywords = [], opts = {}) {
  const targetGroupIndex = Number.isInteger(opts.targetGroupIndex) ? opts.targetGroupIndex : 0;
  const adgroupNum = Number.isInteger(opts.adgroupNum) ? opts.adgroupNum : null;
  const expected = dedupeStrings(requestedKeywords).map((v) => normalizeUiText(v));
  if (expected.length === 0) return { ok: true, missing: [], extras: [], selected: [] };

  await dismissDatePickerPopover(page, adgroupNum);
  const activeGroup = await getTargetingGroup(page, targetGroupIndex);
  if (!activeGroup) return { ok: false, missing: [...expected], extras: [], selected: [] };

  const attributeTrigger = activeGroup
    .locator('[data-testid="attribute-select--trigger--button"], [data-testid="attribute-select--trigger"] button')
    .first();
  const triggerVisible = await attributeTrigger.isVisible().catch(() => false);
  if (!triggerVisible) return { ok: false, missing: [...expected], extras: [], selected: [] };

  const panel = await openPanelFromTrigger(page, attributeTrigger, 2200);
  if (!panel) return { ok: false, missing: [...expected], extras: [], selected: [] };
  const panelReady = await waitForAttributeChoices(panel, 2200);
  if (!panelReady) return { ok: false, missing: [...expected], extras: [], selected: [] };

  const searchInput = panel.locator('input[placeholder*="Search"]').first();
  const hasSearch = await searchInput.isVisible().catch(() => false);
  const missing = [];
  const selected = [];

  for (const value of expected) {
    if (hasSearch) {
      await searchInput.fill('').catch(() => {});
      await searchInput.fill(value).catch(() => {});
      await page.waitForTimeout(65);
    }
    const status = await panel.evaluate((root, needleValue) => {
      const normalizeText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const canonicalText = (s) => normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim();
      const target = canonicalText(needleValue);
      const containers = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"]'));
      for (const container of containers) {
        const button = container.querySelector('button[role="checkbox"]');
        if (!button) continue;
        const parent = container.parentElement;
        const labelNode = container.nextElementSibling
          || Array.from(parent?.children || []).find((el) => el !== container)
          || parent?.querySelector?.('div.line-clamp-2')
          || parent;
        const rowText = normalizeText(labelNode?.textContent || '');
        const rowCanonical = canonicalText(rowText.replace(/^keyword\s*:\s*/i, ''));
        if (rowCanonical !== target) continue;
        return {
          found: true,
          checked: button.getAttribute('aria-checked') === 'true'
        };
      }
      return { found: false, checked: false };
    }, value).catch(() => ({ found: false, checked: false }));
    if (status.found && status.checked) {
      selected.push(value);
    } else {
      missing.push(value);
    }
  }

  if (hasSearch) {
    await searchInput.fill('').catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  const selectedCount = await getKeywordSelectionCount(page, targetGroupIndex);
  const extras = selectedCount > expected.length ? [`count+${selectedCount - expected.length}`] : [];
  const ok = missing.length === 0 && selectedCount === expected.length;
  return { ok, missing, extras, selected };
}

async function setKeywordsWithRetry(page, targetCount = 20, attempts = 3, requestedKeywords = [], opts = {}) {
  const targetGroupIndex = Number.isInteger(opts.targetGroupIndex) ? opts.targetGroupIndex : 0;
  const adgroupNum = Number.isInteger(opts.adgroupNum) ? opts.adgroupNum : null;
  const expectedKeywords = dedupeStrings(requestedKeywords).slice(0, targetCount);
  const expectedSelectionCount = expectedKeywords.length;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ok = await setKeywords(page, targetCount, expectedKeywords, { targetGroupIndex, adgroupNum });
    const selectedCount = await getKeywordSelectionCount(page, targetGroupIndex);
    if (expectedSelectionCount > 0) {
      // Fast path: when Koddi reports the exact requested count selected, move on.
      if (selectedCount === expectedSelectionCount) return true;
      const exact = await verifyExactSelectedKeywords(
        page,
        expectedKeywords,
        { targetGroupIndex, adgroupNum }
      );
      if (exact.ok) return true;
      if (DEBUG_KEYWORD_FAILURES) {
        const missingTxt = exact.missing.length ? exact.missing.join(', ') : '(none)';
        const extrasTxt = exact.extras.length ? exact.extras.join(', ') : '(none)';
        console.warn(
          `Exact keyword verification mismatch on attempt ${attempt} for target group ${targetGroupIndex + 1}; `
          + `selected_count=${selectedCount}, missing=${missingTxt}, extras=${extrasTxt}`
        );
      }
    }
    if (ok && expectedSelectionCount === 0 && selectedCount > 0) return true;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(140);
  }
  return false;
}

async function setAdditionalDimensionValues(page, dimensionName, values = [], opts = {}) {
  const cleanValues = dedupeStrings(values);
  const normalizedDimName = normalizeUiText(dimensionName);
  const supportsSelectAll = normalizedDimName === 'ad context' || normalizedDimName === 'ono view type';
  const selectAllRequested = supportsSelectAll && (
    cleanValues.length === 0
    || cleanValues.some((v) => {
      const normalized = normalizeUiText(v);
      return normalized === '*' || normalized === 'all';
    })
  );
  if (cleanValues.length === 0 && !selectAllRequested) return true;

  const requestedGroupIndex = Number.isInteger(opts.targetGroupIndex) ? opts.targetGroupIndex : null;
  const adgroupNum = Number.isInteger(opts.adgroupNum) ? opts.adgroupNum : null;
  await dismissDatePickerPopover(page, adgroupNum);
  let activeGroup = await getTargetingGroup(page, requestedGroupIndex);
  if (!activeGroup) return false;

  const addDimensionWithinGroup = opts.addDimensionWithinGroup !== false;
  if (addDimensionWithinGroup) {
    const addDimensionButton = activeGroup
      .locator('[data-testid="add-dimension-btn--button"], [data-test="add-dimension-btn"], button:has-text("Add dimension within group")')
      .first();
    const added = await addDimensionButton.click({ force: true, timeout: 1200 }).then(() => true).catch(() => false);
    if (!added) return false;
  }

  const dimensionAliases = {
    'Ad type': ['Ad type', 'ad type', 'ad_type'],
    Country: ['Country', 'country'],
    Position: ['Position', 'position'],
    'Ad Context': ['Ad Context', 'ad context', 'ad_context'],
    'OnO View Type': ['OnO View Type', 'OnO view type', 'OnO View type', 'ono view type', 'ono_view_type', 'onoviewtype']
  };
  const labels = dimensionAliases[dimensionName] || [dimensionName];

  const dimensionTrigger = activeGroup
    .locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button')
    .first();
  if (requestedGroupIndex != null) {
    const currentText = normalizeUiText(await dimensionTrigger.innerText().catch(() => ''));
    if (currentText && !currentText.includes('select dimension')) {
      const emptyGroup = await findNewestEmptyTargetingGroup(page);
      if (emptyGroup?.group) {
        activeGroup = emptyGroup.group;
      }
    }
  }
  const resolvedDimensionTrigger = activeGroup
    .locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button')
    .first();
  const triggerVisible = await resolvedDimensionTrigger.isVisible().catch(() => false);
  if (!triggerVisible) {
    console.warn(`Could not find dimension trigger for ${dimensionName} (group index ${requestedGroupIndex ?? 'last'}).`);
    return false;
  }

  const dimensionPanel = await openPanelFromTrigger(page, resolvedDimensionTrigger, 2200);
  if (!dimensionPanel) {
    console.warn(`Could not open dimension dropdown for ${dimensionName} (group index ${requestedGroupIndex ?? 'last'}).`);
    return false;
  }

  let pickedDimension = false;
  for (let attempt = 0; attempt < 2 && !pickedDimension; attempt += 1) {
    if (attempt > 0) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(120);
      const reopenedPanel = await openPanelFromTrigger(page, resolvedDimensionTrigger, 2200);
      if (!reopenedPanel) break;
      for (const label of labels) {
        pickedDimension = await clickLabelInPanel(page, reopenedPanel, label);
        if (pickedDimension) break;
      }
      continue;
    }
    for (const label of labels) {
      pickedDimension = await clickLabelInPanel(page, dimensionPanel, label);
      if (pickedDimension) break;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(60);

  const dimText = normalizeUiText(await resolvedDimensionTrigger.innerText().catch(() => ''));
  const dimensionApplied = labels.some((label) => {
    const normalizedLabel = normalizeUiText(label).replace('_', ' ');
    return dimText === normalizedLabel || dimText.includes(normalizedLabel);
  });
  if (!pickedDimension && !dimensionApplied) {
    console.warn(`Failed to apply dimension ${dimensionName}; current dimension trigger text was "${dimText}".`);
    return false;
  }

  const attributeLoadDelayMs = normalizedDimName === 'country'
    ? ATTRIBUTE_LOAD_WAIT_MS
    : 260;
  if (attributeLoadDelayMs > 0) {
    await page.waitForTimeout(attributeLoadDelayMs);
  }

  const attributeTrigger = activeGroup
    .locator('[data-testid="attribute-select--trigger--button"], [data-testid="attribute-select--trigger"] button')
    .first();
  const attributeVisible = await attributeTrigger.isVisible().catch(() => false);
  if (!attributeVisible) {
    console.warn(`Could not find attribute trigger for ${dimensionName} (group index ${requestedGroupIndex ?? 'last'}).`);
    return false;
  }

  let attributePanel = await openPanelFromTrigger(page, attributeTrigger, 2200);
  if (!attributePanel) {
    console.warn(`Could not open attribute dropdown for ${dimensionName} (group index ${requestedGroupIndex ?? 'last'}).`);
    return false;
  }

  let panelReady = await waitForAttributeChoices(attributePanel, 2200);
  if (!panelReady) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(220);
    attributePanel = await openPanelFromTrigger(page, attributeTrigger, 2200);
    if (!attributePanel) {
      console.warn(`Could not reopen attribute dropdown for ${dimensionName}.`);
      return false;
    }
    panelReady = await waitForAttributeChoices(attributePanel, 2200);
    if (!panelReady) {
      console.warn(`No attribute checkbox options loaded for ${dimensionName}.`);
      return false;
    }
  }

  let selection = selectAllRequested
    ? await setAllAttributeSelections(page, attributePanel)
    : await setExactAttributeSelections(page, attributePanel, cleanValues, {
      maxAttemptsPerValue: normalizedDimName === 'country' ? 10 : 6,
      retryDelayMs: normalizedDimName === 'country' ? 150 : 100
    });

  if (!selection.ok && normalizedDimName === 'ad type') {
    const fallbackPicked = await selectOnlyFirstAttributeOption(page, attributePanel);
    if (fallbackPicked) {
      console.warn(`Ad type value match failed; used first available ad type option as fallback.`);
      selection = { ok: true, unmatched: [], matchedCount: 1, checkedCount: 1 };
    }
  }

  const checkedAttributeLabels = await attributePanel.evaluate((root) => {
    const normalizeText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const labels = [];
    const containers = Array.from(root.querySelectorAll('[data-testid="attribute-select--checkbox"]'));
    for (const container of containers) {
      const button = container.querySelector('button[role="checkbox"]');
      if (!button) continue;
      const isChecked = button.getAttribute('aria-checked') === 'true';
      if (!isChecked) continue;

      const parent = container.parentElement;
      const siblingText = normalizeText(
        Array.from(parent?.children || [])
          .filter((el) => el !== container)
          .map((el) => el.textContent || '')
          .join(' ')
      );
      const rowText = siblingText || normalizeText(parent?.textContent || '');
      if (rowText) labels.push(rowText);
    }
    return labels;
  }).catch(() => []);

  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  const triggerText = (await attributeTrigger.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const triggerMatch = triggerText.match(/\+(\d+)\s+selected/i);
  const triggerSelectedCount = triggerMatch ? Number(triggerMatch[1]) : null;

  if (Array.isArray(selection.unmatched) && selection.unmatched.length > 0) {
    console.warn(`Unmatched ${dimensionName} values: ${selection.unmatched.join(', ')}`);
  }

  if (!selection.ok && normalizedDimName === 'country') {
    const matchesRequestedValue = (rowText, targetValue) => {
      const row = normalizeUiText(rowText);
      const target = normalizeUiText(targetValue);
      if (!row || !target) return false;
      if (row === target) return true;
      if (` ${row} `.includes(` ${target} `)) return true;
      const canonicalRow = row.replace(/[^a-z0-9]+/g, ' ').trim();
      const canonicalTarget = target.replace(/[^a-z0-9]+/g, ' ').trim();
      if (!canonicalRow || !canonicalTarget) return false;
      if (canonicalRow === canonicalTarget) return true;
      return ` ${canonicalRow} `.includes(` ${canonicalTarget} `);
    };
    const checkedLabelsMatchRequested = checkedAttributeLabels.length === cleanValues.length
      && cleanValues.every((targetValue) => checkedAttributeLabels.some((rowText) => matchesRequestedValue(rowText, targetValue)));
    const countLooksRight = triggerSelectedCount == null || triggerSelectedCount === cleanValues.length;
    if (checkedLabelsMatchRequested && countLooksRight) {
      console.warn(`Country targeting verified via checked labels fallback; continuing despite strict selection mismatch.`);
      selection = {
        ok: true,
        unmatched: [],
        matchedCount: cleanValues.length,
        checkedCount: cleanValues.length
      };
    }
    if (!selection.ok && triggerSelectedCount != null && triggerSelectedCount === cleanValues.length && cleanValues.length > 0) {
      console.warn(`Country targeting fallback: trigger count matched expected selections (${triggerSelectedCount}); continuing.`);
      selection = {
        ok: true,
        unmatched: [],
        matchedCount: cleanValues.length,
        checkedCount: cleanValues.length
      };
    }
  }

  if (selectAllRequested) {
    return selection.ok && (triggerSelectedCount == null || triggerSelectedCount >= 1);
  }
  return selection.ok && (triggerSelectedCount == null || triggerSelectedCount === cleanValues.length);
}

async function addNewTargetingGroup(page) {
  const groups = page.locator('[data-test="targeting-group"]');
  let beforeCount = await groups.count().catch(() => 0);
  if (beforeCount === 0) {
    for (let i = 0; i < 10; i += 1) {
      await page.waitForTimeout(80);
      beforeCount = await groups.count().catch(() => 0);
      if (beforeCount > 0) break;
    }
  }

  let added = false;
  const addBtn = page
    .locator('[data-testid="add-group-btn--button"]:visible, [data-test="add-group-btn"]:visible, button:has-text("Add new group"):visible')
    .last();
  const addBtnVisible = await addBtn.isVisible().catch(() => false);
  if (addBtnVisible) {
    added = await addBtn.click({ timeout: 1200, force: true }).then(() => true).catch(() => false);
  }
  if (!added) {
    added = await clickFirst(page, [
      '[data-testid="add-group-btn--button"]',
      '[data-test="add-group-btn"]',
      'button:has-text("Add new group")'
    ], 1500);
  }
  if (!added) return false;

  for (let i = 0; i < 16; i += 1) {
    const afterCount = await groups.count().catch(() => 0);
    if (afterCount > beforeCount) {
      return { ok: true, index: afterCount - 1 };
    }
    await page.waitForTimeout(90);
  }
  return { ok: false, index: -1 };
}

async function removeOrphanedEmptyTargetingGroups(page, maxRemovals = 3) {
  let removed = 0;
  for (let pass = 0; pass < maxRemovals; pass += 1) {
    const groups = page.locator('[data-test="targeting-group"]');
    const count = await groups.count().catch(() => 0);
    if (count === 0) break;

    let removedThisPass = false;
    for (let i = count - 1; i >= 0; i -= 1) {
      const group = groups.nth(i);
      await group.scrollIntoViewIfNeeded().catch(() => null);
      const trigger = group
        .locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button')
        .first();
      const triggerText = normalizeUiText(
        (await trigger.textContent().catch(() => '')) || (await trigger.innerText().catch(() => ''))
      );
      if (triggerText && !triggerText.includes('select dimension')) continue;

      const removedViaClick = await group.evaluate((root) => {
        const btn = root.querySelector('[data-testid="remove-group-btn--button"], [data-test="remove-group-btn"], button[aria-label="Remove group"]');
        if (!btn) return false;
        if (typeof btn.click === 'function') {
          btn.click();
          return true;
        }
        return false;
      }).catch(() => false);
      if (!removedViaClick) continue;

      await page.waitForTimeout(120);
      removed += 1;
      removedThisPass = true;
      break;
    }

    if (!removedThisPass) break;
  }
  return removed;
}

async function resetTargetingGroupsForAdGroup(page) {
  const groups = page.locator('[data-test="targeting-group"]');

  for (let pass = 0; pass < 8; pass += 1) {
    const count = await groups.count().catch(() => 0);
    if (count <= 1) break;
    const lastGroup = groups.nth(count - 1);
    await lastGroup.scrollIntoViewIfNeeded().catch(() => null);
    const removed = await lastGroup.evaluate((root) => {
      const btn = root.querySelector('[data-testid="remove-group-btn--button"], [data-test="remove-group-btn"], button[aria-label="Remove group"]');
      if (!btn) return false;
      if (typeof btn.click === 'function') {
        btn.click();
        return true;
      }
      return false;
    }).catch(() => false);
    if (!removed) break;
    await page.waitForTimeout(150);
  }

  const remainingCount = await groups.count().catch(() => 0);
  if (remainingCount === 0) return false;

  const firstGroup = groups.first();
  for (let pass = 0; pass < 4; pass += 1) {
    const removeDimButtons = firstGroup.locator('[data-testid="remove-dimension-btn--button"], [data-test="remove-dimension-btn"], button[aria-label="Remove dimension"]');
    const dimRemoveCount = await removeDimButtons.count().catch(() => 0);
    if (dimRemoveCount <= 1) break;
    await removeDimButtons.last().click({ force: true, timeout: 700 }).catch(() => null);
    await page.waitForTimeout(90);
  }

  // Some UI states carry over selected attributes (for example "+22 selected")
  // even when only one dimension row remains. Keep removing that row until the
  // first row is reset to an empty "Select dimension" state.
  for (let pass = 0; pass < 5; pass += 1) {
    const trigger = firstGroup
      .locator('[data-testid="dimension-select--trigger--button"], [data-testid="dimension-select--trigger"] button')
      .first();
    const triggerText = normalizeUiText(
      (await trigger.textContent().catch(() => '')) || (await trigger.innerText().catch(() => ''))
    );
    if (triggerText.includes('select dimension')) {
      return true;
    }

    const removeSingleDim = firstGroup
      .locator('[data-testid="remove-dimension-btn--button"], [data-test="remove-dimension-btn"], button[aria-label="Remove dimension"]')
      .first();
    const canRemove = await removeSingleDim.isVisible().catch(() => false);
    if (!canRemove) break;
    await removeSingleDim.click({ force: true, timeout: 700 }).catch(() => null);
    await page.waitForTimeout(120);
  }

  return true;
}

async function readVisibleToastTexts(page) {
  const selectors = [
    '[role="alert"]',
    '[data-status="error"]',
    '[data-status="success"]',
    '[class*="toast"]',
    '.chakra-alert'
  ];
  const texts = new Set();
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = loc.nth(i);
      const visible = await item.isVisible().catch(() => false);
      if (!visible) continue;
      const t = (await item.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
      if (t) texts.add(t);
    }
  }
  return Array.from(texts);
}

function classifySubmitMessage(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (/(error|failed|could not|unable|invalid|required|try again|please select)/i.test(t)) return 'error';
  if (/(success|submitted|created|saved|complete|completed)/i.test(t)) return 'success';
  return null;
}

async function clickSubmitAndVerify(page) {
  const submitBtn = page.locator('button:has-text("Submit")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
  await submitBtn.click({ force: true });

  const startedAt = Date.now();
  const timeoutMs = 15000;
  const observedMessages = [];
  let sawErrorToast = false;

  while (Date.now() - startedAt < timeoutMs) {
    const successModalVisible = await page.locator('[data-test="success--modal"]').first().isVisible().catch(() => false);
    if (successModalVisible) {
      await clickFirst(page, [
        'button[data-test="success--modal--footer_exit"]',
        'button:has-text("Continue")'
      ], 2500).catch(() => null);
      await page.waitForTimeout(250);
      return { ok: true, reason: 'success-modal', observedMessages };
    }

    const url = page.url();
    const onReserveWizard = /\/reservations\/reserve/i.test(url);
    const hasCreateButton = await page.locator('button[data-test="add-reservation"]').first().isVisible().catch(() => false);
    if (!onReserveWizard || hasCreateButton) {
      return { ok: true, reason: 'navigation-changed', observedMessages };
    }

    const msgs = await readVisibleToastTexts(page);
    for (const msg of msgs) {
      if (!observedMessages.includes(msg)) observedMessages.push(msg);
      const kind = classifySubmitMessage(msg);
      if (kind === 'error') {
        sawErrorToast = true;
      }
      if (kind === 'success') {
        return { ok: true, reason: 'success-toast', observedMessages };
      }
    }

    const stillHasSubmit = await submitBtn.isVisible().catch(() => false);
    if (sawErrorToast && stillHasSubmit && Date.now() - startedAt > 1500) {
      return { ok: false, reason: 'error-toast', observedMessages };
    }
    if (!stillHasSubmit) {
      return { ok: true, reason: 'submit-button-gone', observedMessages };
    }

    await page.waitForTimeout(120);
  }

  if (sawErrorToast) {
    return { ok: false, reason: 'error-toast', observedMessages };
  }
  return { ok: false, reason: 'submit-timeout', observedMessages };
}

async function createOneAdGroup(page, group, idx) {
  const label = `adgroup-${idx + 1}`;
  const adgroupNum = idx + 1;
  const startedAt = Date.now();
  const resolvedCampaignType = normalizeCampaignType(group.campaignType, DEFAULT_CAMPAIGN_TYPE);
  const adGroupNameForUi = getConventionalAdGroupName(group.name, resolvedCampaignType);
  console.log(`Creating ${label}: ${group.name}`);
  if (adGroupNameForUi !== group.name) {
    console.log(`Applying naming convention for ${group.name} -> ${adGroupNameForUi}`);
  }

  const openCreate = await clickFirst(page, [
    '[data-test="create-card--Ad Groups"]',
    'button:has-text("New Ad Groups")',
    '[data-test="adgroup-button"]'
  ], 8000);

  if (!openCreate) {
    await captureDiagnostics(page, `${label}-open-create-failed`);
    throw new Error(`Could not open new ad group for ${group.name}`);
  }
  const targetingReset = await resetTargetingGroupsForAdGroup(page);
  if (!targetingReset) {
    await captureDiagnostics(page, `${label}-targeting-reset-failed`);
    throw new Error(`Could not reset targeting groups for ${group.name}`);
  }

  const nameSet = await setAdGroupNameStrict(page, adgroupNum, adGroupNameForUi);
  if (!nameSet) {
    await captureDiagnostics(page, `${label}-name-fill-failed`);
    throw new Error(`Could not fill ad group name for ${group.name}`);
  }

  const impsSel = await fillFirst(page, [
    `input[data-test="adgroup.${adgroupNum}.reservation_reserved_imps-field--input"]`,
    `input[name="adgroup.${adgroupNum}.reservation_reserved_imps"]`,
    'input[data-test$=".reservation_reserved_imps-field--input"]',
    '[data-test$=".reservation_reserved_imps-field--input"] input'
  ], group.reservedImpressions ?? RESERVED_IMPS_PER_GROUP, 1800);

  if (!impsSel) {
    await captureDiagnostics(page, `${label}-imps-fill-failed`);
    throw new Error(`Could not fill reserved impressions for ${group.name}`);
  }

  const cpmValue = toNonNegativeNumber(group.cpm, CPM_PER_GROUP);
  if (group.addedValueGroup && cpmValue === ADDED_VALUE_MIN_CPM) {
    console.log(`Added Value (AV) group detected for ${group.name}; using CPM ${ADDED_VALUE_MIN_CPM}.`);
  }
  const cpmSel = await fillNumericFirst(page, [
    `input[data-test="adgroup.${adgroupNum}.reservation_cpm-field--input"]`,
    `input[name="adgroup.${adgroupNum}.reservation_cpm"]`,
    'input[data-test$=".reservation_cpm-field--input"]',
    '[data-test$=".reservation_cpm-field--input"] input'
  ], cpmValue, 2200);
  if (!cpmSel) {
    await captureDiagnostics(page, `${label}-cpm-fill-failed`);
    throw new Error(`Could not fill CPM for ${group.name}`);
  }

  const clickUrl = String(group.clickUrl || '').trim();
  const derivedCreativeId = deriveCreativeIdFromUrl(group.gifUrl, group.name);
  await fillFirst(page, ['input[data-test="6318-Creative ID--input"]'], derivedCreativeId).catch(() => null);
  await fillFirst(page, ['input[data-test="6320-Creative Friendly Name--input"]'], group.creativeFriendlyName || group.name).catch(() => null);
  await fillFirst(page, ['input[data-test="6322-Carousel GIF(s)--input"]'], group.carouselGif || group.gifUrl).catch(() => null);
  if (clickUrl) {
    await fillFirst(page, ['input[data-test="6566-Click URL--input"]'], clickUrl).catch(() => null);
  }
  const ctaText = String(group.ctaText || '').trim();
  if (ctaText) {
    await fillFirst(page, ['input[data-test="6324-CTA Text--input"]'], ctaText).catch(() => null);
  }
  await fillFirst(page, ['input[data-test="6326-CTA URL--input"]'], group.ctaUrl || group.gifUrl).catch(() => null);
  await dismissDatePickerPopover(page, adgroupNum);

  const shouldApplySearchQueryTargeting = resolvedCampaignType !== 'banner';
  let requestedKeywords = Array.isArray(group.keywords) ? group.keywords : [];
  if (resolvedCampaignType === 'trending') {
    requestedKeywords = [...DEFAULT_TRENDING_KEYWORDS];
    console.log(`Campaign type "trending" for ${group.name}; forcing keywords to: ${requestedKeywords.join(', ')}`);
  }

  if (shouldApplySearchQueryTargeting) {
    if (Array.isArray(requestedKeywords) && requestedKeywords.length > 0) {
      console.log(`Using ${requestedKeywords.length} requested keyword(s) for ${group.name}.`);
    } else {
      console.log(`No keywords provided for ${group.name}; selecting random keywords in UI (excluding ${DEFAULT_TRENDING_KEYWORDS.join(', ')}).`);
    }
    const kwOk = await setKeywordsWithRetry(page, 20, 3, requestedKeywords || [], { targetGroupIndex: 0, adgroupNum });
    if (!kwOk) {
      await captureDiagnostics(page, `${label}-keywords-select-failed`);
      throw new Error(`Could not set keywords for ${group.name}`);
    }
    // Give the targeting UI a beat to commit search_query selections before creating the next group.
    if (TARGETING_SETTLE_MS > 0) {
      await page.waitForTimeout(TARGETING_SETTLE_MS);
    }
  } else {
    console.log(`Campaign type "banner" for ${group.name}; skipping search_query targeting group.`);
  }

  const countries = Array.isArray(group.countries) && group.countries.length ? group.countries : DEFAULT_COUNTRIES;
  const requiresPositionTargeting = group.requiresPositionTargeting !== false;
  const positions = Array.isArray(group.positions) && group.positions.length
    ? group.positions
    : (requiresPositionTargeting ? DEFAULT_POSITIONS : []);
  const adTypesRaw = Array.isArray(group.adTypes) && group.adTypes.length ? group.adTypes : DEFAULT_AD_TYPES;
  const forcedAdTypes = Array.isArray(group.forceAdTypes) && group.forceAdTypes.length ? group.forceAdTypes : [];
  const adContexts = Array.isArray(group.adContexts) && group.adContexts.length ? group.adContexts : DEFAULT_AD_CONTEXTS;
  const onoViewTypesRaw = Array.isArray(group.onoViewTypes) && group.onoViewTypes.length ? group.onoViewTypes : [];
  const onoViewTypes = resolvedCampaignType === 'banner'
    ? (onoViewTypesRaw.length ? onoViewTypesRaw : DEFAULT_ONO_VIEW_TYPES)
    : onoViewTypesRaw;
  let adTypes = forcedAdTypes.length > 0 ? forcedAdTypes : adTypesRaw;
  const norm = (v) => String(v || '').toLowerCase().trim();
  if (forcedAdTypes.length > 0) {
    if (
      adTypesRaw.length > 0
      && !adTypesRaw.every((value) => forcedAdTypes.some((forcedValue) => norm(forcedValue) === norm(value)))
    ) {
      console.warn(
        `Product-specific ad type override for ${group.name}; forcing ad type ${forcedAdTypes.join(', ')}`
      );
    }
  } else {
    const countrySet = new Set(countries.map(norm));
    const adTypeLooksLikeCountry = adTypesRaw.some((v) => countrySet.has(norm(v)));
    if (adTypeLooksLikeCountry) {
      console.warn(`Ad type values looked like country values for ${group.name}; forcing default ad type ${DEFAULT_AD_TYPES.join(', ')}`);
      adTypes = DEFAULT_AD_TYPES;
    }
  }

  await dismissDatePickerPopover(page, adgroupNum);
  let countryTargetGroupIndex = 0;
  if (shouldApplySearchQueryTargeting) {
    const countryGroupAdded = await addNewTargetingGroup(page);
    if (!countryGroupAdded?.ok) {
      await captureDiagnostics(page, `${label}-country-group-add-failed`);
      throw new Error(`Could not add country targeting group for ${group.name}`);
    }
    countryTargetGroupIndex = countryGroupAdded.index;
  }
  if (COUNTRY_PICK_DELAY_MS > 0) {
    await page.waitForTimeout(COUNTRY_PICK_DELAY_MS);
  }
  const countryOk = await setAdditionalDimensionValues(page, 'Country', countries, {
    addDimensionWithinGroup: false,
    targetGroupIndex: countryTargetGroupIndex,
    adgroupNum
  });
  if (!countryOk) {
    await captureDiagnostics(page, `${label}-country-targeting-failed`);
    throw new Error(`Could not set country targeting for ${group.name}`);
  }
  if (TARGETING_GROUP_STEP_DELAY_MS > 0) {
    await page.waitForTimeout(TARGETING_GROUP_STEP_DELAY_MS);
  }

  if (Array.isArray(positions) && positions.length > 0) {
    const positionGroupAdded = await addNewTargetingGroup(page);
    if (!positionGroupAdded?.ok) {
      await captureDiagnostics(page, `${label}-position-group-add-failed`);
      throw new Error(`Could not add position targeting group for ${group.name}`);
    }
    const positionOk = await setAdditionalDimensionValues(page, 'Position', positions, {
      addDimensionWithinGroup: false,
      targetGroupIndex: positionGroupAdded.index,
      adgroupNum
    });
    if (!positionOk) {
      await captureDiagnostics(page, `${label}-position-targeting-failed`);
      throw new Error(`Could not set position targeting for ${group.name}`);
    }
    if (TARGETING_GROUP_STEP_DELAY_MS > 0) {
      await page.waitForTimeout(TARGETING_GROUP_STEP_DELAY_MS);
    }
  } else {
    console.log(`Position targeting not required for ${group.name}; skipping Position targeting group.`);
  }

  const adTypeGroupAdded = await addNewTargetingGroup(page);
  if (!adTypeGroupAdded?.ok) {
    await captureDiagnostics(page, `${label}-ad-type-group-add-failed`);
    throw new Error(`Could not add ad type targeting group for ${group.name}`);
  }
  const adTypeOk = await setAdditionalDimensionValues(page, 'Ad type', adTypes, {
    addDimensionWithinGroup: false,
    targetGroupIndex: adTypeGroupAdded.index,
    adgroupNum
  });
  if (!adTypeOk) {
    await captureDiagnostics(page, `${label}-ad-type-targeting-failed`);
    throw new Error(`Could not set ad type targeting for ${group.name}`);
  }
  if (TARGETING_GROUP_STEP_DELAY_MS > 0) {
    await page.waitForTimeout(TARGETING_GROUP_STEP_DELAY_MS);
  }

  const adContextGroupAdded = await addNewTargetingGroup(page);
  if (!adContextGroupAdded?.ok) {
    await captureDiagnostics(page, `${label}-ad-context-group-add-failed`);
    throw new Error(`Could not add ad context targeting group for ${group.name}`);
  }
  const adContextOk = await setAdditionalDimensionValues(page, 'Ad Context', adContexts, {
    addDimensionWithinGroup: false,
    targetGroupIndex: adContextGroupAdded.index,
    adgroupNum
  });
  if (!adContextOk) {
    await captureDiagnostics(page, `${label}-ad-context-targeting-failed`);
    throw new Error(`Could not set ad context targeting for ${group.name}`);
  }
  if (TARGETING_GROUP_STEP_DELAY_MS > 0) {
    await page.waitForTimeout(TARGETING_GROUP_STEP_DELAY_MS);
  }

  if (Array.isArray(onoViewTypes) && onoViewTypes.length > 0) {
    const onoViewTypeGroupAdded = await addNewTargetingGroup(page);
    if (!onoViewTypeGroupAdded?.ok) {
      await captureDiagnostics(page, `${label}-ono-view-type-group-add-failed`);
      throw new Error(`Could not add OnO View Type targeting group for ${group.name}`);
    }
    const onoViewTypeOk = await setAdditionalDimensionValues(page, 'OnO View Type', onoViewTypes, {
      addDimensionWithinGroup: false,
      targetGroupIndex: onoViewTypeGroupAdded.index,
      adgroupNum
    });
    if (!onoViewTypeOk) {
      await captureDiagnostics(page, `${label}-ono-view-type-targeting-failed`);
      throw new Error(`Could not set OnO View Type targeting for ${group.name}`);
    }
  }
  const orphanedGroupsRemoved = await removeOrphanedEmptyTargetingGroups(page, 3);
  if (orphanedGroupsRemoved > 0) {
    console.warn(`Removed ${orphanedGroupsRemoved} orphaned empty targeting group(s) before finishing ${label}.`);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(20);

  const nameStillSet = await ensureAdGroupNameBeforeDone(page, adgroupNum, adGroupNameForUi);
  if (!nameStillSet) {
    await captureDiagnostics(page, `${label}-name-recheck-failed`);
    throw new Error(`Ad group name lost before Done for ${group.name}`);
  }
  const finalOrphanCleanup = await removeOrphanedEmptyTargetingGroups(page, 4);
  if (finalOrphanCleanup > 0) {
    console.warn(`Removed ${finalOrphanCleanup} trailing empty targeting group(s) right before Done for ${label}.`);
  }

  let doneSel = null;
  try {
    const doneBtn = page.locator('button[data-test="campaign-action-row--next"]').first();
    await doneBtn.waitFor({ state: 'visible', timeout: 1500 });
    await doneBtn.click({ force: true });
    doneSel = 'button[data-test="campaign-action-row--next"]';
  } catch {
    doneSel = await clickFirst(page, ['button[data-test="campaign-action-row--next"]'], 1200);
  }

  if (!doneSel) {
    await captureDiagnostics(page, `${label}-done-click-failed`);
    throw new Error(`Could not click Done for ${group.name}`);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`${label} completed in ${elapsedMs}ms`);
  await page.waitForTimeout(120);
}

async function main() {
  const openBouncerAtStart = await shouldOpenBouncerWindowAtStart();
  let bouncerSession = null;
  let bouncerContext = null;
  if (openBouncerAtStart) {
    console.log('Detected Bouncer enrichment/lookup needs; opening Bouncer first, then opening Koddi.');
    const bouncerStartupUrl = await resolveBouncerStartupUrl();
    bouncerSession = await launchBouncerWindowAtStart(bouncerStartupUrl);
    bouncerContext = bouncerSession?.context || null;
  } else {
    console.log('Keyword inventory already provided (or not required); opening Koddi window only.');
  }

  await applyCampaignOverrides({ bouncerSession });
  const launched = await launchBrowserContext();

  const context = launched.context;
  context.setDefaultTimeout(2500);
  context.setDefaultNavigationTimeout(7000);

  let page = context.pages()[0] || (await context.newPage());
  if (page.isClosed()) {
    page = await context.newPage();
  }
  if (page.url() === 'about:blank') {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
  }
  await page.waitForTimeout(150);

  const hasAdGroupCreate = await page.locator('[data-test="create-card--Ad Groups"], button:has-text("New Ad Groups")').first().isVisible().catch(() => false);
  if (!hasAdGroupCreate) {
    console.log('Ad group controls not found on current page; attempting to navigate from Reservations via Create.');
    const moved = await gotoAdGroupsStepFromReservations(page);
    if (!moved) {
      await captureDiagnostics(page, 'navigation-to-adgroups-failed');
      throw new Error('Could not navigate from reservation details to ad groups page.');
    }
    await page.waitForTimeout(180);
  }

  for (let i = 0; i < AD_GROUPS.length; i += 1) {
    await createOneAdGroup(page, AD_GROUPS[i], i);
  }

  console.log(`Finished creating ${AD_GROUPS.length} ad groups with reserved impressions and keyword attempts.`);
  await clickFirst(page, [
    '[data-test="campaign-action-row--next"]',
    'button:has-text("Next")'
  ], 6000).catch(() => null);

  const submitResult = await clickSubmitAndVerify(page);
  if (!submitResult.ok) {
    console.error(`Submit failed (${submitResult.reason}).`);
    if (submitResult.observedMessages.length) {
      console.error(`Observed submit messages: ${submitResult.observedMessages.join(' | ')}`);
    }
    await captureDiagnostics(page, `submit-failed-${submitResult.reason}`);
    if (KEEP_BROWSER_OPEN) {
      if (bouncerContext) {
        console.error('Submit failed and diagnostics were captured. Koddi + Bouncer windows left open for inspection; script exiting without closing browser.');
      } else {
        console.error('Submit failed and diagnostics were captured. Koddi window left open for inspection; script exiting without closing browser.');
      }
    } else {
      console.error('Submit failed; closing browser/context automatically.');
      if (bouncerContext) {
        await bouncerContext.close().catch(() => null);
      }
      if (launched.viaCdp) {
        await launched.browser?.close().catch(() => null);
      } else {
        await context.close();
      }
    }
    return;
  }
  if (submitResult.observedMessages.length) {
    console.log(`Submit verification messages: ${submitResult.observedMessages.join(' | ')}`);
  }
  if (CAPTURE_SUCCESS_DIAGNOSTICS) {
    await captureDiagnostics(page, `submit-success-${submitResult.reason}`);
  }

  if (KEEP_BROWSER_OPEN) {
    if (bouncerContext) {
      console.log('Completed ad-group creation and verified Submit success. Koddi + Bouncer windows left open for manual verification; script exiting without closing browser.');
    } else {
      console.log('Completed ad-group creation and verified Submit success. Koddi window left open for manual verification; script exiting without closing browser.');
    }
  } else {
    console.log('Completed ad-group creation and verified Submit success. Closing browser/context automatically.');
    if (bouncerContext) {
      await bouncerContext.close().catch(() => null);
    }
    if (launched.viaCdp) {
      await launched.browser?.close().catch(() => null);
    } else {
      await context.close();
    }
  }
}

main().catch(async (error) => {
  console.error('create-koddi-reservation failed:', error);
  process.exitCode = 1;
});
