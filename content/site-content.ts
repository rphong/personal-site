import type { SceneId } from "../app/three/types";

export type RouteKey = "home" | "experience" | "projects" | "contact";

export type RouteDefinition = {
  readonly key: RouteKey;
  readonly href: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly heroSceneId: SceneId;
};

export const routes = [
  {
    key: "home",
    href: "/",
    label: "Home",
    title: "Richard Phong",
    description:
      "Software developer Richard Phong shares his experience, projects, and interactive web experiments.",
    heroSceneId: "home-hero",
  },
  {
    key: "experience",
    href: "/experience",
    label: "Experience",
    title: "Experience",
    description:
      "Software engineering experience at NASA, EOG Resources, and Paycom.",
    heroSceneId: "experience-hero",
  },
  {
    key: "projects",
    href: "/projects",
    label: "Projects",
    title: "Projects",
    description:
      "Selected projects by Richard Phong, including League Ban Site and Froggie Adventures.",
    heroSceneId: "projects-hero",
  },
  {
    key: "contact",
    href: "/contact",
    label: "Contact",
    title: "Contact",
    description:
      "Contact Richard Phong by email, LinkedIn, GitHub, or phone, and download his résumé.",
    heroSceneId: "contact-hero",
  },
] as const satisfies readonly RouteDefinition[];

export const routeByKey: Record<RouteKey, RouteDefinition> = Object.fromEntries(
  routes.map((route) => [route.key, route]),
) as Record<RouteKey, RouteDefinition>;

export function routeKeyFromPathname(pathname: string): RouteKey {
  const firstSegment = pathname.split("/").find(Boolean);

  if (
    firstSegment === "experience" ||
    firstSegment === "projects" ||
    firstSegment === "contact"
  ) {
    return firstSegment;
  }

  return "home";
}

export const home = {
  introduction:
    "I studied computer science at the University of Houston. In my free time, I work on games, robots, websites, and whatever else catches my interest.",
  experienceLink: {
    label: "What I've been up to →",
    href: "/experience",
  },
  rabbitHoles: [
    {
      index: "01",
      title: "Frontend",
      description: "Interfaces that feel good to touch.",
      href: "/projects",
      linkLabel: "See projects →",
    },
    {
      index: "02",
      title: "Games",
      description: "Engines, mechanics, and the odd shader rabbit hole.",
      href: "/projects",
      linkLabel: "See projects →",
    },
    {
      index: "03",
      title: "Contests",
      description: "Chasing rating on Codeforces, one problem at a time.",
      href: "https://codeforces.com/profile/richardp",
      linkLabel: "Codeforces ↗",
    },
  ],
} as const;

export type RoleEntry = {
  readonly title: string;
  readonly dates: string;
};

export type ExperienceChapter = {
  readonly id: "nasa" | "eog" | "paycom";
  readonly company: string;
  readonly sceneId: SceneId;
  readonly roles: readonly RoleEntry[];
  readonly narrative: readonly string[];
};

export const experience = [
  {
    id: "nasa",
    company: "NASA",
    sceneId: "nasa-rocket",
    roles: [
      { title: "Software Developer Intern", dates: "2023–2024" },
      { title: "Software Developer Intern", dates: "2022–2023" },
    ],
    narrative: [
      "At NASA, I worked across crew-facing interfaces, training tools, and simulator workflows. I helped redesign an ISS crew calendar interface used during Artemis III preparation, automated feedback for On-Board Training, and built a Razor Pages coordination tool.",
      "I also reduced a training-simulator file's size by 60 percent and improved one script's speed by more than 5×. That range made performance and clarity feel inseparable from the people relying on the software.",
    ],
  },
  {
    id: "eog",
    company: "EOG Resources",
    sceneId: "eog-poster",
    roles: [
      { title: "Software Developer", dates: "2025–Present" },
      { title: "Software Developer Intern", dates: "2024" },
    ],
    narrative: [
      "At EOG, I've focused on making dense technical data faster to explore and easier to trust. I reduced a reservoir proxy workflow from 40–50 seconds to 1–2 seconds and helped surface more than 100,000 data points through visualization components.",
      "I've also established automated quality gates, led cross-team visualization integration, and built a real-time anomaly detection and escalation pipeline. Moving from intern to full-time developer has reinforced how much I enjoy working close to a problem and iterating with the people who know it best.",
    ],
  },
  {
    id: "paycom",
    company: "Paycom",
    sceneId: "paycom-poster",
    roles: [{ title: "Software Developer Intern", dates: "2023" }],
    narrative: [
      "At Paycom, I built an ASP.NET Web API using FedEx APIs, paired with a React interface, to support more than 15,000 packages each week. I also built a test suite that reached 90 percent coverage.",
      "It was a focused lesson in treating reliability as part of the feature rather than a separate concern.",
    ],
  },
] as const satisfies readonly ExperienceChapter[];

export type ProjectChapter = {
  readonly id: "league-ban-site" | "froggie-adventures";
  readonly name: string;
  readonly sceneId: SceneId;
  readonly reflection: string;
  readonly technicalLine: string;
  readonly repository: string;
};

export const projects = [
  {
    id: "league-ban-site",
    name: "League Ban Site",
    sceneId: "league-ban",
    reflection:
      "I built League Ban Site around a game I already knew well: League of Legends. Working with recent match data gave me a practical way to learn APIs and backend development, then turn the results into playful ban recommendations.",
    technicalLine:
      "Node.js · Express · EJS · node-fetch · Riot APIs · turns a summoner name and recent ranked matches into playful opponent and ban recommendations",
    repository: "https://github.com/rphong/LeagueBanSite",
  },
  {
    id: "froggie-adventures",
    name: "Froggie Adventures",
    sceneId: "froggie-adventures",
    reflection:
      "Froggie Adventures was a three-person Unity project that taught me how to build as a team. I helped lead the project, divide the work, and bring the game together for a public demo.",
    technicalLine:
      "Unity · C# · three-person team · procedurally generated levels with scaling difficulty",
    repository: "https://github.com/rphong/Froggie",
  },
] as const satisfies readonly ProjectChapter[];

export const contact = {
  introduction:
    "Whether you want to talk about a role, a project, or an odd web experiment, these are the best ways to reach me.",
  actions: [
    {
      label: "Email",
      display: "richard.phong424@gmail.com",
      href: "mailto:richard.phong424@gmail.com",
    },
    {
      label: "LinkedIn",
      display: "linkedin.com/in/richard-phong",
      href: "https://linkedin.com/in/richard-phong/",
    },
    {
      label: "GitHub",
      display: "github.com/rphong",
      href: "https://github.com/rphong",
    },
    {
      label: "Phone",
      display: "281-777-6437",
      href: "tel:+12817776437",
    },
  ],
  resumeHref: "/Richard-Phong-Resume.pdf",
  privacy:
    "This site is hosted on Cloudflare and does not track contact-link clicks or use session replay. Your 3D preference is stored only in this browser.",
} as const;

export const footer = {
  disclosure: "No contact-link tracking or session replay.",
  privacyHref: "/contact#privacy",
} as const;
