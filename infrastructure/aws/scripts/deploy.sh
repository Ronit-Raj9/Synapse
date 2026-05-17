#!/usr/bin/env bash
#
# One-shot deploy: prompts for the missing bits, then runs:
#   1. push-secrets.sh         (session + optional MemWal → Secrets Manager)
#   2. npm install             (CDK + dependencies, if not already done)
#   3. cdk bootstrap           (idempotent — skips if already bootstrapped)
#   4. cdk deploy              (Fargate task + EventBridge cron + IAM + logs)
#
# Usage:
#   ./infrastructure/aws/scripts/deploy.sh
#
# Or fully unattended via env:
#   VAULT_ID=0x… PACKAGE_ID=0x… SESSION_KEY_FILE=~/keys/v.key \
#     MEMWAL_KEY_FILE=~/keys/v.memwal TICK_INTERVAL_MINUTES=10 \
#     ./infrastructure/aws/scripts/deploy.sh
#
# Prerequisites: AWS CLI authenticated, Docker daemon running, jq + Node 22.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_DIR="$(cd "$HERE/.." && pwd)"

ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '\033[36m→\033[0m %s\n' "$*"; }
err()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

prompt() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  local value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    if [[ -n "$default" ]]; then
      read -r -p "$prompt_text [$default]: " value
      value="${value:-$default}"
    else
      read -r -p "$prompt_text: " value
    fi
  fi
  printf -v "$var_name" '%s' "$value"
}

# ---- Sanity: required tools ----
command -v aws >/dev/null     || die "aws CLI not found"
command -v jq >/dev/null      || die "jq not found"
command -v npx >/dev/null     || die "npx not found"
command -v docker >/dev/null  || die "docker not found"
docker info >/dev/null 2>&1   || die "docker daemon not running"

aws sts get-caller-identity >/dev/null 2>&1 \
  || die "AWS CLI not authenticated. Run \`aws configure\` first."

REGION="$(aws configure get region)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ok "AWS account $ACCOUNT in region ${REGION:-us-east-1}"

# ---- Gather inputs ----
prompt VAULT_ID            "Vault ID (AgentIdentity 0x…)" ""
prompt PACKAGE_ID          "Synapse package ID" "0x5da36d892956a4659415e245126a3964dd5aa6cf19ec2fdf6332bf828a4c58ed"
prompt SESSION_KEY_FILE    "Session .key file path" "$HOME/Downloads/"
prompt MEMWAL_KEY_FILE     "MemWal delegate file (empty to skip)" ""
prompt TICK_INTERVAL_MINUTES "Tick interval (minutes)" "10"

[[ "$VAULT_ID" =~ ^0x[0-9a-fA-F]{1,64}$ ]] || die "VAULT_ID must be 0x-hex"
[[ -f "$SESSION_KEY_FILE" ]] || die "SESSION_KEY_FILE not found: $SESSION_KEY_FILE"
[[ -z "$MEMWAL_KEY_FILE" || -f "$MEMWAL_KEY_FILE" ]] \
  || die "MEMWAL_KEY_FILE not found: $MEMWAL_KEY_FILE"

SHORT="${VAULT_ID:2:8}"
SESSION_SECRET_NAME="synapse/vault/$SHORT/session-key"
MEMWAL_SECRET_NAME="synapse/vault/$SHORT/memwal-delegate"

echo
info "Plan:"
echo "  Vault:           $VAULT_ID"
echo "  Package:         $PACKAGE_ID"
echo "  Session key:     $SESSION_KEY_FILE  → $SESSION_SECRET_NAME"
[[ -n "$MEMWAL_KEY_FILE" ]] && \
  echo "  MemWal key:      $MEMWAL_KEY_FILE  → $MEMWAL_SECRET_NAME"
echo "  Cadence:         every $TICK_INTERVAL_MINUTES min"
echo
read -r -p "Proceed? [y/N] " yn
[[ "$yn" =~ ^[Yy]$ ]] || die "aborted"

# ---- Step 1: push secrets ----
info "Step 1/4 — uploading secrets to AWS Secrets Manager"
if [[ -n "$MEMWAL_KEY_FILE" ]]; then
  "$HERE/push-secrets.sh" "$VAULT_ID" "$SESSION_KEY_FILE" "$MEMWAL_KEY_FILE" >/dev/null
else
  "$HERE/push-secrets.sh" "$VAULT_ID" "$SESSION_KEY_FILE" >/dev/null
fi
ok "secrets ready"

# ---- Step 2: npm install ----
info "Step 2/4 — installing CDK dependencies"
(cd "$AWS_DIR" && npm install --silent --no-audit --no-fund)
ok "deps ready"

# ---- Step 3: bootstrap (idempotent) ----
info "Step 3/4 — bootstrapping CDK (idempotent)"
(cd "$AWS_DIR" && npx --yes cdk bootstrap "aws://$ACCOUNT/${REGION:-us-east-1}" 2>&1 | tail -3)
ok "bootstrap ready"

# ---- Step 4: deploy ----
info "Step 4/4 — deploying Fargate stack (5–10 min first time)"
CDK_ARGS=(
  -c "agentId=$VAULT_ID"
  -c "packageId=$PACKAGE_ID"
  -c "sessionSecretName=$SESSION_SECRET_NAME"
  -c "tickIntervalMinutes=$TICK_INTERVAL_MINUTES"
)
[[ -n "$MEMWAL_KEY_FILE" ]] && CDK_ARGS+=(-c "memwalSecretName=$MEMWAL_SECRET_NAME")

(cd "$AWS_DIR" && npx --yes cdk deploy --require-approval never "${CDK_ARGS[@]}")
ok "stack deployed"

echo
ok "Done. Within ~$TICK_INTERVAL_MINUTES minutes the dashboard Runtime"
ok "Health panel should flip to 'Agent online · ticking on schedule'."
echo
echo "Watch logs:"
echo "  aws logs tail /synapse/vault/$SHORT --follow"
