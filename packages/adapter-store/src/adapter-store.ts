import type {ComputedRef, Ref} from 'vue';

import {computed, ref} from 'vue';

import type {Adapted, AdapterStoreConfig, AdapterStoreModule, Item, NewAdapted, StoreModuleForAdapter} from './types';

import {EntryNotFoundError} from './errors';

export const createAdapterStoreModule = <
    T extends Item,
    E extends Adapted<T, object> = Adapted<T>,
    N extends NewAdapted<T, object> = NewAdapted<T>,
>(
    config: AdapterStoreConfig<T, E, N>,
): StoreModuleForAdapter<T, E, N> => {
    const {domainName, adapter, httpService, storageService, loadingService, broadcast} = config;

    const storedItems = storageService.get<{[id: number]: T}>(domainName, {});
    const frozenStoredItems = Object.fromEntries(
        Object.entries(storedItems).map(([id, item]) => [id, Object.freeze(item)]),
    ) as {[id: number]: Readonly<T>};

    const state: Ref<{[id: number]: Readonly<T>}> = ref(frozenStoredItems);

    const adaptedCache = new Map<number, E>();
    const getByIdComputedCache = new Map<number, ComputedRef<E | undefined>>();

    const getAdapted = (item: Readonly<T>): E => {
        const cached = adaptedCache.get(item.id);
        if (cached) {
            return cached;
        }
        const adapted = adapter(storeModule, () => state.value[item.id] as T);
        adaptedCache.set(item.id, adapted);
        return adapted;
    };

    const setById = (item: T): void => {
        state.value = {...state.value, [item.id]: Object.freeze(item)};
        storageService.put(domainName, state.value);
        adaptedCache.delete(item.id);
    };

    const deleteById = (id: number): void => {
        state.value = Object.fromEntries(Object.entries(state.value).filter(([key]) => Number(key) !== id)) as {
            [id: number]: Readonly<T>;
        };
        storageService.put(domainName, state.value);
        adaptedCache.delete(id);
        getByIdComputedCache.delete(id);
    };

    const storeModule: AdapterStoreModule<T> = {setById, deleteById};

    broadcast?.subscribe({onUpdate: setById, onDelete: deleteById});

    const getById = (id: number): ComputedRef<E | undefined> => {
        const cached = getByIdComputedCache.get(id);
        if (cached) {
            return cached;
        }
        const computedRef = computed(() => (state.value[id] ? getAdapted(state.value[id]) : undefined));
        getByIdComputedCache.set(id, computedRef);
        return computedRef;
    };

    return {
        getAll: computed(() => Object.values(state.value).map((item) => getAdapted(item))),
        getById,
        getOrFailById: async (id: number) => {
            await loadingService.ensureLoadingFinished();
            const item = getById(id).value;
            if (!item) throw new EntryNotFoundError(domainName, id);
            return item;
        },
        generateNew: () => adapter(storeModule),
        retrieveById: async (id: number) => {
            const {data} = await httpService.getRequest<T>(`${domainName}/${id}`);
            setById(data);
        },
        retrieveAll: async () => {
            const {data} = await httpService.getRequest<T[]>(domainName);
            state.value = data.reduce<{[id: number]: Readonly<T>}>((acc, item) => {
                acc[item.id] = Object.freeze(item);
                return acc;
            }, {});
            storageService.put(domainName, state.value);
            adaptedCache.clear();
            getByIdComputedCache.clear();
        },
    };
};
