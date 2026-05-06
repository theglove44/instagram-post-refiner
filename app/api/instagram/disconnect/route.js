import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = getServerSupabaseClient();
    
    // Delete all connected accounts
    const { error } = await supabase
      .from('instagram_accounts')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (error) {
      throw new Error(error.message);
    }
    
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('Instagram disconnect error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
