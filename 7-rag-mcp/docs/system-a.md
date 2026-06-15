# system-a — production runbook

Deeper technical documentation for system-a (Helix's real-time event-streaming
service, owned by Team Aurora).

## Deployment
system-a is deployed to production with `helmfile apply -e production`.
It runs **12 replicas** in production, behind an internal load balancer.

## Rollback
Run `helmfile destroy -e production`, then redeploy the previous chart version
from the release archive.

## On-call
Paged via the `#aurora-oncall` rotation. Sev-1 escalation SLA is 15 minutes.
