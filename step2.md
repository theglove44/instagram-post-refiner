Replace single “Engagement %” with rate components + percentiles
Goal

Stop using one headline engagement % as the main truth. Show component rates (likes/comments/saves/shares per reach) and show how each post performs vs a baseline (percentiles).

Backend / Derived metrics

Create a derived metrics table (or materialized view) computed whenever you ingest metrics:

Rules:

If reach is NULL or 0, all “rate” metrics become NULL (not 0).

engagement_total should be NULL if all components are NULL; otherwise sum only present components.

Compute baseline distributions for percentiles.
Simplest implementation:

Baseline window: last 30 posts of the same media_type (fallback to last 30 overall if fewer than e.g. 10).

For each metric: gather baseline values where not NULL, compute percentile rank.

Percentile definition:

percentile = (#baseline_values <= post_value) / n * 100

If baseline n < 10, show “Insufficient data” and hide percentile.

Frontend / UI

For each post card:

Replace one “Engagement %” with a compact block:

ER (by reach)

Save rate

Share rate

Comment rate

(optional) Like rate

Next to each, show:

value

percentile badge: “P78” (if baseline sufficient)

At top-level summary:

Show medians (not averages) for each rate over last 28 days.

Show delta vs previous 28 days if you have history; otherwise omit.

Acceptance checks

Engagement is no longer a single large % that drives all decisions.

Rates are NULL-safe and don’t divide by zero.

Percentiles only appear when baseline sample size is adequate.