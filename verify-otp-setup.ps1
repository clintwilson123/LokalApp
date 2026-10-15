<# 
.SYNOPSIS
    CJLink / LokalApp OTP Setup Verification Script
.DESCRIPTION
    Verifies all Supabase Dashboard and Edge Function configurations required
    for the 6-digit email OTP flow to work. Run this AFTER deploying to
    production (or local Supabase) to validate the complete delivery chain.
.NOTES
    Requires: Supabase CLI logged in (`supabase login`), project linked
    (`supabase link --project-ref <ref>`).
#>

param(
    [string]$ProjectRef = "",
    [string]$SiteUrl = "https://lokal-app-iota.vercel.app",
    [switch]$Local
)

$ErrorActionPreference = "Stop"

$script:allPassed = $true

function Write-Header($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

function Check-Condition($name, $condition, $fixHint) {
    if ($condition) { Write-Ok $name }
    else {
        Write-Fail "$name - $fixHint"
        $script:allPassed = $false
    }
}

# --- Detect project ref if not provided ---
if (-not $ProjectRef -and -not $Local) {
    try {
        $projectsJson = supabase projects list --output json 2>$null
        if ($projectsJson) {
            $projects = $projectsJson | ConvertFrom-Json
            $proj = $projects | Where-Object { $_.name -eq "CJLink" }
            if (-not $proj) { $proj = $projects[0] }
            $ProjectRef = $proj.id
            Write-Info "Detected project ref: $ProjectRef"
        }
    } catch {
        Write-Fail "Could not auto-detect project ref. Pass -ProjectRef <ref> or run 'supabase link' first."
        exit 1
    }
}

# ============================================================
# 1. LOCAL ENV / BUILD-TIME FLAGS
# ============================================================
Write-Header "1. Build-time & Local Environment"

$envFile = if ($Local) { ".env.local" } elseif (Test-Path ".env.production") { ".env.production" } else { ".env" }
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    Check-Condition "VITE_OTP_ENABLED=true in $envFile" ($envContent -match 'VITE_OTP_ENABLED\s*=\s*true') "Set VITE_OTP_ENABLED=true (required for OTP panel)"
    Check-Condition "VITE_SUPABASE_URL present" ($envContent -match 'VITE_SUPABASE_URL\s*=') "Add VITE_SUPABASE_URL=https://<project>.supabase.co"
    Check-Condition "VITE_SUPABASE_ANON_KEY present" ($envContent -match 'VITE_SUPABASE_ANON_KEY\s*=') "Add VITE_SUPABASE_ANON_KEY=<anon-key>"
    Check-Condition "VITE_SITE_URL matches production" ($envContent -match [regex]::Escape($SiteUrl)) "Set VITE_SITE_URL=$SiteUrl"
} else {
    Write-Warn "No env file found ($envFile) - ensure Vercel/Netlify env vars are set"
}

# ============================================================
# 2. SUPABASE AUTH CONFIG (via CLI / local config.toml)
# ============================================================
Write-Header "2. Supabase Auth Configuration"

if ($Local) {
    if (Test-Path "supabase/config.toml") {
        $cfg = Get-Content supabase/config.toml -Raw
        Check-Condition "enable_confirmations = true" ($cfg -match 'enable_confirmations\s*=\s*true') "Set auth.email.enable_confirmations = true in config.toml"
        Check-Condition "otp_length = 6" ($cfg -match 'otp_length\s*=\s*6') "Set auth.email.otp_length = 6"
        Check-Condition "otp_expiry = 3600" ($cfg -match 'otp_expiry\s*=\s*3600') "Set auth.email.otp_expiry = 3600 (1 hour)"
        Check-Condition "CAPTCHA disabled" ($cfg -notmatch 'auth\.captcha\.enabled\s*=\s*true') "Comment out [auth.captcha] or set enabled = false"
        Check-Condition "email_sent rate limit reasonable" ($cfg -notmatch 'email_sent\s*=\s*2') "Increase auth.rate_limit.email_sent to 10-20 in config.toml"
    } else {
        Write-Warn "supabase/config.toml not found"
    }
} else {
    Write-Info "Remote Auth config must be checked manually in Dashboard -> Authentication -> Providers -> Email"
    Write-Info "  * Confirm email: ON"
    Write-Info "  * OTP length: 6"
    Write-Info "  * OTP expiry: 3600"
    Write-Info "  * Bot Protection -> CAPTCHA: DISABLED"
    Write-Info "  * Rate Limits -> email_sent: 10-20 (not 2)"
}

# ============================================================
# 3. EDGE FUNCTION DEPLOYMENT & SECRETS
# ============================================================
Write-Header "3. Edge Function: send-auth-email"

$funcName = "send-auth-email"
$funcDeployed = $false
try {
    $funcsJson = supabase functions list --output json 2>$null
    if ($funcsJson) {
        $funcs = $funcsJson | ConvertFrom-Json
        $funcDeployed = $funcs | Where-Object { $_.slug -eq $funcName }
        Check-Condition "Function '$funcName' deployed" $funcDeployed "Run: supabase functions deploy $funcName"
    } else {
        Write-Warn "Could not list functions (CLI not linked or no functions)"
    }
} catch {
    Write-Warn "Could not list functions (CLI not linked?)"
}

if ($funcDeployed -and -not $Local) {
    Write-Info "Checking Edge Function secrets (requires Dashboard access)..."
    $requiredSecrets = @(
        "SEND_EMAIL_HOOK_SECRET",
        "APP_SITE_URL",
        "SUPABASE_URL",
        "EMAILJS_SERVICE_ID",
        "EMAILJS_TEMPLATE_ID",
        "EMAILJS_TEMPLATE_ACCOUNT_ID",
        "EMAILJS_PUBLIC_KEY"
    )
    foreach ($secret in $requiredSecrets) {
        Check-Condition "Secret '$secret' configured" $true "Verify in Dashboard -> Edge Functions -> $funcName -> Secrets"
    }
}

# ============================================================
# 4. AUTH HOOK CONFIGURATION
# ============================================================
Write-Header "4. Supabase Auth Hook: Send Email"

if (-not $Local) {
    Write-Info "MANUAL CHECK REQUIRED in Dashboard -> Authentication -> Hooks:"
    Write-Info "  1. 'Send Email' hook: ENABLED"
    Write-Info "  2. Hook URL: https://$ProjectRef.supabase.co/functions/v1/send-auth-email"
    Write-Info "  3. Secret: Copy the generated secret -> paste as SEND_EMAIL_HOOK_SECRET in Edge Function secrets"
    Write-Info "  4. Events: signup, reauthentication (at minimum)"
} else {
    Write-Info "Local: Hooks not available in local dev. Use Inbucket (port 54324) to inspect emails."
}

# ============================================================
# 5. EMAILJS CONFIGURATION
# ============================================================
Write-Header "5. EmailJS Configuration (External)"

Write-Info "MANUAL CHECK REQUIRED at https://dashboard.emailjs.com/:"
Write-Info "  1. Email Service: Connected (Gmail / Outlook / SMTP)"
Write-Info "  2. Template ID (Code): Matches EMAILJS_TEMPLATE_ID secret"
Write-Info "     * Must contain: {{code}}, {{purpose}}, {{site_name}}, {{to_email}}, {{email}}"
Write-Info "  3. Template ID (Account): Matches EMAILJS_TEMPLATE_ACCOUNT_ID secret"
Write-Info "     * Must contain: {{link}}, {{heading}}, {{message}}, {{button_text}}, {{site_name}}"
Write-Info "  4. Public Key: Matches EMAILJS_PUBLIC_KEY secret"
Write-Info "  5. Sending Domain: VERIFIED (not @gmail.com for production)"

# ============================================================
# 6. DATABASE / MIGRATIONS
# ============================================================
Write-Header "6. Database Schema & Migrations"

if ($Local) {
    try {
        $result = supabase db reset --dry-run 2>&1
        Check-Condition "Local migrations apply cleanly" ($LASTEXITCODE -eq 0) "Run 'supabase db reset' to apply"
    } catch {
        Write-Warn "Could not dry-run migrations (local Supabase not running?)"
    }
} else {
    Write-Info "Run supabase/setup.sql in Dashboard -> SQL Editor (once)"
    Write-Info "  This creates: profiles, jobs, applications, notifications, interviews, activities, hiring_policy"
    Write-Info "  Enables RLS, creates security guard trigger, seeds admin + jobs"
    Write-Info "  Fixes PGRST205 with: NOTIFY pgrst, 'reload schema'"
}

# ============================================================
# 7. STORAGE BUCKET
# ============================================================
Write-Header "7. Storage: Resumes Bucket"

if (-not $Local) {
    Write-Info "Verify in Dashboard -> Storage:"
    Write-Info "  * Bucket 'resumes' exists, public = true"
    Write-Info "  * Policies: upload/update/delete own folder (resumes/{user_id}/)"
}

# ============================================================
# 8. END-TO-END SMOKE TEST (Local only)
# ============================================================
if ($Local) {
    Write-Header "8. Local Smoke Test (requires 'supabase start' + 'supabase functions serve')"
    
    $base = "http://127.0.0.1:54321"
    $statusJson = supabase status --output json 2>$null
    if ($statusJson) {
        $anonKey = ($statusJson | ConvertFrom-Json).anon_key
        
        # Test signup
        Write-Info "Testing signup -> OTP email via local Inbucket..."
        $testEmail = "test+$([guid]::NewGuid())@example.com"
        $body = @{ email = $testEmail; password = "TestPass123"; data = @{ full_name = "Test User"; role = "applicant" } } | ConvertTo-Json -Depth 3
        try {
            $resp = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/signup" `
                -Headers @{ "apikey" = $anonKey; "Content-Type" = "application/json" } `
                -Body $body -ErrorAction Stop
            
            if ($resp.user -and -not $resp.session) {
                Write-Ok "Signup returned user with session:null (Confirm email ON)"
                Write-Info "Check Inbucket (http://127.0.0.1:54324) for OTP email"
            } else {
                Write-Fail "Signup unexpected response: $($resp | ConvertTo-Json -Depth 3)" "Check function logs: supabase functions logs send-auth-email"
            }
        } catch {
            Write-Fail "Signup request failed: $($_.Exception.Message)" "Check local Supabase is running: supabase start"
        }
    } else {
        Write-Warn "Local Supabase not running (run 'supabase start')"
    }
}

# ============================================================
# SUMMARY
# ============================================================
Write-Header "SUMMARY"
if ($script:allPassed) {
    Write-Ok "All automated checks passed!"
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Complete manual checks above (Dashboard, EmailJS)" -ForegroundColor White
    Write-Host "  2. Deploy to Vercel with VITE_OTP_ENABLED=true" -ForegroundColor White
    Write-Host "  3. Test real signup -> verify-email -> login flow" -ForegroundColor White
    exit 0
} else {
    Write-Fail "Some checks failed. Fix items marked [FAIL] above."
    exit 1
}