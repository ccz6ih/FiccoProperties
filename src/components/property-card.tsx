import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { getCommunityContent } from "@/lib/content";
import { propertyTypeLabel } from "@/lib/format";
import type { PropertyWithCounts } from "@/lib/queries";

export function PropertyCard({ property }: { property: PropertyWithCounts }) {
  const content = getCommunityContent(property.slug);
  const available = property.availableCount > 0;

  return (
    <Link href={`/properties/${property.slug}`} className="group block">
      <Card className="h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_24px_rgba(44,38,34,0.10)]">
        <div
          className={`relative aspect-[16/10] bg-gradient-to-br ${content.gradient}`}
        >
          <div className="bg-grain absolute inset-0 opacity-60" />
          <div className="absolute left-4 top-4">
            <span className="rounded-full bg-cream/90 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              {propertyTypeLabel(property.type)}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="font-display text-2xl font-semibold text-cream drop-shadow-sm">
              {property.name}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ink-soft line-clamp-2">
            {content.blurb}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-faint">
              {property.address_line1}
            </span>
            <Badge tone={available ? "pine" : "neutral"}>
              {available
                ? `${property.availableCount} available`
                : "Fully leased"}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
