export {createRouterService} from './router';
export {
    createStandardRouteConfig,
    createCrudRoutes,
    createNestedCrudRoutes,
    CREATE_PAGE_NAME,
    EDIT_PAGE_NAME,
    OVERVIEW_PAGE_NAME,
    SHOW_PAGE_NAME,
} from './routes';
export {createRouterView, createRouterLink} from './components';
export type {
    FilterUndefined,
    LazyRouteComponent,
    OptionalComponent,
    ActualRoute,
    RouteName,
    CreateRouteName,
    OverviewRouteName,
    EditRouteName,
    ShowRouteName,
    BeforeRouteMiddleware,
    UnregisterMiddleware,
    RouterViewComponent,
    RouterLinkComponent,
    RouterServiceOptions,
    RouterService,
    CrudRoute,
    ParentCrudRoute,
    NestedParentCrudRoute,
} from './types';
