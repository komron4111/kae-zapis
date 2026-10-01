// Язык интерфейса (2.7.0): русский и казахский — для приложения мастера, страницы клиентов
// и страницы администратора. Тексты в коде пишутся по-русски внутри t('…'); казахский берётся
// из словаря kk.js (русская фраза → казахская). Нет перевода — остаётся русский текст.
// Подстановки: t('Подписка до {date}', { date }). Язык хранится на этом устройстве (localStorage);
// сначала — язык телефона (казахский, если телефон на казахском).

import KK from './kk.js';
import { setLang as setLogicLang } from './logic.js';

export const LANGS = ['ru', 'kk'];
const KEY = 'kae:lang';
const has = Object.prototype.hasOwnProperty;

function startLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch (e) { /* приватный режим */ }
  return /^kk\b/i.test(navigator.language || '') ? 'kk' : 'ru';
}

let lang = startLang();

export function t(text, vars) {
  let out = lang === 'kk' && has.call(KK, text) ? KK[text] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (has.call(vars, k) ? String(vars[k]) : m));
  return out;
}

export const getLang = () => lang;

export function setLang(next) {
  lang = LANGS.includes(next) ? next : 'ru';
  try { localStorage.setItem(KEY, lang); } catch (e) { /* не страшно */ }
  apply();
}

// Кнопка переключения показывает другой язык: «Қаз» — перейти на казахский, «Рус» — на русский.
export const otherLangLabel = () => (lang === 'kk' ? 'Рус' : 'Қаз');

function apply() {
  document.documentElement.lang = lang;
  setLogicLang(lang, t);
}
apply();
