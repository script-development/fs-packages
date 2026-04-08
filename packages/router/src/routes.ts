import type { RouteComponent } from "vue-router";

import type {
  CrudRoute,
  LazyRouteComponent,
  NestedParentCrudRoute,
  OptionalComponent,
  ParentCrudRoute,
} from "./types";

export const CREATE_PAGE_NAME = ".create";
export const EDIT_PAGE_NAME = ".edit";
export const OVERVIEW_PAGE_NAME = ".overview";
export const SHOW_PAGE_NAME = ".show";

export const createStandardRouteConfig = <
  T extends string,
  P extends string,
  C extends OptionalComponent,
  Meta extends Record<string, unknown> = Record<string, unknown>,
>(
  path: P,
  name: T,
  component: C,
  meta: Meta = {} as Meta,
): C extends undefined ? undefined : CrudRoute<P, T, NonNullable<C>, Meta> => {
  if (!component)
    return undefined as C extends undefined ? undefined : CrudRoute<P, T, NonNullable<C>, Meta>;

  return {
    path,
    name,
    component,
    meta,
  } as C extends undefined ? undefined : CrudRoute<P, T, NonNullable<C>, Meta>;
};

export const createCrudRoutes = <
  N extends string,
  Meta extends Record<string, unknown>,
  OverviewComponent extends OptionalComponent,
  CreateComponent extends OptionalComponent,
  EditComponent extends OptionalComponent,
  ShowComponent extends OptionalComponent,
>(
  basePath: string,
  baseRouteName: N,
  baseComponent: RouteComponent | LazyRouteComponent,
  components: {
    overview: OverviewComponent;
    create: CreateComponent;
    edit: EditComponent;
    show: ShowComponent;
  },
  meta: Meta = {} as Meta,
): ParentCrudRoute<N, Meta, OverviewComponent, CreateComponent, EditComponent, ShowComponent> => {
  // @ts-expect-error FilterUndefined is a compile-time tuple filter, but .filter() produces a generic array
  const children: ParentCrudRoute<
    N,
    Meta,
    OverviewComponent,
    CreateComponent,
    EditComponent,
    ShowComponent
  >["children"] = [
    createStandardRouteConfig(
      "",
      `${baseRouteName}${OVERVIEW_PAGE_NAME}`,
      components.overview,
      meta,
    ),
    createStandardRouteConfig(
      "create",
      `${baseRouteName}${CREATE_PAGE_NAME}`,
      components.create,
      meta,
    ),
    createStandardRouteConfig(
      ":id/edit",
      `${baseRouteName}${EDIT_PAGE_NAME}`,
      components.edit,
      meta,
    ),
    createStandardRouteConfig(":id", `${baseRouteName}${SHOW_PAGE_NAME}`, components.show, meta),
  ].filter((route) => route !== undefined);

  return {
    path: `/${basePath}`,
    component: baseComponent,
    children,
  };
};

export const createNestedCrudRoutes = <
  N extends string,
  Meta extends Record<string, unknown>,
  OverviewComponent extends OptionalComponent,
  CreateComponent extends OptionalComponent,
  EditComponent extends OptionalComponent,
  ShowComponent extends OptionalComponent,
>(
  path: { parent: string; child: string },
  baseRouteName: N,
  baseComponent: RouteComponent | LazyRouteComponent,
  components: {
    overview: OverviewComponent;
    create: CreateComponent;
    edit: EditComponent;
    show: ShowComponent;
  },
  meta: Meta = {} as Meta,
): NestedParentCrudRoute<
  N,
  Meta,
  OverviewComponent,
  CreateComponent,
  EditComponent,
  ShowComponent
> => {
  // @ts-expect-error FilterUndefined is a compile-time tuple filter, but .filter() produces a generic array
  const children: NestedParentCrudRoute<
    N,
    Meta,
    OverviewComponent,
    CreateComponent,
    EditComponent,
    ShowComponent
  >["children"] = [
    createStandardRouteConfig(
      "",
      `${baseRouteName}${OVERVIEW_PAGE_NAME}`,
      components.overview,
      meta,
    ),
    createStandardRouteConfig(
      "create",
      `${baseRouteName}${CREATE_PAGE_NAME}`,
      components.create,
      meta,
    ),
    createStandardRouteConfig(
      ":id/edit",
      `${baseRouteName}${EDIT_PAGE_NAME}`,
      components.edit,
      meta,
    ),
    createStandardRouteConfig(":id", `${baseRouteName}${SHOW_PAGE_NAME}`, components.show, meta),
  ].filter((route) => route !== undefined);

  return {
    path: `/${path.parent}/:parentId/${path.child}`,
    component: baseComponent,
    children,
  };
};
