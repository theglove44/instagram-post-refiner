/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure server-only env vars never leak to the client bundle
  serverRuntimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    instagramAppSecret: process.env.INSTAGRAM_APP_SECRET,
    tatCronSecret: process.env.TAT_CRON_SECRET,
  },
};

export default nextConfig;
