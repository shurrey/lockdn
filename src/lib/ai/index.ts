import type { AIProvider } from '@/types'
import type { AIProviderInterface, AIProviderConfig } from './types'
import { AnthropicProvider } from './providers/anthropic'
import { OpenAIProvider } from './providers/openai'
import { GoogleProvider } from './providers/google'
import { OllamaProvider } from './providers/ollama'
import { db } from '@/db'
import { decrypt } from '@/lib/crypto'

export * from './types'

/**
 * Create an AI provider instance based on configuration
 */
export function createProvider(config: AIProviderConfig): AIProviderInterface {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model)
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model, config.baseUrl)
    case 'google':
      return new GoogleProvider(config.apiKey, config.model)
    case 'ollama':
      return new OllamaProvider(config.apiKey, config.model) // apiKey is baseUrl for Ollama
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

/**
 * Get the configured AI provider from the database
 * Returns null if no API key is configured
 */
export async function getConfiguredProvider(): Promise<AIProviderInterface | null> {
  // Get user preferences to determine which provider to use
  const prefs = await db.preferences.get('user_preferences')
  const preferredProvider = prefs?.aiProvider || 'anthropic'

  // Try to get the API key for the preferred provider
  let apiKey = await db.encryptedApiKeys
    .where('provider')
    .equals(preferredProvider)
    .first()

  // If no key for preferred provider, try to find any configured provider
  if (!apiKey) {
    const allKeys = await db.encryptedApiKeys.toArray()
    if (allKeys.length > 0) {
      apiKey = allKeys[0]
    }
  }

  if (!apiKey) {
    return null
  }

  // Decrypt the API key
  const decryptedKey = await decrypt({
    ciphertext: apiKey.encryptedKey,
    iv: apiKey.iv,
    salt: apiKey.salt,
  })

  return createProvider({
    provider: apiKey.provider,
    apiKey: decryptedKey,
    model: prefs?.aiModel,
  })
}

/**
 * Get a specific AI provider by type
 * Returns null if the provider is not configured
 */
export async function getProvider(
  provider: AIProvider
): Promise<AIProviderInterface | null> {
  const apiKey = await db.encryptedApiKeys
    .where('provider')
    .equals(provider)
    .first()

  if (!apiKey) {
    return null
  }

  const decryptedKey = await decrypt({
    ciphertext: apiKey.encryptedKey,
    iv: apiKey.iv,
    salt: apiKey.salt,
  })

  const prefs = await db.preferences.get('user_preferences')

  return createProvider({
    provider,
    apiKey: decryptedKey,
    model: prefs?.aiModel,
  })
}

/**
 * Check if any AI provider is configured
 */
export async function hasConfiguredProvider(): Promise<boolean> {
  const count = await db.encryptedApiKeys.count()
  return count > 0
}

/**
 * Get list of configured providers
 */
export async function getConfiguredProviders(): Promise<AIProvider[]> {
  const keys = await db.encryptedApiKeys.toArray()
  return keys.map((k) => k.provider)
}
