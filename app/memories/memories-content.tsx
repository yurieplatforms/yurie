'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  FileText, 
  Trash2, 
  Plus, 
  Loader2,
  Search,
  ArrowLeft,
  Check,
  X,
  Brain,
  HardDrive,
  Clock,
  ArrowUpDown,
  Sparkles,
  AlertTriangle
} from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { 
  type MemoryFile, 
  updateMemory, 
  createMemory, 
  deleteMemory 
} from './actions'

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

type Toast = {
  id: string
  message: string
  type: 'success' | 'error'
}

type SortOption = 'updated' | 'name' | 'size'

type DeleteConfirmation = {
  path: string
  name: string
} | null

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

function getFilename(path: string): string {
  return path.split('/').pop() || path
}

function getPreview(content: string, maxLength: number = 120): string {
  if (!content) return 'Empty memory'
  const preview = content.replace(/\n/g, ' ').trim()
  if (preview.length <= maxLength) return preview
  return preview.substring(0, maxLength).trim() + '...'
}

// Custom confirmation dialog component
function DeleteConfirmDialog({ 
  isOpen, 
  memoryName, 
  onConfirm, 
  onCancel,
  isDeleting 
}: { 
  isOpen: boolean
  memoryName: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Delete memory?
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Are you sure you want to delete <span className="font-medium text-zinc-700 dark:text-zinc-300">"{memoryName}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function MemoriesContent({ 
  initialMemories 
}: { 
  initialMemories: MemoryFile[] 
}) {
  const [memories, setMemories] = useState<MemoryFile[]>(initialMemories)
  const [selectedMemory, setSelectedMemory] = useState<MemoryFile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileContent, setNewFileContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Track client-side mounting to avoid hydration mismatches with Date calculations
  useEffect(() => {
    setMounted(true)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel editing or creating
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
        } else if (isCreating) {
          setIsCreating(false)
          setNewFileName('')
          setNewFileContent('')
        } else if (selectedMemory) {
          setSelectedMemory(null)
        }
      }
      
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !selectedMemory && !isCreating) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      
      // Cmd/Ctrl + N to create new memory
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !selectedMemory && !isCreating) {
        e.preventDefault()
        handleStartCreate()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, isCreating, selectedMemory])

  // Toast notification helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Calculate stats - only calculate dynamic "recently updated" on client to avoid hydration mismatch
  const stats = useMemo(() => {
    const totalSize = memories.reduce((acc, m) => acc + (m.size_bytes || 0), 0)
    // Only calculate time-based stats on client side
    const recentlyUpdated = mounted ? memories.filter(m => {
      const diff = Date.now() - new Date(m.updated_at).getTime()
      return diff < 24 * 60 * 60 * 1000 // Last 24 hours
    }).length : 0
    return {
      count: memories.length,
      totalSize,
      recentlyUpdated
    }
  }, [memories, mounted])

  // Filter and sort memories
  const filteredMemories = useMemo(() => {
    let filtered = memories
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = memories.filter(m => 
        getFilename(m.path).toLowerCase().includes(query) ||
        m.content.toLowerCase().includes(query)
      )
    }
    
    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return getFilename(a.path).localeCompare(getFilename(b.path))
        case 'size':
          return (b.size_bytes || 0) - (a.size_bytes || 0)
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })
  }, [memories, searchQuery, sortBy])

  const handleSelectMemory = (memory: MemoryFile) => {
    setSelectedMemory(memory)
    setEditContent(memory.content)
    setIsEditing(false)
    setIsCreating(false)
  }

  const handleBack = () => {
    setSelectedMemory(null)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    if (selectedMemory) {
      setEditContent(selectedMemory.content)
      setIsEditing(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedMemory) return
    
    setIsSaving(true)
    const result = await updateMemory(selectedMemory.path, editContent)
    
    if (result.success) {
      const updatedMemory = { 
        ...selectedMemory, 
        content: editContent, 
        updated_at: new Date().toISOString(),
        size_bytes: new TextEncoder().encode(editContent).length
      }
      setMemories(prev => prev.map(m => 
        m.path === selectedMemory.path ? updatedMemory : m
      ))
      setSelectedMemory(updatedMemory)
      setIsEditing(false)
      showToast('Memory saved', 'success')
    } else {
      showToast('Failed to save memory', 'error')
    }
    setIsSaving(false)
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedMemory(null)
    setNewFileName('')
    setNewFileContent('')
    // Focus the name input after a short delay for the animation
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }

  const handleCancelCreate = () => {
    setIsCreating(false)
    setNewFileName('')
    setNewFileContent('')
  }

  const handleSaveNew = async () => {
    if (!newFileName.trim()) {
      showToast('Please enter a name for your memory', 'error')
      return
    }
    
    setIsSaving(true)
    const path = newFileName.endsWith('.txt') ? newFileName : `${newFileName}.txt`
    const result = await createMemory(path, newFileContent)
    
    if (result.success) {
      const newMemory: MemoryFile = {
        path: `/memories/${path}`,
        content: newFileContent,
        updated_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        size_bytes: new TextEncoder().encode(newFileContent).length,
      }
      setMemories(prev => [...prev, newMemory])
      setSelectedMemory(newMemory)
      setEditContent(newFileContent)
      setIsCreating(false)
      showToast('Memory created', 'success')
    } else {
      showToast('Failed to create memory', 'error')
    }
    setIsSaving(false)
  }

  const handleDeleteRequest = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleteConfirmation({
      path,
      name: getFilename(path)
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return
    
    const { path } = deleteConfirmation
    setIsDeleting(path)
    const result = await deleteMemory(path)
    
    if (result.success) {
      setMemories(prev => prev.filter(m => m.path !== path))
      if (selectedMemory?.path === path) {
        setSelectedMemory(null)
        setIsEditing(false)
      }
      showToast('Memory deleted', 'success')
    } else {
      showToast('Failed to delete memory', 'error')
    }
    setIsDeleting(null)
    setDeleteConfirmation(null)
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null)
  }

  // Determine which view to show
  const showDetailView = selectedMemory && !isCreating

  // Character count for editor
  const charCount = isEditing ? editContent.length : (selectedMemory?.content.length || 0)
  const wordCount = isEditing 
    ? editContent.trim().split(/\s+/).filter(Boolean).length 
    : (selectedMemory?.content.trim().split(/\s+/).filter(Boolean).length || 0)

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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteConfirmation !== null}
        memoryName={deleteConfirmation?.name || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting !== null}
      />

      <AnimatePresence mode="wait">
        {showDetailView ? (
          /* Detail View */
          <motion.main
            key="detail-view"
            className="space-y-4 pb-8"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            suppressHydrationWarning
          >
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBack}
                  className="flex items-center justify-center h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </motion.button>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate text-zinc-900 dark:text-zinc-100">
                    {getFilename(selectedMemory.path)}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400" suppressHydrationWarning>
                    {formatDate(selectedMemory.updated_at)} · {formatBytes(selectedMemory.size_bytes || 0)}
                  </p>
                </div>
              </div>
              
              {/* Keyboard hint */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">esc</kbd>
                <span>to go back</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 h-11 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save changes
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsEditing(false)}
                    className="px-6 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartEdit}
                    className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Edit memory
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDeleteRequest(selectedMemory.path)}
                    disabled={isDeleting === selectedMemory.path}
                    className="px-6 h-11 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting === selectedMemory.path ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </motion.button>
                </>
              )}
            </div>

            {/* Content area */}
            <div className="rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 overflow-hidden">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[400px] p-4 text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border-none outline-none resize-none font-mono leading-relaxed"
                  placeholder="Write your memory content here..."
                  autoFocus
                />
              ) : (
                <div className="p-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-[200px]">
                  {selectedMemory.content || (
                    <span className="text-zinc-400 dark:text-zinc-500 italic">This memory is empty. Click "Edit memory" to add content.</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Character/Word count */}
            <div className="flex items-center justify-end gap-3 text-xs text-zinc-400 dark:text-zinc-500 px-1">
              <span>{charCount.toLocaleString()} characters</span>
              <span>·</span>
              <span>{wordCount.toLocaleString()} words</span>
            </div>

          </motion.main>
        ) : (
          /* List View */
          <motion.main
            key="list-view"
            className="space-y-6 pb-8"
            variants={VARIANTS_CONTAINER}
            initial="hidden"
            animate="visible"
            suppressHydrationWarning
          >
            {/* Header */}
            <motion.section
              variants={VARIANTS_SECTION}
              transition={TRANSITION_SECTION}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Memories
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Your personal knowledge base
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartCreate}
                  className="h-10 px-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[var(--color-accent)]/20"
                >
                  <Plus className="h-4 w-4" />
                  New memory
                </motion.button>
              </div>
            </motion.section>

            {/* Stats Cards */}
            {memories.length > 0 && (
              <motion.section
                variants={VARIANTS_SECTION}
                transition={TRANSITION_SECTION}
              >
                <div className="grid grid-cols-3 gap-3">
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/10 via-transparent to-transparent p-4 border border-[var(--color-accent)]/20"
                  >
                    <div className="h-9 w-9 rounded-xl bg-[var(--color-accent)]/20 flex items-center justify-center mb-3">
                      <Brain className="h-4 w-4 text-[var(--color-accent)]" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.count}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Total memories</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-4 border border-emerald-500/20"
                  >
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
                      <HardDrive className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{formatBytes(stats.totalSize)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Storage used</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-4 border border-amber-500/20"
                  >
                    <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>{stats.recentlyUpdated}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Updated today</p>
                  </motion.div>
                </div>
              </motion.section>
            )}

            {/* Search and Sort */}
            {memories.length > 0 && (
              <motion.section
                variants={VARIANTS_SECTION}
                transition={TRANSITION_SECTION}
                className="space-y-3"
              >
                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-[var(--color-accent)] transition-colors" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full pl-10 pr-20 py-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/60 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border border-transparent outline-none focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4 text-zinc-400" />
                    </button>
                  ) : (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-zinc-400">
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">⌘K</kbd>
                    </div>
                  )}
                </div>
                
                {/* Sort Options */}
                <div className="flex items-center gap-2 px-1">
                  <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Sort by:</span>
                  <div className="flex gap-1">
                    {[
                      { value: 'updated' as SortOption, label: 'Recent' },
                      { value: 'name' as SortOption, label: 'Name' },
                      { value: 'size' as SortOption, label: 'Size' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          sortBy === option.value
                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Create new memory panel */}
            <AnimatePresence>
              {isCreating && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-transparent p-5 space-y-4 border border-[var(--color-accent)]/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[var(--color-accent)]/20 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create new memory</h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Add something to your knowledge base</p>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">esc</kbd>
                        <span>to cancel</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Name</label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          placeholder="e.g., Project Ideas, Meeting Notes..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSaveNew()
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Content <span className="font-normal opacity-60">(optional)</span></label>
                        <textarea
                          value={newFileContent}
                          onChange={(e) => setNewFileContent(e.target.value)}
                          placeholder="Write your memory content here..."
                          rows={5}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border border-zinc-200 dark:border-zinc-700 outline-none resize-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                        />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 text-right">
                          {newFileContent.length.toLocaleString()} characters
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveNew}
                        disabled={isSaving || !newFileName.trim()}
                        className="flex-1 h-11 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[var(--color-accent)]/20"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Create memory
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCancelCreate}
                        className="px-6 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Memory list */}
            <motion.section
              variants={VARIANTS_SECTION}
              transition={TRANSITION_SECTION}
            >
              {filteredMemories.length === 0 && !isCreating ? (
                <motion.div
                  className="flex min-h-[40vh] flex-col items-center justify-center p-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex w-full max-w-sm flex-col items-center justify-center text-center">
                    <motion.div 
                      className="mb-5 h-20 w-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-purple-500/20 flex items-center justify-center"
                      animate={{ 
                        boxShadow: ['0 0 0 0 rgba(127, 145, 224, 0)', '0 0 0 12px rgba(127, 145, 224, 0.1)', '0 0 0 0 rgba(127, 145, 224, 0)']
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {searchQuery ? (
                        <Search className="h-8 w-8 text-[var(--color-accent)]" />
                      ) : (
                        <Brain className="h-8 w-8 text-[var(--color-accent)]" />
                      )}
                    </motion.div>
                    <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {searchQuery ? 'No results found' : 'No memories yet'}
                    </h3>
                    <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {searchQuery 
                        ? `Nothing matches "${searchQuery}". Try a different search term.`
                        : 'Start building your personal knowledge base. Ask the AI to remember things for you, or create memories manually.'
                      }
                    </p>
                    {!searchQuery ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStartCreate}
                        className="h-11 px-6 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[var(--color-accent)]/20"
                      >
                        <Plus className="h-4 w-4" />
                        Create your first memory
                      </motion.button>
                    ) : (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                      >
                        Clear search
                      </button>
                    )}
                    
                    {/* Keyboard shortcuts hint */}
                    {!searchQuery && (
                      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">⌘N</kbd> to create · <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">⌘K</kbd> to search
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : filteredMemories.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {searchQuery 
                        ? `${filteredMemories.length} result${filteredMemories.length !== 1 ? 's' : ''}`
                        : 'All memories'
                      }
                    </h2>
                  </div>
                  
                  <div className="-mx-4 overflow-hidden">
                    <AnimatedBackground
                      enableHover
                      className="h-full w-full rounded-xl bg-zinc-100 dark:bg-zinc-900/80"
                      transition={{
                        type: 'spring',
                        bounce: 0,
                        duration: 0.2,
                      }}
                    >
                      {filteredMemories.map((memory, index) => (
                        <motion.div
                          key={memory.path}
                          data-id={memory.path}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="w-full rounded-xl px-4 py-4 relative group overflow-hidden cursor-pointer"
                          onClick={() => handleSelectMemory(memory)}
                        >
                          <div className="relative z-10 pointer-events-none flex flex-col space-y-1.5 pr-10 min-w-0 w-full">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                              </div>
                              <h4 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {getFilename(memory.path)}
                              </h4>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words leading-relaxed pl-9">
                              {getPreview(memory.content)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 pt-0.5 pl-9">
                              <span suppressHydrationWarning>{formatDate(memory.updated_at)}</span>
                              <span>·</span>
                              <span>{formatBytes(memory.size_bytes || 0)}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDeleteRequest(memory.path, e)}
                            disabled={isDeleting === memory.path}
                            className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition-all hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete memory"
                          >
                            {isDeleting === memory.path ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </motion.div>
                      ))}
                    </AnimatedBackground>
                  </div>
                </div>
              )}
            </motion.section>

          </motion.main>
        )}
      </AnimatePresence>
    </>
  )
}
