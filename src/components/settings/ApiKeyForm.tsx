import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Check, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { encrypt, decrypt } from '@/lib/crypto'
import { useApiKeys, saveApiKey, deleteApiKey } from '@/db/hooks'
import { generateId, now } from '@/db'
import type { AIProvider, EncryptedApiKey } from '@/types'
import { toast } from 'sonner'

const apiKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

type ApiKeyFormValues = z.infer<typeof apiKeySchema>

interface ProviderConfig {
  provider: AIProvider
  name: string
  description: string
  placeholder: string
  helpUrl: string
}

const providers: ProviderConfig[] = [
  {
    provider: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Recommended for the best tutoring experience',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    provider: 'openai',
    name: 'OpenAI (GPT-4)',
    description: 'Alternative AI provider',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    provider: 'google',
    name: 'Google (Gemini)',
    description: 'Google AI provider',
    placeholder: 'AIza...',
    helpUrl: 'https://makersuite.google.com/app/apikey',
  },
  {
    provider: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run AI models locally for privacy',
    placeholder: 'http://localhost:11434',
    helpUrl: 'https://ollama.ai/',
  },
]

interface ApiKeyCardProps {
  config: ProviderConfig
  existingKey?: EncryptedApiKey
  onSave: (provider: AIProvider, key: string) => Promise<void>
  onDelete: (provider: AIProvider) => Promise<void>
}

function ApiKeyCard({ config, existingKey, onSave, onDelete }: ApiKeyCardProps) {
  const [showKey, setShowKey] = useState(false)
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Update editing state when existingKey loads/changes
  useEffect(() => {
    setIsEditing(!existingKey)
  }, [existingKey])

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: '',
    },
  })

  const handleToggleShow = async () => {
    if (showKey) {
      setShowKey(false)
      setDecryptedKey(null)
    } else if (existingKey) {
      try {
        const key = await decrypt({
          ciphertext: existingKey.encryptedKey,
          iv: existingKey.iv,
          salt: existingKey.salt,
        })
        setDecryptedKey(key)
        setShowKey(true)
      } catch {
        toast.error('Failed to decrypt API key')
      }
    }
  }

  const handleSave = async (values: ApiKeyFormValues) => {
    setIsLoading(true)
    try {
      await onSave(config.provider, values.apiKey)
      form.reset()
      setIsEditing(false)
      toast.success(`${config.name} API key saved`)
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await onDelete(config.provider)
      setIsEditing(true)
      setDecryptedKey(null)
      setShowKey(false)
      toast.success(`${config.name} API key removed`)
    } catch {
      toast.error('Failed to remove API key')
    } finally {
      setIsLoading(false)
    }
  }

  const maskedKey = decryptedKey
    ? decryptedKey.slice(0, 8) + '...' + decryptedKey.slice(-4)
    : '••••••••••••••••'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{config.name}</CardTitle>
            <CardDescription className="text-sm">
              {config.description}
            </CardDescription>
          </div>
          {existingKey && (
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-500">Configured</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={config.placeholder}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      <a
                        href={config.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Get your API key
                      </a>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Key
                </Button>
                {existingKey && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Stored Key:</Label>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {showKey ? decryptedKey : maskedKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleShow}
                className="h-8 w-8"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Update Key
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ApiKeyForm() {
  const apiKeys = useApiKeys()

  const handleSave = async (provider: AIProvider, key: string) => {
    const encrypted = await encrypt(key)
    const apiKeyRecord: EncryptedApiKey = {
      id: generateId(),
      provider,
      encryptedKey: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      createdAt: now(),
      updatedAt: now(),
    }
    await saveApiKey(apiKeyRecord)
  }

  const handleDelete = async (provider: AIProvider) => {
    await deleteApiKey(provider)
  }

  const getExistingKey = (provider: AIProvider) =>
    apiKeys?.find((k) => k.provider === provider)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-4 text-sm">
        <p className="font-medium mb-1">Your data stays private</p>
        <p className="text-muted-foreground">
          API keys are encrypted using the Web Crypto API and stored only on your
          device. They are never sent to our servers.
        </p>
      </div>

      <div className="grid gap-4">
        {providers.map((config) => (
          <ApiKeyCard
            key={config.provider}
            config={config}
            existingKey={getExistingKey(config.provider)}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
