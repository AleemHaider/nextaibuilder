# AWS Security Group — Inbound Rules

**FIR-80** — Required inbound rules for the nextaibuilder EC2 instance.

> **Important:** Port 4000 (API) must NOT be open to the public internet.
> Nginx on the EC2 host terminates public traffic on 80/443 and proxies internally to the API process on 4000.
> In the Docker deployment model (current), the API container binds to port 4000 on the Docker bridge network and is proxied by the Nginx container on port 3000 — the host-level Security Group never needs to expose 4000 publicly.

## Inbound Rules

| Port | Protocol | Source         | Purpose                                        |
|------|----------|----------------|------------------------------------------------|
| 22   | TCP      | Your IP only   | SSH access — restrict to your static IP or VPN |
| 80   | TCP      | 0.0.0.0/0      | HTTP — Nginx redirects all traffic to HTTPS    |
| 443  | TCP      | 0.0.0.0/0      | HTTPS — Nginx terminates SSL, proxies to app   |
| 3000 | TCP      | 127.0.0.1/32   | Docker nginx — local-only; Apache reaches it via loopback |
| 4000 | TCP      | 127.0.0.1/32   | API container — internal only, never public    |

## Notes

- **Port 22:** Restrict to a known static IP or a bastion/VPN CIDR. Never open `0.0.0.0/0` for SSH.
- **Port 3000:** Should NOT be open to the world. Apache terminates TLS on 443 and reverse-proxies to Docker nginx via `127.0.0.1:3000`. See `infra/HTTPS-RUNBOOK.md` § 1 for the steps to revoke the public ingress.
- **Port 4000:** Listed here for documentation only. This port must remain closed in the Security Group. Nginx communicates with the API container over Docker's internal network, not via the public interface.
- **Egress:** Allow all outbound traffic (default AWS behaviour) — required for MongoDB Atlas, Stripe, SMTP, GHCR pulls, and package installs.

## How to apply in AWS Console

1. EC2 → Security Groups → Select the group attached to your instance
2. Inbound Rules → Edit inbound rules
3. Add each row from the table above
4. Save rules
