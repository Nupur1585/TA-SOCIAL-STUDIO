/**
 * Details the owner must confirm before the legal pages are published.
 * Every value that starts with "[" is a placeholder and is rendered highlighted on the page.
 * Replace the placeholders here; nothing else in the legal pages needs editing for these fields.
 */
export const legalInfo = {
  productName: "Lexora",
  operatorName: "[OWNER TO CONFIRM: legal operator name]",
  operatorAddress: "[OWNER TO CONFIRM: business address]",
  privacyEmail: "[OWNER TO CONFIRM: privacy contact email]",
  dataDeletionResponseTime: "[OWNER TO CONFIRM: time to respond to deletion requests]",
  governingLaw: "[OWNER TO CONFIRM: governing law and jurisdiction]",
  hostingProvider: "[OWNER TO CONFIRM: hosting provider and region]",
  databaseProvider: "[OWNER TO CONFIRM: database hosting provider and region]",
  retention: "[OWNER TO CONFIRM: retention periods]",
  effectiveDate: "[OWNER TO CONFIRM: effective date]",
} as const;

export const isPlaceholder = (value: string) => value.startsWith("[");
