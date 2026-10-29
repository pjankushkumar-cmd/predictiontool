EARN WITH HACKII — LIVE SERVER PROJECT

This is not a single static HTML file. It includes a Node.js backend so result history,
estimates, generated keys, device binding and admin usage are shared by all visitors.

DEPLOY ON RENDER
1. Upload this folder to a GitHub repository.
2. Create a new Render Web Service from the repository.
3. Build command: npm install
4. Start command: npm start
5. Add a persistent disk mounted at /var/data (1 GB is enough to start).
6. Set environment variables:
   DATA_DIR=/var/data
   ADMIN_PASSWORD=<choose a strong private password>
   FREE_KEY=<your free key>
   VIP_KEY=<your VIP key>
   RESULT_API_URL=https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1
7. Deploy, then open the Render URL.

IMPORTANT
- Use a persistent disk or a managed database. Without persistent storage, history and keys can be lost on restart.
- Change the default admin password before publishing.
- The upstream API can change format or block server requests; check API STATUS after deployment.
- This app keeps a shared rolling history of up to 100 periods. Estimates are generated server-side and the same saved estimate is sent to every device for a given period.
- Free estimate uses SHA-256 + seeded PRNG. VIP uses server cryptographic random bytes for an estimate. Neither can predict a genuinely random outcome.
- One-device lock is enforced server-side for generated keys using a device ID stored by the browser. Browser storage clearing or a different browser profile can appear as a new device; for strong identity enforcement, use verified user accounts.
- Default FREE/VIP keys are shared keys; use admin-generated keys for per-key device binding.
- This project is a starter implementation; test the actual upstream API and configure production monitoring before relying on it.
