-- ============================================================================
-- Yurie Database Schema
-- ============================================================================

-- ============================================================================
-- CHATS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can insert their own chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;

CREATE POLICY "Users can view their own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

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

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages into their own chats" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages into their own chats" ON messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
  ));

-- ============================================================================
-- AVATARS STORAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);
