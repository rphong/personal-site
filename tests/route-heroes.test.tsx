import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ContactPage from "../app/contact/page";
import ExperiencePage from "../app/experience/page";
import HomePage from "../app/page";
import ProjectsPage from "../app/projects/page";
import { routeByKey } from "../content/site-content";

afterEach(cleanup);

const routes = [
  ["home", HomePage, "editorial"],
  ["experience", ExperiencePage, "rounded"],
  ["projects", ProjectsPage, "rounded"],
  ["contact", ContactPage, "rounded"],
] as const;

describe("route heroes", () => {
  it.each(routes)(
    "uses the shared layered composition for %s",
    (routeKey, Page, titleStyle) => {
      const route = routeByKey[routeKey];
      const { container } = render(<Page />);
      const hero = container.querySelector<HTMLElement>(
        `[data-scene-id="${route.heroSceneId}"]`,
      );

      expect(hero).not.toBeNull();
      expect(hero).toHaveClass("page-hero--layered");
      expect(hero).toHaveClass(`page-hero--${titleStyle}`);
      expect(
        screen.getByRole("heading", { level: 1, name: route.title }),
      ).toBeInTheDocument();
      expect(hero?.querySelector(".eyebrow")).toBeNull();
      expect(hero?.querySelector(".page-hero__summary")).toBeNull();
      expect(screen.queryByText(route.eyebrow)).not.toBeInTheDocument();
      expect(screen.queryByText(route.heroSummary)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Scroll down" })).toHaveAttribute(
        "href",
        "#page-content",
      );
    },
  );
});
