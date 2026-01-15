/**
 * Device Pairing Dialog
 *
 * Dialog for pairing devices via QR code or manual code entry.
 */

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Scanner } from '@yudiel/react-qr-scanner'
import {
  Smartphone,
  QrCode,
  Keyboard,
  RefreshCw,
  Camera,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePairingCode, useJoinSync, useSyncStatus, syncProvider } from '@/lib/sync'

interface DevicePairingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'show' | 'scan' // show = display code, scan = scan code
}

export function DevicePairingDialog({
  open,
  onOpenChange,
  mode = 'show',
}: DevicePairingDialogProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>(
    mode === 'scan' ? 'qr' : 'qr'
  )
  const [manualCode, setManualCode] = useState('')
  const [showScanner, setShowScanner] = useState(mode === 'scan')

  const { qrData, formattedCode, isExpired, generate, refresh } =
    usePairingCode()
  const { joinWithCode, joinWithQR, isJoining, error, clearError } =
    useJoinSync()
  const { isConnected, peerCount } = useSyncStatus()

  // Generate code and connect to room when dialog opens in "show" mode
  useEffect(() => {
    if (open && mode === 'show' && !qrData) {
      const { data } = generate()
      // Connect to the room so we're waiting for peers
      if (data) {
        console.log('[Sync] Host connecting to room:', data.roomId)
        syncProvider.connect(data.roomId, data.secret).catch((err) => {
          console.error('[Sync] Host failed to connect:', err)
        })
      }
    }
  }, [open, mode, qrData, generate])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setManualCode('')
      setShowScanner(mode === 'scan')
      clearError()
      // Note: We don't disconnect here because we want to stay connected
      // if pairing was successful
    }
  }, [open, mode, clearError])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.length >= 6) {
      await joinWithCode(manualCode.replace(/[^A-Za-z0-9]/g, ''))
    }
  }

  const handleQRScan = async (result: string) => {
    setShowScanner(false)
    await joinWithQR(result)
  }

  // Show success state when connected
  if (isConnected && peerCount > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Devices Connected
            </DialogTitle>
            <DialogDescription>
              Your devices are now syncing. Changes will automatically sync
              between paired devices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                <Smartphone className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex flex-col items-center">
                <div className="h-0.5 w-12 bg-green-500" />
                <span className="text-xs text-muted-foreground mt-1">
                  syncing
                </span>
              </div>
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                <Smartphone className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {mode === 'show' ? 'Pair New Device' : 'Connect to Device'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'show'
              ? 'Scan this code on another device to sync your data.'
              : 'Scan the code shown on your other device, or enter the code manually.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'qr' | 'manual')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr" className="flex items-center gap-2">
              {mode === 'show' ? (
                <QrCode className="h-4 w-4" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {mode === 'show' ? 'QR Code' : 'Scan'}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="mt-4">
            {mode === 'show' ? (
              // Show QR code for other device to scan
              <div className="flex flex-col items-center gap-4">
                {qrData && !isExpired ? (
                  <>
                    <div className="p-4 bg-white rounded-lg">
                      <QRCodeSVG value={qrData} size={200} level="M" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Or enter this code:{' '}
                      <span className="font-mono font-bold">
                        {formattedCode}
                      </span>
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <XCircle className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isExpired ? 'Code expired' : 'Generating code...'}
                    </p>
                    <Button onClick={refresh} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate New Code
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              // Show scanner for reading QR code
              <div className="flex flex-col items-center gap-4">
                {showScanner ? (
                  <div className="w-full aspect-square max-w-[280px] rounded-lg overflow-hidden bg-black">
                    <Scanner
                      onScan={(result) => {
                        if (result?.[0]?.rawValue) {
                          handleQRScan(result[0].rawValue)
                        }
                      }}
                      onError={(error) => console.error(error)}
                      styles={{
                        container: { width: '100%', height: '100%' },
                      }}
                    />
                  </div>
                ) : isJoining ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Connecting...
                    </p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button
                      onClick={() => {
                        clearError()
                        setShowScanner(true)
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Camera className="h-12 w-12 text-muted-foreground" />
                    <Button onClick={() => setShowScanner(true)}>
                      <Camera className="h-4 w-4 mr-2" />
                      Open Camera
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            {mode === 'show' ? (
              // Show the code for manual entry
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="text-4xl font-mono font-bold tracking-widest">
                  {formattedCode || '---'}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Enter this code on your other device
                </p>
                {isExpired && (
                  <Button onClick={refresh} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate New Code
                  </Button>
                )}
              </div>
            ) : (
              // Input for entering code manually
              <form
                onSubmit={handleManualSubmit}
                className="flex flex-col gap-4"
              >
                <Input
                  value={manualCode}
                  onChange={(e) =>
                    setManualCode(e.target.value.toUpperCase().slice(0, 7))
                  }
                  placeholder="ABC-123"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={7}
                  autoComplete="off"
                />
                {error && (
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={manualCode.replace(/[^A-Za-z0-9]/g, '').length < 6}
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
