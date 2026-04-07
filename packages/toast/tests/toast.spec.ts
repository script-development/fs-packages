// @vitest-environment happy-dom
import { createToastService } from "../src/index";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";

const TestToast = defineComponent({
  props: { message: String },
  emits: ["close"],
  render() {
    return h("div", { class: "toast" }, this.message);
  },
});

describe("toast service", () => {
  describe("createToastService", () => {
    it("should return all expected methods and properties", () => {
      const toastService = createToastService(TestToast);

      expect(toastService).toHaveProperty("show");
      expect(toastService).toHaveProperty("hide");
      expect(toastService).toHaveProperty("ToastContainerComponent");
      expect(typeof toastService.show).toBe("function");
      expect(typeof toastService.hide).toBe("function");
    });

    it("should return a valid Vue component", () => {
      const toastService = createToastService(TestToast);

      expect(toastService.ToastContainerComponent).toHaveProperty("render");
      expect(toastService.ToastContainerComponent.name).toBe("ToastContainer");
    });
  });

  describe("show", () => {
    it("should add toast to the container", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Test message" });
      await nextTick();

      expect(wrapper.text()).toContain("Test message");
    });

    it("should return toast id with toast- prefix", () => {
      const toastService = createToastService(TestToast);

      const id = toastService.show({ message: "Test" });

      expect(id).toMatch(/^toast-\d+$/);
    });

    it("should return incrementing toast ids", () => {
      const toastService = createToastService(TestToast);

      const id1 = toastService.show({ message: "First" });
      const id2 = toastService.show({ message: "Second" });

      expect(id1).not.toBe(id2);
      const num1 = Number(id1.replace("toast-", ""));
      const num2 = Number(id2.replace("toast-", ""));
      expect(num2).toBe(num1 + 1);
    });

    it("should add multiple toasts", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Toast 1" });
      toastService.show({ message: "Toast 2" });
      toastService.show({ message: "Toast 3" });
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(3);
      expect(wrapper.text()).toContain("Toast 1");
      expect(wrapper.text()).toContain("Toast 2");
      expect(wrapper.text()).toContain("Toast 3");
    });

    it("should remove oldest toast when exceeding maximum", async () => {
      const toastService = createToastService(TestToast, 2);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Toast 1" });
      toastService.show({ message: "Toast 2" });
      toastService.show({ message: "Toast 3" });
      toastService.show({ message: "Toast 4" });
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(2);
      expect(wrapper.text()).not.toContain("Toast 1");
      expect(wrapper.text()).not.toContain("Toast 2");
      expect(wrapper.text()).toContain("Toast 3");
      expect(wrapper.text()).toContain("Toast 4");
    });

    it("should use default maxToasts of 4", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      for (let i = 1; i <= 6; i++) {
        toastService.show({ message: `Toast ${i}` });
      }
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(4);
      expect(wrapper.text()).not.toContain("Toast 1");
      expect(wrapper.text()).toContain("Toast 6");
    });

    it("should clamp maxToasts to minimum of 1 when 0 is provided", async () => {
      const toastService = createToastService(TestToast, 0);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Toast 1" });
      toastService.show({ message: "Toast 2" });
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(1);
      expect(wrapper.text()).toContain("Toast 2");
    });

    it("should clamp maxToasts to minimum of 1 when negative is provided", async () => {
      const toastService = createToastService(TestToast, -5);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Toast 1" });
      toastService.show({ message: "Toast 2" });
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(1);
      expect(wrapper.text()).toContain("Toast 2");
    });

    it("should floor decimal maxToasts values", async () => {
      const toastService = createToastService(TestToast, 2.9);
      const wrapper = shallowMount(toastService.ToastContainerComponent);

      toastService.show({ message: "Toast 1" });
      toastService.show({ message: "Toast 2" });
      toastService.show({ message: "Toast 3" });
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(2);
      expect(wrapper.text()).not.toContain("Toast 1");
      expect(wrapper.text()).toContain("Toast 3");
    });
  });

  describe("hide", () => {
    it("should remove toast by id", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);
      const id = toastService.show({ message: "Toast to hide" });
      await nextTick();

      toastService.hide(id);
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(0);
    });

    it("should only remove specified toast", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);
      toastService.show({ message: "Toast 1" });
      const id2 = toastService.show({ message: "Toast 2" });
      toastService.show({ message: "Toast 3" });
      await nextTick();

      toastService.hide(id2);
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(2);
      expect(wrapper.text()).toContain("Toast 1");
      expect(wrapper.text()).not.toContain("Toast 2");
      expect(wrapper.text()).toContain("Toast 3");
    });

    it("should do nothing when hiding non-existent toast", async () => {
      const toastService = createToastService(TestToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);
      toastService.show({ message: "Toast 1" });
      await nextTick();

      expect(() => toastService.hide("non-existent")).not.toThrow();
      expect(wrapper.findAll(".toast")).toHaveLength(1);
    });
  });

  describe("onClose prop", () => {
    it("should pass onClose handler to toast component", async () => {
      const ClosableToast = defineComponent({
        props: { message: String, onClose: Function },
        emits: ["close"],
        render() {
          return h("div", { class: "toast" }, [
            this.message,
            h("button", { onClick: this.onClose }, "Close"),
          ]);
        },
      });
      const toastService = createToastService(ClosableToast);
      const wrapper = shallowMount(toastService.ToastContainerComponent);
      toastService.show({ message: "Closable toast" });
      await nextTick();

      await wrapper.find("button").trigger("click");
      await nextTick();

      expect(wrapper.findAll(".toast")).toHaveLength(0);
    });
  });

  describe("isolation", () => {
    it("should create independent toast services", async () => {
      const service1 = createToastService(TestToast);
      const service2 = createToastService(TestToast);
      const wrapper1 = shallowMount(service1.ToastContainerComponent);
      const wrapper2 = shallowMount(service2.ToastContainerComponent);

      service1.show({ message: "Service 1 toast" });
      await nextTick();

      expect(wrapper1.text()).toContain("Service 1 toast");
      expect(wrapper2.text()).not.toContain("Service 1 toast");
    });
  });
});
