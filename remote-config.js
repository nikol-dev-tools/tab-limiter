// ============================================================
// SCHEPKI REMOTE CONFIG MODULE v2.0
// Fetches config from GitHub, caches 6h, falls back gracefully
// ============================================================

const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/nikol-dev-tools/schepki-config/main/config.json';
const CACHE_KEY = 'schepki_remote_config';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms
const EXTENSION_ID = 'tab_limiter';

// Fallback config — used when GitHub is unreachable
const FALLBACK_CONFIG = {
  global: {
    privacy_policy_url: 'https://nikol-dev-tools.github.io/schepki-config/privacy',
    support_email: 'nikol.dev.tools@gmail.com'
  },
  monetization: {
    donation_links: {
      buymeacoffee: 'https://buymeacoffee.com/nikoltools'
    }
  },
  extensions: {
    tab_limiter: {
      is_active: true,
      donation: {
        show: true,
        source: 'buymeacoffee',
        text_en: 'Support the developer ☕'
      }
    }
  }
};

async function fetchRemoteConfig() {
  try {
    const cached = await chrome.storage.local.get(CACHE_KEY);
    if (cached[CACHE_KEY]) {
      const { data, timestamp } = cached[CACHE_KEY];
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
    const response = await fetch(REMOTE_CONFIG_URL + '?t=' + Date.now());
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    await chrome.storage.local.set({
      [CACHE_KEY]: { data, timestamp: Date.now() }
    });
    return data;
  } catch (e) {
    console.warn('[Schepki] Remote config fetch failed, using fallback:', e.message);
    return FALLBACK_CONFIG;
  }
}

async function getExtensionConfig() {
  const config = await fetchRemoteConfig();
  const extConfig = config?.extensions?.[EXTENSION_ID] || FALLBACK_CONFIG.extensions[EXTENSION_ID];
  const global = config?.global || FALLBACK_CONFIG.global;
  const monetization = config?.monetization || FALLBACK_CONFIG.monetization;

  // GEO override (best-effort, no extra permissions needed)
  let donationSource = extConfig?.donation?.source || 'buymeacoffee';
  try {
    const lang = navigator.language || '';
    const country = lang.split('-')[1]?.toUpperCase();
    const geoOverride = extConfig?.geo_overrides?.[country];
    if (geoOverride?.donation_source) donationSource = geoOverride.donation_source;
  } catch (_) {}

  const donationUrl = monetization?.donation_links?.[donationSource]
    || monetization?.donation_links?.buymeacoffee
    || FALLBACK_CONFIG.monetization.donation_links.buymeacoffee;

  return {
    isActive: extConfig?.is_active !== false,
    donation: {
      show: extConfig?.donation?.show !== false,
      url: donationUrl + '?utm_source=tab_limiter&utm_medium=extension&utm_campaign=donate',
      text: extConfig?.donation?.text_en || 'Support the developer ☕'
    },
    privacyUrl: global?.privacy_policy_url || FALLBACK_CONFIG.global.privacy_policy_url,
    crossPromo: config?.cross_promo || null
  };
}

export { getExtensionConfig };
