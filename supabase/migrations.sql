-- Chats Table Policies (Strict Authentication)
-- Remove old policies to ensure clean state
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can insert their own chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;
DROP POLICY IF EXISTS "Allow users to view chats" ON chats;
DROP POLICY IF EXISTS "Allow users to insert chats" ON chats;
DROP POLICY IF EXISTS "Allow users to update chats" ON chats;
DROP POLICY IF EXISTS "Allow users to delete chats" ON chats;

-- Create standard authenticated policies
CREATE POLICY "Users can view their own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);


-- Messages Table (New Normalization)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  rich_content JSONB,
  reasoning TEXT,
  name TEXT,
  thinking_duration_seconds FLOAT,
  suggestions TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Messages Policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages into their own chats" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages into their own chats"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- Storage: Avatars Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner );

-- ============================================================================
-- Memory Tool Storage
-- Stores memory files for the Anthropic Memory Tool
-- See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
-- ============================================================================

CREATE TABLE IF NOT EXISTS memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Virtual path within /memories directory (e.g., "/memories/notes.txt")
  path TEXT NOT NULL,
  -- File content (text-based)
  content TEXT NOT NULL DEFAULT '',
  -- File size in bytes for limit enforcement
  size_bytes INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Last accessed timestamp for expiration policies
  accessed_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure unique paths per user
  UNIQUE(user_id, path)
);

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Memory Policies (strict user isolation)
DROP POLICY IF EXISTS "Users can view their own memories" ON memories;
DROP POLICY IF EXISTS "Users can insert their own memories" ON memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON memories;

CREATE POLICY "Users can view their own memories"
  ON memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
  ON memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
  ON memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
  ON memories FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_path ON memories(user_id, path);
CREATE INDEX IF NOT EXISTS idx_memories_accessed_at ON memories(accessed_at);

-- Function to update timestamps on memory access
CREATE OR REPLACE FUNCTION update_memory_accessed_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.accessed_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update accessed_at on updates
DROP TRIGGER IF EXISTS trigger_update_memory_accessed_at ON memories;
CREATE TRIGGER trigger_update_memory_accessed_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_accessed_at();
