import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  ArrowRight,
  ArrowLeft,
  Key,
  Check,
  ExternalLink,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { encrypt } from '@/lib/crypto'
import { saveApiKey } from '@/db/hooks'
import { generateId, now } from '@/db'
import type { AIProvider, EncryptedApiKey } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ApiKeyStepProps {
  onNext: () => void
  onBack: () => void
  hasApiKey: boolean
}

const apiKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

type ApiKeyFormValues = z.infer<typeof apiKeySchema>

interface ProviderOption {
  provider: AIProvider
  name: string
  description: string
  placeholder: string
  helpUrl: string
  recommended?: boolean
}

const providers: ProviderOption[] = [
  {
    provider: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Best for tutoring and study guides',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    recommended: true,
  },
  {
    provider: 'openai',
    name: 'OpenAI (GPT-4)',
    description: 'Widely used, versatile',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    provider: 'google',
    name: 'Google (Gemini)',
    description: 'Fast and capable',
    placeholder: 'AIza...',
    helpUrl: 'https://makersuite.google.com/app/apikey',
  },
]

export function ApiKeyStep({ onNext, onBack, hasApiKey }: ApiKeyStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic')
  const [isLoading, setIsLoading] = useState(false)
  const [savedKey, setSavedKey] = useState(hasApiKey)

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: '',
    },
  })

  const handleSave = async (values: ApiKeyFormValues) => {
    setIsLoading(true)
    try {
      const encrypted = await encrypt(values.apiKey)
      const apiKeyRecord: EncryptedApiKey = {
        id: generateId(),
        provider: selectedProvider,
        encryptedKey: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        createdAt: now(),
        updatedAt: now(),
      }
      await saveApiKey(apiKeyRecord)
      setSavedKey(true)
      form.reset()
      toast.success('API key saved successfully')
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setIsLoading(false)
    }
  }

  const currentProvider = providers.find(p => p.provider === selectedProvider)!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Configure AI Provider</h2>
        <p className="text-muted-foreground">
          To enable AI features like syllabus parsing, study guides, and tutoring,
          you'll need an API key from an AI provider.
        </p>
      </div>

      {/* Already configured */}
      {savedKey && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            API key configured. You can add or update keys later in Settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Provider selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Select Provider</label>
        <div className="grid sm:grid-cols-3 gap-3">
          {providers.map((provider) => (
            <button
              key={provider.provider}
              type="button"
              onClick={() => setSelectedProvider(provider.provider)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all',
                selectedProvider === provider.provider
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {provider.description}
                  </div>
                </div>
                {provider.recommended && (
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* API Key form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Enter {currentProvider.name} API Key
          </CardTitle>
          <CardDescription>
            <a
              href={currentProvider.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get your API key
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                        placeholder={currentProvider.placeholder}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Your key is encrypted and stored only on your device
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save API Key
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Skip notice */}
      {!savedKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You can skip this step, but AI features won't work until you configure
            an API key in Settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          {savedKey ? 'Continue' : 'Skip for Now'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
