import type {Ref} from 'vue';
import type {LocationQueryRaw, RouteLocationNormalizedLoaded, RouteRecordRaw} from 'vue-router';

import {computed, defineComponent, h} from 'vue';

import type {RouteName, RouterLinkComponent, RouterService, RouterViewComponent} from './types';

const buildRouteKey = (route: RouteLocationNormalizedLoaded, depth: number): string => {
    let key = route.matched[depth].path;
    for (const [paramName, paramValue] of Object.entries(route.params)) {
        const value = Array.isArray(paramValue) ? paramValue[0] : paramValue;
        if (value) key = key.replace(`:${paramName}`, value);
    }

    return key;
};

export const createRouterView = (currentRouteRef: Ref<RouteLocationNormalizedLoaded>): RouterViewComponent =>
    defineComponent<{depth?: number}>(
        ({depth = 0}) => {
            const component = computed(() => {
                const matched = currentRouteRef.value.matched[depth];
                return matched?.components?.default ?? null;
            });

            return () => {
                if (!component.value) return h('p', ['404']);

                return h(component.value, {key: buildRouteKey(currentRouteRef.value, depth)});
            };
        },
        // https://vuejs.org/api/general.html#function-signature
        // manual runtime props declaration is currently still needed
        {props: ['depth']},
    );

export const createRouterLink = <Routes extends RouteRecordRaw[]>(
    getUrlForRouteName: RouterService<Routes>['getUrlForRouteName'],
    goToRoute: RouterService<Routes>['goToRoute'],
): RouterLinkComponent<Routes> =>
    defineComponent<{to: {name: RouteName<Routes>; query?: LocationQueryRaw; id?: number | string; parentId?: number}}>(
        (props, {slots}) =>
            () =>
                h(
                    'a',
                    {
                        href: getUrlForRouteName(props.to.name, props.to.id, props.to.query, props.to.parentId),
                        onClick: (event: MouseEvent) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

                            event.preventDefault();
                            goToRoute(props.to.name, props.to.id, props.to.query, props.to.parentId);
                        },
                    },
                    slots.default?.(),
                ),
        // https://vuejs.org/api/general.html#function-signature
        // manual runtime props declaration is currently still needed
        {props: ['to']},
    );
