'use client'

import { useState, useRef, useCallback } from 'react'
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
  Calendar,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  Cake,
  MapPin,
  Globe,
  Settings,
  Palette
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
  const { signOut } = useAuth()
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || null)
  const [coverUrl, setCoverUrl] = useState(user.user_metadata?.cover_url || null)
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
        <section className="flex flex-col items-center text-center">
          {/* Cover Background */}
          <div className="relative w-full h-36 sm:h-44 rounded-[var(--radius-card)] overflow-hidden group/cover">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--color-accent)] dark:from-[var(--color-gradient-dark-start)] via-[var(--color-gradient-mid-1)] via-[45%] to-[var(--color-gradient-mid-2)]">
                {/* Decorative elements */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(127,145,224,0.25)_0%,transparent_45%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_75%,rgba(210,165,200,0.2)_0%,transparent_45%)]" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent" />
              </div>
            )}
            
            {/* Cover upload button */}
            <button 
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover}
              className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-full)] bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white text-xs font-medium opacity-0 group-hover/cover:opacity-100 transition-all duration-[var(--transition-base)] cursor-pointer"
            >
              {isUploadingCover ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Edit cover
            </button>
            
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
            className="relative -mt-14 mb-3"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div 
              className={cn(
                "relative h-28 w-28 rounded-full overflow-hidden ring-4 ring-[var(--color-background)] transition-all duration-300",
                isDragging && "ring-[var(--color-accent)] scale-105"
              )}
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-info)] flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* Upload overlay */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all duration-[var(--transition-base)] cursor-pointer group/upload"
              >
                <div className="opacity-0 group-hover/upload:opacity-100 transition-opacity duration-[var(--transition-base)]">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
            </div>
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Name */}
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {displayName}
          </h1>
        </section>

        {/* Unified Profile Details */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">Settings</h2>
            {!isEditingPreferences && (
              <button
                onClick={startEditingPreferences}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:bg-[var(--color-accent)]/10 active:bg-[var(--color-accent)]/20 transition-all cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
          
          <Card variant="ghost" padding="none" className="bg-transparent overflow-hidden border-none">
            {isEditingPreferences ? (
              <div className="space-y-8 px-1">
                {/* Name Field (Editable) */}
                <div className="space-y-5">
                  <Label variant="muted" size="xs">
                    Name
                  </Label>
                  <Input
                    value={editingFullName}
                    onChange={(e) => setEditingFullName(e.target.value)}
                    placeholder="Your name"
                    variant="filled"
                    className="h-12 text-base px-4"
                  />
                </div>
                
                {/* Birthday Field (Editable) */}
                <div className="space-y-5">
                  <Label variant="muted" size="xs">
                    Birthday
                  </Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={editingBirthday}
                      onChange={(e) => setEditingBirthday(e.target.value)}
                      variant="filled"
                      className="h-12 text-base px-4 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                    />
                  </div>
                </div>
                
                {/* Location Field (Editable) */}
                <div className="space-y-5">
                  <Label variant="muted" size="xs">
                    Location
                  </Label>
                  <Input
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    placeholder="City, Country"
                    variant="filled"
                    className="h-12 text-base px-4"
                  />
                </div>
                
                {/* Timezone Field (Editable) */}
                <div className="space-y-5">
                  <Label variant="muted" size="xs">
                    Timezone
                  </Label>
                  <div className="relative">
                    <select
                      value={editingTimezone}
                      onChange={(e) => setEditingTimezone(e.target.value)}
                      className="w-full h-12 px-4 pr-10 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-[var(--radius-input)] text-base text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:outline-none appearance-none cursor-pointer transition-all"
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
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)] pointer-events-none" />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSavingPreferences}
                    size="lg"
                    className="flex-1"
                  >
                    {isSavingPreferences ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    onClick={cancelEditingPreferences}
                    variant="ghost"
                    size="icon-lg"
                    title="Cancel"
                    className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Name Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <UserIcon className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Name</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{displayName}</p>
                  </div>
                </div>

                {/* Email Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <Mail className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Email</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{user.email}</p>
                  </div>
                </div>

                {/* Member Since Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <Calendar className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Member since</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{memberSince}</p>
                  </div>
                </div>
                
                {/* Birthday Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <Cake className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Birthday</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Location Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <MapPin className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Location</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {location || 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Timezone Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <Globe className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Timezone</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {displayTimezone}
                    </p>
                  </div>
                </div>
                
                {/* Theme Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <Palette className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Theme</p>
                  </div>
                  <ThemeSwitch />
                </div>

                {/* Sign Out Row */}
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-4 px-4 py-3 hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-lg)] transition-all cursor-pointer"
                >
                  <LogOut className="h-5 w-5 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Sign out</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </button>
              </div>
            )}
          </Card>
        </section>
      </main>
    </>
  )
}
