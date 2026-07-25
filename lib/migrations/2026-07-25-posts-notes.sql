-- Phase 1: store Workshop notes with each AI → final training pair
-- Apply in Supabase SQL Editor (safe, additive, nullable).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.posts.notes IS
  'Structured notes / brain dump used to generate the AI draft (nullable for legacy rows).';
