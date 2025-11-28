'use server'

import { createClient } from '@/app/supabase/server'
import { revalidatePath } from 'next/cache'

export type MemoryFile = {
  path: string
  content: string
  updated_at: string
  accessed_at: string
  size_bytes: number
}

const MEMORIES_PREFIX = '/memories'

export async function getMemories(): Promise<{ data: MemoryFile[] | null; error: string | null }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('memories')
    .select('path, content, updated_at, accessed_at, size_bytes')
    .eq('user_id', user.id)
    .order('path')

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as MemoryFile[], error: null }
}

export async function getMemory(path: string): Promise<{ data: MemoryFile | null; error: string | null }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  // Normalize path
  let normalizedPath = path
  if (!normalizedPath.startsWith(MEMORIES_PREFIX)) {
    normalizedPath = `${MEMORIES_PREFIX}/${normalizedPath}`
  }

  const { data, error } = await supabase
    .from('memories')
    .select('path, content, updated_at, accessed_at, size_bytes')
    .eq('user_id', user.id)
    .eq('path', normalizedPath)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as MemoryFile, error: null }
}

export async function updateMemory(path: string, content: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Normalize path
  let normalizedPath = path
  if (!normalizedPath.startsWith(MEMORIES_PREFIX)) {
    normalizedPath = `${MEMORIES_PREFIX}/${normalizedPath}`
  }

  const { error } = await supabase
    .from('memories')
    .update({
      content,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('path', normalizedPath)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/memories')
  return { success: true, error: null }
}

export async function createMemory(path: string, content: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Normalize path
  let normalizedPath = path
  if (!normalizedPath.startsWith(MEMORIES_PREFIX)) {
    normalizedPath = `${MEMORIES_PREFIX}/${normalizedPath}`
  }

  const { error } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      path: normalizedPath,
      content,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/memories')
  return { success: true, error: null }
}

export async function deleteMemory(path: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Normalize path
  let normalizedPath = path
  if (!normalizedPath.startsWith(MEMORIES_PREFIX)) {
    normalizedPath = `${MEMORIES_PREFIX}/${normalizedPath}`
  }

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('user_id', user.id)
    .eq('path', normalizedPath)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/memories')
  return { success: true, error: null }
}

