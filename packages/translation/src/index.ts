import type {ComputedRef, Ref} from 'vue';

import {replaceAll} from 'string-ts';
import {computed, ref} from 'vue';

/** Schema constraint: two-level nested object of translation strings. */
export type TranslationSchema = Record<string, Record<string, string>>;

// Rejects strings that contain a dot (e.g., "a.b" -> never, "ab" -> "ab")
type NoDot<S extends string> = S extends `${string}.${string}` ? never : S;

/**
 * Generates valid dot-notation keys from a TranslationSchema.
 * Only produces keys where both section and key names don't contain dots,
 * ensuring keys are always exactly "section.name" format.
 */
export type NestedKeys<T extends TranslationSchema, K extends keyof T = keyof T> = K extends string
    ? K extends NoDot<K>
        ? T[K] extends Record<string, string>
            ? keyof T[K] extends infer Name extends string
                ? Name extends NoDot<Name>
                    ? `${K}.${Name}`
                    : never
                : never
            : never
        : never
    : never;

/** Public API of a translation service instance. */
export interface TranslationService<TSchema extends TranslationSchema, TLocale extends string> {
    /**
     * Get a reactive translation by dot-notation key.
     * Returns a ComputedRef that updates when the locale changes.
     * Supports parameter interpolation via `{param}` placeholders.
     * Returns the key itself if the translation is not found.
     */
    t: (key: NestedKeys<TSchema>, params?: Record<string, string>) => ComputedRef<string>;
    /** Reactive locale ref. Assign to switch languages — all computed translations update automatically. */
    locale: Ref<TLocale>;
}

const getCacheKey = (key: string, params?: Record<string, string>): string => {
    if (!params) {
        return key;
    }
    return `${key}:${JSON.stringify(params)}`;
};

/**
 * Create a type-safe, reactive translation service.
 *
 * @param translations - Translation dictionaries keyed by locale. All locales must share the same schema.
 * @param defaultLocale - The initial locale to use.
 */
export const createTranslationService = <const TSchema extends TranslationSchema, const TLocale extends string>(
    translations: Record<TLocale, TSchema>,
    defaultLocale: NoInfer<TLocale>,
): TranslationService<TSchema, TLocale> => {
    const locale = ref(defaultLocale) as Ref<TLocale>;
    const cache = new Map<string, ComputedRef<string>>();

    const createTranslationComputed = (key: string, params?: Record<string, string>): ComputedRef<string> => {
        return computed(() => {
            const parts = key.split('.');

            if (parts.length !== 2) {
                return key;
            }

            const [section, name] = parts as [string, string];
            const localeData = translations[locale.value] as Record<string, Record<string, string>> | undefined;
            const sectionData = localeData?.[section];
            let text = sectionData?.[name];

            if (text === undefined) {
                return key;
            }

            if (params) {
                for (const [param, value] of Object.entries(params)) {
                    text = replaceAll(text, `{${param}}`, value);
                }
            }

            return text;
        });
    };

    const t = (key: NestedKeys<TSchema>, params?: Record<string, string>): ComputedRef<string> => {
        const keyString = key as string;
        const cacheKey = getCacheKey(keyString, params);

        const cached = cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const translationComputed = createTranslationComputed(keyString, params);
        cache.set(cacheKey, translationComputed);
        return translationComputed;
    };

    return {t, locale};
};
