import { NextResponse } from 'next/server';
import { getAuthUrl } from '../../../lib/instagram.js';
import { randomBytes } from 'crypto';

/**
 * GET /api/auth
 * Generate an OAuth authorization URL with a CSRF state cookie and redirect.
 */
export async function GET() {
  try {
    const state = randomBytes(16).toString('hex');
    const authUrl = getAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('tat_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
