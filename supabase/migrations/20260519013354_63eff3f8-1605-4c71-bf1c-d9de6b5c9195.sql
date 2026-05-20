-- =============================
-- CHATS
-- =============================
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct','group')),
  name text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chats_last_msg_idx ON public.chats(last_message_at DESC);

DROP TRIGGER IF EXISTS chats_set_updated_at ON public.chats;
CREATE TRIGGER chats_set_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================
-- CHAT MEMBERS
-- =============================
CREATE TABLE IF NOT EXISTS public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','owner')),
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT 'epoch',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_members_user_idx ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS chat_members_chat_idx ON public.chat_members(chat_id);

-- =============================
-- MESSAGES
-- =============================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','audio','video','file','system')),
  media_url text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON public.messages(chat_id, created_at DESC);

-- =============================
-- REACTIONS / READS / TYPING
-- =============================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS reactions_message_idx ON public.message_reactions(message_id);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.typing_presence (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

-- =============================
-- RLS HELPER — avoids recursion
-- =============================
CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = _chat_id AND user_id = _user_id
  );
$$;

-- One-shot direct-chat creator. Returns existing 1:1 chat if it exists.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  found uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF me = _other THEN RAISE EXCEPTION 'cannot chat with self'; END IF;

  SELECT c.id INTO found
  FROM public.chats c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = me)
    AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = _other)
  LIMIT 1;

  IF found IS NOT NULL THEN RETURN found; END IF;

  INSERT INTO public.chats (type, created_by) VALUES ('direct', me) RETURNING id INTO found;
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (found, me, 'owner');
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (found, _other, 'member');
  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_chat(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;

-- =============================
-- TRIGGER: bump chat preview on new message
-- =============================
CREATE OR REPLACE FUNCTION public.touch_chat_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(COALESCE(NEW.content, ''), 200),
      updated_at = now()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_chat ON public.messages;
CREATE TRIGGER messages_touch_chat
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_on_message();

-- =============================
-- RLS POLICIES
-- =============================

-- chats
CREATE POLICY "Members can view their chats" ON public.chats
FOR SELECT TO authenticated
USING (public.is_chat_member(id, auth.uid()));

CREATE POLICY "Authenticated can create chats" ON public.chats
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Members can update chat metadata" ON public.chats
FOR UPDATE TO authenticated
USING (public.is_chat_member(id, auth.uid()))
WITH CHECK (public.is_chat_member(id, auth.uid()));

-- chat_members
CREATE POLICY "Members can view chat members" ON public.chat_members
FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Add self or as chat creator" ON public.chat_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid())
);

CREATE POLICY "User can update own membership" ON public.chat_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "User can leave (delete own membership)" ON public.chat_members
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- messages
CREATE POLICY "Members can read messages" ON public.messages
FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members can send messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Sender can edit own messages" ON public.messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages" ON public.messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- reactions
CREATE POLICY "Members can view reactions" ON public.message_reactions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())
));

CREATE POLICY "Users can react to messages in their chats" ON public.message_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())
  )
);

CREATE POLICY "Users can remove own reactions" ON public.message_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- reads
CREATE POLICY "Members can view reads" ON public.message_reads
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())
));

CREATE POLICY "Users can mark own reads" ON public.message_reads
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())
  )
);

-- typing
CREATE POLICY "Members can view typing" ON public.typing_presence
FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Users can upsert own typing" ON public.typing_presence
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Users can update own typing" ON public.typing_presence
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =============================
-- Realtime publication
-- =============================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_presence;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.typing_presence REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;