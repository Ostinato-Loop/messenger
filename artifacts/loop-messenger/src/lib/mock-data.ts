// Loop Messenger — Launch Mock Data
// Adopted from loop-messenger-ui-ux reference design.
// Used for UI demonstration until real API data is wired end-to-end.
// LILCKY STUDIO LIMITED

const av = (seed: string) => `https://i.pravatar.cc/150?u=${seed}`;

export type Chat = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: number;
  pinned?: boolean;
  verified?: boolean;
  business?: boolean;
  online?: boolean;
  typing?: boolean;
  group?: boolean;
};

export const chats: Chat[] = [
  { id: "adaeze",  name: "Adaeze Okafor",        avatar: av("adaeze"),  lastMessage: "Voice note · 0:42",          time: "now",       unread: 2,  online: true,  pinned: true },
  { id: "lagostech", name: "Lagos Tech Circle",   avatar: av("lagostech"), lastMessage: "Tunde: shared 3 photos",  time: "12m",       unread: 5,  online: true,  group: true },
  { id: "rald",   name: "RALD Announcements",     avatar: av("rald"),   lastMessage: "New update is now live!",     time: "10:15",     verified: true },
  { id: "michael", name: "Michael Johnson",        avatar: av("michael"), lastMessage: "Thanks for your help!",    time: "Yesterday", unread: 1,  typing: true },
  { id: "family", name: "Family Group",            avatar: av("family"), lastMessage: "Mom: Dinner at 7pm",        time: "Yesterday", unread: 3,  group: true },
  { id: "wanjiku", name: "Wanjiku M.",             avatar: av("wanjiku"), lastMessage: "Sent the deck — let me know 🙏", time: "1h",  online: false },
  { id: "djkemi", name: "DJ Kemi",                 avatar: av("djkemi"), lastMessage: "🔥🔥🔥",                    time: "3h",        online: true },
  { id: "saved",  name: "Saved Messages",          avatar: av("saved"),  lastMessage: "Photo",                    time: "Sun" },
];

export type Community = {
  id: string;
  name: string;
  avatar: string;
  category: string;
  members: number;
  activity: "high" | "medium" | "low";
  verified?: boolean;
  joined?: boolean;
  description: string;
};

export const communities: Community[] = [
  { id: "ug-tech",       name: "University of Ghana Tech", avatar: av("ugtech"),       category: "University", members: 12400, activity: "high",   verified: true, joined: true, description: "Builders, designers, founders at UG." },
  { id: "afro-devs",     name: "AfroDevs Collective",      avatar: av("afrodevs"),     category: "Creator",   members: 8230,  activity: "high",   verified: true,               description: "African software engineers shipping global products." },
  { id: "accra-local",   name: "Accra Local",              avatar: av("accra"),        category: "City",      members: 24500, activity: "medium",                               description: "Everything happening around Accra — events, food, life." },
  { id: "loop-biz",      name: "Loop Business Network",    avatar: av("loopbiz"),      category: "Business",  members: 5120,  activity: "high",   verified: true,               description: "Founders & operators across the RALD ecosystem." },
  { id: "design-africa", name: "Design Africa",            avatar: av("designafrica"), category: "Creator",   members: 3400,  activity: "medium",                joined: true, description: "Product, brand and motion designers." },
  { id: "nairobi",       name: "Nairobi Runners",          avatar: av("nairobi"),      category: "Interest",  members: 1820,  activity: "low",                               description: "Weekend runs across Nairobi." },
];

export type CallEntry = {
  id: string;
  name: string;
  avatar: string;
  type: "voice" | "video";
  direction: "incoming" | "outgoing" | "missed";
  time: string;
  group?: boolean;
};

export const calls: CallEntry[] = [
  { id: "c1", name: "Adaeze Okafor",    avatar: av("adaeze"),   type: "video", direction: "outgoing", time: "Today, 12:01" },
  { id: "c2", name: "Lagos Tech Circle", avatar: av("lagostech"), type: "voice", direction: "incoming", time: "Today, 10:32", group: true },
  { id: "c3", name: "Michael Johnson",   avatar: av("michael"),  type: "voice", direction: "missed",   time: "Yesterday" },
  { id: "c4", name: "Wanjiku M.",        avatar: av("wanjiku"),  type: "video", direction: "incoming", time: "Yesterday" },
  { id: "c5", name: "DJ Kemi",           avatar: av("djkemi"),   type: "voice", direction: "outgoing", time: "Mon" },
];

export const audioRooms = [
  { id: "r1", title: "Building for Africa-first",    host: "AfroDevs",    listeners: 412,  live: true },
  { id: "r2", title: "RALD Townhall — 2026",         host: "RALD Team",   listeners: 1280, live: true },
  { id: "r3", title: "Designers' open critique",      host: "Design Africa", listeners: 87, live: false },
];

export type DiscoverPerson = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  mutual?: number;
  verified?: boolean;
  metVia?: string;
};

export const discoverPeople: DiscoverPerson[] = [
  { id: "1", name: "Ngozi Ibe",      handle: "ngozi",  avatar: av("ngozi"),  bio: "Policy · Law · Abuja", mutual: 3, verified: true, metVia: "Met in Lagos Traffic Room" },
  { id: "2", name: "Tunde Abiola",   handle: "tunde",  avatar: av("tunde"),  bio: "Engineer · Open source · Lagos", mutual: 7, verified: true },
  { id: "3", name: "Kabza V.",        handle: "kabza",  avatar: av("kabza"),  bio: "Amapiano · log-drum · Johannesburg", mutual: 1 },
  { id: "4", name: "Fatima Al-Hassan", handle: "fatima", avatar: av("fatima"), bio: "Fintech · Startup · Abuja", mutual: 5 },
  { id: "5", name: "Chidi Eze",       handle: "chidi",  avatar: av("chidi"),  bio: "Product Manager · Lagos", mutual: 2 },
];
