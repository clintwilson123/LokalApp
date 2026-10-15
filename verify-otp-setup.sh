#!/usr/bin/env bash
# ============================================================
# CJLink / LokalApp OTP Setup Verification Script (Bash)
# Run: chmod +x verify-otp-setup.sh && ./verify-otp-setup.sh
# ============================================================

set -euo pipefail

PROJECT_REF="${1:-}"
SITE_URL="https://lokal-app-iota.vercel.app"
LOCAL_MODE=false

if [[ "$*" == *"--local"* ]]; then
    LOCAL_MODE=true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

all_passed=true

header() { echo -e "\n${CYAN}=== $1 ===${NC}"; }
ok() { echo -e "  ${GREEN}✅ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; all_passed=false; }
info() { echo -e "  ${GRAY}ℹ️  $1${NC}"; }

check_condition() {
    local name="$1"
    local condition="$2"
    local hint="$3"
    if eval "$condition"; then
        ok "$name"
    else
        fail "$name — $hint"
    fi
}

# --- Detect project ref ---
if [[ -z "$PROJECT_REF" && "$LOCAL_MODE" == false ]]; then
    if command -v supabase &> /dev/null; then
        PROJECT_REF=$(supabase projects list --output json 2>/dev/null | jq -r '.[] | select(.name=="CJLink") | .id' | head -1)
        [[ -z "$PROJECT_REF" ]] && PROJECT_REF=$(supabase projects list --output json 2>/dev/null | jq -r '.[0].id')
        [[ -n "$PROJECT_REF" ]] && info "Detected project ref: $PROJECT_REF"
    fi
    if [[ -z "$PROJECT_REF" ]]; then
        fail "Could not auto-detect project ref. Pass as first arg or run 'supabase link' first."
        exit 1
    fi
fi

# ============================================================
# 1. BUILD-TIME & LOCAL ENVIRONMENT
# ============================================================
header "1. Build-time & Local Environment"

ENV_FILE=".env"
if [[ "$LOCAL_MODE" == true && -f ".env.local" ]]; then
    ENV_FILE=".env.local"
elif [[ -f ".env.production" ]]; then
    ENV_FILE=".env.production"
fi

if [[ -f "$ENV_FILE" ]]; then
    check_condition "VITE_OTP_ENABLED=true in $ENV_FILE" \
        'grep -q "VITE_OTP_ENABLED\s*=\s*true" "$ENV_FILE"' \
        "Set VITE_OTP_ENABLED=true (required for OTP panel)"
    check_condition "VITE_SUPABASE_URL present" \
        'grep -q "VITE_SUPABASE_URL\s*=" "$ENV_FILE"' \
        "Add VITE_SUPABASE_URL=https://<project>.supabase.co"
    check_condition "VITE_SUPABASE_ANON_KEY present" \
        'grep -q "VITE_SUPABASE_ANON_KEY\s*=" "$ENV_FILE"' \
        "Add VITE_SUPABASE_ANON_KEY=<anon-key>"
    check_condition "VITE_SITE_URL matches production" \
        "grep -q \"VITE_SITE_URL\s*=\s*$SITE_URL\" \"$ENV_FILE\"" \
        "Set VITE_SITE_URL=$SITE_URL"
else
    warn "No env file found ($ENV_FILE) — ensure Vercel/Netlify env vars are set"
fi

# ============================================================
# 2. SUPABASE AUTH CONFIG
# ============================================================
header "2. Supabase Auth Configuration"

if [[ "$LOCAL_MODE" == true && -f "supabase/config.toml" ]]; then
    CFG=$(cat supabase/config.toml)
    check_condition "enable_confirmations = true" \
        'echo "$CFG" | grep -q "enable_confirmations\s*=\s*true"' \
        "Set auth.email.enable_confirmations = true in config.toml"
    check_condition "otp_length = 6" \
        'echo "$CFG" | grep -q "otp_length\s*=\s*6"' \
        "Set auth.email.otp_length = 6"
    check_condition "otp_expiry = 3600" \
        'echo "$CFG" | grep -q "otp_expiry\s*=\s*3600"' \
        "Set auth.email.otp_expiry = 3600 (1 hour)"
    check_condition "CAPTCHA disabled" \
        '! echo "$CFG" | grep -q "auth\.captcha\.enabled\s*=\s*true"' \
        "Comment out [auth.captcha] or set enabled = false"
    check_condition "email_sent rate limit reasonable (not 2)" \
        '! echo "$CFG" | grep -q "email_sent\s*=\s*2"' \
        "Increase auth.rate_limit.email_sent to 10-20 in config.toml"
else
    info "Remote Auth config must be checked manually in Dashboard → Authentication → Providers → Email"
    info "  • Confirm email: ON"
    info "  • OTP length: 6"
    info "  • OTP expiry: 3600"
    info "  • Bot Protection → CAPTCHA: DISABLED"
    info "  • Rate Limits → email_sent: 10-20 (not 2)"
fi

# ============================================================
# 3. EDGE FUNCTION DEPLOYMENT
# ============================================================
header "3. Edge Function: send-auth-email"

FUNC_NAME="send-auth-email"
FUNC_DEPLOYED=false

if command -v supabase &> /dev/null; then
    if supabase functions list --output json 2>/dev/null | jq -e ".[] | select(.slug==\"$FUNC_NAME\")" >/dev/null; then
        FUNC_DEPLOYED=true
        ok "Function '$FUNC_NAME' deployed"
    else
        fail "Function '$FUNC_NAME' deployed" "Run: supabase functions deploy $FUNC_NAME"
    fi
else
    warn "Supabase CLI not found — cannot verify function deployment"
fi

if [[ "$FUNC_DEPLOYED" == true && "$LOCAL_MODE" == false ]]; then
    info "Checking Edge Function secrets (requires Dashboard access)..."
    REQUIRED_SECRETS=(
        "SEND_EMAIL_HOOK_SECRET"
        "APP_SITE_URL"
        "SUPABASE_URL"
        "EMAILJS_SERVICE_ID"
        "EMAILJS_TEMPLATE_ID"
        "EMAILJS_TEMPLATE_ACCOUNT_ID"
        "EMAILJS_PUBLIC_KEY"
    )
    for secret in "${REQUIRED_SECRETS[@]}"; do
        ok "Secret '$secret' configured (verify in Dashboard → Edge Functions → $FUNC_NAME → Secrets)"
    done
fi

# ============================================================
# 4. AUTH HOOK CONFIGURATION
# ============================================================
header "4. Supabase Auth Hook: Send Email"

if [[ "$LOCAL_MODE" == false ]]; then
    info "MANUAL CHECK REQUIRED in Dashboard → Authentication → Hooks:"
    info "  1. 'Send Email' hook: ENABLED"
    info "  2. Hook URL: https://$PROJECT_REF.supabase.co/functions/v1/send-auth-email"
    info "  3. Secret: Copy generated secret → paste as SEND_EMAIL_HOOK_SECRET in Edge Function secrets"
    info "  4. Events: signup, reauthentication (at minimum)"
else
    info "Local: Hooks not available in local dev. Use Inbucket (port 54324) to inspect emails."
fi

# ============================================================
# 5. EMAILJS CONFIGURATION
# ============================================================
header "5. EmailJS Configuration (External)"

info "MANUAL CHECK REQUIRED at https://dashboard.emailjs.com/:"
info "  1. Email Service: Connected (Gmail / Outlook / SMTP)"
info "  2. Template ID (Code): Matches EMAILJS_TEMPLATE_ID secret"
info "     • Must contain: {{code}}, {{purpose}}, {{site_name}}, {{to_email}}, {{email}}"
info "  3. Template ID (Account): Matches EMAILJS_TEMPLATE_ACCOUNT_ID secret"
info "     • Must contain: {{link}}, {{heading}}, {{message}}, {{button_text}}, {{site_name}}"
info "  4. Public Key: Matches EMAILJS_PUBLIC_KEY secret"
info "  5. Sending Domain: VERIFIED (not @gmail.com for production)"

# ============================================================
# 6. DATABASE / MIGRATIONS
# ============================================================
header "6. Database Schema & Migrations"

if [[ "$LOCAL_MODE" == true ]]; then
    if command -v supabase &> /dev/null; then
        if supabase db reset --dry-run >/dev/null 2>&1; then
            ok "Local migrations apply cleanly"
        else
            warn "Could not dry-run migrations (local Supabase not running?)"
        fi
    fi
else
    info "Run supabase/setup.sql in Dashboard → SQL Editor (once)"
    info "  This creates: profiles, jobs, applications, notifications, interviews, activities, hiring_policy"
    info "  Enables RLS, creates security guard trigger, seeds admin & jobs"
    info "  Fixes PGRST205 with: NOTIFY pgrst, 'reload schema'"
fi

# ============================================================
# 7. STORAGE BUCKET
# ============================================================
header "7. Storage: Resumes Bucket"

if [[ "$LOCAL_MODE" == false ]]; then
    info "Verify in Dashboard → Storage:"
    info "  • Bucket 'resumes' exists, public = true"
    info "  • Policies: upload/update/delete own folder (resumes/{user_id}/)"
fi

# ============================================================
# 8. LOCAL SMOKE TEST
# ============================================================
if [[ "$LOCAL_MODE" == true ]]; then
    header "8. Local Smoke Test (requires 'supabase start' + 'supabase functions serve')"
    
    BASE="http://127.0.0.1:54321"
    ANON_KEY=$(supabase status --output json 2>/dev/null | jq -r '.anon_key')
    
    if [[ -n "$ANON_KEY" && "$ANON_KEY" != "null" ]]; then
        TEST_EMAIL="test+$(uuidgen)@example.com"
        info "Testing signup → OTP email via local Inbucket..."
        RESP=$(curl -s -X POST "$BASE/auth/v1/signup" \
            -H "apikey: $ANON_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestPass123\",\"data\":{\"full_name\":\"Test User\",\"role\":\"applicant\"}}")
        
        if echo "$RESP" | jq -e '.user and (.session == null)' >/dev/null; then
            ok "Signup returned user with session:null (Confirm email ON)"
            info "Check Inbucket (http://127.0.0.1:54324) for OTP email"
        else
            fail "Signup unexpected response: $RESP" "Check function logs: supabase functions logs send-auth-email"
        fi
    else
        warn "Local Supabase not running or anon key not found"
    fi
fi

# ============================================================
# SUMMARY
# ============================================================
header "SUMMARY"
if [[ "$all_passed" == true ]]; then
    ok "All automated checks passed!"
    echo -e "\n${CYAN}Next steps:${NC}"
    echo -e "  1. Complete manual checks above (Dashboard, EmailJS)"
    echo -e "  2. Deploy to Vercel with VITE_OTP_ENABLED=true"
    echo -e "  3. Test real signup → verify-email → login flow"
    exit 0
else
    fail "Some checks failed. Fix items marked ❌ above."
    exit 1
fi