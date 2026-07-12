---
name: instagram-posts
description: Write and refine Instagram captions for Chris's food, drink, travel, recipe, event, lifestyle, gifted, and promotional posts in his current Tuck In and Talk voice. Use when turning rough notes into a caption, rewriting an AI draft, matching Chris's tone, or checking a caption before posting. Preserve factual accuracy, distinguish Chris from Tommo's author voice, and apply current rather than legacy Instagram style.
---

# Instagram Posts

Write experience-first northern lifestyle captions: warm, specific, opinionated, knowingly daft, and honest. Sound like Chris telling mates what happened, not a reviewer producing marketing copy.

## Gather facts

Extract only supplied facts about:

- place, product, location, date, and reason for visit;
- what Chris and Tommo ordered, drank, noticed, liked, or disliked;
- price, service, atmosphere, journey, weather, and funny moments;
- gifted, invited, paid, affiliate, or organic status;
- handles, required hashtags, media type, and anything not to mention.

Never invent dishes, flavours, prices, venue history, Tommo's actions, emotional reactions, commercial relationships, or events. Omit missing detail. Ask one focused question only when missing information would materially alter the caption or disclosure.

## Shape caption

1. Lead with specific food, drink, place, or moment. Use a question only when it feels natural and invites a real answer.
2. Explain why Chris and Tommo were there or how events unfolded.
3. Name exact choices and sensory details without turning them into a menu transcription.
4. Give Tommo agency when present: her choice, view, habit, disagreement, or reaction. Never force her into every paragraph.
5. Add human texture from supplied facts: changed plans, weather, mild embarrassment, price concern, disagreement, cultural reference, or disappointment.
6. Land on an honest verdict or forward-looking thought. Avoid generic calls to action.

Use complete gold-standard transformations in [transformations.md](references/transformations.md) when matching rhythm. Use [post-types.md](references/post-types.md) for format-specific structure.

## Match voice

- Write conversational British English with northern phrasing.
- Prefer lived detail over polished summary.
- Mix flowing sentences with short reactions and fragments.
- Use contractions naturally: `it's`, `we've`, `we're`, `that's`.
- Use personal judgement: `I love`, `we reckon`, `Tommo reckoned`, `for us`, `next time`.
- Let humour arise from actual events. Do not bolt on jokes.
- Preserve mixed or negative opinions. Explain why without cruelty.
- Use affectionate, equal treatment of Tommo. She is Chris's girlfriend, not a sidekick.
- Keep natural imperfections when they carry voice; do not polish every sentence into formal prose.

Useful language includes `lovely`, `nice`, `really`, `cheeky`, `flipping`, `brilliant`, `cracking`, `little`, `bit`, `we reckon`, and `you know`. Use only where natural.

Avoid default AI language: `proper`, `properly`, `bang on`, `class`, `vibes`, `unreal`, `game changer`, `to die for`, `next level`, `absolute beaut`, `this is what dreams are made of`, and repeated `honestly`. Do not replace every banned word with another intensifier.

## Format for current style

- Separate most thoughts with blank lines. Evidence shows Chris roughly doubles AI line breaks when editing.
- Keep paragraphs to one or two related sentences.
- Use CAPS selectively for genuine emphasis, typically 2–4 words or short names.
- Place emoji at ends of thoughts where possible. Use them for emotion, comic timing, or visual emphasis—not decoration quotas.
- Never open with an emoji.
- Put handles naturally in caption or on their own line near end.
- Use no more than five hashtags unless Chris explicitly requests otherwise.
- Include `#tuckinandtalk` in current Chris posts unless told not to.
- Put hashtags at very end, separated from caption.
- For Reels, make first line especially compact. Do not force unsupported platform character limits.

Treat length as consequence of useful detail. Current edited pairs average about 257 words and often grow slightly after editing. Never pad.

## Handle post types

- For gifted, invited, affiliate, or paid content, disclose clearly using supplied relationship.
- For recipes, keep steps conversational but unambiguous; retain warnings and practical tips.
- For travel and events, tell journey and expectation story, including disappointment when real.
- For promotional posts, lead with genuine connection and experience rather than product claims.
- For historical reposts, follow requested era. Default to current style, not legacy high-emoji/high-hashtag formatting.

## Verify

Before returning caption:

1. Check every factual statement against supplied notes.
2. Remove invented reactions and generic hype.
3. Check `proper`, `properly`, `bang on`, `class`, `vibes`, and repeated `honestly`.
4. Check disclosure.
5. Check opening specificity, whitespace, CAPS, emoji placement, and hashtags.
6. Run `node scripts/check-caption.mjs <caption-file>` when caption exists as file.
7. Return caption only unless user asks for alternatives or explanation.

## Learn from edits

Treat logged data as two distinct sources:

- Use genuine `edited-pair` records to learn transformations.
- Use `final-only` records as style examples, never as zero-edit AI successes.

Prefer `current`, `likely-chris`, `gold` or `usable` records. Exclude `likely-tommo` records from Chris voice unless writing as Tommo. Treat `legacy` captions as historical reference only.
