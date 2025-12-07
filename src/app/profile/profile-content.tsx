'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast, ToastContainer } from '@/components/ui/toast'
import { updateProfile } from './actions'
import { 
  LogOut, 
  Camera, 
  Loader2, 
  Check, 
  X, 
  Mail,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  Cake,
  MapPin,
  Globe,
  Palette,
  Trash2,
  Link2,
  ExternalLink
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ThemeSwitch } from '@/components/layout/footer'
import { useAuth } from '@/lib/providers/auth-provider'
import { cn } from '@/lib/utils'

export function ProfileContent({
  user,
}: {
  user: User
}) {
  const { signOut, refreshUser } = useAuth()
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const url = user.user_metadata?.avatar_url
    // Only set if it's a valid URL
    if (url && typeof url === 'string' && url.startsWith('http')) {
      return url
    }
    return null
  })
  const [avatarError, setAvatarError] = useState(false)
  const [coverUrl, setCoverUrl] = useState(user.user_metadata?.cover_url || null)
  
  // Reset avatar error when URL changes
  useEffect(() => {
    setAvatarError(false)
  }, [avatarUrl])
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  
  // Toast
  const { toasts, showToast } = useToast()
  
  // Preferences state
  const [isEditingPreferences, setIsEditingPreferences] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [editingFullName, setEditingFullName] = useState(fullName)
  const [birthday, setBirthday] = useState(user.user_metadata?.birthday || '')
  const [editingBirthday, setEditingBirthday] = useState(birthday)
  const [location, setLocation] = useState(user.user_metadata?.location || '')
  const [editingLocation, setEditingLocation] = useState(location)
  const [timezone, setTimezone] = useState(user.user_metadata?.timezone || '')
  const [editingTimezone, setEditingTimezone] = useState(timezone)

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to remove your profile photo?')) return

    const previousUrl = avatarUrl
    setAvatarUrl(null)
    
    const formData = new FormData()
    formData.append('fullName', fullName)
    formData.append('avatarUrl', '')
    
    const result = await updateProfile(formData)
    
    if (result.error) {
      setAvatarUrl(previousUrl)
      showToast('Failed to remove profile photo', 'error')
    } else {
      await refreshUser()
      showToast('Profile photo removed', 'success')
    }
  }

  const handleRemoveCover = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to remove your cover photo?')) return

    const previousUrl = coverUrl
    setCoverUrl(null)
    
    const formData = new FormData()
    formData.append('fullName', fullName)
    formData.append('coverUrl', '')
    
    const result = await updateProfile(formData)
    
    if (result.error) {
      setCoverUrl(previousUrl)
      showToast('Failed to remove cover photo', 'error')
    } else {
      await refreshUser()
      showToast('Cover photo removed', 'success')
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    setIsUploading(true)
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error', uploadError)
      showToast('Failed to upload image', 'error')
      setIsUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    setAvatarUrl(data.publicUrl)
    setIsUploading(false)
    
    const formData = new FormData()
    formData.append('fullName', fullName)
    formData.append('avatarUrl', data.publicUrl)
    await updateProfile(formData)
    await refreshUser()
    showToast('Profile photo updated', 'success')
  }

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `cover-${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    setIsUploadingCover(true)
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error', uploadError)
      showToast('Failed to upload cover image', 'error')
      setIsUploadingCover(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    setCoverUrl(data.publicUrl)
    setIsUploadingCover(false)
    
    const formData = new FormData()
    formData.append('fullName', fullName)
    if (avatarUrl) formData.append('avatarUrl', avatarUrl)
    formData.append('coverUrl', data.publicUrl)
    await updateProfile(formData)
    await refreshUser()
    showToast('Cover photo updated', 'success')
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleCoverUpload(e.target.files[0])
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleFileUpload(e.target.files[0])
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      await handleFileUpload(file)
    }
  }, [user.id, fullName])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  // Auto-detect timezone on first load
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Gmail connection state
  const [isGmailConnected, setIsGmailConnected] = useState(false)
  const [isCheckingGmail, setIsCheckingGmail] = useState(true)
  const [isConnectingGmail, setIsConnectingGmail] = useState(false)
  const [isDisconnectingGmail, setIsDisconnectingGmail] = useState(false)

  // Spotify connection state
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false)
  const [isCheckingSpotify, setIsCheckingSpotify] = useState(true)
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false)
  const [isDisconnectingSpotify, setIsDisconnectingSpotify] = useState(false)

  // Check Gmail and Spotify connection status on mount
  useEffect(() => {
    const checkConnectionStatus = async () => {
      // Check Gmail
      try {
        const gmailResponse = await fetch(`/api/composio/status?userId=${user.id}&app=gmail`)
        const gmailData = await gmailResponse.json()
        setIsGmailConnected(gmailData.connected === true)
        
        if (!gmailData.connected && gmailData.requiresReauth) {
          console.log('[Gmail] Connection requires re-authentication:', gmailData.status)
        }
      } catch (error) {
        console.error('Failed to check Gmail status:', error)
      } finally {
        setIsCheckingGmail(false)
      }

      // Check Spotify
      try {
        const spotifyResponse = await fetch(`/api/composio/status?userId=${user.id}&app=spotify`)
        const spotifyData = await spotifyResponse.json()
        setIsSpotifyConnected(spotifyData.connected === true)
        
        if (!spotifyData.connected && spotifyData.requiresReauth) {
          console.log('[Spotify] Connection requires re-authentication:', spotifyData.status)
        }
      } catch (error) {
        console.error('Failed to check Spotify status:', error)
      } finally {
        setIsCheckingSpotify(false)
      }
    }
    checkConnectionStatus()
  }, [user.id])

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true)
    try {
      const response = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, app: 'gmail' }),
      })
      const data = await response.json()
      
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
        showToast('Complete the authorization in the new tab', 'info')
        
        // Poll for connection status
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/composio/status?userId=${user.id}&app=gmail`)
            const statusData = await statusResponse.json()
            if (statusData.connected) {
              setIsGmailConnected(true)
              clearInterval(pollInterval)
              showToast('Gmail connected successfully!', 'success')
              setIsConnectingGmail(false)
            }
          } catch {
            // Continue polling
          }
        }, 2000)
        
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          setIsConnectingGmail(false)
        }, 300000)
      } else {
        showToast('Failed to initiate Gmail connection', 'error')
        setIsConnectingGmail(false)
      }
    } catch (error) {
      console.error('Gmail connect error:', error)
      showToast('Failed to connect Gmail', 'error')
      setIsConnectingGmail(false)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail?')) return
    
    setIsDisconnectingGmail(true)
    try {
      const response = await fetch('/api/composio/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, app: 'gmail' }),
      })
      const data = await response.json()
      
      if (data.success) {
        setIsGmailConnected(false)
        showToast('Gmail disconnected', 'success')
      } else {
        showToast(data.error || 'Failed to disconnect Gmail', 'error')
      }
    } catch (error) {
      console.error('Gmail disconnect error:', error)
      showToast('Failed to disconnect Gmail', 'error')
    } finally {
      setIsDisconnectingGmail(false)
    }
  }

  const handleConnectSpotify = async () => {
    setIsConnectingSpotify(true)
    try {
      const response = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, app: 'spotify' }),
      })
      const data = await response.json()
      
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
        showToast('Complete the authorization in the new tab', 'info')
        
        // Poll for connection status
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/composio/status?userId=${user.id}&app=spotify`)
            const statusData = await statusResponse.json()
            if (statusData.connected) {
              setIsSpotifyConnected(true)
              clearInterval(pollInterval)
              showToast('Spotify connected successfully!', 'success')
              setIsConnectingSpotify(false)
            }
          } catch {
            // Continue polling
          }
        }, 2000)
        
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          setIsConnectingSpotify(false)
        }, 300000)
      } else {
        showToast('Failed to initiate Spotify connection', 'error')
        setIsConnectingSpotify(false)
      }
    } catch (error) {
      console.error('Spotify connect error:', error)
      showToast('Failed to connect Spotify', 'error')
      setIsConnectingSpotify(false)
    }
  }

  const handleDisconnectSpotify = async () => {
    if (!confirm('Are you sure you want to disconnect Spotify?')) return
    
    setIsDisconnectingSpotify(true)
    try {
      const response = await fetch('/api/composio/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, app: 'spotify' }),
      })
      const data = await response.json()
      
      if (data.success) {
        setIsSpotifyConnected(false)
        showToast('Spotify disconnected', 'success')
      } else {
        showToast(data.error || 'Failed to disconnect Spotify', 'error')
      }
    } catch (error) {
      console.error('Spotify disconnect error:', error)
      showToast('Failed to disconnect Spotify', 'error')
    } finally {
      setIsDisconnectingSpotify(false)
    }
  }
  
  const startEditingPreferences = () => {
    setEditingFullName(fullName)
    setEditingBirthday(birthday)
    setEditingLocation(location)
    setEditingTimezone(timezone || detectedTimezone)
    setIsEditingPreferences(true)
  }

  const cancelEditingPreferences = () => {
    setEditingFullName(fullName)
    setEditingBirthday(birthday)
    setEditingLocation(location)
    setEditingTimezone(timezone)
    setIsEditingPreferences(false)
  }

  const handleSavePreferences = async () => {
    if (!editingFullName.trim()) {
      showToast('Name cannot be empty', 'error')
      return
    }

    setIsSavingPreferences(true)
    const formData = new FormData()
    formData.append('fullName', editingFullName.trim())
    if (avatarUrl) formData.append('avatarUrl', avatarUrl)
    if (editingBirthday) formData.append('birthday', editingBirthday)
    if (editingLocation) formData.append('location', editingLocation.trim())
    if (editingTimezone) formData.append('timezone', editingTimezone)

    const result = await updateProfile(formData)
    
    if (result.error) {
      showToast('Failed to update preferences', 'error')
    } else {
      setFullName(editingFullName.trim())
      setBirthday(editingBirthday)
      setLocation(editingLocation.trim())
      setTimezone(editingTimezone)
      await refreshUser()
      showToast('Preferences updated', 'success')
    }
    
    setIsSavingPreferences(false)
    setIsEditingPreferences(false)
  }

  const displayName = fullName || user.email?.split('@')[0] || 'User'
  const displayTimezone = timezone || detectedTimezone
  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })

  return (
    <>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />

      <main className="space-y-6 pb-8">
        {/* Profile Header with Cover */}
        <section className="flex flex-col items-center text-center pb-6">
          {/* Cover Background */}
          <div className="relative w-full h-48 sm:h-64 rounded-[var(--radius-card)] overflow-hidden group/cover shadow-sm">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--color-surface-hover)] to-[var(--color-surface)]" />
            )}
            
            {/* Cover upload button */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover/cover:opacity-100 transition-all duration-[var(--transition-base)] translate-y-2 group-hover/cover:translate-y-0">
              <button 
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] bg-black/50 hover:bg-black/70 backdrop-blur-md text-white text-xs font-medium cursor-pointer transition-colors"
              >
                {isUploadingCover ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Edit cover
              </button>
              
              {coverUrl && !isUploadingCover && (
                <button
                  onClick={handleRemoveCover}
                  className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-full)] bg-black/50 hover:bg-black/70 backdrop-blur-md text-white transition-colors cursor-pointer"
                  title="Remove cover photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            
            <input 
              ref={coverInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleCoverChange}
              disabled={isUploadingCover}
            />
          </div>

          {/* Avatar - Overlapping Cover */}
          <div 
            className="relative -mt-16 mb-4 group/avatar w-fit mx-auto"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div 
              className={cn(
                "relative h-32 w-32 rounded-full overflow-hidden ring-[6px] ring-[var(--color-background)] shadow-xl transition-all duration-300",
                isDragging && "ring-[var(--color-primary)] scale-105"
              )}
            >
              {avatarUrl && !avatarError ? (
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-info)]" />
              )}
              
              {/* Upload overlay */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all duration-[var(--transition-base)] cursor-pointer group/upload"
              >
                <div className="opacity-0 group-hover/upload:opacity-100 transition-all duration-[var(--transition-base)] transform translate-y-2 group-hover/upload:translate-y-0">
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <Camera className="h-8 w-8 text-white" />
                  )}
                </div>
              </button>
            </div>
            
            {avatarUrl && !avatarError && !isUploading && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 p-2 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white transition-all opacity-0 group-hover/avatar:opacity-100 z-10 cursor-pointer shadow-lg"
                title="Remove profile photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Name & Title */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
              {displayName}
            </h1>
            <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Member since {memberSince}
            </p>
          </div>
        </section>

        {/* Unified Profile Details */}
        <section className="space-y-4">
          <Card variant="outline" padding="none" className="bg-[var(--color-card)]/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">Profile Settings</h2>
              {!isEditingPreferences && (
                <Button
                  onClick={startEditingPreferences}
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 -mr-2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  Edit
                </Button>
              )}
            </div>
            
            {isEditingPreferences ? (
              <div className="space-y-6 p-6">
                {/* Name Field (Editable) */}
                <div className="space-y-2">
                  <Label variant="muted" size="xs">
                    Name
                  </Label>
                  <Input
                    value={editingFullName}
                    onChange={(e) => setEditingFullName(e.target.value)}
                    placeholder="Your name"
                    variant="filled"
                    className="h-10"
                  />
                </div>
                
                {/* Birthday Field (Editable) */}
                <div className="space-y-2">
                  <Label variant="muted" size="xs">
                    Birthday
                  </Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={editingBirthday}
                      onChange={(e) => setEditingBirthday(e.target.value)}
                      variant="filled"
                      className="h-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                    />
                  </div>
                </div>
                
                {/* Location Field (Editable) */}
                <div className="space-y-2">
                  <Label variant="muted" size="xs">
                    Location
                  </Label>
                  <Input
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    placeholder="City, Country"
                    variant="filled"
                    className="h-10"
                  />
                </div>
                
                {/* Timezone Field (Editable) */}
                <div className="space-y-2">
                  <Label variant="muted" size="xs">
                    Timezone
                  </Label>
                  <div className="relative">
                    <select
                      value={editingTimezone}
                      onChange={(e) => setEditingTimezone(e.target.value)}
                      className="w-full h-10 px-3 pr-8 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-[var(--radius-input)] text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none appearance-none cursor-pointer transition-all"
                    >
                      <option value="">Select timezone</option>
                      <optgroup label="Detected">
                        <option value={detectedTimezone}>{detectedTimezone} (Auto-detected)</option>
                      </optgroup>
                      <optgroup label="Americas">
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                        <option value="America/Denver">America/Denver (MST/MDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="America/Anchorage">America/Anchorage (AKST/AKDT)</option>
                        <option value="Pacific/Honolulu">Pacific/Honolulu (HST)</option>
                        <option value="America/Toronto">America/Toronto (EST/EDT)</option>
                        <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
                        <option value="America/Mexico_City">America/Mexico_City (CST/CDT)</option>
                        <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                        <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                        <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                      </optgroup>
                      <optgroup label="Asia">
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                        <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                        <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                        <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                      </optgroup>
                      <optgroup label="Oceania">
                        <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                        <option value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</option>
                        <option value="Australia/Perth">Australia/Perth (AWST)</option>
                        <option value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</option>
                      </optgroup>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)] pointer-events-none" />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSavingPreferences}
                    className="flex-1"
                  >
                    {isSavingPreferences ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                  <Button
                    onClick={cancelEditingPreferences}
                    variant="ghost"
                    disabled={isSavingPreferences}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {/* Name Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">Name</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{displayName}</p>
                  </div>
                </div>

                {/* Email Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">Email</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{user.email}</p>
                  </div>
                </div>

                {/* Birthday Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <Cake className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">Birthday</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Location Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">Location</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {location || 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Timezone Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">Timezone</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {displayTimezone}
                    </p>
                  </div>
                </div>
                
                {/* Theme Row */}
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] shrink-0">
                    <Palette className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Theme</p>
                  </div>
                  <div className="scale-90 origin-right">
                    <ThemeSwitch />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Connected Apps Section */}
        <section className="space-y-4">
          <Card variant="outline" padding="none" className="bg-[var(--color-card)]/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">Connected Apps</h2>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {/* Gmail Connection Row */}
              <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                  <img 
                    src="/Gmail.svg" 
                    alt="Gmail" 
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Gmail</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {isCheckingGmail 
                      ? 'Checking status...' 
                      : 'Send emails on your behalf'}
                  </p>
                </div>
                {isCheckingGmail ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted-foreground)]" />
                ) : isGmailConnected ? (
                  <button
                    onClick={handleDisconnectGmail}
                    disabled={isDisconnectingGmail}
                    className="inline-flex items-center justify-center rounded-[var(--radius-full)] h-8 px-3 text-sm font-medium bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
                  >
                    {isDisconnectingGmail ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Connected'
                    )}
                  </button>
                ) : (
                  <Button
                    onClick={handleConnectGmail}
                    disabled={isConnectingGmail}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                  >
                    {isConnectingGmail ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Spotify Connection Row */}
              <div className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                  <img 
                    src="/Spotify.png" 
                    alt="Spotify" 
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Spotify</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {isCheckingSpotify 
                      ? 'Checking status...' 
                      : 'Control music playback'}
                  </p>
                </div>
                {isCheckingSpotify ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted-foreground)]" />
                ) : isSpotifyConnected ? (
                  <button
                    onClick={handleDisconnectSpotify}
                    disabled={isDisconnectingSpotify}
                    className="inline-flex items-center justify-center rounded-[var(--radius-full)] h-8 px-3 text-sm font-medium bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
                  >
                    {isDisconnectingSpotify ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Connected'
                    )}
                  </button>
                ) : (
                  <Button
                    onClick={handleConnectSpotify}
                    disabled={isConnectingSpotify}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                  >
                    {isConnectingSpotify ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* Sign Out Section */}
        <section className="pt-2">
          <button
            onClick={() => signOut()}
            className="group flex w-full items-center justify-between px-4 py-3 rounded-[var(--radius-card)] border border-transparent hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Sign out</span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </button>
        </section>
      </main>
    </>
  )
}
