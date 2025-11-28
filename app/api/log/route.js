import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Store posts in a JSON file (you could swap this for a database later)
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

async function savePosts(posts) {
  await ensureDataDir();
  await writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

export async function POST(request) {
  try {
    const { topic, aiVersion, finalVersion, editCount } = await request.json();

    if (!aiVersion || !finalVersion) {
      return Response.json(
        { error: 'Both AI and final versions are required' },
        { status: 400 }
      );
    }

    const posts = await loadPosts();
    
    const newPost = {
      id: Date.now().toString(),
      topic: topic || 'Untitled',
      aiVersion,
      finalVersion,
      editCount: editCount || 0,
      createdAt: new Date().toISOString(),
    };

    posts.unshift(newPost); // Add to beginning
    await savePosts(posts);

    return Response.json({ 
      success: true, 
      post: newPost,
      totalPosts: posts.length
    });
  } catch (error) {
    console.error('Log API error:', error);
    return Response.json(
      { error: error.message || 'Failed to log post' },
      { status: 500 }
    );
  }
}
