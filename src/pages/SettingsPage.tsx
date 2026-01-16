import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ApiKeyForm } from '@/components/settings/ApiKeyForm'
import { StudyPreferencesForm } from '@/components/settings/StudyPreferencesForm'
import { DataManagement } from '@/components/settings/DataManagement'
import { DeviceSyncSettings } from '@/components/settings/DeviceSyncSettings'
import { usePreferences, updatePreferences } from '@/db/hooks'
import { Sun, Moon, Monitor, HelpCircle } from 'lucide-react'
import { HelpPanel } from '@/components/HelpPanel'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function SettingsPage() {
  const preferences = usePreferences()
  const currentTheme = preferences?.theme || 'system'
  const [showHelp, setShowHelp] = useState(false)

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    await updatePreferences({ theme })
  }
  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Configure your preferences and API keys.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      <Tabs defaultValue="api-keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="sync">Device Sync</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>
                Enter your API keys to enable AI features. Keys are encrypted and stored locally on your device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeyForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <StudyPreferencesForm />
        </TabsContent>

        <TabsContent value="sync">
          <DeviceSyncSettings />
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the app looks on your device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Theme</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                        currentTheme === 'light'
                          ? 'border-2 border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-accent'
                      )}
                      onClick={() => handleThemeChange('light')}
                    >
                      <Sun className="h-5 w-5" />
                      <span className="text-sm font-medium">Light</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                        currentTheme === 'dark'
                          ? 'border-2 border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-accent'
                      )}
                      onClick={() => handleThemeChange('dark')}
                    >
                      <Moon className="h-5 w-5" />
                      <span className="text-sm font-medium">Dark</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                        currentTheme === 'system'
                          ? 'border-2 border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-accent'
                      )}
                      onClick={() => handleThemeChange('system')}
                    >
                      <Monitor className="h-5 w-5" />
                      <span className="text-sm font-medium">System</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    System will automatically switch between light and dark based on your device settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <DataManagement />
        </TabsContent>
      </Tabs>

      {/* Help Panel */}
      <HelpPanel
        docPath="user/features/settings"
        open={showHelp}
        onOpenChange={setShowHelp}
        title="Settings Help"
      />
    </div>
  )
}
