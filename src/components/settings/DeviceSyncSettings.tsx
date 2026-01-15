/**
 * Device Sync Settings
 *
 * Settings tab for managing device sync and pairing.
 */

import { useState } from 'react'
import {
  Smartphone,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DevicePairingDialog } from '@/components/sync/DevicePairingDialog'
import { SyncStatusIndicator } from '@/components/sync/SyncStatusIndicator'
import {
  useSyncStatus,
  useDeviceInfo,
  useSyncConnection,
} from '@/lib/sync'
import { formatDistanceToNow } from 'date-fns'

export function DeviceSyncSettings() {
  const [showPairingDialog, setShowPairingDialog] = useState(false)
  const [pairingMode, setPairingMode] = useState<'show' | 'scan'>('show')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  const { status, connectedPeers, lastSyncedAt } = useSyncStatus()
  const { deviceId, deviceName, setDeviceName } = useDeviceInfo()
  const { disconnect, disconnectPeer } = useSyncConnection()

  const handleStartPairing = (mode: 'show' | 'scan') => {
    setPairingMode(mode)
    setShowPairingDialog(true)
  }

  const handleEditName = () => {
    setEditedName(deviceName)
    setIsEditingName(true)
  }

  const handleSaveName = () => {
    if (editedName.trim()) {
      setDeviceName(editedName.trim())
    }
    setIsEditingName(false)
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  return (
    <div className="space-y-6">
      {/* This Device */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            This Device
          </CardTitle>
          <CardDescription>
            Your device information and sync status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-8 w-40"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleSaveName}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{deviceName}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={handleEditName}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                ID: {deviceId?.slice(0, 8)}...
              </p>
            </div>
            <SyncStatusIndicator showLabel />
          </div>

          {lastSyncedAt && (
            <div className="text-sm text-muted-foreground">
              Last synced{' '}
              {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pair Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Pair Devices</CardTitle>
          <CardDescription>
            Sync your data between multiple devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleStartPairing('show')}
            >
              <Plus className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Show Pairing Code</div>
                <div className="text-xs text-muted-foreground">
                  Display a code for another device to scan
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleStartPairing('scan')}
            >
              <RefreshCw className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Scan Pairing Code</div>
                <div className="text-xs text-muted-foreground">
                  Connect to a device showing a code
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Devices */}
      {connectedPeers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Connected Devices</span>
              <Badge variant="secondary">{connectedPeers.length}</Badge>
            </CardTitle>
            <CardDescription>
              Devices currently syncing with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {connectedPeers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{peer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {peer.isOnline ? (
                          <span className="text-green-500">Online</span>
                        ) : (
                          <span>
                            Last seen{' '}
                            {formatDistanceToNow(peer.lastSeen, {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={peer.isOnline ? 'default' : 'secondary'}
                      className={peer.isOnline ? 'bg-green-500' : ''}
                    >
                      {peer.isOnline ? 'Syncing' : 'Offline'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => disconnectPeer(peer.id)}
                      title="Disconnect this device"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {connectedPeers.length > 1 && (
              <>
                <Separator className="my-4" />

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnect()}
                  disabled={status === 'disconnected'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect All
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Device Sync Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Device sync uses peer-to-peer technology to keep your data in sync
            across all your devices without storing anything on our servers.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Private:</strong> Data is transferred directly between
              your devices
            </li>
            <li>
              <strong>Secure:</strong> Connections are encrypted end-to-end
            </li>
            <li>
              <strong>Automatic:</strong> Changes sync instantly when devices
              are online
            </li>
            <li>
              <strong>Offline-ready:</strong> Works without internet, syncs when
              reconnected
            </li>
          </ul>
          <p className="text-xs">
            Note: API keys are never synced and must be configured on each
            device separately for security.
          </p>
        </CardContent>
      </Card>

      {/* Pairing Dialog */}
      <DevicePairingDialog
        open={showPairingDialog}
        onOpenChange={setShowPairingDialog}
        mode={pairingMode}
      />
    </div>
  )
}
