import type {
  AIProviderInterface,
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIMessageContent,
} from '../types'

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

interface OllamaResponse {
  model: string
  message: {
    role: string
    content: string
  }
  prompt_eval_count?: number
  eval_count?: number
}

export class OllamaProvider implements AIProviderInterface {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string, model?: string) {
    // baseUrl is typically http://localhost:11434
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.model = model || this.getDefaultModel()
  }

  getDefaultModel(): string {
    return 'llama3.2'
  }

  supportsVision(): boolean {
    // Some Ollama models support vision (llava, bakllava, etc.)
    return this.model.includes('llava') || this.model.includes('vision')
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const messages = this.convertMessages(request.messages, request.systemPrompt)
    const model = request.model || this.model

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    }

    if (request.temperature !== undefined) {
      body.options = { temperature: request.temperature }
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${response.status} - ${error}`)
    }

    const data: OllamaResponse = await response.json()

    return {
      content: data.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
    }
  }

  private convertMessages(
    messages: AIMessage[],
    systemPrompt?: string
  ): OllamaMessage[] {
    const result: OllamaMessage[] = []

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    for (const message of messages) {
      if (message.role === 'system') {
        result.push({ role: 'system', content: message.content as string })
      } else {
        const converted = this.convertContent(message.content)
        result.push({
          role: message.role,
          content: converted.content,
          ...(converted.images.length > 0 && { images: converted.images }),
        })
      }
    }

    return result
  }

  private convertContent(content: string | AIMessageContent[]): {
    content: string
    images: string[]
  } {
    if (typeof content === 'string') {
      return { content, images: [] }
    }

    const textParts: string[] = []
    const images: string[] = []

    for (const c of content) {
      if (c.type === 'text' && c.text) {
        textParts.push(c.text)
      }
      if (c.type === 'image' && c.image) {
        images.push(c.image.data)
      }
    }

    return {
      content: textParts.join('\n'),
      images,
    }
  }
}
