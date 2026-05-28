# OrionPlay

OrionPlay is a standalone Angular frontend for Jellyfin with a dark, cinematic browsing experience. It pairs a live TMDB-powered catalog with Jellyfin playback so the app always looks populated, while only titles that exist in the local library can actually be played.

## What is included

- Standalone Angular routing and components
- Jellyfin authentication flow
- TMDB catalog integration for trending, popular, top rated, new releases, genres, cast, trailers, and search
- Jellyfin library matching with playable and unavailable states
- Home page with featured banner, continue watching, trending, recently added, and categories
- Movie and TV browsing pages
- Favorites, watchlist, and email-based movie requests
- Search
- Media details page with resume playback support
- HLS playback via `hls.js`
- Keyboard shortcuts, fullscreen, and quality selection
- Runtime config generated from environment variables
- Vercel SPA routing rewrite support

## Project structure

```text
src/app/
  components/
  models/
  pages/
  services/
  shared/
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local env file from the example:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set your Jellyfin URL, TMDB read token, and movie request email settings:

   ```env
   JELLYFIN_SERVER_URL=https://media.example.com
   JELLYFIN_API_KEY=
   TMDB_API_READ_TOKEN=your_tmdb_read_access_token
   RESEND_API_KEY=your_resend_api_key
   REQUEST_EMAIL_TO=owner@example.com
   REQUEST_EMAIL_FROM=requests@example.com
   ```

`TMDB_API_READ_TOKEN` is the TMDB API Read Access Token from your TMDB account settings. Because OrionPlay is a browser app, use a read-only token here rather than a secret intended for a private server.

`RESEND_API_KEY` stays server-side and is only used by the Vercel function that sends request emails. `REQUEST_EMAIL_FROM` must be a sender address that Resend accepts for your account or verified domain.

4. Start locally:

   ```bash
   npm start
   ```

   Or use the explicit frontend command:

   ```bash
   npm run frontend
   ```

`npm start` and `npm run frontend` now start two local processes together:

- the Angular dev server
- the local `/api/request-movie` helper used for email requests

That means the `Request Movie` button works during normal Angular local development too.

If you run plain `ng serve`, the app still works as long as `src/assets/app-config.json` already contains valid values. Re-run `npm run generate:config` after changing env vars.

If you prefer two terminals instead of the combined dev script:

```bash
npm run frontend:api
npm run frontend:angular
```

The deployed app still uses the Vercel serverless function at `/api/request-movie`. Local Angular development proxies that same path to the local helper server through `proxy.conf.json`.

## Vercel deployment

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it into Vercel as an Other framework project.
3. Set the build command to `npm run build`.
4. Confirm the output directory is `dist/orionplay/browser`.
5. Add Vercel environment variables:

   - `JELLYFIN_SERVER_URL`
   - `JELLYFIN_API_KEY` (optional)
   - `JELLYFIN_CLIENT_NAME` (optional)
   - `JELLYFIN_DEVICE_NAME` (optional)
   - `JELLYFIN_DEVICE_ID` (optional)
   - `JELLYFIN_APP_VERSION` (optional)
   - `TMDB_API_READ_TOKEN`
   - `TMDB_API_BASE_URL` (optional)
   - `TMDB_IMAGE_BASE_URL` (optional)
   - `TMDB_LANGUAGE` (optional)
   - `TMDB_REGION` (optional)
   - `RESEND_API_KEY`
   - `REQUEST_EMAIL_TO`
   - `REQUEST_EMAIL_FROM`

6. Deploy.

`vercel.json` serves the Angular build from `dist/orionplay/browser` and rewrites client routes to `index.html`, so Angular refreshes continue to work without 404 errors while `/api/request-movie` stays available as a serverless endpoint.

## Email movie requests

- `Request Movie` appears only for unavailable movies that have a TMDB movie id.
- Playable titles never show the request button.
- Guest sessions can browse, but requesting prompts the guest to sign in with a full account first.
- Signed-in users send requests through `POST /api/request-movie`, which emails the site owner through Resend.
- The app prevents duplicate requests for the same movie during the current browser session.

## Connecting Vercel to Jellyfin securely

The deployed frontend needs Jellyfin to be reachable over HTTPS from the browser. The cleanest options are:

1. Put Jellyfin behind Cloudflare Tunnel, Caddy, Nginx Proxy Manager, or another reverse proxy.
2. Terminate TLS at the proxy and forward requests to your private Jellyfin instance.
3. Allow CORS for your Vercel frontend origin on the Jellyfin side or proxy layer.
4. Preserve HLS paths and headers. Do not strip `Authorization`, `X-Emby-Token`, `X-MediaBrowser-Token`, or query tokens from streaming requests.
5. Keep the server URL in `JELLYFIN_SERVER_URL` pointed at the public proxy hostname, not a local address like `http://localhost:8096`.

Example Cloudflare Tunnel flow:

- `orionplay.vercel.app` serves the Angular SPA.
- `media.example.com` points to a Cloudflare Tunnel or reverse proxy in front of Jellyfin.
- The Angular app sends auth, library, and playback requests directly to `https://media.example.com`.

## Jellyfin API examples

Authenticate:

```bash
curl -X POST "https://media.example.com/Users/AuthenticateByName" \
  -H 'Authorization: MediaBrowser Client="OrionPlay", Device="Browser", DeviceId="browser-01", Version="0.1.0"' \
  -H 'Content-Type: application/json' \
  -d '{"Username":"demo","Pw":"password"}'
```

Get movies:

```bash
curl "https://media.example.com/Users/USER_ID/Items?IncludeItemTypes=Movie&Recursive=true" \
  -H "X-MediaBrowser-Token: ACCESS_TOKEN"
```

Get continue watching:

```bash
curl "https://media.example.com/Users/USER_ID/Items/Resume?Limit=12" \
  -H "X-MediaBrowser-Token: ACCESS_TOKEN"
```

Stream HLS:

```text
https://media.example.com/Videos/ITEM_ID/master.m3u8?UserId=USER_ID&DeviceId=DEVICE_ID&api_key=ACCESS_TOKEN
```

## TMDB API examples

Trending movies:

```bash
curl --request GET \
  --url "https://api.themoviedb.org/3/trending/movie/week?language=en-US" \
  --header "Authorization: Bearer TMDB_READ_ACCESS_TOKEN"
```

Search:

```bash
curl --request GET \
  --url "https://api.themoviedb.org/3/search/multi?query=dune&language=en-US" \
  --header "Authorization: Bearer TMDB_READ_ACCESS_TOKEN"
```

Movie details with cast and trailers:

```bash
curl --request GET \
  --url "https://api.themoviedb.org/3/movie/693134?append_to_response=credits,videos,external_ids&language=en-US" \
  --header "Authorization: Bearer TMDB_READ_ACCESS_TOKEN"
```

## Frontend to Jellyfin communication

- `AuthService` signs users in through `/Users/AuthenticateByName` and stores the session token in web storage.
- `JellyfinApiService` builds authenticated REST requests against the configured Jellyfin base URL.
- `TmdbApiService` fills the catalog with posters, backdrops, descriptions, ratings, cast, trailers, and search results from TMDB.
- `JellyfinLibraryService` fetches the local library and matches TMDB entries against Jellyfin items by TMDB id, title, and release year.
- `MediaService` composes both sources into one catalog model so titles stay visible even when they are not locally available.
- `PlaybackStateService` requests playback info, constructs HLS playlist URLs, and syncs watch progress through the session playback endpoints.
- `VideoPlayerComponent` mounts `hls.js`, exposes quality switching, fullscreen, subtitles, and periodic progress reporting.

## Availability behavior

- Titles found in Jellyfin show `Play` or `Resume` and stream through Jellyfin.
- Titles that only exist in TMDB stay visible in the catalog but show `Not In Library`, `Add to Watchlist`, and, for movie titles with TMDB ids, `Request Movie`.
- `My List` combines Jellyfin favorites with saved watchlist titles.

## Notes

- This frontend does not hardcode localhost URLs.
- Runtime config is environment-driven for Vercel and local development.
- For best playback results, make sure your reverse proxy supports range requests and does not buffer HLS segments aggressively.
- TMDB data and images should be attributed according to TMDB's current terms when you ship publicly.
