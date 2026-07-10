import "@testing-library/jest-dom/vitest";
import type * as ReactTypes from "react";
import { vi } from "vitest";

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
