-- ============================================================
-- MediMate — A Personal Health Assistant
-- Database Schema for Supabase PostgreSQL
-- ============================================================

-- 1. Profiles Table (User settings, preferred voice, accessibility)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name text,
  reminder_prefs jsonb DEFAULT '{"reminderVoice": "standard", "language": "English", "notifications": true, "seniorMode": false}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Medications Table
CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text,
  scheduled_time time without time zone,
  instructions text,
  strength text,
  form text DEFAULT 'Tablet',
  times text[] DEFAULT ARRAY['08:00'::text],
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  food text DEFAULT 'any',
  doctor text,
  notes text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 3. Reminder History Table (Auditing adherence, confirm times, snooze intervals)
CREATE TABLE IF NOT EXISTS public.reminder_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications ON DELETE SET NULL,
  med_name text,
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'taken'::text, 'missed'::text, 'snoozed'::text])),
  confirmed_at timestamptz,
  snooze_until timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Medical Records Table
CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  data_url text,
  file_size text,
  created_at timestamptz DEFAULT now()
);

-- 5. Caregivers Table
CREATE TABLE IF NOT EXISTS public.caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  permissions jsonb DEFAULT '{"schedule": true, "confirmed": true, "missed": true, "instructions": true, "docs": false, "adherence": true}'::jsonb,
  status text DEFAULT 'invited',
  created_at timestamptz DEFAULT now()
);

-- 6. Favourite Voices Table
CREATE TABLE IF NOT EXISTS public.favourite_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  label text NOT NULL,
  data_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each user can only read and write their own records
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourite_voices ENABLE ROW LEVEL SECURITY;

-- Profiles Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users manage their profile'
  ) THEN
    CREATE POLICY "Users manage their profile" ON public.profiles
      FOR ALL TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Medications Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medications' AND policyname = 'Users manage their medications'
  ) THEN
    CREATE POLICY "Users manage their medications" ON public.medications
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Reminder History Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reminder_history' AND policyname = 'Users manage their reminder history'
  ) THEN
    CREATE POLICY "Users manage their reminder history" ON public.reminder_history
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Medical Records Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records' AND policyname = 'Users manage their medical records'
  ) THEN
    CREATE POLICY "Users manage their medical records" ON public.medical_records
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Caregivers Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'caregivers' AND policyname = 'Users manage their caregivers'
  ) THEN
    CREATE POLICY "Users manage their caregivers" ON public.caregivers
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Favourite Voices Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favourite_voices' AND policyname = 'Users manage their favourite voices'
  ) THEN
    CREATE POLICY "Users manage their favourite voices" ON public.favourite_voices
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
