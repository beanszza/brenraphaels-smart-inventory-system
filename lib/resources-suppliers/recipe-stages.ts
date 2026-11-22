export const DEFAULT_PRODUCTION_STAGES = [
  "Steaming",
  "Peeling",
  "Grinding",
  "Mixing",
  "Cooking",
  "Cooling",
] as const;

const STAGES_PREFIX_REGEX = /^\[STAGES:([^\]]*)\]\r?\n?/i;

export function countWords(text?: string | null): number {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function decodeRecipeNotes(rawNotes?: string | null): {
  notes: string;
  stages: string[];
  hasExplicitStages: boolean;
} {
  const raw = rawNotes ?? "";
  const match = raw.match(STAGES_PREFIX_REGEX);
  if (!match) {
    return {
      notes: raw,
      stages: [...DEFAULT_PRODUCTION_STAGES],
      hasExplicitStages: false,
    };
  }

  const parsedStages = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const cleanNotes = raw.slice(match[0].length);
  return {
    notes: cleanNotes,
    stages: parsedStages.length > 0 ? parsedStages : [...DEFAULT_PRODUCTION_STAGES],
    hasExplicitStages: parsedStages.length > 0,
  };
}

export function encodeRecipeNotes(notes?: string | null, stages?: string[] | null): string {
  const decoded = decodeRecipeNotes(notes);
  const cleanNotes = decoded.notes.trim();
  const effectiveStages = (stages && stages.length > 0 ? stages : decoded.hasExplicitStages ? decoded.stages : [])
    .map((s) => s.trim().replace(/[|\]]/g, ""))
    .filter(Boolean);

  if (effectiveStages.length === 0) {
    return cleanNotes;
  }

  const header = `[STAGES:${effectiveStages.join("|")}]`;
  return cleanNotes ? `${header}\n${cleanNotes}` : header;
}
