import type { SceneId } from "../app/three/types";

export type RouteKey = "home" | "experience" | "projects" | "contact";

export type RoutePalette = {
  readonly background: string;
  readonly accent: string;
  readonly paleHeading: string;
};

export type RouteDefinition = {
  readonly key: RouteKey;
  readonly href: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly heroSummary: string;
  readonly heroSceneId: SceneId;
  readonly order: number;
  readonly palette: RoutePalette;
};

export const OWNER_INPUT_SENTINEL = "OWNER_INPUT_REQUIRED:";

export const routes = [
  {
    key: "home",
    href: "/",
    label: "Home",
    title: "Richard Phong",
    description:
      "Software developer Richard Phong shares his experience, projects, and interactive web experiments.",
    eyebrow: "Personal home",
    heroSummary:
      "Software developer, curious builder, and collector of projects with a little personality.",
    heroSceneId: "home-hero",
    order: 0,
    palette: {
      background: "#9ECCC0",
      accent: "#135946",
      paleHeading: "#FFFFFF",
    },
  },
  {
    key: "experience",
    href: "/experience",
    label: "Experience",
    title: "Experience",
    description:
      "Software engineering experience at NASA, EOG Resources, and Paycom.",
    eyebrow: "Work, in my own words",
    heroSummary:
      "Three chapters shaped by high-stakes tools, technical data, and software people depend on.",
    heroSceneId: "experience-hero",
    order: 1,
    palette: {
      background: "#DFA9B5",
      accent: "#722939",
      paleHeading: "#FBE5EA",
    },
  },
  {
    key: "projects",
    href: "/projects",
    label: "Projects",
    title: "Projects",
    description:
      "Selected projects by Richard Phong, including League Ban Site and Froggie Adventures.",
    eyebrow: "Built for the fun of it",
    heroSummary:
      "A pair of formative projects remembered for curiosity, collaboration, and flair.",
    heroSceneId: "projects-hero",
    order: 2,
    palette: {
      background: "#AFD4E1",
      accent: "#285D71",
      paleHeading: "#EDF7FB",
    },
  },
  {
    key: "contact",
    href: "/contact",
    label: "Contact",
    title: "Contact",
    description:
      "Contact Richard Phong by email, LinkedIn, GitHub, or phone, and download his résumé.",
    eyebrow: "Say hello",
    heroSummary:
      "The direct routes to my inbox, work, code, résumé, and phone.",
    heroSceneId: "contact-hero",
    order: 3,
    palette: {
      background: "#C9BAE4",
      accent: "#4B2E7E",
      paleHeading: "#EDE6FA",
    },
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

export function routeDirection(from: RouteKey, to: RouteKey): -1 | 0 | 1 {
  return Math.sign(routeByKey[to].order - routeByKey[from].order) as -1 | 0 | 1;
}

export type OwnerHomeFields = {
  readonly nonWorkInterest: string;
  readonly technicalCuriosity: string;
};

export const home = {
  introduction:
    "I studied computer science at the University of Houston. In my free time I like poking at whatever corner of the field will have me — building games, tinkering with robotics, fussing over frontends, and following whatever I get curious about next.",
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
  nonWorkInterest:
    "Games have a habit of turning into side projects for me, from League Ban Site to Froggie Adventures.",
  technicalCuriosity:
    "This site is my current experiment in bringing Blender-built 3D scenes to the web while keeping each page fast and usable.",
  ownerDraftMessage:
    "Richard will replace these two marked lines with his own words before production.",
} as const;

export function getOwnerGatedFields(fields: OwnerHomeFields) {
  return (
    [
      ["home.nonWorkInterest", fields.nonWorkInterest],
      ["home.technicalCuriosity", fields.technicalCuriosity],
    ] as const
  )
    .filter(
      ([, value]) =>
        value.trim().length === 0 || value.includes(OWNER_INPUT_SENTINEL),
    )
    .map(([field]) => field);
}

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
