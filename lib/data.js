import { GoldTitle, GrayTitle } from "@/components/reusables";

export const LOGOS = [
  { src: "/amazon.svg", alt: "Amazon" },
  { src: "/atlassian.svg", alt: "Atlassian" },
  { src: "/google.webp", alt: "Google" },
  { src: "/meta.svg", alt: "Meta" },
  { src: "/microsoft.webp", alt: "Microsoft" },
  { src: "/netflix.png", alt: "Netflix" },
  { src: "/uber.svg", alt: "Uber" },
];

export const AVATARS = [
  { src: "https://randomuser.me/api/portraits/men/32.jpg" },
  { src: "https://randomuser.me/api/portraits/women/44.jpg" },
  { src: "https://randomuser.me/api/portraits/men/76.jpg" },
  { src: "https://randomuser.me/api/portraits/women/68.jpg" },
  { src: "https://randomuser.me/api/portraits/men/12.jpg" },
];

export const AI_TAGS = [
  { label: "Frontend Engineer", active: true },
  { label: "L5 Level", active: true },
  { label: "React Performance", active: false },
  { label: "System Design", active: false },
  { label: "Behavioural", active: true },
  { label: "DSA", active: false },
];

export const SLOTS = [
  {
    label: "Mon 10:00 AM",
    cls: "border-amber-400/30 text-amber-200 bg-amber-400/5",
  },
  { label: "Mon 2:00 PM", cls: "border-white/7 text-stone-500" },
  {
    label: "Tue 11:00 AM",
    cls: "border-amber-400/30 text-amber-200 bg-amber-400/5",
  },
  {
    label: "Wed 9:00 AM ✓",
    cls: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
  },
  {
    label: "Thu 3:00 PM",
    cls: "border-amber-400/30 text-amber-200 bg-amber-400/5",
  },
];

export const PLANS = [
  {
    name: "Free",
    price: "$0",
    credits: "1 credit / month",
    featured: false,
    planId: null,
    slug: "free",
    features: [
      "1 mock interview session",
      "HD video call via Stream",
      "Persistent chat thread",
    ],
  },
  {
    name: "Starter",
    price: "$29",
    credits: "5 credits / month",
    featured: true,
    planId: "cplan_3Az9LokzTcywp64E2clEolnnqhB",
    slug: "starter",
    features: [
      "5 mock interview sessions",
      "AI feedback report",
      "HD video call via Stream",
      "Persistent chat thread",
      "Credits roll over monthly",
    ],
  },
  {
    name: "Pro",
    price: "$69",
    credits: "15 credits / month",
    featured: false,
    planId: "cplan_3Az9PNOYND36xNf4JEkpT22w4X2",
    slug: "pro",
    features: [
      "15 mock interview sessions",
      "AI feedback report",
      "HD video call via Stream",
      "Persistent chat thread",
      "Credits roll over monthly",
      "Recording & playback link",
    ],
  },
];

export const ROLES = [
  {
    label: "Interviewee",
    title: <GrayTitle>Land the role you deserve</GrayTitle>,
    desc: "Stop guessing what interviewers want. Practice with people who've been on the other side and know exactly how top companies evaluate candidates.",
    perks: [
      "Browse by category: Frontend, Backend, System Design, PM",
      "Book sessions using monthly credits from your plan",
      "Receive AI-powered feedback after every session",
      "Access session recordings to review your performance",
      "Chat with your interviewer before and after the call",
    ],
  },
  {
    label: "Interviewer",
    title: <GoldTitle>Earn doing what you&apos;re great at</GoldTitle>,
    desc: "Share your knowledge, help engineers grow, and earn meaningful income on your own schedule. Set your slots, and we handle the rest.",
    perks: [
      "Set your own availability and session rates",
      "AI question generator tailored to each candidate's role",
      "Earn credits per session — withdraw any time",
      "Dashboard with credit balance and withdrawal requests",
    ],
  },
];
