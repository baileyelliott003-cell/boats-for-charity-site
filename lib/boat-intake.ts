/** Preserve useful vessel facts in the existing intake/deal-packet field. */
export function boatIntakeDetails(data: Record<string, unknown>): string {
  const fields = [
    ["boat_year", "Year"], ["boat_make_model", "Make / model"],
    ["boat_length", "Length (ft)"], ["boat_location", "Boat city / state"],
    ["boat_condition", "Condition"], ["boat_ownership", "Ownership paperwork"],
    ["boat_timeline", "Owner's timeline"], ["boat_trailer", "Trailer / access"],
  ];
  const clean = (value: unknown, limit: number) => typeof value === "string" || typeof value === "number"
    ? String(value).trim().slice(0, limit) : "";
  const details = clean(data.boat_details || data.details || data.notes || data["Boat Details"] || data.Details, 3500);
  const facts = fields.flatMap(([key, label]) => {
    const value = clean(data[key], 150);
    return value ? [`${label}: ${value}`] : [];
  });
  return [facts.join("\n"), details].filter(Boolean).join("\n\n").slice(0, 5000);
}
