import type { AIProvider } from '@/types'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | AIMessageContent[]
}

export interface AIMessageContent {
  type: 'text' | 'image'
  text?: string
  image?: {
    data: string // base64
    mediaType: string
  }
}

export interface AICompletionRequest {
  messages: AIMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface AICompletionResponse {
  content: string
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface AIProviderConfig {
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AIProviderInterface {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>
  getDefaultModel(): string
  supportsVision(): boolean
}
