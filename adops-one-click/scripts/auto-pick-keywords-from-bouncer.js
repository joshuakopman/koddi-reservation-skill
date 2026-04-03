#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const INVENTORY_EXPLORER_URL = process.env.BOUNCER_INVENTORY_EXPLORER_URL || 'https://bouncer.giphy.tech/website/inventory-explorer/';
const DEFAULT_PROFILE_DIR = process.env.BOUNCER_PROFILE_DIR || path.resolve(__dirname, '../../.playwright-koddi-profile');
const DEFAULT_LOGIN_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_LOOKUP_TIMEOUT_MS = 25 * 1000;
const DEFAULT_TARGETING_SETTLE_MS = 300;
const DEFAULT_IMPRESSION_GOAL = 1_000_000;

function usageAndExit(message = '') {
  if (message) console.error(message);
  console.error([
    'Usage:',
    '  node adops-one-click/scripts/auto-pick-keywords-from-bouncer.js \\',
    '    --input /absolute/path/to/campaign.json \\',
    '    --output /absolute/path/to/output.json [options]',
    '',
    'Options:',
    '  --line-item-url <url>    Bouncer line item URL (can also come from JSON/env)',
    '  --headless <0|1>         default 0',
    '  --profile-dir <path>     default ./.playwright-koddi-profile',
    '  --login-timeout-ms <n>   default 1200000',
    '  --lookup-timeout-ms <n>  default 25000',
    '  --impression-goal <n>    optional override; otherwise derived from campaign JSON',
    '  --retry-zero-only        only re-lookup terms currently at available_inventory=0',
    '  --dry-run                print report without writing output'
  ].join('\n'));
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    headless: false,
    profileDir: DEFAULT_PROFILE_DIR,
    loginTimeoutMs: DEFAULT_LOGIN_TIMEOUT_MS,
    lookupTimeoutMs: DEFAULT_LOOKUP_TIMEOUT_MS,
    impressionGoal: null,
    retryZeroOnly: false,
    dryRun: false,
    lineItemUrl: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') {
      args.input = argv[++i];
      continue;
    }
    if (token === '--output') {
      args.output = argv[++i];
      continue;
    }
    if (token === '--line-item-url') {
      args.lineItemUrl = String(argv[++i] || '').trim();
      continue;
    }
    if (token === '--headless') {
      args.headless = String(argv[++i] || '').trim() === '1';
      continue;
    }
    if (token === '--profile-dir') {
      args.profileDir = argv[++i];
      continue;
    }
    if (token === '--login-timeout-ms') {
      args.loginTimeoutMs = toPositiveInt(argv[++i], DEFAULT_LOGIN_TIMEOUT_MS);
      continue;
    }
    if (token === '--lookup-timeout-ms') {
      args.lookupTimeoutMs = toPositiveInt(argv[++i], DEFAULT_LOOKUP_TIMEOUT_MS);
      continue;
    }
    if (token === '--impression-goal') {
      args.impressionGoal = toPositiveInt(argv[++i], null);
      continue;
    }
    if (token === '--retry-zero-only') {
      args.retryZeroOnly = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      usageAndExit('');
    }
  }

  if (!args.input) usageAndExit('Missing required flag: --input');
  if (!args.output && !args.dryRun) usageAndExit('Missing required flag: --output (or pass --dry-run)');

  args.input = path.resolve(args.input);
  if (args.output) args.output = path.resolve(args.output);
  args.profileDir = path.resolve(args.profileDir);
  return args;
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTerm(value) {
  return normalizeWhitespace(String(value || '').toLowerCase());
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupeTerms(values = []) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const term = normalizeTerm(raw);
    if (!term) continue;
    if (seen.has(term)) continue;
    seen.add(term);
    out.push(term);
  }
  return out;
}

function normalizeGifId(value) {
  return normalizeWhitespace(String(value || '')).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function extractGifIdFromGifUrl(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';

  let tail = raw;
  try {
    const parsed = new URL(raw);
    const segments = parsed.pathname.split('/').filter(Boolean);
    tail = segments[segments.length - 1] || '';
  } catch {
    // Keep raw tail fallback.
  }

  const parts = tail.split('-').filter(Boolean);
  if (parts.length > 0) {
    const maybeId = parts[parts.length - 1];
    if (/^[A-Za-z0-9]{8,}$/.test(maybeId)) return maybeId;
  }

  const cleaned = tail.replace(/[^A-Za-z0-9]/g, '');
  return cleaned || '';
}

function parseKeywordTerm(raw) {
  const term = normalizeTerm(raw);
  return term || '';
}

function parseKeywordInventoryValue(raw) {
  const n = Number(String(raw ?? '').replace(/,/g, '').replace(/[^0-9.+-]/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function collectKeywordInventoryRows(rawValue) {
  const rows = [];

  const pushRow = (termRaw, invRaw) => {
    const term = parseKeywordTerm(termRaw);
    const inv = parseKeywordInventoryValue(invRaw);
    if (!term) return;
    rows.push({ term, availableInventory: inv });
  };

  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      if (typeof item === 'string') {
        const term = parseKeywordTerm(item);
        if (term) rows.push({ term, availableInventory: null });
        continue;
      }
      if (item && typeof item === 'object') {
        pushRow(item.term, item.available_inventory ?? item.availableInventory ?? item.inventory);
      }
    }
  } else if (rawValue && typeof rawValue === 'object') {
    for (const [termRaw, invRaw] of Object.entries(rawValue)) {
      pushRow(termRaw, invRaw);
    }
  } else if (typeof rawValue === 'string') {
    const pieces = rawValue.split(/[|,;\n]/g).map((x) => x.trim()).filter(Boolean);
    for (const piece of pieces) {
      const [termPart, invPart] = piece.split(':');
      if (invPart != null) {
        pushRow(termPart, invPart);
      } else {
        const term = parseKeywordTerm(piece);
        if (term) rows.push({ term, availableInventory: null });
      }
    }
  }

  const deduped = new Map();
  for (const row of rows) {
    const key = normalizeTerm(row.term);
    if (!key) continue;
    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, { term: key, availableInventory: row.availableInventory });
      continue;
    }
    if (prev.availableInventory == null && row.availableInventory != null) {
      deduped.set(key, { term: key, availableInventory: row.availableInventory });
    }
  }

  return Array.from(deduped.values());
}

function groupHasAnyKeywordsOrInventory(group = {}) {
  const rows = [
    ...collectKeywordInventoryRows(group.keywords),
    ...collectKeywordInventoryRows(group.keyword_inventory),
    ...collectKeywordInventoryRows(group.keyword_inventories)
  ];
  return rows.length > 0;
}

function termInventoryMapFromGroup(group = {}) {
  const rows = [
    ...collectKeywordInventoryRows(group.keywords),
    ...collectKeywordInventoryRows(group.keyword_inventory),
    ...collectKeywordInventoryRows(group.keyword_inventories)
  ];
  const map = new Map();
  for (const row of rows) {
    const term = normalizeTerm(row.term);
    if (!term) continue;
    map.set(term, row.availableInventory == null ? null : Number(row.availableInventory));
  }
  return map;
}

function normalizeCampaignType(group = {}) {
  const raw = normalizeTerm(group?.campaign_type || group?.campaignType || group?.product_type || 'search');
  if (raw.includes('trend')) return 'trending';
  if (raw.includes('banner')) return 'banner';
  return 'search';
}

function extractLineItemUrl(campaign, args) {
  if (args.lineItemUrl) return args.lineItemUrl;
  const reservation = campaign?.reservation || {};
  const fromReservation = [
    reservation.bouncer_line_item_url,
    reservation.bouncerLineItemUrl,
    reservation.line_item_url,
    reservation.lineItemUrl,
    reservation.bouncer_campaign_line_item_url
  ].find((x) => normalizeWhitespace(x));
  if (fromReservation) return normalizeWhitespace(fromReservation);
  if (process.env.BOUNCER_LINE_ITEM_URL) return normalizeWhitespace(process.env.BOUNCER_LINE_ITEM_URL);
  return '';
}

function parseUsDateParts(rawDate) {
  const text = normalizeWhitespace(rawDate);
  if (!text) return null;

  const slashShort = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    return { month: Number(slashShort[1]), day: Number(slashShort[2]), year: Number(slashShort[3]) };
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return { month: Number(slash[1]), day: Number(slash[2]), year: Number(slash[3]) };
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return { month: Number(iso[2]), day: Number(iso[3]), year: Number(iso[1]) };
  }

  return null;
}

function toFourDigitYear(yearNumber) {
  const y = Number(yearNumber);
  if (!Number.isFinite(y)) return null;
  if (y >= 1000) return y;
  if (y >= 0 && y <= 69) return 2000 + y;
  if (y >= 70 && y <= 99) return 1900 + y;
  return null;
}

function normalizeUsDate(rawDate) {
  const text = normalizeWhitespace(rawDate);
  if (!text) return '';
  const parts = parseUsDateParts(text);
  if (!parts) return '';
  const year = toFourDigitYear(parts.year);
  if (!year) return '';
  return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${String(year)}`;
}

function parseNumberLoose(rawValue) {
  if (rawValue == null) return null;
  const cleaned = String(rawValue).replace(/,/g, '').replace(/[^0-9.+-]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseMoneyLoose(rawValue) {
  return parseNumberLoose(rawValue);
}

function roundToTwo(n) {
  return Math.round(Number(n) * 100) / 100;
}

function toMonthName(monthNumber) {
  if (!Number.isFinite(monthNumber)) return '';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNumber - 1] || '';
}

async function ensureLoggedIn(page, targetRegex, loginTimeoutMs, label) {
  if (!targetRegex.test(page.url())) {
    console.log(`${label} login required. Please log in in the opened browser window.`);
  }
  await page.waitForURL(targetRegex, { timeout: loginTimeoutMs });
  console.log(`${label} login detected.`);
}

async function launchBouncerContext(profileDir, headless) {
  return chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless,
    args: ['--disable-crash-reporter', '--disable-crashpad', '--disable-breakpad']
  });
}

async function clickFirstVisible(locator) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    const visible = await item.isVisible().catch(() => false);
    if (!visible) continue;
    const ok = await item.click({ force: true }).then(() => true).catch(() => false);
    if (ok) return true;
  }
  return false;
}

async function ensureKeywordsGroupsExpanded(page) {
  const header = page.locator('div[role="button"][aria-controls]').filter({ hasText: /Keywords & Groups/i }).first();
  const isVisible = await header.isVisible().catch(() => false);
  if (!isVisible) return;

  const expandedRaw = await header.getAttribute('aria-expanded').catch(() => null);
  const expanded = String(expandedRaw || '').toLowerCase() === 'true';
  if (!expanded) {
    await header.click({ force: true }).catch(() => null);
    await page.waitForTimeout(120);
  }
}

async function gotoBouncerMonth(page, monthName, yearNumber) {
  const maxJumps = 24;

  for (let i = 0; i < maxJumps; i += 1) {
    const captionText = await page.locator('.rdp-caption_label').first().innerText().catch(() => '');
    const normalized = normalizeWhitespace(captionText).toLowerCase();
    const target = `${String(monthName || '').toLowerCase()} ${String(yearNumber)}`;
    if (normalized === target) return;

    const captionDate = new Date(`${captionText} 1`);
    const targetDate = new Date(`${monthName} 1, ${yearNumber}`);
    const moveNext = captionDate < targetDate;

    const navNext = page.locator([
      'button[name="Go to next month"]',
      'button[aria-label="Go to next month"]',
      'button.rdp-button_next',
      '.rdp-nav_button_next',
      '.rdp-nav button:last-child'
    ].join(',')).first();
    const navPrev = page.locator([
      'button[name="Go to previous month"]',
      'button[aria-label="Go to previous month"]',
      'button.rdp-button_previous',
      '.rdp-nav_button_previous',
      '.rdp-nav button:first-child'
    ].join(',')).first();
    const nav = moveNext ? navNext : navPrev;
    const clicked = await nav.click({ force: true }).then(() => true).catch(() => false);
    if (!clicked) break;
    await page.waitForTimeout(100);
  }
}

async function clickCalendarDayByParts(page, monthName, day, year) {
  const clicked = await page.evaluate(({ monthNameValue, dayValue, yearValue }) => {
    const normalize = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const wantedMonth = normalize(monthNameValue);
    const wantedDay = Number(dayValue);
    const wantedYear = Number(yearValue);

    const dayButtons = Array.from(document.querySelectorAll('button.rdp-day, .rdp-day button, .rdp-day'));
    for (const el of dayButtons) {
      const aria = normalize(el.getAttribute('aria-label') || '');
      if (!aria.includes(String(wantedDay))) continue;
      if (!aria.includes(String(wantedYear))) continue;
      if (wantedMonth && !aria.includes(wantedMonth)) continue;
      const btn = el.matches('button') ? el : el.querySelector('button');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }, { monthNameValue: monthName, dayValue: Number(day), yearValue: Number(year) }).catch(() => false);

  return clicked;
}

async function setDatePickerByParts(page, buttonSelector, parts) {
  const combo = page.locator(buttonSelector).first();
  await combo.waitFor({ state: 'visible', timeout: 60_000 });
  await combo.click({ force: true });
  await page.waitForTimeout(120);

  const monthName = parts ? toMonthName(parts.month) : '';
  const yearNumber = parts ? parts.year : null;
  if (monthName && yearNumber) {
    await gotoBouncerMonth(page, monthName, yearNumber);
  }

  const clicked = await clickCalendarDayByParts(page, monthName, parts?.day, parts?.year);
  if (!clicked) throw new Error(`Could not click calendar day for ${monthName} ${parts?.day}, ${parts?.year}`);

  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(140);
}

async function setDates(page, startDate, endDate) {
  const startParts = parseUsDateParts(startDate);
  const endParts = parseUsDateParts(endDate);
  if (!startParts || !endParts) {
    throw new Error(`Could not parse reservation dates for Bouncer: start="${startDate}" end="${endDate}"`);
  }
  await setDatePickerByParts(page, '#start-date-label + button[role="combobox"]', startParts);
  await setDatePickerByParts(page, '#end-date-label + button[role="combobox"]', endParts);
}

async function removeGroupByTerm(page, term = null) {
  const regex = term ? new RegExp(escapeRegExp(term), 'i') : null;
  const pill = regex
    ? page.locator('button[data-testid="keyword-group"]').filter({ hasText: regex }).first()
    : page.locator('button[data-testid="keyword-group"]').first();

  const visible = await pill.isVisible().catch(() => false);
  if (!visible) return false;

  const deleteBtn = pill.locator('[aria-label="delete keyword"]').first();
  const delVisible = await deleteBtn.isVisible().catch(() => false);
  if (delVisible) {
    await deleteBtn.click({ force: true }).catch(() => null);
  } else {
    await pill.click({ force: true, position: { x: 20, y: 18 } }).catch(() => null);
    await page.waitForTimeout(120);
    await pill.locator('[aria-label="delete keyword"]').first().click({ force: true }).catch(() => null);
  }

  const modal = page.locator('text=Delete Group').first();
  const modalVisible = await modal.isVisible().catch(() => false);
  if (modalVisible) {
    await page.locator('button:has-text("Delete")').first().click({ force: true }).catch(() => null);
    await page.waitForTimeout(180);
  }

  await page.waitForTimeout(180);
  return true;
}

async function clearAllGroups(page) {
  for (let i = 0; i < 40; i += 1) {
    const ok = await removeGroupByTerm(page, null);
    if (!ok) break;
  }
}

async function clickGroupPill(page, term) {
  const pill = page.locator('button[data-testid="keyword-group"]').filter({ hasText: new RegExp(escapeRegExp(term), 'i') }).first();
  const visible = await pill.isVisible().catch(() => false);
  if (!visible) return false;
  await pill.click({ force: true, position: { x: 24, y: 20 } }).catch(() => null);
  await page.waitForTimeout(120);
  return true;
}

async function addGroup(page, term) {
  await ensureKeywordsGroupsExpanded(page);
  const input = page.locator('input[placeholder="Search for a Keyword Group"]').first();
  await input.waitFor({ state: 'visible', timeout: 60_000 });
  await input.click({ force: true });
  await input.fill('');
  await input.type(term, { delay: 20 });
  const added = await clickFirstVisible(page.locator('button[aria-label="add tag"]').first());
  if (!added) {
    await input.press('Enter').catch(() => null);
  }
  await page.waitForTimeout(220);
  await clickGroupPill(page, term);
}

async function captureTermChipCount(page, term) {
  return page.evaluate((needle) => {
    const normalize = (s) => String(s || '')
      .replace(/["']/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const wanted = normalize(needle);
    const esc = String(needle || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const groupInput = document.querySelector('input[placeholder="Search for a Keyword Group"]');
    let root = groupInput ? groupInput.parentElement : null;
    while (root && !/Run Estimation/i.test(String(root.textContent || ''))) {
      root = root.parentElement;
    }
    const scope = root || document.body;
    const tagInput = scope.querySelector('input[placeholder="Input any number of Tags"]');
    const minY = tagInput ? tagInput.getBoundingClientRect().bottom : 0;

    const chips = Array.from(scope.querySelectorAll('[data-testid="keyword-item"]'))
      .filter((el) => el.getBoundingClientRect().top >= minY - 6);

    for (const chip of chips) {
      const text = String(chip.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      const directText = Array.from(chip.childNodes || [])
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => String(n.textContent || ''))
        .join(' ');

      const chipTerm = normalize(directText)
        || normalize(text.replace(/\b[0-9][0-9,]*\b/g, '').replace(/\bx\b/gi, ''));
      if (chipTerm !== wanted) continue;

      const spanTexts = Array.from(chip.querySelectorAll('span'))
        .map((s) => String(s.textContent || '').trim())
        .filter(Boolean);

      for (const spanText of spanTexts) {
        const m = spanText.match(/\b([0-9][0-9,]*)\b/);
        if (!m) continue;
        const n = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(n) && n >= 0) return n;
      }

      const m2 = text.match(new RegExp(`\\b${esc}\\b[^0-9]{0,8}([0-9][0-9,]*)\\b`, 'i'));
      if (!m2) continue;
      const n2 = Number(String(m2[1]).replace(/,/g, ''));
      if (Number.isFinite(n2) && n2 >= 0) return n2;
    }

    return null;
  }, term).catch(() => null);
}

async function waitForTermChipCount(page, term, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) return null;
    const n = await captureTermChipCount(page, term);
    if (Number.isFinite(n) && n >= 0) return n;
    await page.waitForTimeout(400).catch(() => null);
  }
  return null;
}

async function lookupTermInventory(page, term, timeoutMs) {
  await addGroup(page, term);
  const count = await waitForTermChipCount(page, term, timeoutMs);
  await removeGroupByTerm(page, term).catch(() => null);
  await page.waitForTimeout(DEFAULT_TARGETING_SETTLE_MS);
  return Number.isFinite(count) ? count : null;
}

async function waitForCreativeCards(page, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hasCards = await page.evaluate(() => {
      const text = String(document.body?.innerText || '');
      return /GIF ID:/i.test(text);
    }).catch(() => false);
    if (hasCards) return true;
    await page.waitForTimeout(300).catch(() => null);
  }
  return false;
}

async function scrapeLineItemMetadata(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeLower = (value) => normalize(value).toLowerCase();
    const nodes = Array.from(document.querySelectorAll('span, div, p, td, th'));

    const looksLikeValue = (text) => /(^\$?[0-9][0-9,]*(\.[0-9]+)?$)|(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(text);

    const findLabelValue = (exactLabel) => {
      const target = normalizeLower(exactLabel);
      for (const node of nodes) {
        const labelText = normalizeLower(node.textContent || '');
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

        let prev = node.previousElementSibling;
        while (prev) {
          const candidate = normalize(prev.textContent || '');
          if (candidate && looksLikeValue(candidate)) return candidate;
          prev = prev.previousElementSibling;
        }
      }
      return '';
    };

    const bodyText = normalize(document.body?.innerText || '');
    const dateRangeMatch = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);

    return {
      startDateRaw: dateRangeMatch?.[1] || '',
      endDateRaw: dateRangeMatch?.[2] || '',
      impressionsDeliveredRaw: findLabelValue('Impressions Delivered'),
      impressionsRemainingRaw: findLabelValue('Impressions Remaining'),
      spentRaw: findLabelValue('Spent'),
      spendRemainingRaw: findLabelValue('Spend Remaining'),
      cpmRaw: findLabelValue('CPM')
    };
  });
}

function computeLineItemMetadata(rawMeta = {}) {
  const startDate = normalizeUsDate(rawMeta.startDateRaw || '');
  const endDate = normalizeUsDate(rawMeta.endDateRaw || '');

  const delivered = toNonNegativeInt(parseNumberLoose(rawMeta.impressionsDeliveredRaw), null);
  const remaining = toNonNegativeInt(parseNumberLoose(rawMeta.impressionsRemainingRaw), null);
  const totalImpressions = (
    delivered != null && remaining != null
      ? delivered + remaining
      : (remaining != null ? remaining : delivered)
  );

  const spent = parseMoneyLoose(rawMeta.spentRaw);
  const spendRemaining = parseMoneyLoose(rawMeta.spendRemainingRaw);
  const totalBudget = (
    spent != null && spendRemaining != null
      ? spent + spendRemaining
      : (spendRemaining != null ? spendRemaining : spent)
  );

  const cpmDirect = parseMoneyLoose(rawMeta.cpmRaw);
  let cpm = cpmDirect;
  if (cpm == null && totalBudget != null && totalImpressions != null && totalImpressions > 0) {
    cpm = roundToTwo((totalBudget * 1000) / totalImpressions);
  }

  return {
    startDate,
    endDate,
    totalImpressions: totalImpressions != null ? Math.floor(totalImpressions) : null,
    cpm: cpm != null ? roundToTwo(cpm) : null
  };
}

async function scrapeCreativesFromLineItem(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeTerm = (value) => normalize(String(value || '').toLowerCase());
    const normalizeId = (value) => normalize(value).replace(/[^A-Za-z0-9]/g, '').toLowerCase();

    const dedupe = (values) => {
      const out = [];
      const seen = new Set();
      for (const raw of values) {
        const v = normalizeTerm(raw);
        if (!v) continue;
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
      return out;
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

    // Fallback for older/variant DOMs where class selectors differ.
    if (idValueSpans.length === 0) {
      idValueSpans = Array.from(document.querySelectorAll('span'))
        .filter((el) => /GIF ID:/i.test(String(el.textContent || '')))
        .map((el) => {
          const nested = el.querySelector('span');
          return nested || el;
        });
    }

    const seenIds = new Set();
    const creatives = [];

    for (const idValue of idValueSpans) {
      const rawId = normalize(idValue.textContent || '');
      const normalizedId = normalizeId(rawId);
      if (!normalizedId || seenIds.has(normalizedId)) continue;
      seenIds.add(normalizedId);

      const card = findCardRoot(idValue.parentElement || idValue);

      const nameCandidates = Array.from(card.querySelectorAll('span'))
        .map((s) => normalize(s.textContent || ''))
        .filter((t) => t && !/^GIF ID:/i.test(t) && t.toUpperCase() !== 'LIVE');
      const name = nameCandidates[0] || '';

      let termNodes = Array.from(card.querySelectorAll('div.rounded.bg-giphyDarkGrey'));
      if (termNodes.length === 0) {
        termNodes = Array.from(card.querySelectorAll('div.rounded')).filter((el) =>
          String(el.className || '').includes('bg-giphyDarkGrey')
        );
      }

      let terms = dedupe(termNodes.map((el) => el.textContent || ''));
      if (terms.length === 0) {
        const lines = normalize(card.innerText || '').split(/\n+/g).map((x) => normalize(x)).filter(Boolean);
        const idIndex = lines.findIndex((line) => /^GIF ID:/i.test(line));
        const fallback = [];
        for (let i = Math.max(0, idIndex + 1); i < lines.length; i += 1) {
          const line = lines[i];
          if (!line || line.toUpperCase() === 'LIVE') continue;
          if (/^GIF ID:/i.test(line)) continue;
          if (line.length > 60) continue;
          fallback.push(line);
        }
        terms = dedupe(fallback);
      }

      creatives.push({
        gifId: rawId,
        normalizedGifId: normalizedId,
        name,
        normalizedName: normalizeTerm(name),
        terms
      });
    }

    return creatives;
  });
}

function findCreativeMatch(group, creativeById) {
  const gifIdFromUrl = extractGifIdFromGifUrl(group?.gif_url);
  const normalizedGifId = normalizeGifId(gifIdFromUrl);
  if (normalizedGifId && creativeById.has(normalizedGifId)) {
    return creativeById.get(normalizedGifId);
  }
  return null;
}

function ensureSearchFallbacks(group = {}, lineItemCpm = null) {
  const normalizedType = normalizeCampaignType(group);
  if (normalizedType !== 'search') return group;

  const out = { ...group };
  if (!Array.isArray(out.positions) || out.positions.length === 0) {
    out.positions = ['Position 1'];
  }
  if (!Array.isArray(out.ad_contexts) || out.ad_contexts.length === 0) {
    out.ad_contexts = ['*'];
  }
  if (lineItemCpm != null) {
    out.cpm = Number(lineItemCpm);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const raw = await fs.readFile(args.input, 'utf8');
  const campaign = JSON.parse(raw);
  const reservation = campaign?.reservation || {};
  const adGroups = Array.isArray(campaign?.ad_groups) ? campaign.ad_groups : [];

  if (adGroups.length === 0) {
    throw new Error('Input campaign JSON has no ad_groups.');
  }

  const groupsNeedingEnrichment = adGroups
    .map((group, idx) => ({ idx, group }))
    .filter(({ group }) => {
      const type = normalizeCampaignType(group);
      if (type === 'banner') return false;
      if (!args.retryZeroOnly && groupHasAnyKeywordsOrInventory(group)) return false;
      return true;
    });

  if (groupsNeedingEnrichment.length === 0) {
    console.log('All ad groups already have keywords/inventory. No Bouncer enrichment needed.');
    const outputCampaign = JSON.parse(JSON.stringify(campaign));
    outputCampaign.ad_groups = (outputCampaign.ad_groups || []).map((group) => ensureSearchFallbacks(group, null));
    if (!args.dryRun) {
      await fs.mkdir(path.dirname(args.output), { recursive: true });
      await fs.writeFile(args.output, `${JSON.stringify(outputCampaign, null, 2)}\n`, 'utf8');
      console.log(`Wrote campaign JSON (fallbacks applied): ${args.output}`);
    }
    return;
  }

  const lineItemUrl = extractLineItemUrl(campaign, args);
  if (!lineItemUrl) {
    throw new Error(
      `Missing Bouncer line-item URL. Provide --line-item-url, BOUNCER_LINE_ITEM_URL, or reservation.bouncer_line_item_url in JSON. ${groupsNeedingEnrichment.length} ad group(s) need enrichment.`
    );
  }

  let context = await launchBouncerContext(args.profileDir, args.headless);
  let page = context.pages()[0];
  if (!page) page = await context.newPage();

  try {
    console.log(`Opening Bouncer line item: ${lineItemUrl}`);
    await page.goto(lineItemUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    try {
      const initialTimeout = args.headless ? Math.min(15_000, args.loginTimeoutMs) : args.loginTimeoutMs;
      await ensureLoggedIn(page, /\/website\/campaigns\//i, initialTimeout, 'Bouncer');
    } catch (loginError) {
      if (!args.headless) throw loginError;
      console.log('Headless login was not detected. Re-launching headful for manual login...');
      await context.close().catch(() => null);
      context = await launchBouncerContext(args.profileDir, false);
      page = context.pages()[0];
      if (!page) page = await context.newPage();
      await page.goto(lineItemUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await ensureLoggedIn(page, /\/website\/campaigns\//i, args.loginTimeoutMs, 'Bouncer');
    }
    await page.waitForTimeout(500);
    const hasCreativeCards = await waitForCreativeCards(page, 30_000);
    if (!hasCreativeCards) {
      throw new Error('Bouncer line item loaded, but no creative cards with GIF IDs were detected.');
    }

    const rawLineItemMetadata = await scrapeLineItemMetadata(page);
    const lineItemMetadata = computeLineItemMetadata(rawLineItemMetadata);
    const resolvedReservation = {
      ...reservation
    };
    if (lineItemMetadata.startDate) {
      resolvedReservation.start_date = lineItemMetadata.startDate;
    }
    if (lineItemMetadata.endDate) {
      resolvedReservation.end_date = lineItemMetadata.endDate;
    }
    if (lineItemMetadata.totalImpressions != null) {
      resolvedReservation.total_impressions = lineItemMetadata.totalImpressions;
      const existingGoals = (
        resolvedReservation.impression_goals_by_campaign_type
        && typeof resolvedReservation.impression_goals_by_campaign_type === 'object'
      )
        ? { ...resolvedReservation.impression_goals_by_campaign_type }
        : {};
      existingGoals.search = lineItemMetadata.totalImpressions;
      resolvedReservation.impression_goals_by_campaign_type = existingGoals;
    }
    if (lineItemMetadata.cpm != null) {
      resolvedReservation.cpm_per_group = lineItemMetadata.cpm;
    }

    console.log('Bouncer line-item metadata:');
    console.log(`  Start date: ${resolvedReservation.start_date || 'n/a'}`);
    console.log(`  End date: ${resolvedReservation.end_date || 'n/a'}`);
    console.log(`  Total impressions: ${resolvedReservation.total_impressions ?? 'n/a'}`);
    console.log(`  CPM: ${lineItemMetadata.cpm ?? 'n/a'}`);

    const creatives = await scrapeCreativesFromLineItem(page);
    if (!Array.isArray(creatives) || creatives.length === 0) {
      throw new Error('Could not extract creatives/keywords from Bouncer line item page.');
    }

    const creativeById = new Map();
    for (const creative of creatives) {
      if (creative?.normalizedGifId) {
        creativeById.set(creative.normalizedGifId, creative);
      }
    }

    const enrichmentPlan = [];
    const unmatched = [];

    for (const entry of groupsNeedingEnrichment) {
      const group = entry.group;
      const creative = findCreativeMatch(group, creativeById);
      if (!creative || !Array.isArray(creative.terms) || creative.terms.length === 0) {
        unmatched.push({
          index: entry.idx,
          name: group?.name || `Ad Group ${entry.idx + 1}`,
          gif_url: group?.gif_url || '',
          gif_id_from_url: extractGifIdFromGifUrl(group?.gif_url || '')
        });
        continue;
      }
      enrichmentPlan.push({
        index: entry.idx,
        groupName: group?.name || `Ad Group ${entry.idx + 1}`,
        gifUrl: group?.gif_url || '',
        creativeName: creative.name,
        creativeGifId: creative.gifId,
        terms: dedupeTerms(creative.terms),
        lookupTerms: []
      });
    }

    if (enrichmentPlan.length === 0) {
      throw new Error(`No ad groups could be matched to Bouncer creatives. Unmatched groups: ${unmatched.length}`);
    }

    console.log(`Matched ${enrichmentPlan.length}/${groupsNeedingEnrichment.length} ad groups to Bouncer creatives.`);
    if (unmatched.length > 0) {
      console.log(`Unmatched groups (${unmatched.length}):`);
      for (const item of unmatched) {
        console.log(`  - [${item.index}] ${item.name} (${item.gif_url}) [gif_id=${item.gif_id_from_url}]`);
      }
    }

    for (const item of enrichmentPlan) {
      if (!args.retryZeroOnly) {
        item.lookupTerms = item.terms.slice();
        continue;
      }
      const existingMap = termInventoryMapFromGroup(adGroups[item.index] || {});
      const zeroTerms = new Set(
        Array.from(existingMap.entries())
          .filter(([, inventory]) => Number(inventory) === 0)
          .map(([term]) => normalizeTerm(term))
      );
      item.lookupTerms = item.terms.filter((term) => zeroTerms.has(normalizeTerm(term)));
    }

    const activePlan = enrichmentPlan.filter((item) => (item.lookupTerms || []).length > 0);
    if (activePlan.length === 0) {
      console.log('No terms need lookup after applying --retry-zero-only filter.');
      const outputCampaign = JSON.parse(JSON.stringify(campaign));
      outputCampaign.reservation = {
        ...(outputCampaign.reservation || {}),
        ...resolvedReservation
      };
      outputCampaign.ad_groups = (outputCampaign.ad_groups || [])
        .map((group) => ensureSearchFallbacks(group, lineItemMetadata.cpm));
      if (!args.dryRun) {
        await fs.mkdir(path.dirname(args.output), { recursive: true });
        await fs.writeFile(args.output, `${JSON.stringify(outputCampaign, null, 2)}\n`, 'utf8');
        console.log(`Wrote campaign JSON (metadata/fallbacks applied): ${args.output}`);
      }
      return;
    }

    const orderedUniqueTerms = [];
    const seenTerms = new Set();
    for (const item of activePlan) {
      for (const term of item.lookupTerms) {
        const key = normalizeTerm(term);
        if (!key || seenTerms.has(key)) continue;
        seenTerms.add(key);
        orderedUniqueTerms.push(key);
      }
    }

    console.log(`Looking up inventory for ${orderedUniqueTerms.length} unique term(s) in Inventory Explorer...`);

    await page.goto(INVENTORY_EXPLORER_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await ensureLoggedIn(page, /\/website\/inventory-explorer\//i, args.loginTimeoutMs, 'Inventory Explorer');
    await page.waitForTimeout(300);

    await ensureKeywordsGroupsExpanded(page);

    const startDate = resolvedReservation.start_date;
    const endDate = resolvedReservation.end_date;
    const shouldSetDates = String(process.env.BOUNCER_SET_DATES || '1').trim() === '1';
    if (shouldSetDates && startDate && endDate) {
      try {
        await setDates(page, startDate, endDate);
      } catch (error) {
        console.log(`Skipping date-range setup in Inventory Explorer: ${error.message}`);
      }
    } else if (startDate && endDate) {
      console.log('Skipping date-range setup in Inventory Explorer (default behavior).');
    }

    const derivedImpressionGoal = (
      args.impressionGoal
      || Number(resolvedReservation?.impression_goals_by_campaign_type?.search)
      || Number(resolvedReservation?.total_impressions)
      || DEFAULT_IMPRESSION_GOAL
    );

    const impressionInput = page.locator('input#impression-goal').first();
    const impressionVisible = await impressionInput.isVisible().catch(() => false);
    if (impressionVisible) {
      await impressionInput.fill(String(Math.floor(derivedImpressionGoal)));
      await page.waitForTimeout(120);
    }

    await clearAllGroups(page);

    const termCounts = new Map();
    for (let i = 0; i < orderedUniqueTerms.length; i += 1) {
      const term = orderedUniqueTerms[i];
      const count = await lookupTermInventory(page, term, args.lookupTimeoutMs);
      termCounts.set(term, Number.isFinite(count) ? Math.floor(count) : 0);
      console.log(`[${i + 1}/${orderedUniqueTerms.length}] ${term} => ${Number.isFinite(count) ? count : 'n/a'}`);
    }

    const outputCampaign = JSON.parse(JSON.stringify(campaign));
    outputCampaign.reservation = {
      ...(outputCampaign.reservation || {}),
      ...resolvedReservation
    };
    const outputGroups = outputCampaign.ad_groups || [];

    for (const item of activePlan) {
      const existingRows = Array.isArray(outputGroups[item.index]?.keywords)
        ? outputGroups[item.index].keywords.map((row) => ({
          term: normalizeTerm(row?.term),
          available_inventory: Math.floor(Number(row?.available_inventory || 0))
        })).filter((row) => row.term)
        : [];

      if (args.retryZeroOnly && existingRows.length > 0) {
        const updatedRows = existingRows.map((row) => {
          const key = normalizeTerm(row.term);
          if (!key) return row;
          if (!item.lookupTerms.some((t) => normalizeTerm(t) === key)) return row;
          return {
            term: row.term,
            available_inventory: Math.floor(Number(termCounts.get(key) || 0))
          };
        });
        outputGroups[item.index] = {
          ...outputGroups[item.index],
          keywords: updatedRows
        };
        continue;
      }

      const rows = item.terms.map((term) => ({
        term,
        available_inventory: Math.floor(Number(termCounts.get(normalizeTerm(term)) || 0))
      }));
      outputGroups[item.index] = {
        ...outputGroups[item.index],
        keywords: rows
      };
    }

    for (let i = 0; i < outputGroups.length; i += 1) {
      outputGroups[i] = ensureSearchFallbacks(outputGroups[i], lineItemMetadata.cpm);
    }

    console.log('Enrichment summary:');
    for (const item of activePlan) {
      const rows = outputGroups[item.index]?.keywords || [];
      const compact = rows.map((r) => `${r.term}:${r.available_inventory}`).join(', ');
      console.log(`- [${item.index}] ${item.groupName} <= ${item.creativeName} (${item.creativeGifId})`);
      console.log(`  ${compact}`);
    }

    if (!args.dryRun) {
      await fs.mkdir(path.dirname(args.output), { recursive: true });
      await fs.writeFile(args.output, `${JSON.stringify(outputCampaign, null, 2)}\n`, 'utf8');
      console.log(`\nWrote enriched campaign JSON: ${args.output}`);
    }
  } finally {
    await context.close().catch(() => null);
  }
}

main().catch((error) => {
  console.error(`auto-pick-keywords-from-bouncer failed: ${error.message}`);
  process.exit(1);
});
