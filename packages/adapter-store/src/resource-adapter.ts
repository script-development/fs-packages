import type {Writable} from '@script-development/fs-helpers';
import type {HttpService} from '@script-development/fs-http';
import type {Ref} from 'vue';

import {deepCopy} from '@script-development/fs-helpers';
import {ref} from 'vue';

import type {Adapted, AdapterStoreModule, Item, NewAdapted} from './types';

import {MissingResponseDataError} from './errors';

type ResourceHttpService = Pick<HttpService, 'postRequest' | 'putRequest' | 'patchRequest' | 'deleteRequest'>;

interface AdapterRepository<T extends Item, N> {
    create: (newItem: N) => Promise<T>;
    update: (id: number, updatedItem: N | T) => Promise<T>;
    patch: (id: number, partialItem: Partial<N>) => Promise<T>;
    delete: (id: number) => Promise<void>;
}

const adapterRepositoryFactory = <T extends Item, N>(
    domainName: string,
    {setById, deleteById}: AdapterStoreModule<T>,
    httpService: ResourceHttpService,
): AdapterRepository<T, N> => {
    const dataHandler = (data: T | undefined, actionType: 'create' | 'update' | 'patch'): T => {
        if (!data) {
            throw new MissingResponseDataError(
                `${actionType} route for ${domainName} returned no model in response to put in store.`,
            );
        }

        setById(data);

        return data;
    };

    return {
        create: async (newItem: N) => {
            const {data} = await httpService.postRequest<T>(domainName, newItem);
            return dataHandler(data, 'create');
        },
        update: async (id: number, updatedItem: N | T) => {
            const {data} = await httpService.putRequest<T>(`${domainName}/${id}`, updatedItem);
            return dataHandler(data, 'update');
        },
        patch: async (id: number, partialItem: Partial<N>) => {
            const {data} = await httpService.patchRequest<T>(`${domainName}/${id}`, partialItem);
            return dataHandler(data, 'patch');
        },
        delete: async (id: number) => {
            await httpService.deleteRequest<void>(`${domainName}/${id}`);
            deleteById(id);
        },
    };
};

/**
 * Resource adapter factory — wraps a domain resource with mutable state and CRUD methods.
 *
 * Overloaded:
 * - With resourceGetter `() => T`: creates an Adapted (existing resource with update/patch/delete)
 * - Without: creates a NewAdapted (new resource with create)
 */
export function resourceAdapter<T extends Item, N extends object = Omit<T, 'id'>>(
    resourceGetter: () => T,
    domainName: string,
    storeModule: AdapterStoreModule<T>,
    httpService: ResourceHttpService,
): Adapted<T, N>;
export function resourceAdapter<T extends Item, N extends object = Omit<T, 'id'>>(
    resource: N,
    domainName: string,
    storeModule: AdapterStoreModule<T>,
    httpService: ResourceHttpService,
): NewAdapted<T, N>;
export function resourceAdapter<T extends Item, N extends object = Omit<T, 'id'>>(
    resource: (() => T) | N,
    domainName: string,
    storeModule: AdapterStoreModule<T>,
    httpService: ResourceHttpService,
): Adapted<T, N> | NewAdapted<T, N> {
    const repository = adapterRepositoryFactory<T, N>(domainName, storeModule, httpService);

    if (typeof resource === 'function') {
        const resourceGetter = resource as () => T;
        const mutable = ref(deepCopy(resourceGetter())) as Ref<Writable<T>>;

        const adapted = {} as Adapted<T, N>;
        const source = resourceGetter();

        for (const key of Object.keys(source)) {
            Object.defineProperty(adapted, key, {
                get: () => resourceGetter()[key as keyof T],
                enumerable: true,
                configurable: true,
            });
        }

        Object.defineProperty(adapted, 'mutable', {
            value: mutable,
            enumerable: true,
            configurable: true,
            writable: false,
        });
        Object.defineProperty(adapted, 'reset', {
            value: () => (mutable.value = deepCopy(resourceGetter())),
            enumerable: true,
            configurable: true,
            writable: false,
        });
        Object.defineProperty(adapted, 'update', {
            value: () => repository.update(resourceGetter().id, mutable.value as N | T),
            enumerable: true,
            configurable: true,
            writable: false,
        });
        Object.defineProperty(adapted, 'patch', {
            value: (partialItem: Partial<N>) => repository.patch(resourceGetter().id, partialItem),
            enumerable: true,
            configurable: true,
            writable: false,
        });
        Object.defineProperty(adapted, 'delete', {
            value: () => repository.delete(resourceGetter().id),
            enumerable: true,
            configurable: true,
            writable: false,
        });

        return adapted;
    }

    const mutable = ref(deepCopy(resource)) as Ref<Writable<N>>;

    return {
        ...Object.freeze(resource as object),
        mutable,
        reset: () => (mutable.value = deepCopy(resource)),
        create: () => repository.create(mutable.value as N),
    } as unknown as NewAdapted<T, N>;
}
