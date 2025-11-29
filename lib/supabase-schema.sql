-- Create posts table for Instagram Post Logger
-- Run this SQL in the Supabase SQL Editor to set up your database

CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id TEXT NOT NULL UNIQUE DEFAULT (
    (EXTRACT(EPOCH FROM now()) * 1000)::bigint::text
  ),
  topic TEXT NOT NULL DEFAULT 'Untitled',
  ai_version TEXT NOT NULL,
  final_version TEXT NOT NULL,
  edit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on created_at for efficient ordering
CREATE INDEX posts_created_at_idx ON posts(created_at DESC);

-- Create index on post_id for quick lookups
CREATE INDEX posts_post_id_idx ON posts(post_id);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read/write (adjust as needed for your use case)
CREATE POLICY "Allow public read" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON posts
  FOR INSERT WITH CHECK (true);
