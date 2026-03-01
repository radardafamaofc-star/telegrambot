
CREATE TABLE public.access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins) can manage keys
CREATE POLICY "Authenticated users can read keys" ON public.access_keys
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert keys" ON public.access_keys
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update keys" ON public.access_keys
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete keys" ON public.access_keys
  FOR DELETE TO authenticated USING (true);

-- Allow anonymous users to validate a key (read-only, only active and non-expired)
CREATE POLICY "Anyone can validate active keys" ON public.access_keys
  FOR SELECT TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
