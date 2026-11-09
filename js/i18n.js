// Two-language support without duplicating content.
// English is authored directly in index.html (good for SEO and no-JS visitors);
// Turkish lives in i18n/tr.json and is fetched only when requested.
//
//   <p data-i18n="hero.lede">English markup…</p>
//   <input data-i18n-attr="placeholder:form.name_ph">

const STORAGE_KEY = 'lang';
const SUPPORTED = ['en', 'tr'];
const root = document.documentElement;

const english = new Map(); // element -> original innerHTML
const englishAttrs = new Map(); // element -> { attr: value }
let dictionary = {};
let lang = 'en';

function snapshotEnglish() {
  document.querySelectorAll('[data-i18n]').forEach((el) => english.set(el, el.innerHTML));
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const attrs = {};
    for (const pair of parseAttrSpec(el.dataset.i18nAttr)) attrs[pair.attr] = el.getAttribute(pair.attr);
    englishAttrs.set(el, attrs);
  });
  english.set('meta.title', document.title);
  english.set('meta.description', document.querySelector('meta[name="description"]')?.content ?? '');
}

function parseAttrSpec(spec) {
  return spec.split(';').filter(Boolean).map((part) => {
    const [attr, key] = part.split(':').map((s) => s.trim());
    return { attr, key };
  });
}

async function loadDictionary(code) {
  if (code === 'en') return {};
  const response = await fetch(`i18n/${code}.json`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Missing translations for ${code}`);
  return response.json();
}

function apply() {
  const isEnglish = lang === 'en';

  english.forEach((html, el) => {
    if (typeof el === 'string') return;
    const key = el.dataset.i18n;
    // Dictionary strings are first-party content from this repository.
    el.innerHTML = isEnglish ? html : dictionary[key] ?? html;
  });

  englishAttrs.forEach((attrs, el) => {
    for (const { attr, key } of parseAttrSpec(el.dataset.i18nAttr)) {
      el.setAttribute(attr, isEnglish ? attrs[attr] : dictionary[key] ?? attrs[attr]);
    }
  });

  document.title = isEnglish ? english.get('meta.title') : dictionary['meta.title'] ?? english.get('meta.title');
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.content = isEnglish
      ? english.get('meta.description')
      : dictionary['meta.description'] ?? english.get('meta.description');
  }

  root.lang = lang;
}

/** Translate a string used from JavaScript. `fallback` is the English text. */
export function t(key, fallback) {
  return lang === 'en' ? fallback : dictionary[key] ?? fallback;
}

export function currentLang() {
  return lang;
}

export async function setLang(code) {
  if (!SUPPORTED.includes(code)) return;
  try {
    dictionary = await loadDictionary(code);
    lang = code;
  } catch (error) {
    console.warn(error);
    dictionary = {};
    lang = 'en';
  }
  apply();
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export async function initI18n(button) {
  snapshotEnglish();

  const sync = () => {
    const other = lang === 'en' ? 'tr' : 'en';
    button.textContent = other.toUpperCase();
    button.setAttribute('aria-label', other === 'tr' ? 'Türkçe’ye geç' : 'Switch to English');
    button.setAttribute('lang', other);
  };

  button.addEventListener('click', () => setLang(lang === 'en' ? 'tr' : 'en'));
  document.addEventListener('langchange', sync);

  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const initial = SUPPORTED.includes(fromUrl) ? fromUrl : saved;

  if (initial && initial !== 'en') {
    await setLang(initial);
  } else {
    sync();
  }
}
