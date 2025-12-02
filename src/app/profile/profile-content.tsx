'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast, ToastContainer } from '@/components/ui/toast'
import { updateProfile, initiateConnection, checkConnectionStatus, disconnectApp, getGitHubRepos, setFocusedRepo, getFocusedRepo, clearFocusedRepo, ConnectionInfo, GitHubRepo, FocusedRepo } from './actions'
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
  Palette,
  Link as LinkIcon,
  Github,
  Unlink,
  Star,
  Lock,
  GitBranch,
  ExternalLink,
  RefreshCw,
  Search,
  Target,
  Sparkles,
  Bot
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
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null)
  const [connectionInfo, setConnectionInfo] = useState<Record<string, ConnectionInfo>>({})
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [repoSearchTerm, setRepoSearchTerm] = useState('')
  const [focusedRepo, setFocusedRepoState] = useState<FocusedRepo | null>(null)
  const [isSettingFocus, setIsSettingFocus] = useState<string | null>(null)
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

  // Fetch GitHub repos
  const fetchGitHubRepos = useCallback(async () => {
    setIsLoadingRepos(true)
    const result = await getGitHubRepos()
    if (result.repos) {
      setGithubRepos(result.repos)
    } else if (result.error) {
      console.error('Failed to fetch repos:', result.error)
    }
    setIsLoadingRepos(false)
  }, [])

  // Check connection status on load
  useEffect(() => {
    checkConnectionStatus('github').then(result => {
      setConnectionInfo(prev => ({ ...prev, github: result }))
      // If connected, fetch repos and focused repo
      if (result.connected) {
        fetchGitHubRepos()
        getFocusedRepo().then(({ repo }) => {
          if (repo) setFocusedRepoState(repo)
        })
      }
    })
  }, [fetchGitHubRepos])

  // Re-check connection status when window regains focus (e.g. after returning from auth popup)
  useEffect(() => {
    const handleFocus = () => {
      if (connectionInfo.github?.connected) return

      checkConnectionStatus('github').then(result => {
        if (result.connected) {
          setConnectionInfo(prev => ({ ...prev, github: result }))
          fetchGitHubRepos()
          showToast('GitHub connected successfully', 'success')
        }
      })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [connectionInfo.github?.connected, fetchGitHubRepos, showToast])

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

  const handleConnect = async (appName: string) => {
    setIsConnecting(appName)
    
    // Open window immediately to avoid popup blockers
    const authWindow = window.open('', '_blank')
    if (authWindow) {
      authWindow.document.write('<html><body style="background:#1a1a1a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;"><h3>Initiating connection...</h3></body></html>')
    }

    const result = await initiateConnection(appName)
    setIsConnecting(null)
    
    if (result.error) {
      showToast(result.error, 'error')
      authWindow?.close()
    } else if (result.url) {
      if (authWindow) {
        authWindow.location.href = result.url
      } else {
        window.location.href = result.url
      }
    }
  }

  const handleDisconnect = async (appName: string) => {
    setIsDisconnecting(appName)
    const result = await disconnectApp(appName)
    setIsDisconnecting(null)
    
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      setConnectionInfo(prev => ({ 
        ...prev, 
        [appName]: { connected: false } 
      }))
      showToast(`${appName.charAt(0).toUpperCase() + appName.slice(1)} disconnected`, 'success')
      setGithubRepos([])
      setFocusedRepoState(null)
    }
  }

  const handleSetFocusedRepo = async (repo: GitHubRepo) => {
    // If already focused, unfocus it
    if (focusedRepo?.fullName === repo.full_name) {
      setIsSettingFocus(repo.full_name)
      const result = await clearFocusedRepo()
      setIsSettingFocus(null)
      
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setFocusedRepoState(null)
        showToast('Repository unfocused', 'success')
      }
      return
    }

    setIsSettingFocus(repo.full_name)
    
    const focusedRepoData: FocusedRepo = {
      owner: repo.full_name.split('/')[0],
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      private: repo.private,
      language: repo.language,
      defaultBranch: 'main', // We'll use main as default, the actual default branch would need another API call
    }
    
    const result = await setFocusedRepo(focusedRepoData)
    setIsSettingFocus(null)
    
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      setFocusedRepoState(focusedRepoData)
      showToast(`Focused on ${repo.name}. The AI agent now has full context of this repo.`, 'success')
    }
  }

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
  }

  const displayName = fullName || user.email?.split('@')[0] || 'User'
  const displayTimezone = timezone || detectedTimezone
  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })

  const githubInfo = connectionInfo.github
  
  const filteredRepos = githubRepos.filter(repo => 
    repo.name.toLowerCase().includes(repoSearchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(repoSearchTerm.toLowerCase())
  )

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
          
          <Card variant="default" padding="none" className="divide-y divide-[var(--color-border)]/60 overflow-hidden">
            {/* ... existing settings content ... */}
            {isEditingPreferences ? (
              <div className="p-4 space-y-4">
                {/* Name Field (Editable) */}
                <div className="space-y-1.5">
                  <Label variant="muted" size="xs" className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5" />
                    Name
                  </Label>
                  <Input
                    value={editingFullName}
                    onChange={(e) => setEditingFullName(e.target.value)}
                    placeholder="Your name"
                    variant="filled"
                  />
                </div>
                
                {/* Birthday Field (Editable) */}
                <div className="space-y-1.5">
                  <Label variant="muted" size="xs" className="flex items-center gap-2">
                    <Cake className="h-3.5 w-3.5" />
                    Birthday
                  </Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={editingBirthday}
                      onChange={(e) => setEditingBirthday(e.target.value)}
                      variant="filled"
                      className="[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                    />
                  </div>
                </div>
                
                {/* Location Field (Editable) */}
                <div className="space-y-1.5">
                  <Label variant="muted" size="xs" className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </Label>
                  <Input
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    placeholder="City, Country"
                    variant="filled"
                  />
                </div>
                
                {/* Timezone Field (Editable) */}
                <div className="space-y-1.5">
                  <Label variant="muted" size="xs" className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Timezone
                  </Label>
                  <div className="relative">
                    <select
                      value={editingTimezone}
                      onChange={(e) => setEditingTimezone(e.target.value)}
                      className="w-full h-11 px-4 pr-10 bg-[var(--color-surface-hover)] border-none rounded-[var(--radius-full)] text-sm text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:outline-none appearance-none cursor-pointer transition-all"
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
                <div className="flex gap-2 pt-2">
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
                    variant="secondary"
                    size="icon-lg"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]/60">
                {/* Name Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Name</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{displayName}</p>
                  </div>
                </div>

                {/* Email Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <Mail className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Email</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{user.email}</p>
                  </div>
                </div>

                {/* Member Since Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Member since</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{memberSince}</p>
                  </div>
                </div>
                
                {/* Birthday Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <Cake className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Birthday</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Location Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Location</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {location || 'Not set'}
                    </p>
                  </div>
                </div>
                
                {/* Timezone Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <Globe className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Timezone</p>
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                      {displayTimezone}
                    </p>
                  </div>
                </div>
                
                {/* Theme Row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <Palette className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Theme</p>
                  </div>
                  <ThemeSwitch />
                </div>

                {/* Sign Out Row */}
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-4 px-4 py-3.5 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] transition-all cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <LogOut className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Sign out</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </button>
              </div>
            )}
          </Card>
        </section>

        {/* Connected Apps */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">Integrations</h2>
          </div>
          
          <Card variant="default" padding="none" className="divide-y divide-[var(--color-border)]/60 overflow-hidden">
            {/* GitHub Connection */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                  githubInfo?.connected ? "bg-[#333] text-white" : "bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)]"
                )}>
                  <Github className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">GitHub</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {githubInfo?.connected 
                      ? githubInfo.accountName 
                        ? `Connected as @${githubInfo.accountName}`
                        : 'Connected to your account'
                      : 'Connect your repositories'}
                  </p>
                </div>
              </div>
              {githubInfo?.connected ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                    <Check className="h-3 w-3" />
                    Active
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDisconnect('github')}
                    disabled={!!isDisconnecting}
                    className="text-[var(--color-muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
                    title="Disconnect GitHub"
                  >
                    {isDisconnecting === 'github' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleConnect('github')}
                  disabled={!!isConnecting}
                  className="min-w-[90px]"
                >
                  {isConnecting === 'github' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>

          {/* GitHub Repositories */}
          {githubInfo?.connected && (
            <div className="mt-4 space-y-3">
              {/* Focused Repository Banner */}
              {focusedRepo && (
                <Card variant="default" padding="none" className="overflow-hidden bg-gradient-to-r from-[var(--color-accent)]/5 via-transparent to-purple-500/5 border-[var(--color-accent)]/20">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-purple-500 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        <p className="text-xs font-medium text-[var(--color-accent)]">AI Agent Focus</p>
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                        {focusedRepo.fullName}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">
                        Full repo context available • Can create issues, PRs & more
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const repo = githubRepos.find(r => r.full_name === focusedRepo.fullName)
                        if (repo) handleSetFocusedRepo(repo)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Unfocus
                    </button>
                  </div>
                </Card>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                    Repositories {filteredRepos.length > 0 && `(${filteredRepos.length})`}
                  </p>
                  <button
                    onClick={fetchGitHubRepos}
                    disabled={isLoadingRepos}
                    className="flex items-center justify-center h-5 w-5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] transition-colors"
                    title="Refresh repositories"
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingRepos && "animate-spin")} />
                  </button>
                </div>
                
                {/* Search Input */}
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                  <input
                    type="text"
                    placeholder="Search repos..."
                    value={repoSearchTerm}
                    onChange={(e) => setRepoSearchTerm(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-[var(--color-muted-foreground)]/70"
                  />
                </div>
              </div>
              
              <Card variant="default" padding="none" className="overflow-hidden">
                {isLoadingRepos ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--color-muted-foreground)] mb-2" />
                    <p className="text-xs text-[var(--color-muted-foreground)]">Loading repositories...</p>
                  </div>
                ) : filteredRepos.length > 0 ? (
                  <div className="divide-y divide-[var(--color-border)]/60 max-h-[400px] overflow-y-auto scrollbar-thin">
                    {filteredRepos.map((repo) => {
                      const isFocused = focusedRepo?.fullName === repo.full_name
                      const isSettingThisFocus = isSettingFocus === repo.full_name
                      
                      return (
                        <div
                          key={repo.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 transition-colors group",
                            isFocused ? "bg-[var(--color-accent)]/5" : "hover:bg-[var(--color-surface-hover)]"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-[var(--radius-md)] border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            isFocused 
                              ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                              : "bg-[var(--color-surface-hover)] border-[var(--color-border)]/50 text-[var(--color-muted-foreground)] group-hover:border-[var(--color-accent)]/30 group-hover:text-[var(--color-accent)]"
                          )}>
                            {isFocused ? (
                              <Target className="h-4 w-4" />
                            ) : (
                              <GitBranch className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={cn(
                                  "text-sm font-medium truncate transition-colors",
                                  isFocused 
                                    ? "text-[var(--color-accent)]" 
                                    : "text-[var(--color-foreground)] group-hover:text-[var(--color-accent)]"
                                )}>
                                  {repo.name}
                                </p>
                                {isFocused && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[10px] font-medium shrink-0">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    Focused
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-[var(--color-muted-foreground)]">
                                  {timeAgo(repo.updated_at)}
                                </span>
                                {repo.private && (
                                  <Lock className="h-3 w-3 text-[var(--color-muted-foreground)]" />
                                )}
                              </div>
                            </div>
                            
                            {repo.description && (
                              <p className="text-xs text-[var(--color-muted-foreground)] line-clamp-1 mt-0.5">
                                {repo.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-3 mt-1.5">
                              {repo.language && (
                                <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted-foreground)] font-medium">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                                  {repo.language}
                                </span>
                              )}
                              {repo.stargazers_count > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
                                  <Star className="h-3 w-3" />
                                  {repo.stargazers_count}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleSetFocusedRepo(repo)}
                              disabled={!!isSettingFocus}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-all",
                                isFocused
                                  ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                                  : "bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-active)] opacity-0 group-hover:opacity-100"
                              )}
                              title={isFocused ? "Unfocus repository" : "Focus for AI Agent"}
                            >
                              {isSettingThisFocus ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isFocused ? (
                                <>
                                  <Target className="h-3 w-3" />
                                  Focused
                                </>
                              ) : (
                                <>
                                  <Target className="h-3 w-3" />
                                  Focus
                                </>
                              )}
                            </button>
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-md)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all"
                              title="Open in GitHub"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    {repoSearchTerm ? (
                      <>
                        <Search className="h-8 w-8 text-[var(--color-muted-foreground)] mb-2 opacity-20" />
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          No repositories found matching &quot;{repoSearchTerm}&quot;
                        </p>
                      </>
                    ) : (
                      <>
                        <GitBranch className="h-8 w-8 text-[var(--color-muted-foreground)] mb-2 opacity-20" />
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          No repositories found
                        </p>
                      </>
                    )}
                  </div>
                )}
              </Card>
              
              {/* Help text */}
              {!focusedRepo && githubRepos.length > 0 && (
                <p className="text-[10px] text-[var(--color-muted-foreground)] text-center px-4">
                  💡 <strong>Tip:</strong> Focus a repository to give the AI agent full context. 
                  It can then browse code, create issues, review PRs, and take actions on your behalf.
                </p>
              )}
            </div>
          )}
        </section>

      </main>
    </>
  )
}
