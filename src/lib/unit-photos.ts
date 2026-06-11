/**
 * Unit photo storage helpers.
 *   listing   -> bucket "unit-photos"   (PUBLIC; served via public URL)
 *   condition -> bucket "unit-condition" (PRIVATE; viewed via signed URL)
 */
export const LISTING_BUCKET = "unit-photos";
export const CONDITION_BUCKET = "unit-condition";

export type PhotoKind = "listing" | "condition" | "move_in" | "move_out";

/** Listing photos are public; everything else (move-in/out/condition) is private. */
export function bucketForKind(kind: string): string {
  return kind === "listing" ? LISTING_BUCKET : CONDITION_BUCKET;
}

/** Public URL for a listing photo (no auth needed — the bucket is public). */
export function listingPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${LISTING_BUCKET}/${path}`;
}
