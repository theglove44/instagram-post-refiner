import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getAuthUrl } from '@/lib/instagram';

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    const authUrl = getAuthUrl(state);
    return Response.json({ authUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
