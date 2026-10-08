import {storage} from '../platform/storage.js';
import {en, type Message, type MessageKey} from './en.js';
import {ptBR} from './pt-BR.js';

export type Locale = 'en' | 'pt-BR';
export const localeStorageKey = 'abroz-language';
export const languageOptions = [{value:'en', label:'English'}, {value:'pt-BR', label:'Português (Brasil)'}] as const;
export type Parameters = Readonly<Record<string, string | number>>;
type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;
const catalogs: Record<Locale, Partial<Record<MessageKey, Message>>> = {en, 'pt-BR':ptBR};
const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = {en: new Intl.PluralRules('en'), 'pt-BR':new Intl.PluralRules('pt-BR')};
export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'pt-BR';

export function detectLocale(languages: unknown): Locale {
  const candidates = Array.isArray(languages) ? languages : [languages];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    if (/^pt-br$/i.test(candidate)) return 'pt-BR';
    if (/^en(?:-[a-z]{2})?$/i.test(candidate)) return 'en';
  }
  return 'en';
}

/** Independent from gameplay/settings saves. Failed persistence keeps this session usable. */
export class LocalePreference {
  private current: Locale;
  private listeners = new Set<(locale: Locale) => void>();
  constructor(private store: LocaleStorage, languages: unknown) {
    let saved: unknown;
    try { saved = store.getItem(localeStorageKey); } catch { /* Use locale detection. */ }
    this.current = isLocale(saved) ? saved : detectLocale(languages);
  }
  get value(): Locale { return this.current; }
  set(value: unknown): boolean {
    if (!isLocale(value)) return false;
    // Persist even an explicit choice of the detected default.
    try { this.store.setItem(localeStorageKey, value); } catch { /* Session preference still works. */ }
    if (value === this.current) return false;
    this.current = value;
    this.listeners.forEach(listener => listener(value));
    return true;
  }
  subscribe(listener: (locale: Locale) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export function formatNumber(value: number, locale: Locale, digits?: number): string {
  const key = `${locale}:${digits ?? ''}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, digits === undefined ? undefined : {minimumFractionDigits:digits, maximumFractionDigits:digits});
    numberFormats.set(key, format);
  }
  return format.format(value);
}

/** Strings remain plain text; HTML callers must use th() or their existing escaper. */
export function translate(locale: Locale, key: MessageKey, params: Parameters = {}, catalog = catalogs[locale]): string {
  const message = catalog[key] ?? en[key];
  const template = typeof message === 'string' ? message : message[pluralRules[locale].select(Number(params.count)) === 'one' ? 'one' : 'other'];
  return template.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

export const localePreference = new LocalePreference(storage, typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : navigator.language);
export const getLocale = (): Locale => localePreference.value;
export const setLocale = (value: unknown): boolean => localePreference.set(value);
export const t = (key: MessageKey, params?: Parameters): string => translate(getLocale(), key, params);
export const escapeText = (text: string): string => text.replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]!));
export const th = (key: MessageKey, params?: Parameters): string => escapeText(t(key, params));
export const inputLabelKeys = ['input.left','input.right','input.up','input.down','input.combo','input.heavy','input.third','input.special1','input.special2','input.ultimate1','input.ultimate2'] as const;
