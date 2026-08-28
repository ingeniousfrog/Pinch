# Pinch

Pinterest video → MP4. That's it.

**Documentation checked:** 2026-08-28

[Online demo](https://ingeniousfrog.github.io/Pinch/)

> The demo URL becomes available after GitHub Pages is enabled for this
> repository and the deployment workflow has completed.

Pinch is a tiny static web utility for one job: paste a public Pinterest video
Pin URL and get the best progressive MP4 Pinterest exposes. There are no
accounts, credentials, uploads, analytics, boards, profiles, images, or batch
scraping.

## Usage

1. Paste a direct public Pin URL such as
   `https://www.pinterest.com/pin/<numeric-id>/`.
2. Select **Get MP4**.
3. Preview the best progressive source Pinch found.
4. Follow the action Pinch shows:
   - **Download MP4** means the browser can read the original bytes and save a
     Blob without re-encoding.
   - **Open MP4** means Pinterest blocks file access from this origin. Open the
     original media and use the browser's save command.

Pinch never calls an open action a completed download.

## Supported URLs and media

Supported:

- public `pinterest.com/pin/<numeric-id>` URLs;
- ordinary subdomains such as `www.pinterest.com`;
- locale domains such as `pinterest.co.uk`;
- progressive MP4 sources from Pinterest's `v*.pinimg.com` video CDN;
- HLS detection with an explicit capability error when browser access is
  blocked.

Not supported:

- `pin.it` short links;
- private Pins, authentication, accounts, or cookies;
- boards, profiles, images, feeds, search, and bulk downloads;
- proxy configuration, arbitrary CORS proxies, or third-party download sites;
- DRM, access-control bypasses, or rate-limit evasion.

## How it works

```text
public Pin URL
  → validate and extract numeric Pin ID
  → fetch Pinterest's public widget JSON
  → recursively normalize supported video representations
  → reject non-Pinterest media URLs
  → deduplicate and rank MP4 before HLS
  → probe whether the selected media is browser-readable
  → download original MP4 bytes or open the opaque source honestly
```

The normal Pinterest Pin page contains useful embedded JSON, but does not grant
foreign origins access to its response body. The current static resolver uses
the public JSON endpoint behind Pinterest's widget mechanism. That endpoint
requires no login or secret, but is undocumented and may change, so it is
isolated behind `PinResolver` and covered by sanitized fixtures.

The extractor recognizes nested story-Pin media, `video_list`, `videoList`,
`videoUrls`, structured page JSON, and Open Graph video metadata. The UI only
receives normalized `PinVideo` and `VideoSource` objects.

## Privacy architecture

- Pin resolution runs from the browser directly against Pinterest.
- Pinch has no application server and stores no video.
- Progressive media bytes never pass through a Pinch service.
- No Pinterest login, cookie, or API credential is requested or stored.
- No analytics are included by default.
- The production build has no runtime npm dependencies.

## Current browser limitations

Browser checks established the following for public video Pins:

| Capability | Current result |
| --- | --- |
| Public widget JSON resolution | Works from a static origin with CORS |
| Progressive MP4 preview | Works as opaque cross-origin media |
| MP4 `fetch()` / Blob download | Blocked by Pinterest CDN CORS |
| Cross-origin `download` link | Opens media; does not emit a file download |
| HLS playlist and segment access | Blocked by Pinterest CDN CORS |
| Browser-side HLS → MP4 remux | Not technically reachable from GitHub Pages |

No Service Worker, `mode: "no-cors"`, or WebAssembly media library can make an
unreadable cross-origin response readable. Pinch therefore does not ship
`ffmpeg.wasm` or another inactive remux dependency.

## Local development

Requirements: Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Vite serves the development site at the URL printed in the terminal. Because
the production base is `/Pinch/`, local development also uses that path.

Verification commands:

```sh
npm test                 # deterministic fixture and DOM tests
npm run test:coverage    # enforced 80% thresholds
npm run typecheck
npm run build
npm run test:e2e         # Chrome live probes plus Firefox/WebKit app flows
npm run verify           # typecheck, coverage, production build
```

The live Playwright suite is intentionally separate from the default unit
tests because Pinterest's network behavior can change independently of Pinch.
Live Pin IDs and media URLs are not committed; set `PINCH_LIVE_PIN_ID`,
`PINCH_LIVE_PIN_MP4_URL`, and `PINCH_LIVE_PIN_HLS_URL` (and optional
`PINCH_LIVE_PIN_2_*`) locally. Without those variables, live probes are skipped.

## GitHub Pages deployment

The Vite production base is `/Pinch/`. A push to `main` runs
`.github/workflows/deploy-pages.yml`, verifies the project, builds `dist/`, and
deploys it with GitHub's official Pages actions.

For the first deployment:

1. Open the repository's **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run **Deploy GitHub Pages** manually from Actions.

The expected site URL is `https://ingeniousfrog.github.io/Pinch/`.

## Attribution

Pinch is a clean TypeScript implementation. The single-Pin behavior was
studied against Lim Kok Hole's MIT-licensed
[`pinterest-downloader`](https://github.com/limkokhole/pinterest-downloader),
particularly its handling of embedded Pin objects, `videos.video_list`, story
Pin blocks, and progressive quality selection. Its broad board/profile/image
downloader architecture was not ported.

## Disclaimer

Pinch is an independent technical utility and is not affiliated with,
endorsed by, or sponsored by Pinterest. Users are responsible for downloading
only content they own or have permission to use and for complying with
applicable terms and law.

MIT licensed. See [LICENSE](LICENSE).
