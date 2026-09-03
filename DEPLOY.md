# Deploying

The site is a static build. `npm run build` produces `client/dist`, and
that is the whole thing — no server yet (see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §1 for when that changes).

## Why not just serve it on the wifi

Tried that first. `npm run preview -- --host` serves on the local network,
but **"Homys 5th Floor" has client isolation** — the router blocks
device-to-device traffic, so the phone cannot reach the laptop even on the
same network. Firewall rules are not the problem and changing them does not
help. Checked: the server listens on `0.0.0.0`, and Windows already allows
`C:\Program Files\nodejs\node.exe` inbound on the Public profile.

So on this network it has to be a real deploy.

## Option A — connect the GitHub repo (recommended)

Better than the CLI because every `git push` redeploys, with no command to
remember.

1. Go to **vercel.com/new**
2. Sign in with GitHub, and grant access to `rahulbishnoi2929/jugnibishnoi`
   — it is a private repo, so Vercel needs permission explicitly
3. Import it. Leave every build setting alone: `vercel.json` already sets
   the build command and output directory
4. Deploy

You get a permanent `https://…vercel.app` URL that works on any network,
including mobile data.

## Option B — from the CLI

The CLI is installed as a dev dependency, so there is nothing to download.

```bash
npm run deploy
```

First run opens a browser to log in — **that part is yours, not something
I can do for you.** It then asks a few setup questions; the defaults are
correct because of `vercel.json`.

`npm run deploy:preview` puts up a throwaway preview URL instead of
touching production.

## What vercel.json does

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Every route on this site is client-side. Without that rewrite, opening
`/c/soil` directly — a hard reload, or a link you sent someone — returns a
404, which is most of how anyone would actually reach a branch. Vercel
checks the filesystem before applying rewrites, so real files under
`/assets`, `/scenes`, `/textures` and `/photos` still serve normally.

The `headers` block caches hashed assets for a year. They are
content-hashed by Vite, so a new build produces new filenames and nothing
goes stale.

## Custom domain

Later, in the Vercel project settings. There is no domain yet — it is still
an open question in [docs/PRD.md](docs/PRD.md) §11.
