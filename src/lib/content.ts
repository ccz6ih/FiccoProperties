/**
 * Marketing copy + visual treatment per community, keyed by slug.
 * The database holds the source-of-truth records (name, address, units);
 * this layer adds the editorial detail the public pages render.
 */
export type CommunityContent = {
  tagline: string;
  blurb: string;
  highlights: string[];
  gradient: string; // tailwind classes for the hero tile
  accent: "pine" | "terracotta" | "gold";
};

export const communityContent: Record<string, CommunityContent> = {
  "mountain-village-square": {
    tagline: "Our flagship apartment community",
    blurb:
      "Sixty-one apartment homes wrapped around mature trees and mountain views, minutes from Crown Hill Park. The largest of the Ficco communities and the heart of the neighborhood.",
    highlights: ["61 apartment homes", "Mountain & park views", "On-site management", "Off-street parking"],
    gradient: "from-pine to-pine-dark",
    accent: "pine",
  },
  "senior-villa": {
    tagline: "Comfortable senior living, 55+",
    blurb:
      "A quiet, walkable community designed for independent senior living. Single-level access, a caring on-site team, and neighbors who look out for one another.",
    highlights: ["43 senior residences", "Single-level access", "Quiet, walkable grounds", "Responsive maintenance"],
    gradient: "from-terracotta to-terracotta-dark",
    accent: "terracotta",
  },
  "villa-victoria": {
    tagline: "Townhomes & a single-family home",
    blurb:
      "Twenty-seven townhome residences plus a standalone house on the parcel — more room to spread out, with the ease of professional management.",
    highlights: ["27 townhomes + 1 house", "More square footage", "Private entries", "Family-friendly"],
    gradient: "from-[#7a6b3f] to-[#5d5230]",
    accent: "gold",
  },
  "the-villa": {
    tagline: "Intimate boutique apartments",
    blurb:
      "Eighteen apartment homes with a tucked-away, neighborly feel. The smallest and most personal of the four communities.",
    highlights: ["18 apartment homes", "Boutique scale", "Close-knit community", "Easy 38th Ave access"],
    gradient: "from-pine-dark to-[#1c3a32]",
    accent: "pine",
  },
};

export const FALLBACK_CONTENT: CommunityContent = {
  tagline: "A Ficco community",
  blurb:
    "A well-kept, family-owned community on W 38th Avenue in Wheat Ridge, Colorado.",
  highlights: ["Family-owned", "On-site management", "Responsive maintenance"],
  gradient: "from-pine to-pine-dark",
  accent: "pine",
};

export function getCommunityContent(slug: string): CommunityContent {
  return communityContent[slug] ?? FALLBACK_CONTENT;
}
