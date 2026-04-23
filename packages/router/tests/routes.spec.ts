import {describe, expect, it} from 'vitest';
import {defineComponent, h} from 'vue';

import {
    CREATE_PAGE_NAME,
    EDIT_PAGE_NAME,
    OVERVIEW_PAGE_NAME,
    SHOW_PAGE_NAME,
    createCrudRoutes,
    createNestedCrudRoutes,
    createStandardRouteConfig,
} from '../src';

const TestPage = defineComponent({render: () => h('div', 'test')});
const lazyPage = () => Promise.resolve(TestPage);

describe('route constants', () => {
    it('should export correct page name suffixes', () => {
        expect(CREATE_PAGE_NAME).toBe('.create');
        expect(EDIT_PAGE_NAME).toBe('.edit');
        expect(OVERVIEW_PAGE_NAME).toBe('.overview');
        expect(SHOW_PAGE_NAME).toBe('.show');
    });
});

describe('createStandardRouteConfig', () => {
    it('should return a route config when component is provided', () => {
        // Act
        const route = createStandardRouteConfig('', 'items.overview', lazyPage);

        // Assert
        expect(route).toEqual({path: '', name: 'items.overview', component: lazyPage, meta: {}});
    });

    it('should return undefined when component is undefined', () => {
        // Act
        const route = createStandardRouteConfig('', 'items.overview', undefined);

        // Assert
        expect(route).toBeUndefined();
    });

    it('should propagate custom meta', () => {
        // Arrange
        const meta = {authOnly: true, canSeeWhenLoggedIn: true};

        // Act
        const route = createStandardRouteConfig('create', 'items.create', lazyPage, meta);

        // Assert
        expect(route!.meta).toEqual(meta);
    });

    it('should use empty object as default meta', () => {
        // Act
        const route = createStandardRouteConfig('', 'items.overview', lazyPage);

        // Assert
        expect(route!.meta).toEqual({});
    });
});

describe('createCrudRoutes', () => {
    it('should create parent route with all four children', () => {
        // Act
        const routes = createCrudRoutes('items', 'items', TestPage, {
            overview: lazyPage,
            create: lazyPage,
            edit: lazyPage,
            show: lazyPage,
        });

        // Assert
        expect(routes.path).toBe('/items');
        expect(routes.component).toBe(TestPage);
        expect(routes.children).toHaveLength(4);
        expect(routes.children[0].name).toBe('items.overview');
        expect(routes.children[0].path).toBe('');
        expect(routes.children[1].name).toBe('items.create');
        expect(routes.children[1].path).toBe('create');
        expect(routes.children[2].name).toBe('items.edit');
        expect(routes.children[2].path).toBe(':id/edit');
        expect(routes.children[3].name).toBe('items.show');
        expect(routes.children[3].path).toBe(':id');
    });

    it('should filter out undefined components', () => {
        // Act
        const routes = createCrudRoutes('items', 'items', TestPage, {
            overview: lazyPage,
            create: undefined,
            edit: lazyPage,
            show: undefined,
        });

        // Assert
        expect(routes.children).toHaveLength(2);
        expect(routes.children[0].name).toBe('items.overview');
        expect(routes.children[1].name).toBe('items.edit');
    });

    it('should propagate meta to all children', () => {
        // Arrange
        const meta = {authOnly: true, isAdmin: false};

        // Act
        const routes = createCrudRoutes(
            'items',
            'items',
            TestPage,
            {overview: lazyPage, create: lazyPage, edit: undefined, show: undefined},
            meta,
        );

        // Assert
        for (const child of routes.children) {
            expect(child.meta).toEqual(meta);
        }
    });

    it('should use empty meta by default', () => {
        // Act
        const routes = createCrudRoutes('items', 'items', TestPage, {
            overview: lazyPage,
            create: undefined,
            edit: undefined,
            show: undefined,
        });

        // Assert
        expect(routes.children[0].meta).toEqual({});
    });
});

describe('createNestedCrudRoutes', () => {
    it('should create nested route with correct path pattern', () => {
        // Act
        const routes = createNestedCrudRoutes({parent: 'projects', child: 'issues'}, 'projects.issues', TestPage, {
            overview: lazyPage,
            create: lazyPage,
            edit: lazyPage,
            show: lazyPage,
        });

        // Assert
        expect(routes.path).toBe('/projects/:parentId/issues');
        expect(routes.component).toBe(TestPage);
        expect(routes.children).toHaveLength(4);
        expect(routes.children[0].name).toBe('projects.issues.overview');
        expect(routes.children[1].name).toBe('projects.issues.create');
        expect(routes.children[2].name).toBe('projects.issues.edit');
        expect(routes.children[3].name).toBe('projects.issues.show');
    });

    it('should use correct child path patterns', () => {
        // Act
        const routes = createNestedCrudRoutes({parent: 'projects', child: 'issues'}, 'projects.issues', TestPage, {
            overview: lazyPage,
            create: lazyPage,
            edit: lazyPage,
            show: lazyPage,
        });

        // Assert — verify the actual path patterns
        expect(routes.children[0].path).toBe('');
        expect(routes.children[1].path).toBe('create');
        expect(routes.children[2].path).toBe(':id/edit');
        expect(routes.children[3].path).toBe(':id');
    });

    it('should filter out undefined components', () => {
        // Act
        const routes = createNestedCrudRoutes({parent: 'projects', child: 'issues'}, 'projects.issues', TestPage, {
            overview: lazyPage,
            create: undefined,
            edit: undefined,
            show: undefined,
        });

        // Assert
        expect(routes.children).toHaveLength(1);
        expect(routes.children[0].name).toBe('projects.issues.overview');
    });

    it('should propagate meta to all children', () => {
        // Arrange
        const meta = {requiresAuth: true};

        // Act
        const routes = createNestedCrudRoutes(
            {parent: 'projects', child: 'issues'},
            'projects.issues',
            TestPage,
            {overview: lazyPage, create: lazyPage, edit: undefined, show: undefined},
            meta,
        );

        // Assert
        for (const child of routes.children) {
            expect(child.meta).toEqual(meta);
        }
    });
});
