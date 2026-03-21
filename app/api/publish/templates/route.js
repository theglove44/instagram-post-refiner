import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('caption_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Collect unique categories
    const { data: allRows, error: catError } = await supabase
      .from('caption_templates')
      .select('category');

    if (catError) throw new Error(catError.message);

    const categories = [...new Set(
      (allRows || []).map(r => r.category).filter(Boolean)
    )].sort();

    return Response.json({ success: true, templates: data || [], categories });
  } catch (error) {
    console.error('Templates GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { name, caption, category, hashtagCategories } = body;

    if (!name || !caption) {
      return Response.json({ error: 'name and caption are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('caption_templates')
      .insert({
        name,
        caption,
        category: category || null,
        hashtag_categories: hashtagCategories || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ success: true, template: data });
  } catch (error) {
    console.error('Templates POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { id, name, caption, category, hashtagCategories } = body;

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (caption !== undefined) updates.caption = caption;
    if (category !== undefined) updates.category = category;
    if (hashtagCategories !== undefined) updates.hashtag_categories = hashtagCategories;

    const { data, error } = await supabase
      .from('caption_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ success: true, template: data });
  } catch (error) {
    console.error('Templates PUT error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'id query param is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('caption_templates')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Templates DELETE error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
