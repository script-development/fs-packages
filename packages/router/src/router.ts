import type { NavigationHookAfter, RouteLocationRaw, RouteRecordRaw } from "vue-router";

import { computed } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { createRouterLink, createRouterView } from "./components";
import { CREATE_PAGE_NAME, EDIT_PAGE_NAME, OVERVIEW_PAGE_NAME, SHOW_PAGE_NAME } from "./routes";
import type { BeforeRouteMiddleware, RouterService, RouterServiceOptions } from "./types";

export const createRouterService = <Routes extends RouteRecordRaw[]>(
  routes: Routes,
  options?: RouterServiceOptions,
): RouterService<Routes> => {
  const router = createRouter({
    history: createWebHistory(options?.base),
    routes,
  });

  const flattenedRoutes = routes
    .flatMap((route) => ("children" in route ? route.children : route))
    .filter((route): route is RouteRecordRaw => Boolean(route));

  const getRoutePath = (name: string): string =>
    router.getRoutes().find((route) => route.name === name)?.path ?? "";

  const resolveParentId = (overrideParentId?: number): string | number | undefined => {
    if (overrideParentId) return overrideParentId;

    // CRUD routes use single :parentId — repeatable params (:parentId+) are not supported
    return currentRouteRef.value.params.parentId as string | undefined;
  };

  const resolveRouteParams = (
    name: string,
    id?: number | string,
    overrideParentId?: number,
  ): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    const targetPath = getRoutePath(name);
    const parentId = resolveParentId(overrideParentId);

    if (parentId) params.parentId = parentId;
    if (id) {
      params.id = id;
      if (!params.parentId || !targetPath.includes(":id")) params.parentId = id;
    }

    return Object.fromEntries(
      Object.entries(params).filter(([key]) => targetPath.includes(`:${key}`)),
    );
  };

  const goToRoute: RouterService<Routes>["goToRoute"] = async (name, id, query, parentId) => {
    const route: RouteLocationRaw = { name };
    const params = resolveRouteParams(name as string, id, parentId);

    if (Object.keys(params).length > 0) route.params = params;
    if (query) route.query = query;

    await router.push(route);
  };

  const normalizedRouteToSpecificRoute: RouterService<Routes>["normalizedRouteToSpecificRoute"] = (
    route,
  ) => {
    const specificRoute = flattenedRoutes.find(
      ({ path, name }) => name === route.name || path === route.path,
    );

    if (!specificRoute) throw new Error(`${route.path} is an unknown route`);

    return specificRoute;
  };

  const getUrlForRouteName: RouterService<Routes>["getUrlForRouteName"] = (
    name,
    id,
    query,
    parentId,
  ) =>
    router.resolve({
      name,
      params: resolveRouteParams(name as string, id, parentId),
      query,
    }).fullPath;

  const beforeRouteMiddleware: BeforeRouteMiddleware<Routes>[] = [];
  router.beforeEach(async (to, from) => {
    const toNormalized = normalizedRouteToSpecificRoute(to);
    const fromNormalized = from.name ? normalizedRouteToSpecificRoute(from) : toNormalized;

    for (const middleware of beforeRouteMiddleware)
      if (await middleware(toNormalized, fromNormalized)) return false;
  });

  const afterRouteMiddleware: NavigationHookAfter[] = [...(options?.afterRouteCallbacks ?? [])];
  router.afterEach((to, from, failure) => {
    for (const middleware of afterRouteMiddleware) middleware(to, from, failure);
  });

  const currentRouteRef = router.currentRoute;

  const onPage: RouterService<Routes>["onPage"] = (pageName) => {
    const currentName = currentRouteRef.value.name;
    if (!currentName) return false;

    return currentName.toString() === pageName;
  };

  const fullPath =
    (options?.base ? location.pathname.replace(options.base, "") : location.pathname) +
    location.search +
    location.hash;

  return {
    install: () => void router.push(fullPath),
    normalizedRouteToSpecificRoute,

    goToRoute,
    goToCreatePage: (name) => goToRoute(`${name}${CREATE_PAGE_NAME}`),
    goToOverviewPage: (name) => goToRoute(`${name}${OVERVIEW_PAGE_NAME}`),
    goToEditPage: (name, id) => goToRoute(`${name}${EDIT_PAGE_NAME}`, id),
    goToShowPage: (name, id, query) => goToRoute(`${name}${SHOW_PAGE_NAME}`, id, query),

    getUrlForRouteName,
    goBack: () => router.back(),

    registerBeforeRouteMiddleware: (middleware) => {
      beforeRouteMiddleware.push(middleware);

      return () => {
        const index = beforeRouteMiddleware.indexOf(middleware);
        if (index > -1) beforeRouteMiddleware.splice(index, 1);
      };
    },
    registerAfterRouteMiddleware: (middleware) => {
      afterRouteMiddleware.push(middleware);

      return () => {
        const index = afterRouteMiddleware.indexOf(middleware);
        if (index > -1) afterRouteMiddleware.splice(index, 1);
      };
    },

    currentRouteRef,
    currentRouteQuery: computed(() => currentRouteRef.value.query),
    currentRouteId: computed(() => {
      const currentRouteId = currentRouteRef.value.params.id;
      if (!currentRouteId) throw new Error("This route has no route id");

      return Number.parseInt(currentRouteId.toString(), 10);
    }),
    currentRouteSlug: computed(() => {
      // CRUD routes use single :id — repeatable params (:id+) are not supported
      const slug = currentRouteRef.value.params.id as string | undefined;
      if (!slug) throw new Error("This route has no route id");

      return slug;
    }),
    currentParentId: computed(() => {
      const currentParentId = currentRouteRef.value.params.parentId;
      if (!currentParentId) throw new Error("This route has no parent id");

      return Number.parseInt(currentParentId.toString(), 10);
    }),
    changeRouteQuery: (query) => void router.push({ query }),

    onPage,
    onCreatePage: (baseRouteName) => onPage(baseRouteName + CREATE_PAGE_NAME),
    onEditPage: (baseRouteName) => onPage(baseRouteName + EDIT_PAGE_NAME),
    onOverviewPage: (baseRouteName) => onPage(baseRouteName + OVERVIEW_PAGE_NAME),
    onShowPage: (baseRouteName) => onPage(baseRouteName + SHOW_PAGE_NAME),
    routeExists: (to) => {
      try {
        return !!router.resolve(to).name;
      } catch {
        return false;
      }
    },

    RouterView: createRouterView(currentRouteRef),
    RouterLink: createRouterLink(getUrlForRouteName, goToRoute),
  };
};
