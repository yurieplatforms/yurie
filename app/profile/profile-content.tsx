'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
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
  Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Footer } from '@/components/layout/footer'
import { useAuth } from '@/components/providers/auth-provider'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94],
}

type Toast = {
  id: string
  message: string
  type: 'success' | 'error'
}

export function ProfileContent({
  user,
}: {
  user: User
}) {
  const { signOut } = useAuth()
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border ${
                toast.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
              }`}>
                {toast.type === 'success' ? (
                  <Check className="h-3 w-3 text-white" />
                ) : (
                  <X className="h-3 w-3 text-white" />
                )}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.main
        className="space-y-6 pb-32"
        variants={VARIANTS_CONTAINER}
        initial="hidden"
        animate="visible"
      >
        {/* Profile Header */}
        <motion.section
          variants={VARIANTS_SECTION}
          transition={TRANSITION_SECTION}
          className="flex flex-col items-center text-center pt-4"
        >
          {/* Avatar */}
          <div 
            className="relative mb-5"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <motion.div 
              className={`relative h-28 w-28 rounded-full overflow-hidden ring-[3px] ring-zinc-200 dark:ring-zinc-800 transition-all duration-300 ${
                isDragging ? 'ring-[var(--color-accent)] scale-105' : ''
              }`}
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[var(--color-accent)] to-purple-600 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* Upload overlay */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all duration-200 cursor-pointer group/upload"
              >
                <div className="opacity-0 group-hover/upload:opacity-100 transition-opacity duration-200">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
            </motion.div>
            
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {displayName}
          </h1>

          {/* Email */}
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {user.email}
          </p>
        </motion.section>

        {/* Info Cards */}
        <motion.section
          variants={VARIANTS_SECTION}
          transition={TRANSITION_SECTION}
          className="space-y-2"
        >
          <div className="rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overflow-hidden">
            {/* Email Row */}
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                <Mail className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-500">Email</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{user.email}</p>
              </div>
            </div>

            {/* Member Since Row */}
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-500">Member since</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{memberSince}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* User Preferences */}
        <motion.section
          variants={VARIANTS_SECTION}
          transition={TRANSITION_SECTION}
          className="space-y-3"
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Preferences</h2>
            {!isEditingPreferences && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startEditingPreferences}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Edit
              </motion.button>
            )}
          </div>
          
          <div className="rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overflow-hidden">
            <AnimatePresence mode="wait">
              {isEditingPreferences ? (
                <motion.div
                  key="editing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 space-y-4"
                >
                  {/* Name Field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <UserIcon className="h-3.5 w-3.5" />
                      Name
                    </label>
                    <Input
                      value={editingFullName}
                      onChange={(e) => setEditingFullName(e.target.value)}
                      placeholder="Your name"
                      className="h-11 bg-zinc-200/60 dark:bg-zinc-800/60 border-none rounded-xl focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  
                  {/* Birthday Field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Cake className="h-3.5 w-3.5" />
                      Birthday
                    </label>
                    <div className="relative">
                      <Input
                        type="date"
                        value={editingBirthday}
                        onChange={(e) => setEditingBirthday(e.target.value)}
                        className="h-11 bg-zinc-200/60 dark:bg-zinc-800/60 border-none rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                      />
                    </div>
                  </div>
                  
                  {/* Location Field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </label>
                    <Input
                      value={editingLocation}
                      onChange={(e) => setEditingLocation(e.target.value)}
                      placeholder="City, Country"
                      className="h-11 bg-zinc-200/60 dark:bg-zinc-800/60 border-none rounded-xl focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  
                  {/* Timezone Field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Globe className="h-3.5 w-3.5" />
                      Timezone
                    </label>
                    <div className="relative">
                      <select
                        value={editingTimezone}
                        onChange={(e) => setEditingTimezone(e.target.value)}
                        className="w-full h-11 px-3 pr-10 bg-zinc-200/60 dark:bg-zinc-800/60 border-none rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none appearance-none cursor-pointer"
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
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSavePreferences}
                      disabled={isSavingPreferences}
                      className="flex-1 h-11 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSavingPreferences ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={cancelEditingPreferences}
                      className="flex-1 h-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="display"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60"
                >
                  {/* Name Row */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Name</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
                    </div>
                  </div>
                  
                  {/* Birthday Row */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                      <Cake className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Birthday</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Location Row */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Location</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {location || 'Not set'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Timezone Row */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-9 w-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Timezone</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {displayTimezone}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Sign Out */}
        <motion.section
          variants={VARIANTS_SECTION}
          transition={TRANSITION_SECTION}
        >
          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-3.5 text-left group transition-colors"
            onClick={() => signOut()}
          >
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Sign out</p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-red-500 transition-colors" />
            </div>
          </motion.button>
        </motion.section>

        {/* Footer */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
          <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
            <div className="bg-white dark:bg-black pt-2">
              <Footer className="mt-0 border-t-0" />
            </div>
          </div>
        </div>
      </motion.main>
    </>
  )
}
