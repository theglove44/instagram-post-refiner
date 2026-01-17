Fix “Best Times to Post” + Hashtag ranking using sample gating + shrinkage
Goal

Stop overconfident “best hour/day” results driven by tiny sample sizes. Implement:

Minimum sample size gating

Shrinkage scoring so small-n buckets regress toward global mean

Display n clearly

For hashtags: require minimum n and show “lift vs baseline”, not “best” based on one post.

3A) Best Times to Post
Backend

Use engagement_rate_by_reach (or save_rate if you want “value”) as the bucket metric. Not raw interactions.

Create day/hour buckets over the last N posts (e.g. last 60 posts, or 90 days):

day_of_week (0–6)

hour_of_day (0–23)

metric_value = engagement_rate_by_reach

Sample gating:

Don’t label “best” unless n >= MIN_N (recommend MIN_N = 5).

Buckets with n < MIN_N should still render but greyed.

Shrinkage score:
Let:

global_mean = mean(metric_value) across all posts in window

bucket_mean = mean(metric_value) for bucket

n = bucket count

k = shrinkage constant (recommend 10)

Pick “best day” and “best hour” by score, not raw mean.

Pick “best day” and “best hour” by score, not raw mean.

Frontend

In “Top Posting Hours” list: show n posts prominently.

In “Best Day / Best Hour” cards: show both:

score-derived metric (e.g. “ER by reach: 4.2%”)

sample size: “n=7”

Add a simple day x hour heatmap (optional) with greyed low-n cells.

Acceptance checks

“Best hour” cannot be based on 1–2 posts.

UI always surfaces sample size.

Best times change only when enough evidence accumulates.

3B) Hashtag ranking
Backend

Extract hashtags per post into a join table if you don’t already:

Only rank hashtags with n >= MIN_TAG_N (recommend 5–10).

Compute performance for each hashtag using a lift vs baseline:

tag_mean = mean(engagement_rate_by_reach) for posts containing the tag (NULL-safe)

baseline_mean = mean(engagement_rate_by_reach) for posts of same media_type in same window (or same daypart bucket if you want)

raw lift = tag_mean - baseline_mean

Apply shrinkage to lift to avoid small-n noise:

lift_score = (n/(n+k))*raw_lift (k ~ 10)

Store:

n, tag_mean, baseline_mean, raw_lift, lift_score

Frontend

Replace “Best Performing Hashtags” with “Hashtags with positive lift (min n=5)”.

For each hashtag row show:

lift_score (primary)

n posts

tag_mean vs baseline_mean

For “Trending +400%”: show denominator (e.g. “1 → 5 uses”).

Acceptance checks

No hashtag appears in “best” lists when it appears in only 1–2 posts.

Hashtag rankings change when there’s real evidence (n grows).

Trending always shows the underlying counts.