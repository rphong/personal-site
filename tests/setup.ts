import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type * as ReactTypes from "react";
import { afterEach, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      fill: _fill,
      priority: _priority,
      sizes: _sizes,
      ...props
    }: ReactTypes.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
    }) => {
      void _fill;
      void _priority;
      void _sizes;
      return createElement("img", props);
    },
  };
});

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      children,
      ...props
    }: ReactTypes.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      createElement("a", props, children),
  };
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
  writable: true,
});

if (!("ResizeObserver" in globalThis)) {
  class TestResizeObserver implements ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: TestResizeObserver,
  });
}

afterEach(() => cleanup());
