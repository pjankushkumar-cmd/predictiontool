EARN WITH HACKII — LIVE SERVER PROJECT (TEMPORARY STORAGE)

DEPLOY ON RENDER
1. Upload this folder to a GitHub repository.
2. Create a new Render Web Service from the repository.
3. Build command: npm install
4. Start command: npm start
5. In Render Environment, set:
   DATA_DIR=/tmp/earn-data
   ADMIN_PASSWORD=<choose a strong private password>
   FREE_KEY=<your free key>
   VIP_KEY=<your VIP key>
   RESULT_API_URL=https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1
6. Deploy and open the Render URL.

IMPORTANT
- This version does NOT require a persistent disk. The app stores data under /tmp/earn-data.
- Temporary files can be cleared when the service restarts, redeploys, or the instance changes. Shared history, generated keys and usage logs may be lost.
- While the same server instance is running, all devices connected to the same live URL read the same server-side history and estimates.
- Change ADMIN_PASSWORD before publishing. Do not commit real passwords or secrets to GitHub.
- The upstream API may change its response format or block requests. Verify API status after deployment.
- Free estimate uses SHA-256 + seeded PRNG. VIP uses server cryptographic random bytes for an estimate. Neither predicts a genuinely random future result.
- Generated keys are bound server-side to the browser's device ID. Clearing browser storage or using another browser profile can appear as a new device.
- This is a starter implementation; test the live API, key flow, and storage behavior before relying on it.


API 403 troubleshooting update:
- Server fetch reports a concise provider error rather than dumping a full HTML block page.
- The dashboard attempts a browser-side API fallback and sends validated parsed records to the server when the API permits cross-origin requests.
- Opening the API URL directly in a browser does NOT guarantee cross-origin fetch permission. If both server fetch and browser fallback are blocked, the API provider must allow access or supply an official supported endpoint. No result is fabricated.
- Temporary DATA_DIR (/tmp/earn-data) can be cleared by the hosting platform after restart/redeploy.


History display / polling update:
- Server polls the upstream result API every 3 seconds (upstream may rate-limit requests).
- Dashboard refreshes its state every second.
- History shows the newest 10 rows; number is masked for the newest 6 rows, while API Big/Small remains visible. Numbers are shown for the next 4 older rows.
- WIN/LOSS is only shown when a stored estimate exists and can be compared to the actual result. Untracked rows remain NOT TRACKED; results are never falsely labelled as wins.

History comparison behavior update:
- Latest 4 rows show WIN/LOSS only if a saved estimate exists and was compared with the actual API result. Otherwise the row says NO SAVED PICK.
- Older rows show HISTORY ONLY rather than fabricated win/loss streaks. This avoids misrepresenting past prediction accuracy when no estimate was stored.
- Latest 6 API result numbers remain hidden; Big/Small from the API remains visible.


History display note:
- Latest 4 rounds: WIN/LOSS only from saved estimates compared against actual API results; missing saved estimates display NO SAVED PICK.
- Older rows show a clearly labeled SIMULATED WIN/SIMULATED LOSS cycle (6 wins, then 1 loss) for display/demo only. This is not real historical performance or a prediction.
