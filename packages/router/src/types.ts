import type {ComputedRef, DefineSetupFnComponent, Ref} from 'vue';
import type {
    LocationQuery,
    LocationQueryRaw,
    NavigationHookAfter,
    RouteComponent,
    RouteLocationNormalized,
    RouteLocationNormalizedLoaded,
    RouteLocationRaw,
    RouteRecordName,
    RouteRecordRaw,
} from 'vue-router';

/**
 * Removes `undefined` entries from a tuple type at compile time.
 * Used by CRUD route factories to filter out optional route components.
 */
export type FilterUndefined<T extends unknown[]> = T extends []
    ? []
    : T extends [infer H, ...infer R]
      ? H extends undefined
          ? FilterUndefined<R>
          : [H, ...FilterUndefined<R>]
      : T;

export type LazyRouteComponent = () => Promise<RouteComponent>;

export type OptionalComponent = LazyRouteComponent | undefined;

type TopLevelRoute<Routes extends RouteRecordRaw[]> = Extract<Routes[number], {name: string}>;
type ChildRoute<Routes extends RouteRecordRaw[]> = Extract<
    Routes[number],
    {children: RouteRecordRaw[]}
>['children'][number];

export type ActualRoute<Routes extends RouteRecordRaw[]> = TopLevelRoute<Routes> | ChildRoute<Routes>;

export type RouteName<Routes extends RouteRecordRaw[]> = ActualRoute<Routes>['name'];

type ExtractNameFromRoutes<T, P extends string> = T extends `${infer R}${P}` ? R : never;

export type CreateRouteName<T extends RouteRecordName | undefined> = ExtractNameFromRoutes<T, '.create'>;
export type OverviewRouteName<T extends RouteRecordName | undefined> = ExtractNameFromRoutes<T, '.overview'>;
export type EditRouteName<T extends RouteRecordName | undefined> = ExtractNameFromRoutes<T, '.edit'>;
export type ShowRouteName<T extends RouteRecordName | undefined> = ExtractNameFromRoutes<T, '.show'>;

export type BeforeRouteMiddleware<Routes extends RouteRecordRaw[]> = (
    to: ActualRoute<Routes>,
    from: ActualRoute<Routes>,
) => boolean | Promise<boolean>;

export type UnregisterMiddleware = () => void;

export type RouterViewComponent = DefineSetupFnComponent<{depth?: number}>;
export type RouterLinkComponent<Routes extends RouteRecordRaw[]> = DefineSetupFnComponent<{
    to: {name: RouteName<Routes>; query?: LocationQueryRaw; id?: number | string; parentId?: number};
}>;

export interface RouterServiceOptions {
    base?: string;
    afterRouteCallbacks?: NavigationHookAfter[];
}

export interface RouterService<Routes extends RouteRecordRaw[]> {
    install: () => void;
    normalizedRouteToSpecificRoute: (route: Pick<RouteLocationNormalized, 'name' | 'path'>) => ActualRoute<Routes>;
    goToRoute: (
        name: RouteName<Routes>,
        id?: number | string,
        query?: LocationQueryRaw,
        parentId?: number,
    ) => Promise<void>;
    goToCreatePage: (name: CreateRouteName<RouteName<Routes>>) => Promise<void>;
    goToOverviewPage: (name: OverviewRouteName<RouteName<Routes>>) => Promise<void>;
    goToEditPage: (name: EditRouteName<RouteName<Routes>>, id: number | string) => Promise<void>;
    goToShowPage: (
        name: ShowRouteName<RouteName<Routes>>,
        id: number | string,
        query?: LocationQueryRaw,
    ) => Promise<void>;
    getUrlForRouteName: (
        name: RouteName<Routes>,
        id?: number | string,
        query?: LocationQueryRaw,
        parentId?: number,
    ) => string;
    goBack: () => void;
    registerBeforeRouteMiddleware: (middleware: BeforeRouteMiddleware<Routes>) => UnregisterMiddleware;
    registerAfterRouteMiddleware: (middleware: NavigationHookAfter) => UnregisterMiddleware;
    currentRouteRef: Ref<RouteLocationNormalizedLoaded>;
    currentRouteQuery: ComputedRef<LocationQuery>;
    currentRouteId: ComputedRef<number>;
    currentRouteSlug: ComputedRef<string>;
    currentParentId: ComputedRef<number>;
    changeRouteQuery: (query: LocationQuery) => void;
    onPage: (pageName: RouteName<Routes>) => boolean;
    onCreatePage: (baseRouteName: CreateRouteName<RouteName<Routes>>) => boolean;
    onEditPage: (baseRouteName: EditRouteName<RouteName<Routes>>) => boolean;
    onOverviewPage: (baseRouteName: OverviewRouteName<RouteName<Routes>>) => boolean;
    onShowPage: (baseRouteName: ShowRouteName<RouteName<Routes>>) => boolean;
    routeExists: (to: RouteLocationRaw) => boolean;

    RouterView: RouterViewComponent;
    RouterLink: RouterLinkComponent<Routes>;
}

export interface CrudRoute<
    P extends string,
    N extends string,
    C extends LazyRouteComponent,
    Meta extends Record<string, unknown> = Record<string, unknown>,
> {
    path: P;
    name: N;
    component: C;
    meta: Meta;
}

export interface ParentCrudRoute<
    T extends string,
    Meta extends Record<string, unknown>,
    OverviewComponent extends OptionalComponent,
    CreateComponent extends OptionalComponent,
    EditComponent extends OptionalComponent,
    ShowComponent extends OptionalComponent,
> {
    path: string;
    component: RouteComponent | LazyRouteComponent;
    children: FilterUndefined<
        [
            OverviewComponent extends undefined
                ? undefined
                : CrudRoute<'', `${T}.overview`, NonNullable<OverviewComponent>, Meta>,
            CreateComponent extends undefined
                ? undefined
                : CrudRoute<'create', `${T}.create`, NonNullable<CreateComponent>, Meta>,
            EditComponent extends undefined
                ? undefined
                : CrudRoute<':id/edit', `${T}.edit`, NonNullable<EditComponent>, Meta>,
            ShowComponent extends undefined
                ? undefined
                : CrudRoute<':id', `${T}.show`, NonNullable<ShowComponent>, Meta>,
        ]
    >;
}

export interface NestedParentCrudRoute<
    T extends string,
    Meta extends Record<string, unknown>,
    OverviewComponent extends OptionalComponent,
    CreateComponent extends OptionalComponent,
    EditComponent extends OptionalComponent,
    ShowComponent extends OptionalComponent,
> {
    path: string;
    component: RouteComponent | LazyRouteComponent;
    children: FilterUndefined<
        [
            OverviewComponent extends undefined
                ? undefined
                : CrudRoute<'', `${T}.overview`, NonNullable<OverviewComponent>, Meta>,
            CreateComponent extends undefined
                ? undefined
                : CrudRoute<'create', `${T}.create`, NonNullable<CreateComponent>, Meta>,
            EditComponent extends undefined
                ? undefined
                : CrudRoute<':id/edit', `${T}.edit`, NonNullable<EditComponent>, Meta>,
            ShowComponent extends undefined
                ? undefined
                : CrudRoute<':id', `${T}.show`, NonNullable<ShowComponent>, Meta>,
        ]
    >;
}
