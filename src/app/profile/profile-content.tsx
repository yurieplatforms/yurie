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
  Bot,
  Code,
  Book,
  FileCode,
  Music
} from 'lucide-react'
import { createClient } from '@/services/supabase/client'
import { ThemeSwitch } from '@/components/layout/footer'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/utils'
import { motion, AnimatePresence } from 'motion/react'

// Spotify Icon Component
const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
)

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
    
    // Check Spotify connection status
    checkConnectionStatus('spotify').then(result => {
      setConnectionInfo(prev => ({ ...prev, spotify: result }))
    })
  }, [fetchGitHubRepos])

  // Re-check connection status when window regains focus (e.g. after returning from auth popup)
  useEffect(() => {
    const handleFocus = () => {
      // Check GitHub if not connected
      if (!connectionInfo.github?.connected) {
        checkConnectionStatus('github').then(result => {
          if (result.connected) {
            setConnectionInfo(prev => ({ ...prev, github: result }))
            fetchGitHubRepos()
            showToast('GitHub connected successfully', 'success')
          }
        })
      }
      
      // Check Spotify if not connected
      if (!connectionInfo.spotify?.connected) {
        checkConnectionStatus('spotify').then(result => {
          if (result.connected) {
            setConnectionInfo(prev => ({ ...prev, spotify: result }))
            showToast('Spotify connected successfully', 'success')
          }
        })
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [connectionInfo.github?.connected, connectionInfo.spotify?.connected, fetchGitHubRepos, showToast])

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
    } else if (result.alreadyConnected) {
      // Already connected - refresh status and close window
      authWindow?.close()
      const status = await checkConnectionStatus(appName)
      setConnectionInfo(prev => ({ ...prev, [appName]: status }))
      showToast(`${appName.charAt(0).toUpperCase() + appName.slice(1)} is already connected!`, 'success')
      if (appName === 'github' && status.connected) {
        fetchGitHubRepos()
      }
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
  const spotifyInfo = connectionInfo.spotify
  
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
                      : 'Connect your repositories to enable AI features'}
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
                  variant="default" 
                  size="sm"
                  onClick={() => handleConnect('github')}
                  disabled={!!isConnecting}
                  className="min-w-[90px] bg-[#24292f] hover:bg-[#24292f]/90 text-white shadow-md"
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

            {/* Spotify Connection */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                  spotifyInfo?.connected ? "bg-[#1DB954] text-white" : "bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)]"
                )}>
                  <SpotifyIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">Spotify</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {spotifyInfo?.connected 
                      ? spotifyInfo.accountName 
                        ? `Connected as ${spotifyInfo.accountName}`
                        : 'Connected to your account'
                      : 'Control playback and discover music with AI'}
                  </p>
                </div>
              </div>
              {spotifyInfo?.connected ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                    <Check className="h-3 w-3" />
                    Active
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDisconnect('spotify')}
                    disabled={!!isDisconnecting}
                    className="text-[var(--color-muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
                    title="Disconnect Spotify"
                  >
                    {isDisconnecting === 'spotify' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default" 
                    size="sm"
                    onClick={() => handleConnect('spotify')}
                    disabled={!!isConnecting}
                    className="min-w-[90px] bg-[#1DB954] hover:bg-[#1DB954]/90 text-white shadow-md"
                  >
                    {isConnecting === 'spotify' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* GitHub Repositories */}
          {githubInfo?.connected && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">
                    Repositories {filteredRepos.length > 0 && `(${filteredRepos.length})`}
                  </h2>
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
                <div className="relative w-40 sm:w-48">
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

              <AnimatePresence mode="popLayout">
                {/* Focused Repository Banner */}
                {focusedRepo && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card variant="accent" padding="sm" className="overflow-hidden relative border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent opacity-50" />
                      <div className="relative flex items-center gap-4">
                        <div className="h-9 w-9 rounded-full bg-[#333] flex items-center justify-center shrink-0 text-white">
                          <GitBranch className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                              {focusedRepo.fullName}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            AI agent has full context of this repo
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const repo = githubRepos.find(r => r.full_name === focusedRepo.fullName)
                            if (repo) handleSetFocusedRepo(repo)
                          }}
                          className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]/10"
                        >
                          Unfocus
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <Card variant="default" padding="none" className="overflow-hidden min-h-[100px]">
                {isLoadingRepos ? (
                   <div className="divide-y divide-[var(--color-border)]/60">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/3 bg-[var(--color-surface-hover)] rounded animate-pulse" />
                          <div className="h-3 w-2/3 bg-[var(--color-surface-hover)] rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredRepos.length > 0 ? (
                  <div className="divide-y divide-[var(--color-border)]/60 max-h-[400px] overflow-y-auto scrollbar-thin">
                    <AnimatePresence mode="popLayout" initial={false}>
                    {filteredRepos.map((repo) => {
                      const isFocused = focusedRepo?.fullName === repo.full_name
                      const isSettingThisFocus = isSettingFocus === repo.full_name
                      
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          key={repo.id}
                          className={cn(
                            "flex items-center gap-4 px-4 py-3.5 transition-colors group cursor-pointer relative",
                            isFocused ? "bg-[var(--color-accent)]/5" : "hover:bg-[var(--color-surface-hover)]"
                          )}
                          onClick={() => !isSettingFocus && handleSetFocusedRepo(repo)}
                        >
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <p className={cn(
                                  "text-sm font-medium truncate transition-colors",
                                  isFocused 
                                    ? "text-[var(--color-accent)]" 
                                    : "text-[var(--color-foreground)]"
                                )}>
                                  {repo.full_name}
                                </p>
                                {isSettingThisFocus && <Loader2 className="h-3 w-3 animate-spin text-[var(--color-muted-foreground)]" />}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-2 shrink-0 opacity-70">
                                {repo.language && (
                                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                                    {repo.language}
                                  </span>
                                )}
                                {repo.private && (
                                  <Lock className="h-3 w-3 text-[var(--color-muted-foreground)]" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Time & Action Button */}
                          <div className="flex items-center pl-2 min-w-[60px] justify-end h-7">
                             <span className="text-[10px] text-[var(--color-muted-foreground)] shrink-0 tabular-nums group-hover:hidden">
                                {timeAgo(repo.updated_at)}
                             </span>
                             <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hidden group-hover:flex h-7 w-7 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(repo.html_url, '_blank');
                                }}
                                title="Open in GitHub"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                             </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                    </AnimatePresence>
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
