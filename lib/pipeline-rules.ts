export interface ListingCandidate {
  id: number;
  auctionEndDate?: Date | string | null;
  createdAt?: Date | string | null;
}

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function selectLatestListingForFinalSale(listings: ListingCandidate[]): ListingCandidate | null {
  return [...listings].sort((left, right) => {
    const leftTime = timestamp(left.auctionEndDate) || timestamp(left.createdAt);
    const rightTime = timestamp(right.auctionEndDate) || timestamp(right.createdAt);
    return rightTime - leftTime || right.id - left.id;
  })[0] || null;
}

export function conversionId(type: "qualified-lead" | "donation-accepted" | "boat-sold", id: number | string): string {
  if (type === "qualified-lead") return `conv_qual_lead_${id}`;
  if (type === "donation-accepted") return `conv_accept_lead_${id}`;
  return `conv_sale_boat_${id}`;
}
