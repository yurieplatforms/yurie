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

-- ============================================================================
-- BACKGROUND TASKS TABLE
-- Persists background AI tasks so they survive page refreshes/navigation
-- ============================================================================

CREATE TABLE IF NOT EXISTS background_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  response_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  sequence_number INTEGER DEFAULT 0,
  task_type TEXT NOT NULL DEFAULT 'agent',
  partial_output TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_tasks_user_id ON background_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_chat_id ON background_tasks(chat_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_response_id ON background_tasks(response_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);

DROP POLICY IF EXISTS "Users can view their own background tasks" ON background_tasks;
DROP POLICY IF EXISTS "Users can insert their own background tasks" ON background_tasks;
DROP POLICY IF EXISTS "Users can update their own background tasks" ON background_tasks;
DROP POLICY IF EXISTS "Users can delete their own background tasks" ON background_tasks;

CREATE POLICY "Users can view their own background tasks" ON background_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own background tasks" ON background_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own background tasks" ON background_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own background tasks" ON background_tasks
  FOR DELETE USING (auth.uid() = user_id);
