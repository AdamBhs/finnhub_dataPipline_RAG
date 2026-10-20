export type ModelId = "fast" | "balanced" | "reasoning" | "local"

export const MODELS: { id: ModelId; label: string; description: string }[] = [
  { id: "fast", label: "Fast", description: "Quick answers, lowest cost" },
  { id: "balanced", label: "Balanced", description: "Good default for most questions" },
  { id: "reasoning", label: "Reasoning", description: "Slower, for deep analysis" },
  { id: "local", label: "Local", description: "Runs on your own machine" },
]

export const DEFAULT_MODEL: ModelId = "balanced"

export function isModelId(value: string): value is ModelId {
  return MODELS.some((m) => m.id === value)
}