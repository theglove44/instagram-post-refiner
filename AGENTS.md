# Voice Workshop

Read `CLAUDE.md` — it is the single set of instructions for this repo and applies to any
agent, not just Claude Code. Everything that used to be duplicated here now lives there:
the live-actions warning, where things live, the constraints, the auth chain and the
testing loop.

Two rules that were only ever written here, kept so they aren't lost:

- Never commit private post data, local environment files, or generated files.
- Instagram, Supabase and OpenAI credentials stay out of committed code.

Don't add anything else to this file. New rules belong in `CLAUDE.md`, or the two will
drift apart again.
