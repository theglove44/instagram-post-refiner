# Product pivot: SaaS CMS → personal Voice Workshop

## Trigger

Chris reported the Instagram tool is bloated and unused for metrics/publish. Real workflow:

1. Google Keep — photos  
2. Claude / ChatGPT — notes → AI caption  
3. This app — paste AI, manual tweaks, save pair  
4. Google Keep — paste final caption  
5. Michelle — posts from Keep in the Instagram app  

## Decision

Gut the product surface to a **tone-of-voice workshop**. Keep code for publish/metrics cold (not deleted). Keep stays in Michelle's handoff loop.

## Phase 0 changes

- Nav: Workshop, History, Settings only  
- `/edit` rewritten as Voice Workshop with notes zone + Copy final for Keep  
- History promotes Copy for Keep; detail de-emphasises Instagram linking/publish  
- Roadmap rewritten around voice, not SaaS  

## Next

Phase 1: in-app caption generate using existing skill + training pairs so Claude drops out of the daily loop.
