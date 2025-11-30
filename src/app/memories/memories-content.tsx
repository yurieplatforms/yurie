'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { 
  FileText, 
  Trash2, 
  Plus, 
  Loader2,
  Search,
  ArrowLeft,
  Check,
  X,
  Library,
  HardDrive,
  Clock,
  ArrowUpDown,
  Sparkles,
  Type,
  BarChart2
} from 'lucide-react'
import { 
  type MemoryFile, 
  updateMemory, 
  createMemory, 
  deleteMemory 
} from './actions'
import { formatBytes, formatDate, getFilename, getPreview } from './utils'
import { DeleteConfirmDialog } from './delete-dialog'

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
    const totalWords = memories.reduce((acc, m) => acc + (m.content?.trim().split(/\s+/).filter(Boolean).length || 0), 0)
    const avgSize = memories.length > 0 ? totalSize / memories.length : 0
    
    // Only calculate time-based stats on client side
    const recentlyUpdated = mounted ? memories.filter(m => {
      const diff = Date.now() - new Date(m.updated_at).getTime()
      return diff < 24 * 60 * 60 * 1000 // Last 24 hours
    }).length : 0
    return {
      count: memories.length,
      totalSize,
      totalWords,
      avgSize,
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
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
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
    // Focus the name input after a short delay
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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300 ${
              toast.type === 'success' 
                ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]' 
                : 'bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]/20 text-[var(--color-destructive)]'
            }`}
          >
            <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
              toast.type === 'success' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-destructive)]'
            }`}>
              {toast.type === 'success' ? (
                <Check className="h-3 w-3 text-white" />
              ) : (
                <X className="h-3 w-3 text-white" />
              )}
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteConfirmation !== null}
        memoryName={deleteConfirmation?.name || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting !== null}
      />

      {showDetailView ? (
        /* Detail View */
        <main className="space-y-4 pb-8 animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleBack}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
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
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex-1 h-11 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="h-11 w-11 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartEdit}
                  className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  Edit memory
                </button>
                <button
                  onClick={() => handleDeleteRequest(selectedMemory.path)}
                  disabled={isDeleting === selectedMemory.path}
                  className="h-11 w-11 rounded-full bg-[var(--color-destructive)]/10 hover:bg-[var(--color-destructive)]/20 text-[var(--color-destructive)] flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                  title="Delete memory"
                >
                  {isDeleting === selectedMemory.path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
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

        </main>
      ) : (
        /* List View */
        <main className="space-y-6 pb-8 animate-in fade-in duration-200">
          {/* Header */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Memories
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Your personal knowledge base
                </p>
              </div>
              <button
                onClick={handleStartCreate}
                className="h-10 px-5 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                New memory
              </button>
            </div>
          </section>

          {/* Stats Cards */}
          {memories.length > 0 && (
            <section>
              <div className="rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/10 via-transparent to-transparent p-6 border border-[var(--color-accent)]/20 hover:scale-[1.01] transition-transform duration-300">
                <div className="flex flex-col sm:flex-row gap-8">
                  <div className="flex-1 min-w-[200px]">
                    <div className="h-10 w-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center mb-4">
                      <Library className="h-5 w-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{stats.count}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Total memories</p>
                    </div>
                  </div>

                  <div className="w-px bg-[var(--color-accent)]/10 hidden sm:block" />
                  <div className="h-px w-full bg-[var(--color-accent)]/10 sm:hidden" />

                  <div className="flex flex-1 gap-8">
                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
                            <HardDrive className="h-3 w-3 text-[var(--color-success)]" />
                          </div>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Storage used</span>
                        </div>
                        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 pl-8">{formatBytes(stats.totalSize)}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-warning)]/20 flex items-center justify-center">
                            <Clock className="h-3 w-3 text-[var(--color-warning)]" />
                          </div>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Updated today</span>
                        </div>
                        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 pl-8" suppressHydrationWarning>{stats.recentlyUpdated}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Type className="h-3 w-3 text-blue-500" />
                          </div>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Total words</span>
                        </div>
                        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 pl-8">{stats.totalWords.toLocaleString()}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <BarChart2 className="h-3 w-3 text-purple-500" />
                          </div>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Avg size</span>
                        </div>
                        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 pl-8">{formatBytes(stats.avgSize)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Search and Sort */}
          {memories.length > 0 && (
            <section className="space-y-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-[var(--color-accent)] transition-colors" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories..."
                  className="w-full pl-11 pr-20 py-3 rounded-[26px] bg-zinc-100/90 dark:bg-[#181818] text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 border border-transparent outline-none focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/20 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all"
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        sortBy === option.value
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Create new memory panel */}
          {isCreating && (
            <section className="overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-transparent p-5 space-y-4 border border-[var(--color-accent)]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
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
                  <button
                    onClick={handleSaveNew}
                    disabled={isSaving || !newFileName.trim()}
                    className="flex-1 h-11 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Create memory
                  </button>
                  <button
                    onClick={handleCancelCreate}
                    className="h-11 w-11 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Memory list */}
          <section>
            {filteredMemories.length === 0 && !isCreating ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex w-full max-w-sm flex-col items-center justify-center text-center">
                  <div className="mb-5 h-20 w-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-purple-500/20 flex items-center justify-center">
                    {searchQuery ? (
                      <Search className="h-8 w-8 text-[var(--color-accent)]" />
                    ) : (
                      <Library className="h-8 w-8 text-[var(--color-accent)]" />
                    )}
                  </div>
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
                    <button
                      onClick={handleStartCreate}
                      className="h-11 px-6 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Create your first memory
                    </button>
                  ) : (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="cursor-pointer h-10 px-5 rounded-full text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
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
              </div>
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
                
                <div className="space-y-0">
                  {filteredMemories.map((memory) => (
                    <div
                      key={memory.path}
                      className="w-full rounded-2xl px-4 py-3 relative group overflow-hidden cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/80 transition-colors"
                      onClick={() => handleSelectMemory(memory)}
                    >
                      <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-10 min-w-0 w-full">
                        <h4 className="font-normal text-zinc-900 dark:text-zinc-100 truncate">
                          {getFilename(memory.path)}
                        </h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words">
                          {getPreview(memory.content)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                          <span suppressHydrationWarning>{formatDate(memory.updated_at)}</span>
                          <span>·</span>
                          <span>{formatBytes(memory.size_bytes || 0)}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteRequest(memory.path, e)}
                        disabled={isDeleting === memory.path}
                        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110 active:scale-95"
                        title="Delete memory"
                      >
                        {isDeleting === memory.path ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

        </main>
      )}
    </>
  )
}
