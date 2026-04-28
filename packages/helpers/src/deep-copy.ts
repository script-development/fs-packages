type WritablePrimitive = undefined | null | boolean | string | number | Date;

export type Writable<T> = T extends WritablePrimitive
    ? T
    : T extends readonly [...infer U]
      ? {-readonly [K in keyof U]: Writable<U[K]>}
      : T extends ReadonlyArray<infer U>
        ? Array<Writable<U>>
        : T extends object
          ? {-readonly [K in keyof T]: Writable<T[K]>}
          : T;

/**
 * Deep copy for plain objects, arrays, and Date instances.
 *
 * Uses manual recursion over structuredClone for performance (~10x faster
 * depending on object size and depth).
 *
 * Handles: primitives, plain objects, arrays, Date, null.
 * Does NOT handle: Map, Set, RegExp, functions, circular references.
 *
 * Security: skips `__proto__` and `constructor` keys to prevent prototype
 * pollution when copying untrusted input (e.g., `JSON.parse` of external
 * data, where these keys are treated as literal own properties).
 */
export const deepCopy = <T>(toCopy: T): Writable<T> => {
    if (typeof toCopy !== 'object' || toCopy === null) return toCopy as Writable<T>;

    if (toCopy instanceof Date) return new Date(toCopy.getTime()) as Writable<T>;

    if (Array.isArray(toCopy)) return toCopy.map((value: unknown) => deepCopy(value)) as Writable<T>;

    const copiedObject: Record<string, unknown> = {};

    for (const key of Object.keys(toCopy)) {
        if (key === '__proto__' || key === 'constructor') continue;
        copiedObject[key] = deepCopy((toCopy as Record<string, unknown>)[key]);
    }

    return copiedObject as Writable<T>;
};
