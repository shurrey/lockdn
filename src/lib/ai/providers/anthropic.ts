import type {
  AIProviderInterface,
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIMessageContent,
} from '../types'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContent[]
}

interface AnthropicContent {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

interface AnthropicResponse {
  id: string
  type: string
  role: string
  content: Array<{ type: string; text: string }>
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class AnthropicProvider implements AIProviderInterface {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.model = model || this.getDefaultModel()
  }

  getDefaultModel(): string {
    return 'claude-sonnet-4-20250514'
  }

  supportsVision(): boolean {
    return true
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const messages = this.convertMessages(request.messages)
    const model = request.model || this.model

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens || 4096,
      messages,
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature
    }

    if (request.systemPrompt) {
      body.system = request.systemPrompt
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data: AnthropicResponse = await response.json()

    return {
      content: data.content.map((c) => c.text).join(''),
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    }
  }

  private convertMessages(messages: AIMessage[]): AnthropicMessage[] {
    return messages
      .filter((m) => m.role !== 'system') // System messages handled separately
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: this.convertContent(message.content),
      }))
  }

  private convertContent(
    content: string | AIMessageContent[]
  ): string | AnthropicContent[] {
    if (typeof content === 'string') {
      return content
    }

    return content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text }
      }
      if (c.type === 'image' && c.image) {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: c.image.mediaType,
            data: c.image.data,
          },
        }
      }
      return { type: 'text' as const, text: '' }
    })
  }
}
