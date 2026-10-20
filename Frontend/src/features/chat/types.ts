import type { ModelId } from "./models.ts"

export type Attachment = {
  id: string
  file: File
  previewUrl: string | null
}

export type MessageFile = {
  name: string
  size: number
  previewUrl: string | null
}

export type ChatMessage = {
  id: string
  role: "user" | "ai"
  text: string
  files: MessageFile[]
  modelId?: ModelId
  streaming?: boolean
}