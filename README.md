# AppZed IT Helpdesk Agent

Triages common IT requests and resolves the routine ones from a built-in runbook. Anything outside the runbook escalates with a reason. Schema self-initializes.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/naelmohammad/appzed-it-helpdesk)

Click **Deploy to Cloudflare**: it clones this repo to your GitHub account, provisions the bindings below on your Cloudflare account, and wires CI/CD with preview URLs on every PR.

## Bindings (auto-provisioned)

```jsonc
{
  "name": "appzed-it-helpdesk",
  "ai": {
    "binding": "AI"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "appzed-it-helpdesk-meta"
    }
  ]
}
```

## Try it

```bash
curl -X POST https://<your-worker>.workers.dev/tickets \
  -H 'content-type: application/json' \
  -d '{"requester":"sara@example.com","subject":"locked out of email","detail":"too many attempts"}'

curl https://<your-worker>.workers.dev/escalations
```

GET /health for a liveness check. Managed by AppZed (https://dev.appzed.com/solutions/it-helpdesk).
