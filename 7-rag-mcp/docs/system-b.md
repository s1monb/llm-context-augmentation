# system-b — production runbook

Deeper technical documentation for system-b (Helix's distributed cache service,
owned by Team Borealis).

## Deployment
system-b is deployed to production with `helmfile apply -e production`.
It runs **6 replicas** in production.

## Cache warming
On cold start, run `sysb-admin warm --all` before routing traffic to the node.
