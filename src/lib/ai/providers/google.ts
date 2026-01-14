import type {
  AIProviderInterface,
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIMessageContent,
} from '../types'

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
    }
  }>
  usageMetadata: {
    promptTokenCount: number
    candidatesTokenCount: number
  }
}

export class GoogleProvider implements AIProviderInterface {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.model = model || this.getDefaultModel()
  }

  getDefaultModel(): string {
    return 'gemini-1.5-flash'
  }

  supportsVision(): boolean {
    return true
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const contents = this.convertMessages(request.messages)
    const model = request.model || this.model

    const body: Record<string, unknown> = {
      contents,
    }

    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      }
    }

    const generationConfig: Record<string, unknown> = {}
    if (request.maxTokens) {
      generationConfig.maxOutputTokens = request.maxTokens
    }
    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature
    }
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google AI API error: ${response.status} - ${error}`)
    }

    const data: GeminiResponse = await response.json()

    return {
      content: data.candidates[0]?.content?.parts?.map((p) => p.text).join('') || '',
      model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    }
  }

  private convertMessages(messages: AIMessage[]): GeminiContent[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: this.convertContent(message.content),
      }))
  }

  private convertContent(content: string | AIMessageContent[]): GeminiPart[] {
    if (typeof content === 'string') {
      return [{ text: content }]
    }

    return content.map((c) => {
      if (c.type === 'text') {
        return { text: c.text }
      }
      if (c.type === 'image' && c.image) {
        return {
          inlineData: {
            mimeType: c.image.mediaType,
            data: c.image.data,
          },
        }
      }
      return { text: '' }
    })
  }
}
