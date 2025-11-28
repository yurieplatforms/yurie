'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  FileText, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Loader2,
  Edit3,
  Search,
  ArrowLeft
} from 'lucide-react'
import { Footer } from '@/components/layout/footer'
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

function getPreview(content: string, maxLength: number = 100): string {
  if (!content) return 'Empty memory'
  const preview = content.replace(/\n/g, ' ').trim()
  if (preview.length <= maxLength) return preview
  return preview.substring(0, maxLength).trim() + '...'
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

  // Filter memories based on search query
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories
    const query = searchQuery.toLowerCase()
    return memories.filter(m => 
      getFilename(m.path).toLowerCase().includes(query) ||
      m.content.toLowerCase().includes(query)
    )
  }, [memories, searchQuery])

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
    }
    setIsSaving(false)
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedMemory(null)
    setNewFileName('')
    setNewFileContent('')
  }

  const handleCancelCreate = () => {
    setIsCreating(false)
    setNewFileName('')
    setNewFileContent('')
  }

  const handleSaveNew = async () => {
    if (!newFileName.trim()) return
    
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
      setMemories(prev => [...prev, newMemory].sort((a, b) => a.path.localeCompare(b.path)))
      setSelectedMemory(newMemory)
      setEditContent(newFileContent)
      setIsCreating(false)
    }
    setIsSaving(false)
  }

  const handleDelete = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this memory?')) return
    
    setIsDeleting(path)
    const result = await deleteMemory(path)
    
    if (result.success) {
      setMemories(prev => prev.filter(m => m.path !== path))
      if (selectedMemory?.path === path) {
        setSelectedMemory(null)
        setIsEditing(false)
      }
    }
    setIsDeleting(null)
  }

  // Show detail view when a memory is selected
  if (selectedMemory && !isCreating) {
    return (
      <motion.main
        className="space-y-6 pb-24"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center justify-center h-8 w-8 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-medium truncate">
                {getFilename(selectedMemory.path)}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400" suppressHydrationWarning>
                {formatDate(selectedMemory.updated_at)} · {formatBytes(selectedMemory.size_bytes || 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Cancel
                </button>
                <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700" />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 flex items-center gap-1"
                >
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleDelete(selectedMemory.path)}
                  disabled={isDeleting === selectedMemory.path}
                  className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 flex items-center gap-1"
                >
                  {isDeleting === selectedMemory.path && <Loader2 className="h-3 w-3 animate-spin" />}
                  Delete
                </button>
                <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700" />
                <button
                  onClick={handleStartEdit}
                  className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/80 overflow-hidden">
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[400px] p-4 text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border-none outline-none resize-none font-mono leading-relaxed"
              placeholder="Write your memory content here..."
              autoFocus
            />
          ) : (
            <div className="p-4 text-sm text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed min-h-[200px]">
              {selectedMemory.content || (
                <span className="text-zinc-400 dark:text-zinc-500 italic">This memory is empty</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
          <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
            <div className="bg-background">
              <Footer className="mt-0" />
            </div>
          </div>
        </div>
      </motion.main>
    )
  }

  return (
    <motion.main
      className="space-y-12 pb-24"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your memories</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartCreate}
              className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              New memory
            </button>
          </div>
        </div>

        {/* Search bar - show only if there are memories */}
        {memories.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border-none outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            )}
          </div>
        )}

        {/* Create new memory panel */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New memory</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelCreate}
                      className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      Cancel
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700" />
                    <button
                      onClick={handleSaveNew}
                      disabled={isSaving || !newFileName.trim()}
                      className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                      Create
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Memory name"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border-none outline-none"
                  autoFocus
                />
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="Write your memory content here..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 border-none outline-none resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Memory list */}
        {filteredMemories.length === 0 && !isCreating ? (
          <motion.div
            className="flex min-h-[30vh] flex-col items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex w-full max-w-sm flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                {searchQuery ? (
                  <Search className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                ) : (
                  <FileText className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
              <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {searchQuery ? 'No results' : 'No memories yet'}
              </h3>
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                {searchQuery 
                  ? `Nothing matches "${searchQuery}"`
                  : 'Ask the AI to remember things, or create one manually.'
                }
              </p>
              {!searchQuery ? (
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
                    onClick={handleStartCreate}
                    className="relative -mx-3 inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-950 dark:text-zinc-50 transition-colors hover:text-zinc-950 cursor-pointer"
                    data-id="create-memory"
                  >
                    Create a memory
                  </button>
                </AnimatedBackground>
              ) : (
                <button
                  onClick={() => setSearchQuery('')}
                  className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Clear search
                </button>
              )}
            </div>
          </motion.div>
        ) : (
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
              {filteredMemories.map((memory) => (
                <div
                  key={memory.path}
                  data-id={memory.path}
                  className="w-full rounded-xl px-4 py-3 relative group overflow-hidden cursor-pointer"
                  onClick={() => handleSelectMemory(memory)}
                >
                  <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-8 min-w-0 w-full">
                    <h4 className="font-normal dark:text-zinc-100 truncate">
                      {getFilename(memory.path)}
                    </h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words">
                      {getPreview(memory.content)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                      <span suppressHydrationWarning>{formatDate(memory.updated_at)}</span>
                      <span>•</span>
                      <span>{formatBytes(memory.size_bytes || 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(memory.path, e)}
                    disabled={isDeleting === memory.path}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-200 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-800"
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
            </AnimatedBackground>
          </div>
        )}
      </motion.section>

      {/* Footer */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
          <div className="bg-background">
            <Footer className="mt-0" />
          </div>
        </div>
      </div>
    </motion.main>
  )
}
