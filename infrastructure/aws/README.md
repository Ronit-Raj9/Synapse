# Synapse Vault — AWS deployment

Production hosting for the autonomous strategy runtime. Each vault gets
its own Fargate scheduled task that fires every N minutes, signs ticks
with the agent's session key (pulled at runtime from AWS Secrets
Manager), and emits real `TickRecordedEvent` events visible in the
dashboard's Runtime Health panel.

## Architecture

```
   EventBridge cron rule  (every 10 min)
            │
            ▼
   ECS Fargate scheduled task
            │
            ├─ pulls SYNAPSE_SESSION_KEY from Secrets Manager
            ├─ pulls MEMWAL_DELEGATE_KEY from Secrets Manager (optional)
            ├─ runs sdk/packages/vault/src/runtime/bin/run.ts --once
            │   ├─ reads vault state on chain (Sui RPC)
            │   ├─ fetches Pyth + DeepBookV3 market data
            │   ├─ recalls MemWal memory
            │   ├─ strategy.evaluate()
            │   ├─ if REBALANCE: builds + signs PTB, submits
            │   ├─ records performance, pays royalty
            │   └─ emits TickRecordedEvent on chain
            ▼
   CloudWatch Logs (/synapse/vault/<short-vault>)
```

One stack per vault. Multiple vaults = multiple stacks. State lives on
chain + Secrets Manager, the Fargate task is ephemeral.

## Prerequisites

- AWS account, AWS CLI authenticated (`aws configure`)
- `jq` (for the secrets push script)
- Node.js 22 + npm
- Docker daemon running (CDK builds the runtime image locally during
  `cdk deploy`)
- A funded session key for the vault you're deploying — download the
  `.key` file from the dashboard's Session Key Panel after a rotation

## One-time bootstrap (per AWS account/region)

```bash
cd infrastructure/aws
npm install
npx cdk bootstrap aws://<your-account-id>/<region>
```

Bootstrap creates the CDK toolkit stack (S3 bucket for assets, ECR repo
for images, IAM roles). You only do this once per account+region.

## Deploy a vault

1. **Rotate the session key** in the dashboard. Save the downloaded
   `synapse-session-<hash>.key` file somewhere local — say
   `~/keys/vault-80c12701.key`.

2. **(Optional) save the MemWal delegate hex** in a file, one line, no
   whitespace.

3. **Push secrets** to AWS Secrets Manager:

   ```bash
   ./scripts/push-secrets.sh \
     0x80c1270145b11a15838414326e6137ca406a367f91fc8b34d4b7f72533321209 \
     ~/keys/vault-80c12701.key \
     ~/keys/vault-80c12701.memwal     # optional
   ```

   The script prints the names of the secrets it created/updated.

4. **Deploy the stack**:

   ```bash
   npx cdk deploy \
     -c agentId=0x80c1270145b11a15838414326e6137ca406a367f91fc8b34d4b7f72533321209 \
     -c packageId=0x7b3f59e42edbf2189df644e63162d0b9a2c2984755bab9d3e9557c4ddd4aa67c \
     -c sessionSecretName=synapse/vault/80c12701/session-key \
     -c memwalSecretName=synapse/vault/80c12701/memwal-delegate \
     -c tickIntervalMinutes=10
   ```

   First deploy takes ~5 minutes (Docker build + ECR push + Fargate
   provisioning). Subsequent deploys are faster.

5. **Verify autonomy**: open the dashboard's Runtime Health panel. The
   status should flip from `Agent offline` to `Agent online · ticking on
   schedule` within ~12 minutes.

## Operations

| Task | Command |
|---|---|
| View runtime logs | `aws logs tail /synapse/vault/<short-vault> --follow` |
| Trigger a manual tick | `aws events put-events --entries '[{"Source":"local","DetailType":"manual"}]'` plus a target — or just delete + recreate the rule |
| Pause autonomy | Disable the EventBridge rule via console or `aws events disable-rule --name <rule>` |
| Rotate the session key | Rotate in dashboard → re-run `push-secrets.sh` with the new `.key` file — CDK stack picks up the new value on the next tick (no redeploy) |
| Destroy a stack | `npx cdk destroy SynapseVaultRuntime-<suffix>` |

## Cost estimate

Per vault, per month, at the default 10-minute tick interval:

- ECS Fargate: ~4,320 ticks × ~30s × 0.5 vCPU × 1 GB RAM ≈ **~$1.50/mo**
- CloudWatch Logs: ~30MB/mo ≈ **~$0.05/mo**
- Secrets Manager: 2 secrets × $0.40 ≈ **~$0.80/mo**
- EventBridge: free tier
- Data transfer: negligible (read-only outbound RPC calls)

Total: **~$2.50/mo per vault** at 10-minute cadence. Scales linearly —
60-minute cadence costs about $0.50/mo.

## Multi-vault deployments

Each `cdk deploy` invocation targets ONE vault, scoped by stack name
suffix (defaults to the vault ID prefix). To run two vaults:

```bash
# vault A
npx cdk deploy -c agentId=0xAAA… -c packageId=… -c sessionSecretName=… -c stackSuffix=alpha

# vault B
npx cdk deploy -c agentId=0xBBB… -c packageId=… -c sessionSecretName=… -c stackSuffix=beta
```

Both stacks live in the same AWS account and share the underlying ECR
repository — only the task definition, secrets, and EventBridge rule
differ.

## Troubleshooting

**`Agent stalled · 23m since last tick`** in the dashboard

Check the Fargate task logs:

```bash
aws logs tail /synapse/vault/<short-vault> --since 1h
```

Common causes:
- Session key out of gas — fund the session address with ~0.02 SUI
- Vault revoked — strategy aborts at `assert_can_act`; revocation is
  intentional behavior
- DeepBookV3 pool unhealthy / no liquidity for the trade size — swap
  reverts; tick records noop + emits the error in CloudWatch

**`Agent offline · no ticks`** in the dashboard

Confirm the EventBridge rule is enabled and the Fargate task definition
references the correct secret ARNs. If the Docker build failed during
`cdk deploy`, fix the build error (most often a workspace dep missing
in `Dockerfile`'s copy block) and re-deploy.

**Image build failures during `cdk deploy`**

CDK builds the Docker image locally before pushing to ECR. If
`docker build` fails, run it directly to debug:

```bash
docker build -f sdk/packages/vault/Dockerfile -t synapse-runtime-debug .
```

## Why ECS Fargate and not Lambda

We considered Lambda + EventBridge cron — cheaper at the per-invoke
level — but:

- Our runtime depends on `@mysten/walrus` which ships a WASM blob too
  large to fit comfortably in Lambda's deployment bundle limits
- The full tick (Pyth fetch + DeepBook fetch + strategy eval + PTB
  sign + submit + waitForTransaction) sits around 20–40 seconds; well
  within Lambda's 15-minute cap but uncomfortably tight on cold starts
- Fargate gives us first-class Docker semantics and easy local
  reproduction (same image runs on a developer laptop)

For production tightening, a future iteration could split the runtime
into a control-plane Lambda (scheduling, secrets fetch) plus a
data-plane container (the tick itself), but the per-vault economics
don't justify it yet.
