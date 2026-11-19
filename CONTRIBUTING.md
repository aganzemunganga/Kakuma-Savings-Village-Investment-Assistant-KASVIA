# Contributing

1. Fork and create a branch.
2. The app is plain HTML/CSS/JS in `app/`, so there is no build step. Serve it with `python3 -m http.server 8080 --directory app`.
3. Add or update tests in `tests/` and run `npm test`.
4. If you change cached files, bump `CACHE_NAME` in `app/sw.js` and add new files to its `ASSETS` list.
5. Keep the offline promise: no CDN links, no external requests, no tracking.
6. Open a pull request describing the change and how you tested it.
