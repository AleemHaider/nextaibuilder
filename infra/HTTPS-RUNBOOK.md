# HTTPS + Network Hardening Runbook

Current production architecture (EC2):

```
Internet ──443──▶ Apache (TLS terminator) ──http──▶ Docker nginx :3000 ──http──▶ API :4000
                                                                              ▶ static SPA
```

Apache holds the Let's Encrypt cert for `aleemhaider.com`. Docker nginx serves the SPA + reverse-proxies to the API container on the Docker bridge network.

This runbook closes the gaps the 2026-05-11 audit flagged:

1. Port 3000 is reachable from `0.0.0.0/0` in the security group — it should only be reachable from the Apache process on the same host.
2. The Docker nginx didn't emit HSTS / X-Frame-Options / Referrer-Policy. Fixed in `docker/nginx.conf`; redeploy to apply.
3. No documented Let's Encrypt renewal verification.

## 1 — Close port 3000 publicly

The audit recommendation is to drop the port-3000 ingress rule entirely. Apache binds to `0.0.0.0:443` and reaches Docker nginx via `127.0.0.1:3000`, which does not require the SG rule. To verify on the host:

```bash
ssh ubuntu@${EC2_HOST}
sudo netstat -tlnp | grep ':3000'
# Expected: tcp 0.0.0.0:3000 LISTEN <docker-proxy-pid>
```

Then remove the rule. With the AWS CLI configured locally:

```bash
# Find the security-group id
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[].Instances[].SecurityGroups[].GroupId" \
  --output text

SG_ID=sg-XXXX

# Inspect the current rule so you can re-add it if needed
aws ec2 describe-security-group-rules \
  --filter Name=group-id,Values=$SG_ID \
  --query "SecurityGroupRules[?FromPort==\`3000\`]"

# Revoke
aws ec2 revoke-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 3000 \
  --cidr 0.0.0.0/0
```

Verify externally:

```bash
curl -m 5 http://${EC2_HOST}:3000     # should hang or refuse
curl -m 5 https://aleemhaider.com     # should still serve the SPA
```

If the second curl fails, restore the rule immediately:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 3000 \
  --cidr 0.0.0.0/0
```

Update `infra/security-groups.md` to reflect the new posture once verified.

## 2 — Roll out the new docker/nginx.conf

The audit-driven update added HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy. These ship in the frontend container image — they apply after the next deploy. To confirm after the next `ci-cd.yml` deploy:

```bash
curl -sI https://aleemhaider.com | grep -iE 'strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'
```

All five headers should be present. If Apache strips any of them, the corresponding `Header always set` directive needs to be added on the Apache side too.

## 3 — Let's Encrypt renewal

The Apache layer holds the cert. Verify the renewal timer is healthy:

```bash
ssh ubuntu@${EC2_HOST}
sudo systemctl status certbot.timer
sudo certbot certificates
```

Expect: renewal scheduled, all certs valid for >30 days, RENEWAL line shows `Account: ...`, `Renew on: ...`.

If the timer is inactive:

```bash
sudo systemctl enable --now certbot.timer
```

Add a calendar reminder to run `sudo certbot renew --dry-run` on the first of every month — it's free insurance and the failure mode of a missed renewal is a hard outage with no graceful degradation.

## 4 — Health-check endpoint over HTTPS

The deploy workflow currently hits `http://${EC2_HOST}:4000/health`. Once port 3000 is closed, port 4000 may also be SG-blocked. If so, the health-check should go through Apache:

```yaml
# .github/workflows/ci-cd.yml + deploy.yml — health-check step
API_HEALTH="https://aleemhaider.com/api/health"
```

This requires the API to register a `/api/health` route (or use `/api/v1/health`). Verify the route exists before flipping the workflow.

## 5 — Rollback

All these steps are reversible:

- **SG rule**: re-add with `aws ec2 authorize-security-group-ingress` (snippet above).
- **nginx config**: `git revert <commit>` then redeploy.
- **Apache changes**: keep a copy of `/etc/apache2/sites-available/aleemhaider.com.conf` before editing (`cp ... .bak`).
- **Certbot**: `sudo certbot rollback` reverts the last certificate change.
