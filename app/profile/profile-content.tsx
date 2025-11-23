'use client'

import { useState, useRef } from 'react'
import { motion } from 'motion/react'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { updateProfile } from './actions'
import { LogOut, Edit2, Upload, Loader2, Check, X } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { createClient } from '@/lib/supabase/client'
import { Footer } from '@/app/footer'
import { useAuth } from '@/components/auth-provider'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export function ProfileContent({
  user,
}: {
  user: User
}) {
  const { signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
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
      alert('Error uploading image')
      setIsUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    setAvatarUrl(data.publicUrl)
    setIsUploading(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const formData = new FormData()
    formData.append('fullName', fullName)
    if (avatarUrl) formData.append('avatarUrl', avatarUrl)

    await updateProfile(formData)
    setIsSaving(false)
    setIsEditing(false)
  }

  return (
    <motion.main
      className="space-y-12"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="flex flex-col items-center space-y-4 text-center sm:items-start sm:text-left"
      >
        <div className="flex items-center gap-6 w-full">
          <div className="relative group">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-100 text-3xl font-semibold text-zinc-500 overflow-hidden dark:bg-zinc-800 dark:text-zinc-400 ring-2 ring-white dark:ring-zinc-950 shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user.email?.charAt(0).toUpperCase()
              )}
            </div>
            
            {isEditing && (
              <>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Upload className="h-6 w-6 text-white" />
                  )}
                </label>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </>
            )}
          </div>

          <div className="space-y-1 flex-1">
            {isEditing ? (
               <div className="flex flex-col gap-2 max-w-xs">
                 <Input 
                   value={fullName} 
                   onChange={(e) => setFullName(e.target.value)}
                   placeholder="Full Name"
                   className="h-auto w-full rounded-xl px-3 py-3 bg-zinc-100 dark:bg-zinc-900/80 border-none shadow-none text-zinc-700 dark:text-zinc-300 font-medium text-base md:text-base"
                 />
                <div className="flex gap-2 w-full mt-2">
                  <AnimatedBackground
                    enableHover
                    className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
                    transition={{
                      type: 'spring',
                      bounce: 0,
                      duration: 0.2,
                    }}
                  >
                    <button
                      className="flex-1 w-full rounded-xl px-3 py-3 text-left group cursor-pointer"
                      data-id="save"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-500 dark:text-zinc-400" />
                          ) : (
                            <Check className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          )}
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                            Save
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      className="flex-1 w-full rounded-xl px-3 py-3 text-left group cursor-pointer"
                      data-id="cancel"
                      onClick={() => setIsEditing(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                            Cancel
                          </span>
                        </div>
                      </div>
                    </button>
                  </AnimatedBackground>
                </div>
               </div>
            ) : (
              <div className="flex flex-col sm:items-start items-center">
                <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  {user.user_metadata?.full_name || user.email}
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {user.email}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Member since {new Date(user.created_at).toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="space-y-4"
      >
        <h3 className="text-lg font-medium">Account Settings</h3>
        <div className="flex flex-col space-y-0">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
             <button 
                className="-mx-3 w-full rounded-xl px-3 py-3 text-left group cursor-pointer" 
                data-id="sign-out"
                onClick={() => signOut()}
             >
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LogOut className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-red-500 dark:group-hover:text-red-400" />
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium group-hover:text-red-600 dark:group-hover:text-red-400">Sign Out</span>
                  </div>
               </div>
            </button>
          </AnimatedBackground>
        </div>
      </motion.section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
           <div className="bg-white dark:bg-zinc-950">
             <Footer className="mt-0" />
           </div>
        </div>
      </div>
    </motion.main>
  )
}
