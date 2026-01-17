import { getAuthUrl } from '@/lib/instagram';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return Response.json({ authUrl });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
