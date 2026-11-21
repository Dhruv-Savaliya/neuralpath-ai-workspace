# Free learning-resource APIs

NeuralPath's resource discovery uses public/free API access where available. No paid API is required for GitHub repository search or Apple Podcasts catalog search. YouTube's official Data API is optional: without its key, the app shows a normal YouTube search link instead of pretending to have ranked API results.

## Provider matrix

| Provider | Secret needed? | What NeuralPath displays | Limits / caveats |
| --- | --- | --- | --- |
| YouTube Data API v3 | Optional API key | Up to 6 embeddable video search results, titles, channels and thumbnails | Google quota applies. The search endpoint has a daily quota bucket; monitor it in Google Cloud Console. |
| Apple iTunes Search API | No | Podcast episode listings and publisher links; a native audio player only when the catalog supplies a direct episode audio URL | Apple catalog metadata does not guarantee a playable audio URL for every episode. |
| GitHub Search API | No for public repositories | Public repositories sorted by star count | Unauthenticated search is limited to 10 requests/minute; GitHub can also apply secondary limits. Stars are not a quality or safety guarantee. |

## 1. Enable YouTube results (optional)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project for NeuralPath.
3. Open **APIs & Services → Library** and enable **YouTube Data API v3**.
4. Open **APIs & Services → Credentials → Create credentials → API key**.
5. Restrict the key to **YouTube Data API v3**. Since the key is used by the server, do not expose it in a browser or any `NEXT_PUBLIC_*` variable. Apply suitable API restrictions and monitor quota.
6. In the Render dashboard, open the NeuralPath API service → **Environment** and add:
   - Key: `YOUTUBE_API_KEY`
   - Value: your new API key
7. Save the environment change and allow Render to redeploy/restart the API.
8. Sign in to NeuralPath → AI Tutor → **Discover learning resources**. Search for a topic such as `React hooks` or `Python machine learning`.

If you leave `YOUTUBE_API_KEY` blank, discovery remains usable and shows a direct YouTube search link. Ranked video results and thumbnails require the key.

## 2. Apple Podcasts and GitHub

No API key or environment variable is required for the current public catalog/search requests. They run from the API server, not from the browser. If one provider is unavailable or rate-limited, the other provider's results can still be shown.

## 3. How to use the feature

1. Sign in to NeuralPath.
2. Open **AI Tutor** in the dashboard.
3. Find **Discover learning resources**.
4. Enter a focused topic, e.g. `Next.js server actions`, `Python data structures`, or `React portfolio project`.
5. Review the three groups:
   - **Videos:** open the YouTube result to watch on YouTube.
   - **Audio:** open the podcast publisher page; use the audio player only when a direct episode file is supplied.
   - **Projects:** open the GitHub repository and read its README before cloning or running code.
6. Search a narrower topic if the results are broad.

## 4. Quality and safety checks

The API currently sorts YouTube by relevance and GitHub by stars. It does not claim that a result is the objectively best course or a fully audited repository. Before recommending a GitHub project to learners, check its README, license, recent commits, open issues, dependency health, and whether its setup instructions work. Never run unknown repository code without reviewing it.

## 5. Cost and secret handling

- These discovery integrations do not call a paid LLM.
- YouTube API quota is not the same thing as a paid subscription; Google may change quota policies and can require compliance review for quota extensions.
- GitHub and Apple public search are free to call within their policies and rate limits; they are not guaranteed unlimited.
- Render/Vercel hosting and NeuralPath's separate AI Tutor generation/embedding providers have their own plan limits and are not made free by this feature.
- Keep provider keys only in Render server environment variables. Never commit secrets to Git, add them to frontend variables, or paste them into chat.
- Do not scrape or download YouTube videos. This integration links to YouTube's own playback page.

## Official references

- [YouTube Data API overview and quota](https://developers.google.com/youtube/data/getting-started)
- [YouTube search.list reference](https://developers.google.com/youtube/v3/docs/search/list)
- [Apple iTunes Search API](https://performance-partners.apple.com/search-api)
- [GitHub REST API search rate limits](https://docs.github.com/en/rest/search/search)
- [GitHub REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
