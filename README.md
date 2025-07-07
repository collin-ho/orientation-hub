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