// ============================================================
// TAB LIMITER — Popup Logic v1.0
// Remote Config + GA4 + Rate Us + i18n + UTM
// ============================================================

import { getExtensionConfig } from './remote-config.js';
import { trackPopupOpen, trackLimitChanged, trackDonationClick, incrementUseCount } from './analytics.js';

const LIMIT_KEY = 'tab_limit';
const ENABLED_KEY = 'tab_limiter_enabled';
const DEFAULT_LIMIT = 10;
const RATE_US_THRESHOLD = 10; // show Rate Us after 10 uses
const STORE_URL = 'https://chrome.google.com/webstore/detail/REPLACE_WITH_EXTENSION_ID';

// ---- i18n strings ----
const i18n = {
  en: {
    subtitle: 'Stay focused, stay clean',
    openTabs: 'Open tabs',
    tabLimit: 'Tab limit',
    blocked: 'Tab limit reached! New tab was closed.',
    rateUs: 'Enjoying Tab Limiter? Rate us! ⭐',
    donate: 'Support the developer ☕'
  },
  de: {
    subtitle: 'Fokussiert bleiben',
    openTabs: 'Offene Tabs',
    tabLimit: 'Tab-Limit',
    blocked: 'Tab-Limit erreicht! Neuer Tab wurde geschlossen.',
    rateUs: 'Tab Limiter gefällt dir? Bewerte uns! ⭐',
    donate: 'Entwickler unterstützen ☕'
  },
  fr: {
    subtitle: 'Restez concentré',
    openTabs: 'Onglets ouverts',
    tabLimit: 'Limite d\'onglets',
    blocked: 'Limite atteinte ! Nouvel onglet fermé.',
    rateUs: 'Vous aimez Tab Limiter ? Notez-nous ! ⭐',
    donate: 'Soutenir le développeur ☕'
  },
  es: {
    subtitle: 'Mantente enfocado',
    openTabs: 'Pestañas abiertas',
    tabLimit: 'Límite de pestañas',
    blocked: '¡Límite alcanzado! Nueva pestaña cerrada.',
    rateUs: '¿Te gusta Tab Limiter? ¡Valóranos! ⭐',
    donate: 'Apoya al desarrollador ☕'
  },
  pt: {
    subtitle: 'Fique focado',
    openTabs: 'Abas abertas',
    tabLimit: 'Limite de abas',
    blocked: 'Limite atingido! Nova aba foi fechada.',
    rateUs: 'Gosta do Tab Limiter? Avalie-nos! ⭐',
    donate: 'Apoiar o desenvolvedor ☕'
  }
};

function getStrings() {
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
  return i18n[lang] || i18n.en;
}

// ---- DOM refs ----
const $ = id => document.getElementById(id);
const tabCountEl = $('tab-count');
const limitDisplayEl = $('limit-display');
const limitInputEl = $('limit-input');
const progressBarEl = $('progress-bar');
const statusBarEl = $('status-bar');
const toggleEl = $('toggle-enabled');
const blockedNoticeEl = $('blocked-notice');
const donateBannerEl = $('donate-banner');
const donateLinkEl = $('donate-link');
const donateTextEl = $('donate-text');
const privacyLinkEl = $('privacy-link');
const rateLinkEl = $('rate-link');
const rateUsEl = $('rate-us');

// ---- State ----
let currentLimit = DEFAULT_LIMIT;
let isEnabled = true;

// ---- Init ----
async function init() {
  const strings = getStrings();

  // Apply i18n
  $('subtitle').textContent = strings.subtitle;
  $('status-label').textContent = strings.openTabs;
  $('label-limit').textContent = strings.tabLimit;
  $('blocked-text').textContent = strings.blocked;

  // Load saved settings
  const stored = await chrome.storage.local.get([LIMIT_KEY, ENABLED_KEY]);
  currentLimit = stored[LIMIT_KEY] || DEFAULT_LIMIT;
  isEnabled = stored[ENABLED_KEY] !== false;

  limitInputEl.value = currentLimit;
  limitDisplayEl.textContent = currentLimit;
  toggleEl.checked = isEnabled;
  if (!isEnabled) document.body.classList.add('disabled');

  // Get current tab count
  await updateTabCount();

  // Load remote config
  const config = await getExtensionConfig();

  // Privacy link
  if (privacyLinkEl) privacyLinkEl.href = config.privacyUrl;

  // Donation banner (show after 3 uses, controlled by Remote Config)
  const useCount = await incrementUseCount();
  if (config.donation.show && useCount >= 3) {
    donateLinkEl.href = config.donation.url;
    donateTextEl.textContent = config.donation.text || strings.donate;
    donateBannerEl.style.display = 'block';
  }

  // Rate Us (show after threshold uses)
  if (useCount >= RATE_US_THRESHOLD) {
    rateLinkEl.href = STORE_URL;
    $('rate-us').querySelector('a').textContent = strings.rateUs;
    rateUsEl.style.display = 'flex';
  }

  // Track popup open
  await trackPopupOpen();

  // Show blocked notice if last action was a block
  const lastBlocked = await chrome.storage.local.get('tab_limiter_last_blocked');
  if (lastBlocked.tab_limiter_last_blocked) {
    blockedNoticeEl.style.display = 'flex';
    await chrome.storage.local.remove('tab_limiter_last_blocked');
    setTimeout(() => { blockedNoticeEl.style.display = 'none'; }, 4000);
  }
}

// ---- Update tab count display ----
async function updateTabCount() {
  const tabs = await chrome.tabs.query({});
  const count = tabs.length;
  tabCountEl.textContent = count;
  limitDisplayEl.textContent = currentLimit;

  const ratio = currentLimit > 0 ? Math.min(count / currentLimit, 1) : 0;
  const pct = Math.round(ratio * 100);
  progressBarEl.style.width = pct + '%';

  // Color states
  progressBarEl.classList.remove('warning', 'danger');
  statusBarEl.classList.remove('warning', 'danger');
  if (ratio >= 1) {
    progressBarEl.classList.add('danger');
    statusBarEl.classList.add('danger');
  } else if (ratio >= 0.8) {
    progressBarEl.classList.add('warning');
    statusBarEl.classList.add('warning');
  }
}

// ---- Save limit ----
async function saveLimit(value) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) return;
  const clamped = Math.max(1, Math.min(100, parsed));
  currentLimit = clamped;
  limitInputEl.value = clamped;
  limitDisplayEl.textContent = clamped;
  await chrome.storage.local.set({ [LIMIT_KEY]: clamped });
  await updateTabCount();
  await trackLimitChanged(clamped);
}

// ---- Event listeners ----
$('btn-minus').addEventListener('click', () => saveLimit(currentLimit - 1));
$('btn-plus').addEventListener('click', () => saveLimit(currentLimit + 1));

limitInputEl.addEventListener('change', () => saveLimit(limitInputEl.value));
limitInputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveLimit(limitInputEl.value);
});

toggleEl.addEventListener('change', async () => {
  isEnabled = toggleEl.checked;
  await chrome.storage.local.set({ [ENABLED_KEY]: isEnabled });
  document.body.classList.toggle('disabled', !isEnabled);
  if (isEnabled) {
    chrome.action.setBadgeText({ text: String((await chrome.tabs.query({})).length) });
    chrome.action.setBadgeBackgroundColor({ color: '#4A90E2' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
});

donateLinkEl?.addEventListener('click', () => trackDonationClick());

// ---- Start ----
init();
