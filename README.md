# SSL Certificate Info for feedbackotn.duckdns.org

- Certificate path: `/etc/letsencrypt/live/feedbackotn.duckdns.org/fullchain.pem`
- Key path: `/etc/letsencrypt/live/feedbackotn.duckdns.org/privkey.pem`
- Expires: See Certbot output (auto-renews)
- Certbot will auto-renew and reload Nginx

If you ever need to renew manually:

```
sudo certbot renew
```

To test renewal:
```
sudo certbot renew --dry-run
``` 




clickup issue summarized
Summary of the whole debugging session
=======================================

Problem symptoms  
---------------  
1. PM2-managed process crashed on start with  
   `Error: better_sqlite3.node was compiled against NODE_MODULE_VERSION 115, this Node requires 127`.  
2. Directly running `node index.js` worked.  
3. Form submissions returned HTTP 500 and nothing showed up in ClickUp.

Root causes  
-----------  
A. **Node/PATH mismatch**  
   * The droplet had two Node versions:  
     • Node 22 (system-wide, ABI 127)  
     • Node 20 (nvm)  
   * `npm install` compiled better-sqlite3 under the Node present in the interactive shell (Node 22 at first, later Node 20).  
   * The PM2 daemon was started earlier with the *system* Node 22 and kept launching the app with that Node even after you switched shells.  
   * Result: binary built for ABI 115 (Node 20) was being loaded by Node 22 → crash.

B. **Multiple PM2 binaries/daemons**  
   * Old PM2 (6.0.8) installed in `/usr/bin` and `/bin`, new PM2 (6.3.x) under nvm.  
   * The old CLI kept starting a second daemon under Node 22, so even after fixing one copy another kept crashing and spamming logs.

Fixes applied  
-------------  
1. **Upgraded droplet to 2 GB RAM** (compile no longer OOM-kills).  
2. **Installed Node 20 with nvm** and set it as default (`nvm alias default 20`).  
3. **Re-installed PM2 (6.3.x) globally under Node 20**.  
4. **Removed all legacy PM2 binaries** (`/usr/bin/pm2`, `/bin/pm2`).  
5. **Added explicit interpreter path** in `ecosystem.config.js`  
   ```js
   interpreter: '/root/.nvm/versions/node/v20.19.3/bin/node',
   ```  
   so PM2 always launches with Node 20.  
6. **Clean install of dependencies** (`rm -rf node_modules && npm ci`) which downloaded the pre-built `better-sqlite3.node` for ABI 115.  
7. **Flushed logs and deleted stale “errored” PM2 entries** so only one healthy process remained.  
8. **Saved & systemd-enabled PM2** (`pm2 save` + `pm2 startup systemd`) so reboots keep the correct Node/PM2 combo.  
9. Confirmed the API works (`curl /api/classes`) and logs stay clean.  
   The earlier 500s were due to the crash; once the binary mismatch was fixed the server responded 200.

Key take-aways / best practice  
------------------------------  
1. Native addons (`better-sqlite3`) must be compiled with the exact Node major version that will run them.  
2. With nvm, always install global tools (PM2, npm runtimes) **inside** the active nvm session or set an explicit interpreter path.  
3. Remove any legacy Node or PM2 binaries that can shadow the nvm ones.  
4. Use `pm2 show <app> | grep interpreter` to verify which Node the daemon is actually using.  
5. After every change run `pm2 save` and `pm2 startup systemd` so the correct config survives reboots.

Current state  
-------------  
• PM2 daemon: `/root/.nvm/versions/node/v20.19.3/bin/node`, PM2 6.3.x  
• App process: online, no `NODE_MODULE_VERSION` errors  
• API responds (e.g. `/api/classes` returns JSON)  
• Logs are empty of errors after `pm2 flush`  
• Droplet has 2 GB RAM, Node 20 is default (`nvm alias default 20`)

Remaining todo (optional)  
-------------------------  
• Add a real `/health` route for uptime checks.  
• Keep weekly `CLICKUP_LIST_ID` up-to-date via `pm2 restart orientation-hub --update-env`.