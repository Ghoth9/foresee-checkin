-- =========================================================================
-- FORESEE FIELD 2.0 - SUPABASE DATABASE SCHEMA & REALTIME CONFIGURATION
-- =========================================================================

-- 1. Create TECHNICIANS Table
CREATE TABLE IF NOT EXISTS public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '-',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create TASKS Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '-',
  category TEXT DEFAULT 'ติดตั้งงานใหม่',
  priority TEXT DEFAULT 'ปกติ',
  location TEXT DEFAULT '-',
  techs TEXT[] DEFAULT '{}',
  start_date TEXT DEFAULT '',
  deadline TEXT DEFAULT '-',
  status TEXT DEFAULT 'รอดำเนินการ',
  progress INTEGER DEFAULT 0,
  latest_update TEXT DEFAULT 'ยังไม่มีอัปเดต',
  customer JSONB DEFAULT '{}'::jsonb,
  old_deadline TEXT DEFAULT '-',
  extend_reason TEXT DEFAULT '-',
  updated_by TEXT DEFAULT '-',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create CHECKINS Table (For check-in / check-out records)
CREATE TABLE IF NOT EXISTS public.checkins (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  techs TEXT[] DEFAULT '{}',
  job_type TEXT DEFAULT 'ติดตั้งกล้องวงจรปิด',
  location TEXT DEFAULT '-',
  coords TEXT DEFAULT '',
  map_url TEXT DEFAULT '',
  checkin_time TEXT NOT NULL,
  checkout_time TEXT,
  duration TEXT DEFAULT '-',
  status TEXT DEFAULT 'กำลังทำ',
  outcome TEXT DEFAULT '',
  note TEXT DEFAULT '',
  photos TEXT[] DEFAULT '{}',
  progress INTEGER DEFAULT 0,
  closer_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS) & Allow Public Anon Access
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public full access on technicians" ON public.technicians
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public full access on tasks" ON public.tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public full access on checkins" ON public.checkins
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Supabase Realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.technicians;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkins;

-- 6. Insert Default Technicians if empty
INSERT INTO public.technicians (name) VALUES 
  ('ช่างกนก'),
  ('ช่างมณเฑียร'),
  ('ช่างสายฟ้า'),
  ('ช่างอาร์ม'),
  ('ช่างเอก'),
  ('K.ชัยวัฒน์ (พี่อาร์ม)'),
  ('K.สุพิชชาญาต์ (ใบปอ)'),
  ('ทดสอบระบบ')
ON CONFLICT (name) DO NOTHING;

-- 7. Setup Storage Bucket for Photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('work-photos', 'work-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public uploads to work-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'work-photos');

CREATE POLICY "Allow public reads from work-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'work-photos');

CREATE POLICY "Allow public deletes from work-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'work-photos');
