import { getSupabaseClient } from '@/lib/supabase';

function normalizeHashtag(tag) {
  let cleaned = tag.trim().toLowerCase();
  if (!cleaned) return null;
  if (!cleaned.startsWith('#')) {
    cleaned = '#' + cleaned;
  }
  // Strip anything that isn't a valid hashtag character
  if (!/^#[\w]+$/u.test(cleaned)) return null;
  return cleaned;
}

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('hashtag_library')
      .select('*')
      .order('added_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: hashtags, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Collect unique categories from full table (unfiltered)
    const { data: allRows, error: catError } = await supabase
      .from('hashtag_library')
      .select('category');

    if (catError) {
      throw new Error(catError.message);
    }

    const categories = [...new Set(
      (allRows || [])
        .map(r => r.category)
        .filter(Boolean)
    )].sort();

    return Response.json({
      success: true,
      hashtags: hashtags || [],
      categories,
    });
  } catch (error) {
    console.error('Hashtag library GET error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { hashtags, category, source, notes } = body;

    if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
      return Response.json(
        { error: 'hashtags must be a non-empty array' },
        { status: 400 }
      );
    }

    const normalized = hashtags
      .map(normalizeHashtag)
      .filter(Boolean);

    if (normalized.length === 0) {
      return Response.json(
        { error: 'No valid hashtags provided' },
        { status: 400 }
      );
    }

    // Upsert each hashtag (on conflict update category/source/notes)
    const rows = normalized.map(hashtag => ({
      hashtag,
      category: category || null,
      source: source || null,
      notes: notes || null,
    }));

    const { data, error } = await supabase
      .from('hashtag_library')
      .upsert(rows, {
        onConflict: 'hashtag',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({
      success: true,
      added: data?.length || 0,
    });
  } catch (error) {
    console.error('Hashtag library POST error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { hashtag, id } = body;

    if (!hashtag && !id) {
      return Response.json(
        { error: 'Provide either hashtag or id to delete' },
        { status: 400 }
      );
    }

    let query = supabase.from('hashtag_library').delete();

    if (id) {
      query = query.eq('id', id);
    } else {
      const normalized = normalizeHashtag(hashtag);
      if (!normalized) {
        return Response.json(
          { error: 'Invalid hashtag format' },
          { status: 400 }
        );
      }
      query = query.eq('hashtag', normalized);
    }

    const { error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Hashtag library DELETE error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
