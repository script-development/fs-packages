# @script-development/fs-toast

## 0.1.1

### Patch Changes

- Fix ToastContainerComponent rendering a fragment instead of a single root element. Vue drops fallthrough attributes on fragment components, so positioning classes applied directly on `<component :is="ToastContainerComponent" />` were silently lost. The container now wraps toasts in a `<div>`, enabling proper attribute inheritance.
