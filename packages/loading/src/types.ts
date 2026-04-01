import type { ComputedRef, DeepReadonly, Ref } from "vue";

export type LoadingService = {
  isLoading: ComputedRef<boolean>;
  activeCount: DeepReadonly<Ref<number>>;
  startLoading: () => void;
  stopLoading: () => void;
  ensureLoadingFinished: () => Promise<void>;
};

export type LoadingMiddlewareOptions = {
  /**
   * Timeout in milliseconds after which a request is considered stuck
   * and loading state is auto-decremented. Set to 0 to disable.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;
};

export type LoadingMiddlewareResult = {
  unregister: () => void;
};
