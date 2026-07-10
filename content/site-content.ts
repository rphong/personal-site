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
  readonly heroPoster: string;
  readonly heroSceneId: string;
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
      "Richard Phong's personal home for software work, creative experiments, and interactive web scenes.",
    eyebrow: "Personal home",
    heroSummary:
      "Software developer, curious builder, and collector of projects with a little personality.",
    heroPoster: "/posters/home-reference.png",
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
      "Richard Phong's first-person software experience across NASA, EOG Resources, and Paycom.",
    eyebrow: "Work, in my own words",
    heroSummary:
      "Three chapters shaped by high-stakes tools, technical data, and software people depend on.",
    heroPoster: "/posters/experience-reference.png",
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
      "Creative college projects that connected Richard Phong's interests, teamwork, and software craft.",
    eyebrow: "Built for the fun of it",
    heroSummary:
      "A pair of formative projects remembered for curiosity, collaboration, and flair.",
    heroPoster: "/posters/projects-reference.png",
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
      "Email, LinkedIn, GitHub, phone, and résumé links for Richard Phong.",
    eyebrow: "Say hello",
    heroSummary:
      "The direct routes to my inbox, work, code, résumé, and phone.",
    heroPoster: "/posters/contact-reference.png",
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
    "I'm Richard, a software developer who likes turning ideas into things people can see, use, and remember. This is my corner of the web for the work, experiments, and details that feel most like me.",
  currentRole: "Currently building software at EOG Resources.",
  nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
  technicalCuriosity: `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
  ownerDraftMessage:
    "Richard will replace these two marked lines with his own words before production.",
  links: [
    { label: "Read my experience", href: "/experience" },
    { label: "See my projects", href: "/projects" },
    { label: "Browse my GitHub", href: "https://github.com/rphong" },
    { label: "Contact me", href: "/contact" },
  ],
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
  readonly sceneId: string;
  readonly poster: string;
  readonly requiredLive: boolean;
  readonly roles: readonly RoleEntry[];
  readonly narrative: readonly string[];
};

export const experience = [
  {
    id: "nasa",
    company: "NASA",
    sceneId: "nasa-rocket",
    poster: "/posters/experience-reference.png",
    requiredLive: true,
    roles: [
      { title: "Software Developer Intern", dates: "2023–2024" },
      { title: "Software Developer Intern", dates: "2022–2023" },
    ],
    narrative: [
      "At NASA, I worked across crew-facing interfaces, training tools, and simulator workflows. I helped redesign an ISS crew calendar interface used during Artemis III preparation, automated feedback for On-Board Training, and built a Razor Pages coordination tool.",
      "I also reduced a training-simulator file by 60 percent and improved one script's speed by more than 5×. That range made performance and clarity feel inseparable from the people relying on the software.",
    ],
  },
  {
    id: "eog",
    company: "EOG Resources",
    sceneId: "eog-poster",
    poster: "/posters/experience-reference.png",
    requiredLive: false,
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
    poster: "/posters/experience-reference.png",
    requiredLive: false,
    roles: [{ title: "Software Developer Intern", dates: "2023" }],
    narrative: [
      "At Paycom, I built an ASP.NET and React Web API that used FedEx APIs to support more than 15,000 packages each week, then built out a test suite that reached 90 percent coverage.",
      "It was a focused lesson in treating reliability as part of the feature rather than a separate concern.",
    ],
  },
] as const satisfies readonly ExperienceChapter[];

export type ProjectChapter = {
  readonly id: "league-ban-site" | "froggie-adventures";
  readonly name: string;
  readonly sceneId: string;
  readonly poster: string;
  readonly posterAlt: string;
  readonly requiredLive: true;
  readonly reflection: string;
  readonly technicalLine: string;
  readonly repository: string;
};

export const projects = [
  {
    id: "league-ban-site",
    name: "League Ban Site",
    sceneId: "league-ban",
    poster: "/posters/projects-reference.png",
    posterAlt: "",
    requiredLive: true,
    reflection:
      "League Ban Site began with a simple connection: I was already playing League of Legends, and I wanted to see what would happen if I turned that familiarity into a coding project. Building around match data made software feel less abstract and pushed me to keep learning because the problem already meant something to me.",
    technicalLine:
      "Node.js · Express · EJS · node-fetch · Riot APIs · accepts a summoner name, reads recent ranked matches, and derives playful opponent/ban recommendations",
    repository: "https://github.com/rphong/LeagueBanSite",
  },
  {
    id: "froggie-adventures",
    name: "Froggie Adventures",
    sceneId: "froggie-adventures",
    poster: "/images/froggie-gameplay.png",
    posterAlt:
      "Froggie Adventures gameplay showing a pixel-art frog, platforms, hearts, and a score counter.",
    requiredLive: true,
    reflection:
      "Froggie Adventures is the project I remember most for the teamwork. I helped lead a three-person team, which meant sharing ideas, dividing responsibility, and bringing separate pieces together into something we could demonstrate publicly. Seeing the game take shape as a group made shipping feel as rewarding as the code itself.",
    technicalLine:
      "Unity · C# · three-person team · procedural, difficulty-scaled level generation",
    repository: "https://github.com/rphong/Froggie",
  },
] as const satisfies readonly ProjectChapter[];

export const contact = {
  introduction:
    "Whether you want to talk about a role, a project, or an odd web experiment, these are the best ways to reach me.",
  actions: [
    {
      label: "Email",
      value: "richard.phong424@gmail.com",
      href: "mailto:richard.phong424@gmail.com",
    },
    {
      label: "LinkedIn",
      value: "linkedin.com/in/richard-phong",
      href: "https://linkedin.com/in/richard-phong/",
    },
    {
      label: "GitHub",
      value: "github.com/rphong",
      href: "https://github.com/rphong",
    },
    {
      label: "Phone",
      value: "281-777-6437",
      href: "tel:+12817776437",
    },
  ],
  resumeHref: "/Richard-Phong-Resume.pdf",
  privacy:
    "The production site is designed to use Cloudflare and Sentry only for sampled performance and error diagnostics. It does not attach contact details to diagnostics, track contact actions, collect visitor identity, or use session replay. The future 3D preference stays on this device.",
  footer: {
    disclosure: "Operational diagnostics only. No engagement or identity tracking.",
    privacyHref: "/contact#privacy",
  },
} as const;
