import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadPosts() {
  await ensureDataDir();
  try {
    const data = await readFile(POSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const posts = await loadPosts();
    return Response.json({ posts });
  } catch (error) {
    console.error('Posts API error:', error);
    return Response.json(
      { error: error.message || 'Failed to load posts' },
      { status: 500 }
    );
  }
}
