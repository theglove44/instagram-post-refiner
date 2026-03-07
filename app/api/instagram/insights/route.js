import { getSupabaseClient } from '@/lib/supabase';
import { graphFetch, GRAPH_API_BASE } from '@/lib/instagram';

const CACHE_MAX_AGE_HOURS = 24;

/**
 * Parse the follower_demographics response format.
 * Returns an array of { dimensionValues, value } from the breakdown results.
 */
function parseDemographicBreakdown(data) {
  if (!data?.data?.[0]?.total_value?.breakdowns?.[0]?.results) {
    return [];
  }
  return data.data[0].total_value.breakdowns[0].results.map(result => ({
    dimensionValues: result.dimension_values,
    value: result.value,
  }));
}

/**
 * Check cache for all insight types. Returns null if any are missing or stale.
 */
async function getCachedInsights(supabase, userId) {
  const { data: rows, error } = await supabase
    .from('account_insights_cache')
    .select('*')
    .eq('instagram_user_id', userId);

  if (error || !rows || rows.length === 0) {
    return null;
  }

  const requiredTypes = ['profile', 'reach_engaged', 'demographics'];
  const cacheMap = {};
  const now = Date.now();
  const maxAgeMs = CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;

  for (const row of rows) {
    const age = now - new Date(row.fetched_at).getTime();
    if (age > maxAgeMs) {
      return null; // At least one entry is stale
    }
    cacheMap[row.insight_type] = row.data;
  }

  // Check all required types are present
  for (const type of requiredTypes) {
    if (!cacheMap[type]) {
      return null;
    }
  }

  return cacheMap;
}

/**
 * Upsert a single cache entry.
 */
async function setCachedInsight(supabase, userId, type, data) {
  await supabase
    .from('account_insights_cache')
    .upsert(
      {
        instagram_user_id: userId,
        insight_type: type,
        data,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'instagram_user_id,insight_type' }
    );
}

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();

    // Check for ?refresh=true query param
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

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
    const userId = account.instagram_user_id;

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = await getCachedInsights(supabase, userId);
      if (cached) {
        console.log('Account insights served from cache');
        return Response.json({
          success: true,
          cached: true,
          account: cached.profile,
          insights: cached.reach_engaged,
          demographics: cached.demographics,
        });
      }
    }

    // Cache miss or force refresh — fetch from Meta
    const baseUrl = `${GRAPH_API_BASE}/${userId}`;

    const [
      accountResponse,
      reachResponse,
      engagedResponse,
      citiesResponse,
      countriesResponse,
      ageGenderResponse,
    ] = await Promise.allSettled([
      graphFetch(
        `${baseUrl}?fields=id,username,profile_picture_url,followers_count,follows_count,media_count,biography`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=reach&period=days_28`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=accounts_engaged&period=days_28`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=city`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=country`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender`,
        accessToken
      ),
    ]);

    // Parse account info (required - throw if failed)
    if (accountResponse.status !== 'fulfilled') {
      throw new Error('Failed to fetch account info');
    }
    const accountData = accountResponse.value;
    if (accountData.error) {
      throw new Error(accountData.error.message);
    }

    // Parse insights (optional - degrade gracefully)
    let insights = {
      reach: 0,
      accountsEngaged: 0,
    };

    try {
      if (reachResponse.status === 'fulfilled') {
        const reachData = reachResponse.value;
        if (reachData.data?.[0]?.values?.[0]?.value) {
          insights.reach = reachData.data[0].values[0].value;
        }
      }
    } catch (err) {
      console.log('Reach insight not available:', err.message);
    }

    try {
      if (engagedResponse.status === 'fulfilled') {
        const engagedData = engagedResponse.value;
        if (engagedData.data?.[0]?.values?.[0]?.value) {
          insights.accountsEngaged = engagedData.data[0].values[0].value;
        }
      }
    } catch (err) {
      console.log('Accounts engaged insight not available:', err.message);
    }

    // Parse demographics (optional - degrade gracefully)
    let demographics = null;
    try {
      const hasCities = citiesResponse.status === 'fulfilled';
      const hasCountries = countriesResponse.status === 'fulfilled';
      const hasAgeGender = ageGenderResponse.status === 'fulfilled';

      if (hasCities || hasCountries || hasAgeGender) {
        demographics = {};

        if (hasCities) {
          const citiesData = citiesResponse.value;
          const cityResults = parseDemographicBreakdown(citiesData);
          if (cityResults.length > 0) {
            demographics.topCities = cityResults
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map(r => ({ city: r.dimensionValues[0], count: r.value }));
          }
        }

        if (hasCountries) {
          const countriesData = countriesResponse.value;
          const countryResults = parseDemographicBreakdown(countriesData);
          if (countryResults.length > 0) {
            demographics.topCountries = countryResults
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map(r => ({ country: r.dimensionValues[0], count: r.value }));
          }
        }

        if (hasAgeGender) {
          const ageGenderData = ageGenderResponse.value;
          const ageGenderResults = parseDemographicBreakdown(ageGenderData);

          if (ageGenderResults.length > 0) {
            let male = 0, female = 0;
            const ageGroups = {};

            ageGenderResults.forEach(result => {
              const [age, gender] = result.dimensionValues;

              if (gender === 'M') male += result.value;
              if (gender === 'F') female += result.value;

              if (!ageGroups[age]) ageGroups[age] = 0;
              ageGroups[age] += result.value;
            });

            demographics.gender = { male, female };
            demographics.ageGroups = Object.entries(ageGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([age, count]) => ({ age, count }));
          }
        }

        if (Object.keys(demographics).length === 0) {
          demographics = null;
        }
      }
    } catch (err) {
      console.log('Demographics not available:', err.message);
    }

    // Build response objects matching the original format
    const profileData = {
      username: accountData.username,
      profilePicture: accountData.profile_picture_url,
      followers: accountData.followers_count,
      following: accountData.follows_count,
      posts: accountData.media_count,
      bio: accountData.biography,
    };

    const insightsData = {
      reach: insights.reach || 0,
      accountsEngaged: insights.accountsEngaged || 0,
    };

    // Write to cache (fire-and-forget, don't block the response)
    Promise.all([
      setCachedInsight(supabase, userId, 'profile', profileData),
      setCachedInsight(supabase, userId, 'reach_engaged', insightsData),
      setCachedInsight(supabase, userId, 'demographics', demographics),
    ]).catch(err => console.error('Failed to write insights cache:', err));

    return Response.json({
      success: true,
      cached: false,
      account: profileData,
      insights: insightsData,
      demographics,
    });

  } catch (error) {
    console.error('Account insights error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
