export const AVAILABLE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number];
export const DEFAULT_MODEL_ID: ModelId = "gemini-3.5-flash-lite";
