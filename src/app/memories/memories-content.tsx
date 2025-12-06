'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { 
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
import { useToast, ToastContainer } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  const [mounted, setMounted] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null)
  
  const { toasts, showToast } = useToast()
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
      <ToastContainer toasts={toasts} />

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
              <Button
                onClick={handleBack}
                variant="secondary"
                size="icon"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate text-[var(--color-foreground)]">
                  {getFilename(selectedMemory.path)}
                </h2>
                <p className="text-xs text-[var(--color-muted-foreground)]" suppressHydrationWarning>
                  {formatDate(selectedMemory.updated_at)} · {formatBytes(selectedMemory.size_bytes || 0)}
                </p>
              </div>
            </div>
            
            {/* Keyboard hint */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
              <kbd className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[10px]">esc</kbd>
              <span>to go back</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  size="lg"
                  className="flex-1"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save changes
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="secondary"
                  size="icon-lg"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartEdit}
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                >
                  Edit memory
                </Button>
                <Button
                  onClick={() => handleDeleteRequest(selectedMemory.path)}
                  disabled={isDeleting === selectedMemory.path}
                  variant="destructive-ghost"
                  size="icon-lg"
                  title="Delete memory"
                >
                  {isDeleting === selectedMemory.path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Content area */}
          <Card variant="default" padding="none" className="overflow-hidden">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[400px] p-4 text-sm text-[var(--color-foreground)] bg-transparent border-none outline-none resize-none font-mono leading-relaxed"
                placeholder="Write your memory content here..."
                autoFocus
              />
            ) : (
              <div className="p-4 text-sm text-[var(--color-foreground)] whitespace-pre-wrap leading-relaxed min-h-[200px]">
                {selectedMemory.content || (
                  <span className="text-[var(--color-muted-foreground)] italic">This memory is empty. Click "Edit memory" to add content.</span>
                )}
              </div>
            )}
          </Card>
          
          {/* Character/Word count */}
          <div className="flex items-center justify-end gap-3 text-xs text-[var(--color-muted-foreground)] px-1">
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
                <h1 className="text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
                  Memories
                </h1>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
                  Your personal knowledge base
                </p>
              </div>
              <Button 
                onClick={handleStartCreate}
                variant="ghost"
                size="sm"
                className="h-auto py-1.5 px-3 bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40 shadow-sm hover:bg-[var(--color-accent)]/30 hover:text-[var(--color-accent)]"
              >
                <Plus className="h-3.5 w-3.5" />
                New memory
              </Button>
            </div>
          </section>

          {/* Stats Cards */}
          {memories.length > 0 && (
            <section>
              <Card variant="accent" padding="lg" className="hover:scale-[1.01] transition-transform duration-300">
                <div className="flex flex-col sm:flex-row gap-8">
                  <div className="flex-1 min-w-[200px]">
                    <div className="h-10 w-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center mb-4">
                      <Library className="h-5 w-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-[var(--color-foreground)] mb-1">{stats.count}</p>
                      <p className="text-sm text-[var(--color-muted-foreground)]">Total memories</p>
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
                          <span className="text-sm text-[var(--color-muted-foreground)]">Storage used</span>
                        </div>
                        <p className="text-xl font-semibold text-[var(--color-foreground)] pl-8">{formatBytes(stats.totalSize)}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-warning)]/20 flex items-center justify-center">
                            <Clock className="h-3 w-3 text-[var(--color-warning)]" />
                          </div>
                          <span className="text-sm text-[var(--color-muted-foreground)]">Updated today</span>
                        </div>
                        <p className="text-xl font-semibold text-[var(--color-foreground)] pl-8" suppressHydrationWarning>{stats.recentlyUpdated}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-info)]/20 flex items-center justify-center">
                            <Type className="h-3 w-3 text-[var(--color-info)]" />
                          </div>
                          <span className="text-sm text-[var(--color-muted-foreground)]">Total words</span>
                        </div>
                        <p className="text-xl font-semibold text-[var(--color-foreground)] pl-8">{stats.totalWords.toLocaleString()}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                            <BarChart2 className="h-3 w-3 text-[var(--color-accent)]" />
                          </div>
                          <span className="text-sm text-[var(--color-muted-foreground)]">Avg size</span>
                        </div>
                        <p className="text-xl font-semibold text-[var(--color-foreground)] pl-8">{formatBytes(stats.avgSize)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </section>
          )}

          {/* Search and Sort */}
          {memories.length > 0 && (
            <section className="space-y-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)] group-focus-within:text-[var(--color-accent)] transition-colors" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories..."
                  variant="filled"
                  className="pl-11 pr-20 shadow-[var(--shadow-lg)]"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-[var(--radius-lg)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]" />
                  </button>
                ) : (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                    <kbd className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[10px]">⌘K</kbd>
                  </div>
                )}
              </div>
              
              {/* Sort Options */}
              <div className="flex items-center gap-2 px-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                <span className="text-xs text-[var(--color-muted-foreground)]">Sort by:</span>
                  <div className="flex gap-1">
                  {[
                    { value: 'updated' as SortOption, label: 'Recent' },
                    { value: 'name' as SortOption, label: 'Name' },
                    { value: 'size' as SortOption, label: 'Size' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium transition-all cursor-pointer",
                        sortBy === option.value
                          ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40 shadow-sm"
                          : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] border border-transparent"
                      )}
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
              <Card variant="accent" padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Create new memory</h3>
                      <p className="text-xs text-[var(--color-muted-foreground)]">Add something to your knowledge base</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                    <kbd className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[10px]">esc</kbd>
                    <span>to cancel</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Name</Label>
                    <Input
                      ref={nameInputRef}
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="e.g., Project Ideas, Meeting Notes..."
                      variant="filled"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSaveNew()
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Content <span className="font-normal opacity-60">(optional)</span>
                    </Label>
                    <textarea
                      value={newFileContent}
                      onChange={(e) => setNewFileContent(e.target.value)}
                      placeholder="Write your memory content here..."
                      rows={5}
                      className="w-full px-4 py-2.5 rounded-[var(--radius-card)] bg-[var(--color-surface-hover)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] border-none outline-none resize-none focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-all"
                    />
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-1.5 text-right">
                      {newFileContent.length.toLocaleString()} characters
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSaveNew}
                    disabled={isSaving || !newFileName.trim()}
                    size="lg"
                    className="flex-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Create memory
                  </Button>
                  <Button
                    onClick={handleCancelCreate}
                    variant="secondary"
                    size="icon-lg"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </section>
          )}

          {/* Memory list */}
          <section>
            {filteredMemories.length === 0 && !isCreating ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex w-full max-w-sm flex-col items-center justify-center text-center">
                  <div className="mb-5 h-20 w-20 rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-info)]/20 flex items-center justify-center">
                    {searchQuery ? (
                      <Search className="h-8 w-8 text-[var(--color-accent)]" />
                    ) : (
                      <Library className="h-8 w-8 text-[var(--color-accent)]" />
                    )}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">
                    {searchQuery ? 'No results found' : 'No memories yet'}
                  </h3>
                  <p className="mb-6 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                    {searchQuery 
                      ? `Nothing matches "${searchQuery}". Try a different search term.`
                      : 'Start building your personal knowledge base. Ask the AI to remember things for you, or create memories manually.'
                    }
                  </p>
                  {!searchQuery ? (
                    <Button onClick={handleStartCreate} size="lg">
                      <Plus className="h-4 w-4" />
                      Create your first memory
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setSearchQuery('')}
                      variant="ghost"
                      className="text-[var(--color-accent)]"
                    >
                      Clear search
                    </Button>
                  )}
                  
                  {/* Keyboard shortcuts hint */}
                  {!searchQuery && (
                    <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
                      <kbd className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[10px]">⌘N</kbd> to create · <kbd className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[10px]">⌘K</kbd> to search
                    </p>
                  )}
                </div>
              </div>
            ) : filteredMemories.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-medium text-[var(--color-muted-foreground)]">
                    {searchQuery 
                      ? `${filteredMemories.length} result${filteredMemories.length !== 1 ? 's' : ''}`
                      : 'All memories'
                    }
                  </h2>
                </div>
                
                <div className="space-y-2">
                  {filteredMemories.map((memory) => (
                    <Card
                      key={memory.path}
                      variant="interactive"
                      className="group relative overflow-hidden"
                      onClick={() => handleSelectMemory(memory)}
                    >
                      <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-10 min-w-0 w-full">
                        <h4 className="font-normal text-[var(--color-foreground)] truncate">
                          {getFilename(memory.path)}
                        </h4>
                        <p className="text-sm text-[var(--color-muted-foreground)] line-clamp-2 break-words">
                          {getPreview(memory.content)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)] pt-1">
                          <span suppressHydrationWarning>{formatDate(memory.updated_at)}</span>
                          <span>·</span>
                          <span>{formatBytes(memory.size_bytes || 0)}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteRequest(memory.path, e)}
                        disabled={isDeleting === memory.path}
                        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-all hover:bg-[var(--color-destructive)]/20 hover:text-[var(--color-destructive)] active:bg-[var(--color-destructive)]/30 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110 active:scale-100"
                        title="Delete memory"
                      >
                        {isDeleting === memory.path ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </Card>
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
