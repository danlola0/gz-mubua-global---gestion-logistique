// Interface language (Français / English / 中文).
// The application is written in French; this module translates the texts shown on
// screen without touching the components: every text node and the placeholder /
// title / aria-label / alt attributes are translated in place, and re-translated
// whenever React updates them. Data typed by users (inputs, textareas) is never
// changed, and an element marked data-no-translate is left as is.
import { DICTIONARY, PATTERNS } from './dictionary.ts';

export type Lang = 'fr' | 'en' | 'zh';
export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '中文', short: '中文' },
];

const STORAGE_KEY = 'gz-lang';
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE']);

const readStoredLang = (): Lang => {
  // A link may force the language: ?lang=en / ?lang=zh / ?lang=fr
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'fr' || fromUrl === 'en' || fromUrl === 'zh') {
    try {
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      /* ignore */
    }
    return fromUrl;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'zh' ? stored : 'fr';
  } catch {
    return 'fr';
  }
};

let currentLang: Lang = readStoredLang();
const listeners = new Set<(lang: Lang) => void>();

export const getLang = (): Lang => currentLang;
export const onLangChange = (listener: (lang: Lang) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Lookup tables: exact sentences and sentences with variable parts.
const exact = new Map<string, [string, string]>(Object.entries(DICTIONARY));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = PATTERNS.map(([fr, en, zh]) => ({
  regex: new RegExp('^' + escapeRegExp(fr).replace(/\\\{\d\\\}/g, '(.+?)') + '$'),
  order: (fr.match(/\{(\d)\}/g) || []).map((m) => Number(m[1])),
  en,
  zh,
}));

const translateCore = (text: string, lang: Lang): string => {
  if (lang === 'fr') return text;
  const column = lang === 'en' ? 0 : 1;
  const found = exact.get(text);
  if (found) return found[column];
  for (const p of patterns) {
    const match = text.match(p.regex);
    if (!match) continue;
    const values: Record<number, string> = {};
    p.order.forEach((index, i) => {
      values[index] = translateCore(match[i + 1], lang);
    });
    return (lang === 'en' ? p.en : p.zh).replace(/\{(\d)\}/g, (_, i) => values[Number(i)] ?? '');
  }
  return text;
};

/** Translates a French text of the interface (unknown texts are returned unchanged). */
export const translate = (text: string, lang: Lang = currentLang): string => {
  if (lang === 'fr' || !text) return text;
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return text;
  const core = m[2].replace(/\s+/g, ' ');
  const translated = translateCore(core, lang);
  return translated === core ? text : m[1] + translated + m[3];
};

// --- DOM translation -------------------------------------------------------
// Original French value of each text node / attribute, and the value we wrote,
// so that our own writes are recognised and React updates are picked up.
const textOriginal = new WeakMap<Node, string>();
const textWritten = new WeakMap<Node, string>();
const attrOriginal = new WeakMap<Element, Record<string, string>>();
const attrWritten = new WeakMap<Element, Record<string, string>>();

const isSkipped = (el: Element | null): boolean => {
  for (let node = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName) || node.hasAttribute('data-no-translate') || (node as HTMLElement).isContentEditable) return true;
  }
  return false;
};

const processText = (node: Text) => {
  const value = node.nodeValue ?? '';
  if (textWritten.get(node) === value) return; // our own write
  if (isSkipped(node.parentElement)) return;
  textOriginal.set(node, value);
  const translated = translate(value);
  if (translated !== value) {
    textWritten.set(node, translated);
    node.nodeValue = translated;
  } else {
    textWritten.delete(node);
  }
};

const processAttribute = (el: Element, name: string) => {
  const value = el.getAttribute(name);
  if (value === null) return;
  const written = attrWritten.get(el) || {};
  if (written[name] === value) return;
  if (isSkipped(el)) return;
  const originals = attrOriginal.get(el) || {};
  originals[name] = value;
  attrOriginal.set(el, originals);
  const translated = translate(value);
  if (translated !== value) {
    written[name] = translated;
    attrWritten.set(el, written);
    el.setAttribute(name, translated);
  } else {
    delete written[name];
  }
};

const processTree = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    processText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) processText(node as Text);
    else for (const name of ATTRIBUTES) if ((node as Element).hasAttribute(name)) processAttribute(node as Element, name);
  };
  if (root.nodeType === Node.ELEMENT_NODE) visit(root);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) visit(node);
};

/** Re-applies the current language to everything already on screen. */
const retranslateAll = () => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const original = textOriginal.get(node);
      const current = node.nodeValue ?? '';
      // Text changed by React since our last write: it is the new original.
      const source = original !== undefined && textWritten.get(node) === current ? original : current;
      if (original === undefined && currentLang === 'fr') continue;
      if (isSkipped(node.parentElement)) continue;
      textOriginal.set(node, source);
      const translated = translate(source);
      textWritten.set(node, translated);
      if (translated !== current) node.nodeValue = translated;
    } else {
      const el = node as Element;
      for (const name of ATTRIBUTES) {
        const current = el.getAttribute(name);
        if (current === null) continue;
        const originals = attrOriginal.get(el) || {};
        const written = attrWritten.get(el) || {};
        const source = originals[name] !== undefined && written[name] === current ? originals[name] : current;
        if (originals[name] === undefined && currentLang === 'fr') continue;
        if (isSkipped(el)) continue;
        originals[name] = source;
        attrOriginal.set(el, originals);
        const translated = translate(source);
        written[name] = translated;
        attrWritten.set(el, written);
        if (translated !== current) el.setAttribute(name, translated);
      }
    }
  }
  if (document.title) {
    const base = 'GZ MUBUA GLOBAL - Gestion Logistique & Fret';
    document.title = currentLang === 'fr' ? base : currentLang === 'en' ? 'GZ MUBUA GLOBAL - Logistics & Freight Management' : 'GZ MUBUA GLOBAL - 物流与货运管理';
  }
};

export const setLang = (lang: Lang) => {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode: the choice is kept for this visit only */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  retranslateAll();
  listeners.forEach((listener) => listener(lang));
};

let installed = false;
export function installTranslator(): void {
  if (installed) return;
  installed = true;
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : currentLang;

  // Browser dialogs (alert / confirm) built from French messages.
  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  window.alert = (message?: unknown) => nativeAlert(translate(String(message ?? '')));
  window.confirm = (message?: string) => nativeConfirm(translate(String(message ?? '')));

  const observer = new MutationObserver((mutations) => {
    if (currentLang === 'fr') {
      // Keep the originals of React updates so that switching language later works.
      for (const m of mutations) if (m.type === 'characterData') textOriginal.delete(m.target);
      return;
    }
    for (const m of mutations) {
      if (m.type === 'childList') m.addedNodes.forEach(processTree);
      else if (m.type === 'characterData') processText(m.target as Text);
      else if (m.type === 'attributes' && m.attributeName) processAttribute(m.target as Element, m.attributeName);
    }
  });
  const start = () => {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    if (currentLang !== 'fr') retranslateAll();
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}
