const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const PROFILE_DIR = process.env.PLAYWRIGHT_PROFILE_DIR || '.playwright-koddi-profile';
const DIAG_DIR = process.env.DIAG_DIR || 'artifacts';
const CAMPAIGN_FILE = process.env.CAMPAIGN_FILE || '';
const PLAYWRIGHT_CHANNEL = process.env.PLAYWRIGHT_CHANNEL || '';
const BROWSER_EXECUTABLE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '';
const CLEAR_SINGLETON_LOCKS = process.env.CLEAR_SINGLETON_LOCKS === '1';
const ADGROUPS_URL = process.env.ADGROUPS_URL || 'https://k1-uat.koddi.app/#/clients/3500/reservations';
const RESERVE_URL = process.env.RESERVE_URL || 'https://k1-uat.koddi.app/#/clients/3500/reservations/reserve';
let RESERVED_IMPS_PER_GROUP = Number(process.env.RESERVED_IMPS_PER_GROUP || 757576);
let RESERVATION_NAME = process.env.RESERVATION_NAME || 'josh test';
let START_DATE = process.env.START_DATE || '04/01/2026';
let END_DATE = process.env.END_DATE || '06/30/2026';
let ADVERTISER_NAME = process.env.ADVERTISER_NAME || '';
let TOTAL_IMPRESSIONS = Number(process.env.TOTAL_IMPRESSIONS || 0);
const KEEP_BROWSER_OPEN = process.env.KEEP_BROWSER_OPEN !== '0';
const SLOW_MO = Number(process.env.SLOW_MO || 0);
const DEBUG_KEYWORD_FAILURES = process.env.DEBUG_KEYWORD_FAILURES === '1';

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
let AD_GROUPS = DEFAULT_AD_GROUPS.map((g) => ({ ...g, reservedImpressions: RESERVED_IMPS_PER_GROUP }));

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toPositiveInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
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

function normalizeGroup(raw, fallbackImps) {
  const name = raw?.name || raw?.gif_name || raw?.creative_friendly_name || raw?.creative_id;
  const gifUrl = raw?.gifUrl || raw?.gif_url || raw?.click_url || raw?.cta_url || raw?.carousel_gif || raw?.carousel_gifs?.[0];
  if (!name || !gifUrl) return null;

  return {
    name: String(name),
    gifUrl: String(gifUrl),
    keywords: Array.isArray(raw?.keywords) ? raw.keywords : [],
    reservedImpressions: toNumber(raw?.reserved_impressions ?? raw?.reservedImpressions, fallbackImps),
    creativeId: raw?.creative_id || name,
    creativeFriendlyName: raw?.creative_friendly_name || name,
    clickUrl: raw?.click_url || gifUrl,
    ctaUrl: raw?.cta_url || gifUrl,
    carouselGif: raw?.carousel_gif || raw?.carousel_gifs?.[0] || gifUrl
  };
}

async function applyCampaignOverrides() {
  if (!CAMPAIGN_FILE) return;

  const raw = await fs.readFile(CAMPAIGN_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const reservation = parsed?.reservation || {};

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

  const rawGroups = parsed.ad_groups || parsed.adGroups || reservation.ad_groups || [];
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const normalized = rawGroups.map((g) => normalizeGroup(g, RESERVED_IMPS_PER_GROUP)).filter(Boolean);
    if (normalized.length === 0) {
      throw new Error(`CAMPAIGN_FILE has ad_groups but none had required fields "name" and gif URL (${CAMPAIGN_FILE})`);
    }
    AD_GROUPS = normalized;
  }

  if (TOTAL_IMPRESSIONS > 0 && AD_GROUPS.length > 0) {
    const splits = distributeImpressionsEvenly(TOTAL_IMPRESSIONS, AD_GROUPS.length);
    if (splits.some((n) => n <= 0)) {
      throw new Error(`total_impressions (${TOTAL_IMPRESSIONS}) is too small for ${AD_GROUPS.length} ad groups; each group must receive at least 1 impression.`);
    }
    AD_GROUPS = AD_GROUPS.map((g, idx) => ({
      ...g,
      reservedImpressions: splits[idx]
    }));
    console.log(`Using total_impressions=${TOTAL_IMPRESSIONS}; split across ${AD_GROUPS.length} ad groups as: ${splits.join(', ')}`);
  }

  if (!String(ADVERTISER_NAME || '').trim()) {
    throw new Error('advertiser_name is required. Set reservation.advertiser_name in CAMPAIGN_FILE (exact UI label).');
  }
}

async function launchBrowserContext() {
  if (CLEAR_SINGLETON_LOCKS) {
    const staleLockNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'RunningChromeVersion'];
    for (const name of staleLockNames) {
      const p = path.join(PROFILE_DIR, name);
      await fs.unlink(p).catch(() => null);
    }
  }

  const base = {
    headless: false,
    viewport: { width: 1600, height: 1000 },
    slowMo: SLOW_MO,
    args: ['--disable-crash-reporter', '--disable-crashpad', '--disable-breakpad']
  };

  const attempts = [];
  if (BROWSER_EXECUTABLE_PATH) {
    attempts.push({ label: `executablePath=${BROWSER_EXECUTABLE_PATH}`, opts: { executablePath: BROWSER_EXECUTABLE_PATH } });
  }
  if (PLAYWRIGHT_CHANNEL) {
    attempts.push({ label: `channel=${PLAYWRIGHT_CHANNEL}`, opts: { channel: PLAYWRIGHT_CHANNEL } });
  }
  attempts.push({ label: 'bundled-chromium', opts: {} });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...base, ...attempt.opts });
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || error).split('\n')[0];
      console.warn(`Browser launch attempt failed (${attempt.label}): ${msg}`);
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

async function hasFormConfigError(page) {
  return page.getByText(/Could not find form configuration/i).first().isVisible().catch(() => false);
}

async function isLoginPage(page) {
  const hasPassword = await page.locator('input[type="password"], input[name="password"]').first().isVisible().catch(() => false);
  const hasKoddiLoginText = await page.getByText(/Log in to Koddi|Welcome/i).first().isVisible().catch(() => false);
  return hasPassword || hasKoddiLoginText;
}

async function waitUntilLoggedIn(page, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const loginVisible = await isLoginPage(page);
    if (!loginVisible) return true;
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

  if (preferredValue) {
    await page.keyboard.type(preferredValue, { delay: 12 }).catch(() => null);
    await page.waitForTimeout(160);
    const preferredClicked = await clickFirst(page, [
      `[role="option"]:has-text("${preferredValue}")`,
      `text=${preferredValue}`
    ], 600);
    if (!preferredClicked) {
      await page.keyboard.press('Enter').catch(() => null);
    }
  } else {
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
  const startedAt = Date.now();
  const selectors = [
    'button[data-test="add-reservation"]',
    'button:has-text("+ Create")',
    'button:has-text("Create")'
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

      const onExperienceStep = await page.getByText(/Targeted Reservation/i).first().isVisible().catch(() => false);
      if (onExperienceStep) return true;
    }
    await page.waitForTimeout(60);
  }

  return false;
}

async function ensureRequiredReservationSelections(page) {
  const advertiserOk = await selectFromPlaceholder(page, 'Select an advertiser', ADVERTISER_NAME);
  if (!advertiserOk) return false;

  // These may or may not exist depending on Koddi configuration; select if present.
  await selectFromPlaceholder(page, 'Select a member group').catch(() => null);
  await selectFromPlaceholder(page, 'Select an experience').catch(() => null);
  return true;
}

async function gotoAdGroupsStepFromReservations(page) {
  await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(350);

  let loginVisible = await isLoginPage(page);
  if (loginVisible) {
    console.log('Koddi login required for this run. Waiting for login completion in browser...');
    const ok = await waitUntilLoggedIn(page, 120000);
    if (!ok) return false;
    await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(350);
    loginVisible = await isLoginPage(page);
    if (loginVisible) return false;
  }

  if (!/\/reservations/i.test(page.url())) {
    await clickFirst(page, ['[data-test="navigation-reservations"]'], 2500).catch(() => null);
    await page.waitForTimeout(400);
  }

  const onExperienceStep = await page.getByText(/Targeted Reservation/i).first().isVisible().catch(() => false);
  if (!onExperienceStep) {
    let createClicked = await clickCreateReservation(page, 12000);

    if (!createClicked) {
      await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(500);
      createClicked = await clickCreateReservation(page, 12000);
    }
    if (!createClicked) return false;
  }

  let reachedDetails = false;
  for (let attempt = 0; attempt < 3 && !reachedDetails; attempt += 1) {
    await clickFirst(page, ['text=Targeted Reservation']).catch(() => null);
    await page.waitForTimeout(1000);
    await clickFirst(page, ['text=Multiple Ad Group Test Flow']).catch(() => null);
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

async function setKeywords(page, targetCount = 20, requestedKeywords = []) {
  const startedAt = Date.now();
  const maxMs = 3400;
  await clickFirst(page, [
    '[data-testid="remove-dimension-btn--button"]',
    '[data-test="remove-dimension-btn"]'
  ], 350).catch(() => null);
  await clickFirst(page, [
    '[data-testid="add-dimension-btn--button"]',
    '[data-test="add-dimension-btn"]',
    'button:has-text("Add dimension within group")'
  ], 700).catch(() => null);

  const dimensionOpened = await clickFirst(page, [
    '[data-testid="dimension-select--trigger--button"]',
    '[data-testid="dimension-select--trigger"] button',
    'button:has-text("Select dimension")'
  ], 1100);

  if (!dimensionOpened) return false;

  const dimensionSelected = await clickFirst(page, [
    'text=search_query',
    '[role="option"]:has-text("search_query")',
    '[data-value="search_query"]'
  ], 1100);

  if (!dimensionSelected) return false;

  await page.waitForTimeout(80);

  const opened = await clickFirst(page, [
    '[data-testid="attribute-select--trigger--button"]',
    '[data-testid="attribute-select--trigger"] button',
    'button:has-text("Select attributes")',
    'button:has-text("+ selected")'
  ], 1100);

  if (!opened) return false;

  const searchInput = page.locator('input[placeholder="Search"]').last();
  await searchInput.waitFor({ state: 'visible', timeout: 900 }).catch(() => null);

  // Clear any visible previously-selected keywords so each group gets a fresh random set.
  for (let pass = 0; pass < 3; pass += 1) {
    const checked = page.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"][aria-checked="true"]');
    const checkedCount = Math.min(await checked.count(), 30);
    if (checkedCount === 0) break;
    for (let i = 0; i < checkedCount; i += 1) {
      await checked.nth(i).click({ force: true, timeout: 250 }).catch(() => {});
    }
    await page.waitForTimeout(20);
  }

  const desiredKeywords = [];
  if (Array.isArray(requestedKeywords)) {
    for (const raw of requestedKeywords) {
      const kw = String(raw ?? '').trim();
      if (kw && !desiredKeywords.some((x) => x.toLowerCase() === kw.toLowerCase())) desiredKeywords.push(kw);
    }
  }

  if (desiredKeywords.length > 0) {
    let selectedFromDesired = 0;
    const missingKeywords = [];

    for (const keyword of desiredKeywords.slice(0, targetCount)) {
      if (Date.now() - startedAt > maxMs) break;
      await searchInput.fill('').catch(() => {});
      await searchInput.fill(keyword).catch(() => {});
      await page.waitForTimeout(70);

      const row = page.locator('[data-testid="attribute-select--checkbox"]', { hasText: keyword }).first();
      const exists = (await row.count().catch(() => 0)) > 0;
      if (!exists) {
        missingKeywords.push(keyword);
        continue;
      }

      const cb = row.locator('button[role="checkbox"]').first();
      const isChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (!isChecked) {
        await cb.click({ force: true, timeout: 300 }).catch(() => {});
      }
      const nowChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (nowChecked) selectedFromDesired += 1;
    }

    await searchInput.fill('').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    if (DEBUG_KEYWORD_FAILURES && missingKeywords.length > 0) {
      console.warn(`Requested keywords not found in UI: ${missingKeywords.join(', ')}`);
    }
    return selectedFromDesired > 0;
  }

  let totalChecked = 0;
  for (let pass = 0; pass < 3 && totalChecked < targetCount; pass += 1) {
    if (Date.now() - startedAt > maxMs) break;
    const checkboxes = page.locator('[data-testid="attribute-select--checkbox"] button[role="checkbox"]');
    const count = await checkboxes.count();
    if (count === 0) break;

    const order = shuffledIndices(Math.min(count, 40));
    for (const i of order) {
      const cb = checkboxes.nth(i);
      const isChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (isChecked) continue;
      await cb.click({ force: true, timeout: 250 }).catch(() => {});
      const nowChecked = (await cb.getAttribute('aria-checked').catch(() => 'false')) === 'true';
      if (nowChecked) {
        totalChecked += 1;
      }
      if (Date.now() - startedAt > maxMs) break;
      if (totalChecked >= targetCount) break;
    }

    if (totalChecked < targetCount && pass < 3) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(30);
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  return totalChecked > 0;
}

async function getKeywordSelectionCount(page) {
  const trigger = page
    .locator('[data-testid="attribute-select--trigger--button"], [data-testid="attribute-select--trigger"] button')
    .first();
  const txt = (await trigger.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const m = txt.match(/\+(\d+)\s+selected/i);
  if (m) return Number(m[1]);

  const badge = await page.getByText(/^\+\d+\s+selected$/i).first().innerText().catch(() => '');
  const m2 = String(badge).match(/\+(\d+)\s+selected/i);
  return m2 ? Number(m2[1]) : 0;
}

async function setKeywordsWithRetry(page, targetCount = 20, attempts = 3, requestedKeywords = []) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ok = await setKeywords(page, targetCount, requestedKeywords);
    const selectedCount = await getKeywordSelectionCount(page);
    if (ok && selectedCount > 0) return true;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
  return false;
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
  console.log(`Creating ${label}: ${group.name}`);

  const openCreate = await clickFirst(page, [
    '[data-test="create-card--Ad Groups"]',
    'button:has-text("New Ad Groups")',
    '[data-test="adgroup-button"]'
  ], 8000);

  if (!openCreate) {
    await captureDiagnostics(page, `${label}-open-create-failed`);
    throw new Error(`Could not open new ad group for ${group.name}`);
  }

  const nameSet = await setAdGroupNameStrict(page, adgroupNum, group.name);
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

  await fillFirst(page, ['input[data-test="6318-Creative ID--input"]'], group.creativeId || group.name).catch(() => null);
  await fillFirst(page, ['input[data-test="6320-Creative Friendly Name--input"]'], group.creativeFriendlyName || group.name).catch(() => null);
  await fillFirst(page, ['input[data-test="6322-Carousel GIF(s)--input"]'], group.carouselGif || group.gifUrl).catch(() => null);
  await fillFirst(page, ['input[data-test="6566-Click URL--input"]'], group.clickUrl || group.gifUrl).catch(() => null);
  await fillFirst(page, ['input[data-test="6326-CTA URL--input"]'], group.ctaUrl || group.gifUrl).catch(() => null);

  if (Array.isArray(group.keywords) && group.keywords.length > 0) {
    console.log(`Using ${group.keywords.length} requested keyword(s) for ${group.name}.`);
  } else {
    console.log(`No keywords provided for ${group.name}; selecting random keywords in UI.`);
  }
  const kwOk = await setKeywordsWithRetry(page, 20, 3, group.keywords || []);
  if (!kwOk) {
    await captureDiagnostics(page, `${label}-keywords-select-failed`);
    throw new Error(`Could not set keywords for ${group.name}`);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(20);

  const nameStillSet = await ensureAdGroupNameBeforeDone(page, adgroupNum, group.name);
  if (!nameStillSet) {
    await captureDiagnostics(page, `${label}-name-recheck-failed`);
    throw new Error(`Ad group name lost before Done for ${group.name}`);
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
  await applyCampaignOverrides();

  const context = await launchBrowserContext();
  context.setDefaultTimeout(2500);
  context.setDefaultNavigationTimeout(7000);

  let page = context.pages()[0] || (await context.newPage());
  if (page.isClosed()) {
    page = await context.newPage();
  }
  if (page.url() === 'about:blank') {
    await page.goto(ADGROUPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
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
      console.error('Submit failed and diagnostics were captured. Browser left open for inspection; script exiting without closing browser.');
    } else {
      console.error('Submit failed; closing browser/context automatically.');
      await context.close();
    }
    return;
  }
  if (submitResult.observedMessages.length) {
    console.log(`Submit verification messages: ${submitResult.observedMessages.join(' | ')}`);
  }

  if (KEEP_BROWSER_OPEN) {
    console.log('Completed ad-group creation and verified Submit success. Browser left open for manual verification; script exiting without closing browser.');
  } else {
    console.log('Completed ad-group creation and verified Submit success. Closing browser/context automatically.');
    await context.close();
  }
}

main().catch(async (error) => {
  console.error('create-koddi-reservation failed:', error);
  process.exitCode = 1;
});
