import { getSupabaseClient } from '@/lib/supabase';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);
    
    if (!accounts || accounts.length === 0) {
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }
    
    const account = accounts[0];
    const accessToken = account.access_token;
    
    // Fetch account info
    const accountResponse = await fetch(
      `${GRAPH_API_BASE}/${account.instagram_user_id}?fields=id,username,profile_picture_url,followers_count,follows_count,media_count,biography&access_token=${accessToken}`
    );
    const accountData = await accountResponse.json();
    
    if (accountData.error) {
      throw new Error(accountData.error.message);
    }
    
    // Fetch account insights - need to use different endpoints for different metrics
    let insights = {
      reach: 0,
      accountsEngaged: 0,
      profileViews: 0,
      websiteClicks: 0,
    };
    
    // Try to get insights with time-based metrics (last 28 days - Instagram limit)
    try {
      // Get reach for last 28 days (Instagram's max period)
      const reachResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=reach&period=days_28&access_token=${accessToken}`
      );
      const reachData = await reachResponse.json();
      
      if (reachData.data?.[0]?.values?.[0]?.value) {
        insights.reach = reachData.data[0].values[0].value;
      }
      
      // Get accounts engaged
      const engagedResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=accounts_engaged&period=days_28&access_token=${accessToken}`
      );
      const engagedData = await engagedResponse.json();
      
      if (engagedData.data?.[0]?.values?.[0]?.value) {
        insights.accountsEngaged = engagedData.data[0].values[0].value;
      }
      
      // Get profile views (day period, sum last 7 days)
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const now = Math.floor(Date.now() / 1000);
      
      const profileResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=profile_views&period=day&since=${thirtyDaysAgo}&until=${now}&access_token=${accessToken}`
      );
      const profileData = await profileResponse.json();
      
      if (profileData.data?.[0]?.values) {
        insights.profileViews = profileData.data[0].values.reduce((sum, v) => sum + (v.value || 0), 0);
      }
      
      // Get website clicks
      const clicksResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=website_clicks&period=day&since=${thirtyDaysAgo}&until=${now}&access_token=${accessToken}`
      );
      const clicksData = await clicksResponse.json();
      
      if (clicksData.data?.[0]?.values) {
        insights.websiteClicks = clicksData.data[0].values.reduce((sum, v) => sum + (v.value || 0), 0);
      }
    } catch (insightErr) {
      console.log('Some insights not available:', insightErr.message);
    }
    
    // Try to get audience demographics
    let demographics = null;
    try {
      const demoMetrics = ['audience_city', 'audience_country', 'audience_gender_age'];
      const demoResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=${demoMetrics.join(',')}&period=lifetime&access_token=${accessToken}`
      );
      const demoData = await demoResponse.json();
      
      if (demoData.data) {
        demographics = {};
        demoData.data.forEach(metric => {
          if (metric.name === 'audience_city') {
            // Get top 5 cities
            const cities = Object.entries(metric.values?.[0]?.value || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([city, count]) => ({ city, count }));
            demographics.topCities = cities;
          } else if (metric.name === 'audience_country') {
            // Get top 5 countries
            const countries = Object.entries(metric.values?.[0]?.value || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([country, count]) => ({ country, count }));
            demographics.topCountries = countries;
          } else if (metric.name === 'audience_gender_age') {
            // Parse gender/age breakdown
            const genderAge = metric.values?.[0]?.value || {};
            let male = 0, female = 0;
            const ageGroups = {};
            
            Object.entries(genderAge).forEach(([key, value]) => {
              const [gender, age] = key.split('.');
              if (gender === 'M') male += value;
              if (gender === 'F') female += value;
              
              if (!ageGroups[age]) ageGroups[age] = 0;
              ageGroups[age] += value;
            });
            
            demographics.gender = { male, female };
            demographics.ageGroups = Object.entries(ageGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([age, count]) => ({ age, count }));
          }
        });
      }
    } catch (err) {
      console.log('Demographics not available:', err.message);
    }
    
    // Try to get online followers (best times to post)
    let onlineFollowers = null;
    try {
      const onlineResponse = await fetch(
        `${GRAPH_API_BASE}/${account.instagram_user_id}/insights?metric=online_followers&period=lifetime&access_token=${accessToken}`
      );
      const onlineData = await onlineResponse.json();
      
      if (onlineData.data?.[0]?.values?.[0]?.value) {
        const hourlyData = onlineData.data[0].values[0].value;
        onlineFollowers = Object.entries(hourlyData)
          .map(([hour, count]) => ({ hour: parseInt(hour), count }))
          .sort((a, b) => b.count - a.count);
      }
    } catch (err) {
      console.log('Online followers not available:', err.message);
    }
    
    return Response.json({
      success: true,
      account: {
        username: accountData.username,
        profilePicture: accountData.profile_picture_url,
        followers: accountData.followers_count,
        following: accountData.follows_count,
        posts: accountData.media_count,
        bio: accountData.biography,
      },
      insights: {
        reach: insights.reach || 0,
        accountsEngaged: insights.accountsEngaged || 0,
        profileViews: insights.profileViews || 0,
        websiteClicks: insights.websiteClicks || 0,
      },
      demographics,
      onlineFollowers,
    });
    
  } catch (error) {
    console.error('Account insights error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
