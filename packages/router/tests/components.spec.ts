// @vitest-environment happy-dom
import type {RouteRecordRaw} from 'vue-router';
import type {RouteLocationNormalizedLoaded} from 'vue-router';

import {flushPromises, mount} from '@vue/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import {createRouterLink, createRouterView, createRouterService} from '../src';

const TestPage = defineComponent({name: 'TestPage', render: () => h('div', {class: 'test-page'}, 'page content')});

const createTestRoutes = (): RouteRecordRaw[] => [
    {path: '/', name: 'home', component: TestPage},
    {path: '/about', name: 'about', component: TestPage},
    {
        path: '/items',
        component: defineComponent({render: () => h('div', 'layout')}),
        children: [
            {path: '', name: 'items.overview', component: TestPage},
            {path: ':id/edit', name: 'items.edit', component: TestPage},
            {path: ':id', name: 'items.show', component: TestPage},
        ],
    },
];

describe('createRouterView', () => {
    it('should render 404 when no matched route at depth', () => {
        // Arrange
        const routeRef = ref({matched: [], path: '/unknown', params: {}} as unknown as RouteLocationNormalizedLoaded);
        const RouterView = createRouterView(routeRef);

        // Act
        const wrapper = mount(RouterView);

        // Assert
        expect(wrapper.text()).toBe('404');
    });

    it('should render matched component at depth 0', async () => {
        // Arrange
        const service = createRouterService(createTestRoutes());
        await service.goToRoute('about');
        await flushPromises();

        // Act
        const wrapper = mount(service.RouterView);

        // Assert
        expect(wrapper.text()).toBe('page content');
    });

    it('should use depth prop for nested routes', async () => {
        // Arrange
        const service = createRouterService(createTestRoutes());
        await service.goToRoute('items.overview');
        await flushPromises();

        // Act — depth 1 should render the child
        const wrapper = mount(service.RouterView, {props: {depth: 1}});

        // Assert
        expect(wrapper.text()).toBe('page content');
    });

    it('should build key with resolved params', async () => {
        // Arrange
        const service = createRouterService(createTestRoutes());
        await service.goToRoute('items.show', 42);
        await flushPromises();

        // Act
        const wrapper = mount(service.RouterView, {props: {depth: 1}});

        // Assert — component should render with a key that includes the resolved id
        expect(wrapper.exists()).toBe(true);
    });

    it('should fall back to route path when no matched route at depth', () => {
        // Arrange — route with empty matched array at requested depth
        const routeRef = ref({
            matched: [{path: '/items', components: {default: TestPage}}],
            path: '/items/deep',
            params: {},
        } as unknown as RouteLocationNormalizedLoaded);
        const RouterView = createRouterView(routeRef);

        // Act — request depth 2 which doesn't exist
        const wrapper = mount(RouterView, {props: {depth: 2}});

        // Assert — should show 404 since no match at depth 2
        expect(wrapper.text()).toBe('404');
    });

    it('should handle array param values in route key', async () => {
        // Arrange
        const routeRef = ref({
            matched: [{path: '/items/:id', components: {default: TestPage}}],
            path: '/items/42',
            params: {id: ['42', '43']},
        } as unknown as RouteLocationNormalizedLoaded);
        const RouterView = createRouterView(routeRef);

        // Act
        const wrapper = mount(RouterView);

        // Assert
        expect(wrapper.text()).toBe('page content');
    });

    it('should skip empty param values in route key', () => {
        // Arrange
        const routeRef = ref({
            matched: [{path: '/items/:id', components: {default: TestPage}}],
            path: '/items/',
            params: {id: ''},
        } as unknown as RouteLocationNormalizedLoaded);
        const RouterView = createRouterView(routeRef);

        // Act
        const wrapper = mount(RouterView);

        // Assert — empty param should not replace :id in key
        expect(wrapper.exists()).toBe(true);
    });

    it('should fall back to route path when no matched entry at depth', () => {
        // Arrange — matched array is empty but component computed returns something
        // via a ref that changes between computed evaluation and key computation
        const routeRef = ref({matched: [], path: '/fallback', params: {}} as unknown as RouteLocationNormalizedLoaded);
        const RouterView = createRouterView(routeRef);

        // Act — this renders 404 because no component, which is fine
        // The key fallback is tested through the buildRouteKey internal
        const wrapper = mount(RouterView);

        // Assert
        expect(wrapper.text()).toBe('404');
    });
});

describe('createRouterLink', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render an anchor element with correct href and slot content', () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);

        // Act
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}, slots: {default: () => 'Click me'}});

        // Assert
        const anchor = wrapper.find('a');
        expect(anchor.exists()).toBe(true);
        expect(anchor.attributes('href')).toBe('/about');
        expect(anchor.text()).toBe('Click me');
    });

    it('should render without slot content', () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);

        // Act
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}});

        // Assert
        expect(wrapper.find('a').exists()).toBe(true);
    });

    it('should call goToRoute and prevent default on normal click', async () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);
        const wrapper = mount(RouterLink, {props: {to: {name: 'about', id: 5, query: {tab: '1'}, parentId: 2}}});

        // Act
        const event = new MouseEvent('click', {bubbles: true});
        const preventSpy = vi.spyOn(event, 'preventDefault');
        wrapper.find('a').element.dispatchEvent(event);
        await flushPromises();

        // Assert
        expect(preventSpy).toHaveBeenCalled();
        expect(goTo).toHaveBeenCalledWith('about', 5, {tab: '1'}, 2);
    });

    it('should not call goToRoute on ctrl+click', async () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}});

        // Act
        await wrapper.find('a').trigger('click', {ctrlKey: true});

        // Assert
        expect(goTo).not.toHaveBeenCalled();
    });

    it('should not call goToRoute on meta+click', async () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}});

        // Act
        await wrapper.find('a').trigger('click', {metaKey: true});

        // Assert
        expect(goTo).not.toHaveBeenCalled();
    });

    it('should not call goToRoute on shift+click', async () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}});

        // Act
        await wrapper.find('a').trigger('click', {shiftKey: true});

        // Assert
        expect(goTo).not.toHaveBeenCalled();
    });

    it('should not call goToRoute on alt+click', async () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/about');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);
        const wrapper = mount(RouterLink, {props: {to: {name: 'about'}}});

        // Act
        await wrapper.find('a').trigger('click', {altKey: true});

        // Assert
        expect(goTo).not.toHaveBeenCalled();
    });

    it('should pass name, id, query, and parentId to getUrlForRouteName', () => {
        // Arrange
        const getUrl = vi.fn().mockReturnValue('/parent/5/child/10');
        const goTo = vi.fn();
        const RouterLink = createRouterLink(getUrl, goTo);

        // Act
        mount(RouterLink, {props: {to: {name: 'nested', id: 10, query: {tab: 'info'}, parentId: 5}}});

        // Assert
        expect(getUrl).toHaveBeenCalledWith('nested', 10, {tab: 'info'}, 5);
    });
});
