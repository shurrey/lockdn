import type {
  AIProviderInterface,
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIMessageContent,
} from '../types'

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | OpenAIContent[]
}

interface OpenAIContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

interface OpenAIResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export class OpenAIProvider implements AIProviderInterface {
  private apiKey: string
  private model: string
  private baseUrl: string

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.model = model || this.getDefaultModel()
    this.baseUrl = baseUrl || 'https://api.openai.com/v1'
  }

  getDefaultModel(): string {
    return 'gpt-4o'
  }

  supportsVision(): boolean {
    return this.model.includes('gpt-4') || this.model.includes('vision')
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const messages = this.convertMessages(request.messages, request.systemPrompt)
    const model = request.model || this.model

    const body: Record<string, unknown> = {
      model,
      messages,
    }

    if (request.maxTokens) {
      body.max_tokens = request.maxTokens
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data: OpenAIResponse = await response.json()

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    }
  }

  private convertMessages(
    messages: AIMessage[],
    systemPrompt?: string
  ): OpenAIMessage[] {
    const result: OpenAIMessage[] = []

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    for (const message of messages) {
      if (message.role === 'system') {
        result.push({ role: 'system', content: message.content as string })
      } else {
        result.push({
          role: message.role,
          content: this.convertContent(message.content),
        })
      }
    }

    return result
  }

  private convertContent(
    content: string | AIMessageContent[]
  ): string | OpenAIContent[] {
    if (typeof content === 'string') {
      return content
    }

    return content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text }
      }
      if (c.type === 'image' && c.image) {
        return {
          type: 'image_url' as const,
          image_url: {
            url: `data:${c.image.mediaType};base64,${c.image.data}`,
          },
        }
      }
      return { type: 'text' as const, text: '' }
    })
  }
}
