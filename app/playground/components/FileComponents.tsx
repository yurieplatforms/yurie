'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ImageSquare, X } from '@phosphor-icons/react'
import { cn, MAX_IMAGE_BYTES } from '../utils'
import { AttachmentPreview } from '../types'

export function MessageAttachmentList({
  attachments,
  compact = false,
}: {
  attachments: AttachmentPreview[]
  compact?: boolean
}) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div
      className={cn(
        compact ? 'm-0' : 'mt-2 mb-3',
        'flex flex-row flex-wrap gap-2'
      )}
    >
      {attachments.map((att) => {
        if (att.isImage) {
          return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={att.id}
              src={att.objectUrl}
              alt={att.name}
              className="max-h-56 rounded border border-neutral-200 object-cover dark:border-neutral-800"
            />
          )
        }
        const isAudio = (att.mime || '').toLowerCase().startsWith('audio/')
        if (isAudio) {
          return (
            <div
              key={att.id}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-xs"
            >
              <audio controls src={att.objectUrl} className="h-8">
                Your browser does not support the audio element.
              </audio>
              <span className="font-medium truncate max-w-[160px]" title={att.name}>{att.name}</span>
              <span className="ml-2 text-neutral-500">
                {(att.size / 1024).toFixed(2)}kB
              </span>
            </div>
          )
        }
        return (
          <a
            key={att.id}
            href={att.objectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-xs hover:border-[var(--border-color-hover)]"
          >
            <span className="font-medium truncate max-w-[200px]" title={att.name}>{att.name}</span>
            <span className="ml-2 text-neutral-500">
              {(att.size / 1024).toFixed(2)}kB
            </span>
          </a>
        )
      })}
    </div>
  )
}

function FileItem({
  file,
  onRemove,
}: {
  file: File
  onRemove: (file: File) => void
}) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isLikelyImage = useMemo(() => {
    const mime = (file.type || '').toLowerCase()
    if (mime.startsWith('image/')) return true
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const imageExts = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      'svg',
      'heic',
      'heif',
      'tif',
      'tiff',
      'avif',
    ]
    return imageExts.includes(ext)
  }, [file])
  
  const hasTriedDataUrlRef = useRef(false)
  const loadDataUrlFallback = useCallback(() => {
    if (hasTriedDataUrlRef.current) return
    hasTriedDataUrlRef.current = true
    try {
      const reader = new FileReader()
      reader.onload = () => setPreviewUrl(String(reader.result))
      reader.readAsDataURL(file)
    } catch {}
  }, [file])
  
  useEffect(() => {
    if (!isLikelyImage) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isLikelyImage])
  
  const handleRemove = () => {
    setIsRemoving(true)
    onRemove(file)
  }
  
  return (
    <div className="relative mr-2 mb-0 flex items-center">
      <div className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[var(--color-pill-hover)] p-2 pr-3 transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--color-pill-active)]">
        {isLikelyImage ? (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--color-pill-active)]">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onError={loadDataUrlFallback}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-xs font-medium">{file.name}</span>
          <span className="text-xs text-gray-500">
            {(file.size / 1024).toFixed(2)}kB
          </span>
        </div>
      </div>
      {!isRemoving ? (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-transparent bg-[var(--color-pill-active)] text-[var(--text-primary)] shadow-none transition-colors hover:border-[var(--border-color-hover)] active:border-[var(--border-color-hover)]"
          aria-label="Remove file"
        >
          <X className="size-3" weight="bold" />
        </button>
      ) : null}
    </div>
  )
}

export function FileList({
  files,
  onFileRemove,
}: {
  files: File[]
  onFileRemove: (file: File) => void
}) {
  const TRANSITION = { type: 'spring', duration: 0.2, bounce: 0 } as const
  return (
    <AnimatePresence initial={false}>
      {files.length > 0 && (
        <motion.div
          key="files-list"
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={TRANSITION}
          className="overflow-hidden"
        >
          <div className="flex flex-row overflow-x-auto pl-3">
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <motion.div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  initial={{ width: 0 }}
                  animate={{ width: 180 }}
                  exit={{ width: 0 }}
                  transition={TRANSITION}
                  className="relative shrink-0 overflow-hidden pt-2"
                >
                  <FileItem
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    file={file}
                    onRemove={onFileRemove}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ButtonFileUpload({
  onFileUpload,
}: {
  onFileUpload: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => {
            const mime = (f.type || '').toLowerCase()
            const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg'
            const isPng = mime === 'image/png'
            const isWebp = mime === 'image/webp'
            const isGif = mime === 'image/gif'
            const withinLimit = f.size <= MAX_IMAGE_BYTES
            return (isJpeg || isPng || isWebp || isGif) && withinLimit
          })
          onFileUpload(files)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <label
        htmlFor={inputId}
        role="button"
        tabIndex={0}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-0 leading-none transition-colors hover:border-[var(--border-color-hover)]"
        aria-label="Add images"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <ImageSquare className="size-4" weight="bold" aria-hidden="true" />
      </label>
    </>
  )
}
