import {describe, expect, it, vi} from 'vitest';
import {isRef, ref} from 'vue';

// @vitest-environment happy-dom
import type {Adapted, AdapterStoreModule, Item, NewAdapted} from '../src/types';

import {MissingResponseDataError} from '../src/errors';
import {resourceAdapter} from '../src/resource-adapter';

interface TestItem extends Item {
    id: number;
    userName: string;
    createdAt: string;
}

type TestNew = Omit<TestItem, 'id'>;

describe('resource adapter', () => {
    describe('adapting existing resource', () => {
        const existingResource: TestItem = {id: 1, userName: 'testUser', createdAt: '2024-01-01'};

        it('should return the original resource properties', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Assert
            expect(adapted.id).toBe(1);
            expect(adapted.userName).toBe('testUser');
            expect(adapted.createdAt).toBe('2024-01-01');
        });

        it('should provide a mutable ref with a deep copy of the resource', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Assert
            expect(isRef(adapted.mutable)).toBe(true);
            expect(adapted.mutable.value).toEqual({id: 1, userName: 'testUser', createdAt: '2024-01-01'});
            expect(adapted.mutable.value).not.toBe(existingResource);
        });

        it('should allow modifying the mutable ref without affecting original', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            adapted.mutable.value.userName = 'modifiedUser';

            // Assert
            expect(adapted.mutable.value.userName).toBe('modifiedUser');
            expect(adapted.userName).toBe('testUser');
            expect(existingResource.userName).toBe('testUser');
        });

        it('should reset mutable state to original with reset()', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );
            adapted.mutable.value.userName = 'modifiedUser';

            // Act
            adapted.reset();

            // Assert
            expect(adapted.mutable.value.userName).toBe('testUser');
        });

        it('should call httpService.putRequest with data as-is on update()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const putRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'updatedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );
            adapted.mutable.value.userName = 'updatedUser';

            // Act
            await adapted.update();

            // Assert
            expect(putRequest).toHaveBeenCalledWith('users/1', {
                id: 1,
                userName: 'updatedUser',
                createdAt: '2024-01-01',
            });
        });

        it('should call setById with response data after update()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const putRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'updatedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            await adapted.update();

            // Assert
            expect(setById).toHaveBeenCalledWith({id: 1, userName: 'updatedUser', createdAt: '2024-01-01'});
        });

        it('should return the updated item from update()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const putRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'updatedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            const result = await adapted.update();

            // Assert
            expect(result).toEqual({id: 1, userName: 'updatedUser', createdAt: '2024-01-01'});
        });

        it('should throw MissingResponseDataError when update response has no data', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const putRequest = vi.fn().mockResolvedValue({data: undefined});
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert
            await expect(adapted.update()).rejects.toThrow(MissingResponseDataError);
            await expect(adapted.update()).rejects.toThrow(
                'update route for users returned no model in response to put in store.',
            );
        });

        it('should call httpService.patchRequest with data as-is on patch()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const patchRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'patchedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            await adapted.patch({userName: 'patchedUser'});

            // Assert
            expect(patchRequest).toHaveBeenCalledWith('users/1', {userName: 'patchedUser'});
        });

        it('should call setById with response data after patch()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const patchRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'patchedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            await adapted.patch({userName: 'patchedUser'});

            // Assert
            expect(setById).toHaveBeenCalledWith({id: 1, userName: 'patchedUser', createdAt: '2024-01-01'});
        });

        it('should return the patched item from patch()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const patchRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'patchedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            const result = await adapted.patch({userName: 'patchedUser'});

            // Assert
            expect(result).toEqual({id: 1, userName: 'patchedUser', createdAt: '2024-01-01'});
        });

        it('should throw MissingResponseDataError when patch response has no data', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const patchRequest = vi.fn().mockResolvedValue({data: undefined});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert
            await expect(adapted.patch({userName: 'patchedUser'})).rejects.toThrow(MissingResponseDataError);
            await expect(adapted.patch({userName: 'patchedUser'})).rejects.toThrow(
                'patch route for users returned no model in response to put in store.',
            );
        });

        it('should propagate HTTP errors from patch()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const patchRequest = vi.fn().mockRejectedValue(new Error('Network error'));
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert
            await expect(adapted.patch({userName: 'patchedUser'})).rejects.toThrow('Network error');
            expect(setById).not.toHaveBeenCalled();
        });

        it('should call httpService.deleteRequest on delete()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const deleteRequest = vi.fn().mockResolvedValue({});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            await adapted.delete();

            // Assert
            expect(deleteRequest).toHaveBeenCalledWith('users/1');
        });

        it('should call deleteById after delete()', async () => {
            // Arrange
            const deleteById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById};
            const deleteRequest = vi.fn().mockResolvedValue({});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act
            await adapted.delete();

            // Assert
            expect(deleteById).toHaveBeenCalledWith(1);
        });

        it('should propagate HTTP errors from update()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const putRequest = vi.fn().mockRejectedValue(new Error('Network error'));
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert
            await expect(adapted.update()).rejects.toThrow('Network error');
            expect(setById).not.toHaveBeenCalled();
        });

        it('should propagate HTTP errors from delete()', async () => {
            // Arrange
            const deleteById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById};
            const deleteRequest = vi.fn().mockRejectedValue(new Error('Network error'));
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest};
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert
            await expect(adapted.delete()).rejects.toThrow('Network error');
            expect(deleteById).not.toHaveBeenCalled();
        });

        it('should have update, patch, and delete methods', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Assert
            expect(adapted).toHaveProperty('update');
            expect(adapted).toHaveProperty('patch');
            expect(adapted).toHaveProperty('delete');
            expect(typeof adapted.update).toBe('function');
            expect(typeof adapted.patch).toBe('function');
            expect(typeof adapted.delete).toBe('function');
        });

        it('should not have create method', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Assert
            expect(adapted).not.toHaveProperty('create');
        });

        it('should have reactive display properties that reflect getter changes', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            let source: TestItem = {id: 1, userName: 'original', createdAt: '2024-01-01'};
            const adapted: Adapted<TestItem> = resourceAdapter(() => source, 'users', storeModule, httpService);
            expect(adapted.userName).toBe('original');

            // Act
            source = {id: 1, userName: 'updated', createdAt: '2024-01-01'};

            // Assert
            expect(adapted.userName).toBe('updated');
        });

        it('should have read-only display properties', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert — writing to a getter-only property throws in strict mode
            expect(() => {
                (adapted as unknown as Record<string, string>).userName = 'new';
            }).toThrow();
        });

        it('should reset mutable to current getter state, not original state', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            let source: TestItem = {id: 1, userName: 'original', createdAt: '2024-01-01'};
            const adapted: Adapted<TestItem> = resourceAdapter(() => source, 'users', storeModule, httpService);
            adapted.mutable.value.userName = 'dirty';

            // Act — simulate store update, then reset
            source = {id: 1, userName: 'serverUpdated', createdAt: '2024-01-01'};
            adapted.reset();

            // Assert — mutable reflects the current server state, not the original
            expect(adapted.mutable.value.userName).toBe('serverUpdated');
        });

        it('should read current id from getter for update()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const putRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'updatedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest, patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const source: TestItem = {id: 1, userName: 'testUser', createdAt: '2024-01-01'};
            const adapted: Adapted<TestItem> = resourceAdapter(() => source, 'users', storeModule, httpService);

            // Act
            await adapted.update();

            // Assert — uses id from getter
            expect(putRequest).toHaveBeenCalledWith('users/1', expect.any(Object));
        });

        it('should read current id from getter for delete()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const deleteRequest = vi.fn().mockResolvedValue({});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest};
            const source: TestItem = {id: 1, userName: 'testUser', createdAt: '2024-01-01'};
            const adapted: Adapted<TestItem> = resourceAdapter(() => source, 'users', storeModule, httpService);

            // Act
            await adapted.delete();

            // Assert — uses id from getter
            expect(deleteRequest).toHaveBeenCalledWith('users/1');
        });

        it('should read current id from getter for patch()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const patchRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'patchedUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest: vi.fn(), putRequest: vi.fn(), patchRequest, deleteRequest: vi.fn()};
            const source: TestItem = {id: 1, userName: 'testUser', createdAt: '2024-01-01'};
            const adapted: Adapted<TestItem> = resourceAdapter(() => source, 'users', storeModule, httpService);

            // Act
            await adapted.patch({userName: 'patchedUser'});

            // Assert — uses id from getter
            expect(patchRequest).toHaveBeenCalledWith('users/1', {userName: 'patchedUser'});
        });

        it('should allow storing in a Vue ref() and accessing .mutable without TypeError', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act — wrapping in ref() creates a Vue Proxy; accessing .mutable triggers the get trap
            const wrapped = ref(adapted);

            // Assert — no TypeError from Proxy invariant violation
            // Vue auto-unwraps the inner Ref, so wrapped.value.mutable is the unwrapped value
            expect(wrapped.value.mutable).toEqual({id: 1, userName: 'testUser', createdAt: '2024-01-01'});
        });

        it('should still prevent direct assignment to mutable (writable: false protects)', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: Adapted<TestItem> = resourceAdapter(
                () => existingResource,
                'users',
                storeModule,
                httpService,
            );

            // Act & Assert — writable: false still prevents reassignment
            expect(() => {
                (adapted as unknown as Record<string, string>).mutable = 'overwritten';
            }).toThrow(TypeError);
        });
    });

    describe('property descriptors on existing resource adapter', () => {
        const existingRes: TestItem = {id: 1, userName: 'testUser', createdAt: '2024-01-01'};

        it('should have enumerable resource properties', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(() => existingRes, 'users', storeModule, httpService);

            // Assert — resource properties, mutable, reset, update, patch, delete should all be enumerable
            const keys = Object.keys(adapted);
            expect(keys).toContain('id');
            expect(keys).toContain('userName');
            expect(keys).toContain('createdAt');
            expect(keys).toContain('mutable');
            expect(keys).toContain('reset');
            expect(keys).toContain('update');
            expect(keys).toContain('patch');
            expect(keys).toContain('delete');
        });

        it('should have configurable resource properties to support Vue reactivity', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(() => existingRes, 'users', storeModule, httpService);

            // Assert — resource getter properties must be configurable for Vue proxy compatibility
            const idDescriptor = Object.getOwnPropertyDescriptor(adapted, 'id');
            expect(idDescriptor?.configurable).toBe(true);

            // mutable, reset, update, patch, delete must also be configurable
            const mutableDescriptor = Object.getOwnPropertyDescriptor(adapted, 'mutable');
            expect(mutableDescriptor?.configurable).toBe(true);
            const resetDescriptor = Object.getOwnPropertyDescriptor(adapted, 'reset');
            expect(resetDescriptor?.configurable).toBe(true);
            const updateDescriptor = Object.getOwnPropertyDescriptor(adapted, 'update');
            expect(updateDescriptor?.configurable).toBe(true);
            const patchDescriptor = Object.getOwnPropertyDescriptor(adapted, 'patch');
            expect(patchDescriptor?.configurable).toBe(true);
            const deleteDescriptor = Object.getOwnPropertyDescriptor(adapted, 'delete');
            expect(deleteDescriptor?.configurable).toBe(true);
        });

        it('should have non-writable method properties (mutable, reset, update, patch, delete)', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: Adapted<TestItem> = resourceAdapter(() => existingRes, 'users', storeModule, httpService);

            // Assert — all method/ref properties are writable: false
            const mutableDescriptor = Object.getOwnPropertyDescriptor(adapted, 'mutable');
            expect(mutableDescriptor?.writable).toBe(false);
            const resetDescriptor = Object.getOwnPropertyDescriptor(adapted, 'reset');
            expect(resetDescriptor?.writable).toBe(false);
            const updateDescriptor = Object.getOwnPropertyDescriptor(adapted, 'update');
            expect(updateDescriptor?.writable).toBe(false);
            const patchDescriptor = Object.getOwnPropertyDescriptor(adapted, 'patch');
            expect(patchDescriptor?.writable).toBe(false);
            const deleteDescriptor = Object.getOwnPropertyDescriptor(adapted, 'delete');
            expect(deleteDescriptor?.writable).toBe(false);
        });
    });

    describe('adapting new resource', () => {
        const newResource: TestNew = {userName: 'newUser', createdAt: '2024-01-01'};

        it('should return the original resource properties', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Assert
            expect(adapted.userName).toBe('newUser');
        });

        it('should provide a mutable ref with a deep copy of the resource', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Assert
            expect(isRef(adapted.mutable)).toBe(true);
            expect(adapted.mutable.value).toEqual({userName: 'newUser', createdAt: '2024-01-01'});
            expect(adapted.mutable.value).not.toBe(newResource);
        });

        it('should allow modifying the mutable ref without affecting original', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act
            adapted.mutable.value.userName = 'modifiedUser';

            // Assert
            expect(adapted.mutable.value.userName).toBe('modifiedUser');
            expect(adapted.userName).toBe('newUser');
        });

        it('should reset mutable state to original with reset()', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);
            adapted.mutable.value.userName = 'modifiedUser';

            // Act
            adapted.reset();

            // Assert
            expect(adapted.mutable.value.userName).toBe('newUser');
        });

        it('should call httpService.postRequest with data as-is on create()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const postRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'newUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest, putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act
            await adapted.create();

            // Assert
            expect(postRequest).toHaveBeenCalledWith('users', {userName: 'newUser', createdAt: '2024-01-01'});
        });

        it('should call setById with response data after create()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const postRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'newUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest, putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act
            await adapted.create();

            // Assert
            expect(setById).toHaveBeenCalledWith({id: 1, userName: 'newUser', createdAt: '2024-01-01'});
        });

        it('should return the created item from create()', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const postRequest = vi
                .fn()
                .mockResolvedValue({data: {id: 1, userName: 'newUser', createdAt: '2024-01-01'}});
            const httpService = {postRequest, putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act
            const result = await adapted.create();

            // Assert
            expect(result).toEqual({id: 1, userName: 'newUser', createdAt: '2024-01-01'});
        });

        it('should throw MissingResponseDataError when create response has no data', async () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const postRequest = vi.fn().mockResolvedValue({data: undefined});
            const httpService = {postRequest, putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act & Assert
            await expect(adapted.create()).rejects.toThrow(MissingResponseDataError);
            await expect(adapted.create()).rejects.toThrow(
                'create route for users returned no model in response to put in store.',
            );
        });

        it('should propagate HTTP errors from create()', async () => {
            // Arrange
            const setById = vi.fn();
            const storeModule: AdapterStoreModule<TestItem> = {setById, deleteById: vi.fn()};
            const postRequest = vi.fn().mockRejectedValue(new Error('Network error'));
            const httpService = {postRequest, putRequest: vi.fn(), patchRequest: vi.fn(), deleteRequest: vi.fn()};
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Act & Assert
            await expect(adapted.create()).rejects.toThrow('Network error');
            expect(setById).not.toHaveBeenCalled();
        });

        it('should have create method', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Assert
            expect(adapted).toHaveProperty('create');
            expect(typeof adapted.create).toBe('function');
        });

        it('should not have update, patch, and delete methods', () => {
            // Arrange
            const storeModule: AdapterStoreModule<TestItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted: NewAdapted<TestItem> = resourceAdapter(newResource, 'users', storeModule, httpService);

            // Assert
            expect(adapted).not.toHaveProperty('update');
            expect(adapted).not.toHaveProperty('patch');
            expect(adapted).not.toHaveProperty('delete');
        });
    });

    describe('deep copy behavior', () => {
        it('should deeply copy nested objects in mutable', () => {
            // Arrange
            interface NestedItem extends Item {
                id: number;
                nested: {value: string};
            }
            const nestedResource: NestedItem = {id: 1, nested: {value: 'original'}};
            const storeModule: AdapterStoreModule<NestedItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted = resourceAdapter(() => nestedResource, 'nested', storeModule, httpService);
            adapted.mutable.value.nested.value = 'modified';

            // Assert
            expect(adapted.mutable.value.nested.value).toBe('modified');
            expect(nestedResource.nested.value).toBe('original');
        });

        it('should deeply copy arrays in mutable', () => {
            // Arrange
            interface ArrayItem extends Item {
                id: number;
                items: string[];
            }
            const arrayResource: ArrayItem = {id: 1, items: ['a', 'b']};
            const storeModule: AdapterStoreModule<ArrayItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted = resourceAdapter(() => arrayResource, 'arrays', storeModule, httpService);
            adapted.mutable.value.items.push('c');

            // Assert
            expect(adapted.mutable.value.items).toEqual(['a', 'b', 'c']);
            expect(arrayResource.items).toEqual(['a', 'b']);
        });

        it('should deeply copy Date objects in mutable', () => {
            // Arrange
            interface DateItem extends Item {
                id: number;
                createdAt: Date;
            }
            const originalDate = new Date('2024-01-01');
            const dateResource: DateItem = {id: 1, createdAt: originalDate};
            const storeModule: AdapterStoreModule<DateItem> = {setById: vi.fn(), deleteById: vi.fn()};
            const httpService = {
                postRequest: vi.fn(),
                putRequest: vi.fn(),
                patchRequest: vi.fn(),
                deleteRequest: vi.fn(),
            };

            // Act
            const adapted = resourceAdapter(() => dateResource, 'dates', storeModule, httpService);
            adapted.mutable.value.createdAt.setFullYear(2025);

            // Assert
            expect(adapted.mutable.value.createdAt.getFullYear()).toBe(2025);
            expect(originalDate.getFullYear()).toBe(2024);
        });
    });
});
