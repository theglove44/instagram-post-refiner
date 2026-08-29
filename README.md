# Voice Workshop

A private writing tool for Tuck In and Talk.

An AI writes a first draft of an Instagram caption. You rewrite it so it sounds like
you. The app keeps both versions side by side, so over time it builds a record of
exactly how your voice differs from the AI's — and the drafts get closer to right.

It does not post anything to Instagram. Michelle still does that by hand.

---

## The daily routine

1. Michelle puts the photos in Google Keep.
2. You open the **Workshop** page and add the topic, the photos and a few notes.
3. The app writes a draft caption.
4. You rewrite the draft until it sounds like you.
5. You press **Save pair**, then **Copy final for Keep**, and paste it into Google Keep.
6. Michelle posts it from the Instagram app.

That's the whole loop. Everything else in this guide is optional.

---

## Writing a caption

Open **Workshop** in the left-hand menu. It's the page you'll spend all your time on.

**Fill in the top three boxes.** Topic is the subject in a few words. Photos is what's
in the pictures. Notes is anything you want mentioned — a name, a place, a detail from
the day. The more you put here, the less rewriting you'll do later.

**Press Generate.** The draft appears in the box marked *AI-generated draft*. If you'd
rather write the draft elsewhere, you can paste one into that box instead.

**Press Start editing final.** This does two things: it locks the draft so it can't be
changed, and it copies it into the lower box for you to work on. The lock is the point
of the whole tool — the draft has to stay exactly as the AI wrote it, because comparing
it against your version is what the app is recording.

**Rewrite it in the lower box**, the one marked *Your final caption (what Michelle
posts)*. Change it however you like. Cut the bits that sound like a robot, add the bits
it missed, fix the rhythm. There's no wrong amount of editing — a caption you rewrite
completely is just as useful as one you barely touch.

**Press Save pair.** This is the button that stores your work. You'll see a
confirmation telling you how many edits you made.

**Then press Copy final for Keep.** That puts your version on the clipboard, ready to
paste into Google Keep for Michelle.

These really are two separate buttons, and **Copy final for Keep does not save
anything**. Save first, then copy. When you're ready for the next caption, press
**New post** to clear the page.

Once a pair is saved the draft can never be altered. If you spot a problem afterwards,
write a new one rather than trying to correct it — the saved pairs are the tool's
memory, and rewriting history would spoil it.

---

## Looking back at what you've written

The **History** page lists every caption you've saved, newest first.

Open any entry and you'll see the AI's draft and your version next to each other, with
the changes highlighted. The **Difference** view is the interesting one — it shows
precisely what you added, cut and reworded.

To find something specific:

- **Search** by any word in the caption.
- **Sort** by newest, oldest, most edited or least edited.
- **Filter by how much you changed** — Low (1–3 edits), Medium (4–7) or High (8+).

That last filter is worth knowing about. Filter to **High** and you're looking at the
captions the AI got most wrong. Filter to **Low** and you're looking at the ones it
nearly nailed. Both tell you something useful about which topics it handles well.

You can save the whole history with **Export as CSV** (opens in Excel or Numbers) or
**Export as JSON** (for feeding back into an AI tool). Worth doing occasionally as a
backup.

---

## Settings

**Hashtag library.** A place to keep your hashtag sets, grouped into categories with
notes about what each one is for. Paste in a set, give it a name, and copy it back out
when you need it.

**Connect Instagram.** Optional, and switched off by default. Connecting a Business or
Creator account would let the app pull in how your posts performed. It needs a Meta
developer account to set up — see [the technical reference](docs/technical-reference.md)
— so leave it alone unless you specifically want the performance figures.

**Sign out.** Bottom of the menu.

---

## What's switched off

The app has more built into it than you can see. Performance dashboards, scheduled
publishing, a comment inbox and a mentions tracker were all built, and the code still
works — but they're hidden from the menu because they're not part of how you actually
work day to day.

You won't stumble into them by accident. They're mentioned here only so you know the
app is bigger than its menu, and so nobody assumes the missing features were lost.

**If you ever turn publishing back on, understand what it does:** it posts to the real
Tuck In and Talk account, immediately, with no confirmation step and no undo. There is
no practice account. That's the main reason it stays off.

---

## When something goes wrong

**The draft won't generate.** Usually the connection to the AI service. Wait a minute
and press Generate again. If it keeps failing, the service is probably down — write the
caption from scratch this once and carry on.

**Copy final for Keep didn't seem to work.** It copies quietly. Paste into Keep and
check before pressing it a second time.

**A caption is missing from History.** Almost always because **Save pair** wasn't
pressed — copying the text to Keep doesn't save it. Closing the tab before saving loses
the work.

**Save pair is greyed out.** You haven't pressed **Start editing final** yet, or the
lower box is empty. Both have to be done before it will save.

**You can't sign in.** Sessions expire after a while. Sign in again from the login
page. If that fails too, the app itself may be down — that's one for whoever looks
after the server.

**Something looks broken or wrong.** Don't try to fix it by editing old entries. Note
what happened and raise it.

---

## For developers

- **[`docs/technical-reference.md`](docs/technical-reference.md)** — setup, environment
  variables, authentication, hosting, migrations, API surface, database schema,
  architecture decisions.
- **`CLAUDE.md`** — the rules and constraints an AI coding agent needs every session,
  including the testing loop.
- **`ROADMAP.md`** — what's planned next.

Quick start: `npm install`, fill in `.env.local`, `npm run dev`. Run `npm test` and
`npm run build` before committing.

---

## Licence

MIT. See [LICENSE](LICENSE).
