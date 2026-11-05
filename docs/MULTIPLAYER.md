# PLAYING AGAINST RAHUL

The plan for "someone challenges me and I get told about it", and what
has to happen before it can be built.

**Nothing of this is built yet.** Chess against the computer is done and
needs none of it. This is the online half.

---

## Why it needs anything at all

The site is static files on GitHub Pages. There is no server, so there is
nowhere for a challenge to *live* between the moment someone makes it and
the moment Rahul reads it, and nothing to tell him it happened.

Supabase is a hosted Postgres with realtime and auth attached. It is free
at this size, there is no server to run or patch, and the browser talks to
it directly — which keeps the site exactly as static as it is now.

---

## What it will do

1. A visitor opens chess and picks **Play Rahul**. They type a name.
2. A row appears in `challenges`. Rahul gets a notification.
3. He opens the link. The board is live for both of them — each move is a
   row the other is subscribed to.
4. If he is not around, it is still a game: moves are stored, so they can
   play it over two days with the page closed in between.

That last point is the important one. Building it as *correspondence first,
live if both happen to be there* means nobody ever loses a game to a closed
tab, and it is less machinery than a realtime-only design.

---

## What Rahul has to do

About twenty minutes, once. I cannot do these — they need an account.

### 1. Make the project

1. <https://supabase.com> → sign in with GitHub → **New project**.
2. Name it `jugnibishnoi`, pick the region nearest India
   (`ap-south-1`, Mumbai), let it generate a database password and save
   that in a password manager.
3. Wait for it to finish building, then go to **Project Settings → API**
   and copy two things:
   - the **Project URL**
   - the **anon / public** key

### 2. Give them to the site

Create `client/.env.local`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

That file is gitignored. For the deployed site the same two values go in
**GitHub → repo → Settings → Secrets and variables → Actions**, and the
workflow passes them to the build.

> **The anon key is meant to be public.** It ships in the JavaScript of
> every Supabase site; it is not a password. What protects the data is the
> row-level security below, which is why that part is not optional.
>
> The **service_role** key is a different thing and must never be in the
> client, in the repo, or in a screenshot.

### 3. Run the schema

Supabase → **SQL Editor** → paste and run:

```sql
-- A challenge, and the game it becomes.
create table games (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  guest_name  text not null check (char_length(guest_name) between 1 and 40),
  guest_key   uuid not null,              -- the challenger's secret, kept in their browser
  status      text not null default 'waiting'
              check (status in ('waiting','playing','done','declined')),
  fen         text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  guest_plays text not null default 'w' check (guest_plays in ('w','b')),
  last_move   text,
  updated_at  timestamptz not null default now()
);

create index games_status_idx on games (status, created_at desc);

alter table games enable row level security;

-- Anyone may read a game. There is nothing secret in a chess position,
-- and the guest needs to read it without an account.
create policy "games are public" on games for select using (true);

-- Anyone may issue a challenge, but only as a new, waiting game.
create policy "anyone may challenge" on games for insert
  with check (status = 'waiting');

-- A move may be made by whoever holds the guest key, or by a signed-in
-- user — which is only ever Rahul.
create policy "players may move" on games for update
  using (auth.uid() is not null or guest_key = (current_setting('request.headers', true)::json->>'x-guest-key')::uuid)
  with check (true);

-- Realtime for both sides.
alter publication supabase_realtime add table games;
```

### 4. Lock the door

**Authentication → Providers**: turn off every sign-in method except
GitHub, and under **Authentication → Policies / URL Configuration** set the
site URL to `https://rahulbishnoi2929.github.io`. Then sign in once
yourself so your user exists — that account is the only one that will ever
be able to play as Rahul.

### 5. Choose how you want to be told

Pick one and tell me which:

| | What it takes | What it feels like |
|---|---|---|
| **Telegram bot** | Message `@BotFather`, get a token, send yourself one message to learn your chat id | A phone notification in about a second. Easiest of the three and the one I would pick. |
| **Email** | A Resend or Postmark account and an API key | An email a minute or two later. Fine for correspondence, poor for "are you there now". |
| **Web push** | Nothing extra, but it only works on devices where you opened the site and said yes | Free, and silent whenever you last cleared your browser data. |

Whichever it is, the secret for it lives in a **Supabase Edge Function**,
not in the site — a token in client JavaScript is a token anyone can read
and use to send messages as you.

---

## Then I build

Once the URL and anon key exist:

1. `lib/online.js` — one module wrapping Supabase, which reports itself as
   unavailable when the keys are missing, so the site keeps working exactly
   as it does today for anyone who clones it without a project.
2. **Play Rahul** in the games room: name, challenge, a link to come back to.
3. A `/play/:id` route — the same board component, reading its position from
   the row and writing moves back, subscribed for the other side's.
4. An Edge Function on insert into `games` that sends the notification.
5. A small inbox for Rahul: who is waiting, accept or decline.

### What it will not do

- **No accounts for guests.** A name and a key in their own browser. Losing
  the link loses the game, which is the right trade for not asking a
  stranger to sign up to play one game of chess.
- **No rating, no history, no rematch chains.** Not until the first one
  works and somebody actually uses it.
- **No live cursor, no chat.** A chess move is enough of a message.

---

## The honest risk

This is the first thing on the site that can be used by someone who is not
Rahul, which means it is the first thing that can be abused: challenge
spam, forty games a minute, rude names. The mitigations are small and should
be in the first version rather than added after it happens — a rate limit
in the insert policy, a cap on waiting games per day, and a decline that
actually deletes.

It is also the first thing that can be *down*. Chess against the computer
must keep working when Supabase does not, which is why the keys being
absent is a supported state and not an error.
