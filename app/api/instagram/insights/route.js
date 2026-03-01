import { getSupabaseClient } from '@/lib/supabase';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

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
    const userId = account.instagram_user_id;
    const baseUrl = `${GRAPH_API_BASE}/${userId}`;

    // Fetch all independent API calls in parallel
    const [
      accountResponse,
      reachResponse,
      engagedResponse,
      citiesResponse,
      countriesResponse,
      ageGenderResponse,
    ] = await Promise.allSettled([
      // Account info
      fetch(
        `${baseUrl}?fields=id,username,profile_picture_url,followers_count,follows_count,media_count,biography&access_token=${accessToken}`
      ),
      // Reach (last 28 days)
      fetch(
        `${baseUrl}/insights?metric=reach&period=days_28&access_token=${accessToken}`
      ),
      // Accounts engaged (last 28 days)
      fetch(
        `${baseUrl}/insights?metric=accounts_engaged&period=days_28&access_token=${accessToken}`
      ),
      // Demographics: cities (replaces deprecated audience_city)
      fetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=city&access_token=${accessToken}`
      ),
      // Demographics: countries (replaces deprecated audience_country)
      fetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=country&access_token=${accessToken}`
      ),
      // Demographics: age and gender (replaces deprecated audience_gender_age)
      fetch(
        `${baseUrl}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender&access_token=${accessToken}`
      ),
    ]);

    // Parse account info (required - throw if failed)
    if (accountResponse.status !== 'fulfilled') {
      throw new Error('Failed to fetch account info');
    }
    const accountData = await accountResponse.value.json();
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
        const reachData = await reachResponse.value.json();
        if (reachData.data?.[0]?.values?.[0]?.value) {
          insights.reach = reachData.data[0].values[0].value;
        }
      }
    } catch (err) {
      console.log('Reach insight not available:', err.message);
    }

    try {
      if (engagedResponse.status === 'fulfilled') {
        const engagedData = await engagedResponse.value.json();
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

        // Parse cities
        if (hasCities) {
          const citiesData = await citiesResponse.value.json();
          const cityResults = parseDemographicBreakdown(citiesData);
          if (cityResults.length > 0) {
            demographics.topCities = cityResults
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map(r => ({ city: r.dimensionValues[0], count: r.value }));
          }
        }

        // Parse countries
        if (hasCountries) {
          const countriesData = await countriesResponse.value.json();
          const countryResults = parseDemographicBreakdown(countriesData);
          if (countryResults.length > 0) {
            demographics.topCountries = countryResults
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map(r => ({ country: r.dimensionValues[0], count: r.value }));
          }
        }

        // Parse age and gender
        if (hasAgeGender) {
          const ageGenderData = await ageGenderResponse.value.json();
          const ageGenderResults = parseDemographicBreakdown(ageGenderData);

          if (ageGenderResults.length > 0) {
            let male = 0, female = 0;
            const ageGroups = {};

            ageGenderResults.forEach(result => {
              // dimension_values contains [age_range, gender] e.g. ["25-34", "M"]
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

        // If no demographic data was actually parsed, reset to null
        if (Object.keys(demographics).length === 0) {
          demographics = null;
        }
      }
    } catch (err) {
      console.log('Demographics not available:', err.message);
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
      },
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
