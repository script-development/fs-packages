// @vitest-environment jsdom
import { createLoadingService } from "../src";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("createLoadingService", () => {
  it("should initialize with isLoading as false", () => {
    const service = createLoadingService();

    expect(service.isLoading.value).toBe(false);
  });

  it("should set isLoading to true when startLoading is called", () => {
    const service = createLoadingService();

    service.startLoading();

    expect(service.isLoading.value).toBe(true);
  });

  it("should set isLoading to false when stopLoading is called", () => {
    const service = createLoadingService();
    service.startLoading();

    service.stopLoading();

    expect(service.isLoading.value).toBe(false);
  });

  it("should resolve immediately from ensureLoadingFinished when not loading", async () => {
    const service = createLoadingService();

    await service.ensureLoadingFinished();

    expect(service.isLoading.value).toBe(false);
  });

  it("should wait and resolve from ensureLoadingFinished when loading finishes", async () => {
    const service = createLoadingService();
    service.startLoading();
    let resolved = false;

    const promise = service.ensureLoadingFinished().then(() => {
      resolved = true;
    });

    await flushPromises();
    expect(resolved).toBe(false);

    service.stopLoading();
    await flushPromises();
    await promise;

    expect(resolved).toBe(true);
  });

  it("should handle multiple calls to ensureLoadingFinished", async () => {
    const service = createLoadingService();
    service.startLoading();
    let resolved1 = false;
    let resolved2 = false;

    const promise1 = service.ensureLoadingFinished().then(() => {
      resolved1 = true;
    });
    const promise2 = service.ensureLoadingFinished().then(() => {
      resolved2 = true;
    });

    await flushPromises();
    expect(resolved1).toBe(false);
    expect(resolved2).toBe(false);

    service.stopLoading();
    await Promise.all([promise1, promise2]);

    expect(resolved1).toBe(true);
    expect(resolved2).toBe(true);
  });

  it("should track activeCount", () => {
    const service = createLoadingService();

    expect(service.activeCount.value).toBe(0);

    service.startLoading();
    expect(service.activeCount.value).toBe(1);

    service.startLoading();
    expect(service.activeCount.value).toBe(2);

    service.stopLoading();
    expect(service.activeCount.value).toBe(1);

    service.stopLoading();
    expect(service.activeCount.value).toBe(0);
  });

  it("should stay loading while any request is active", () => {
    const service = createLoadingService();

    service.startLoading();
    service.startLoading();

    expect(service.isLoading.value).toBe(true);
    expect(service.activeCount.value).toBe(2);

    service.stopLoading();

    expect(service.isLoading.value).toBe(true);
    expect(service.activeCount.value).toBe(1);

    service.stopLoading();

    expect(service.isLoading.value).toBe(false);
    expect(service.activeCount.value).toBe(0);
  });

  it("should not allow activeCount to go below zero", () => {
    const service = createLoadingService();

    service.stopLoading();
    service.stopLoading();

    expect(service.activeCount.value).toBe(0);
    expect(service.isLoading.value).toBe(false);
  });

  it("should wait for all requests to finish in ensureLoadingFinished", async () => {
    const service = createLoadingService();
    service.startLoading();
    service.startLoading();
    let resolved = false;

    const promise = service.ensureLoadingFinished().then(() => {
      resolved = true;
    });

    await flushPromises();
    service.stopLoading();
    await flushPromises();
    expect(resolved).toBe(false);

    service.stopLoading();
    await flushPromises();
    await promise;
    expect(resolved).toBe(true);
  });
});
