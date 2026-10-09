// Input sanitization utilities for CJLink

// Strip HTML tags and dangerous characters
export function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`;/\\]/g, "");
}

// Sanitize name (letters, spaces, hyphens, periods only)
export function sanitizeName(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[^a-zA-Z\s\-'.]/g, "");
}

// Sanitize phone number (digits, spaces, hyphens, plus only)
export function sanitizePhone(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[^0-9\s\-+()]/g, "");
}

// Sanitize location (alphanumeric, spaces, commas, periods only)
export function sanitizeLocation(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[^a-zA-Z0-9\s,.-]/g, "");
}

// Sanitize bio (allow letters, numbers, spaces, basic punctuation)
export function sanitizeBio(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[^a-zA-Z0-9\s,.\-!?']/g, "");
}

// Validate email format
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Gmail validation with risk assessment.
//
// VERIFICATION-LED POLICY: these rules decide FORMAT and a risk LEVEL only.
// No string-shape heuristic ever hard-blocks signup, because nothing here can
// tell whether the mailbox actually exists. Nonexistent addresses are
// separated from real ones by the Supabase confirmation link — no session, no
// profile, no protected features until the address proves it can receive mail.
export function validateGmail(email) {
  const invalidFormat = {
    valid: false, status: "Invalid", domainVerified: false, risk: "High",
    reason: "Please enter a valid email address.", recommendation: "Block Registration",
    code: "INVALID_FORMAT",
  };

  // Syntax is fine but the domain is not gmail.com/googlemail.com — a
  // different failed requirement, so it gets its own code and message.
  const gmailRequired = {
    valid: false, status: "Invalid", domainVerified: false, risk: "High",
    reason: "A Gmail address is required — CJLink signups use Gmail or Googlemail.",
    recommendation: "Block Registration",
    code: "GMAIL_REQUIRED",
  };

  if (typeof email !== "string") return invalidFormat;

  const lower = email.toLowerCase().trim();

  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return invalidFormat;

  const [localPart, domain] = lower.split("@");

  // Domain must be gmail.com or googlemail.com
  const validDomains = ["gmail.com", "googlemail.com"];
  if (!validDomains.includes(domain)) return gmailRequired;

  // Local part checks
  if (localPart.length < 6) return invalidFormat;
  if (localPart.length > 64) return invalidFormat;

  // Only valid characters: a-z, 0-9, dot
  if (!/^[a-z0-9.]+$/.test(localPart)) return invalidFormat;

  // No leading or trailing dots
  if (localPart.startsWith(".") || localPart.endsWith(".")) return invalidFormat;

  // No consecutive dots
  if (localPart.includes("..")) return invalidFormat;

  // Role-based accounts
  const roleAccounts = ["admin", "support", "info", "noreply", "no-reply", "help", "contact", "webmaster", "postmaster", "hostmaster", "abuse", "security", "billing", "sales", "marketing", "hr", "team", "office", "mail", "service"];
  if (roleAccounts.includes(localPart)) return invalidFormat;

  // Known test / spam patterns
  const blockedPatterns = ["test", "example", "demo", "sample", "fake", "spam", "temp", "throwaway", "trash", "disposable", "guerrilla", "mailinator", "yopmail", "tempmail", "10minutemail", "guerrillamail"];
  if (blockedPatterns.some((p) => localPart.startsWith(p))) return invalidFormat;

  // Risk analysis
  let riskScore = 0;
  const flags = [];
  const stripped = localPart.replace(/\./g, "");

  // Excessive numbers: if more than 50% of the username is digits
  const digitCount = (stripped.match(/[0-9]/g) || []).length;
  if (stripped.length > 0 && digitCount / stripped.length > 0.5) {
    riskScore += 1;
    flags.push("excessive_numbers");
  }

  // Random string detection: long sequences of alternating letters and numbers
  if (/[a-z]\d[a-z]\d[a-z]\d/.test(stripped)) {
    riskScore += 1;
    flags.push("random_pattern");
  }

  // Very long username (likely random)
  if (stripped.length > 20) {
    riskScore += 1;
    flags.push("long_username");
  }

  // All same character repeated (e.g., "aaaaaaa@gmail.com")
  if (stripped.length >= 6 && new Set(stripped.split("")).size === 1) {
    riskScore += 1;
    flags.push("repeated_chars");
  }

  // Low character diversity (e.g., "sadasdsadsadsadsa" — few unique chars vs length)
  if (stripped.length >= 10 && new Set(stripped.split("")).size / stripped.length < 0.35) {
    riskScore += 2;
    flags.push("low_diversity");
  }

  // Sequential characters (e.g., "abcdef@gmail.com" or "123456@gmail.com")
  const isSequential = (str) => {
    if (str.length < 5) return false;
    let asc = true, desc = true;
    for (let i = 1; i < str.length; i++) {
      if (str.charCodeAt(i) !== str.charCodeAt(i - 1) + 1) asc = false;
      if (str.charCodeAt(i) !== str.charCodeAt(i - 1) - 1) desc = false;
    }
    return asc || desc;
  };
  if (isSequential(stripped)) {
    riskScore += 1;
    flags.push("sequential_chars");
  }

  // Risk flags NEVER hard-block signup. An address whose local part looks
  // random (repeated characters, low diversity, long keyboard-smash strings)
  // may still belong to a real person, and this code has no way to know —
  // "fsafsdfsdfsdfsdfdssadsa@" and a genuine first-time user are
  // indistinguishable by string shape. Blocking such an address would reject
  // a legitimate signup while still letting a truly nonexistent one through,
  // so flags only raise the risk LEVEL: score >= 1 becomes risk "Medium" with
  // NEEDS_VERIFICATION, recorded on the profile as signup_risk_level for
  // audit/step-up. Actual rejection of nonexistent mailboxes happens when the
  // Supabase confirmation link cannot be completed.
  // MUST stay identical to the scoring in
  // supabase/functions/spam-prevention/index.ts (enforced by
  // src/test/riskRuleSync.test.js).

  let risk, recommendation;
  if (riskScore >= 1) {
    risk = "Medium";
    recommendation = "Require Additional Verification";
  } else {
    risk = "Low";
    recommendation = "Allow Registration";
  }

  // "format", never "address": risk scoring cannot validate a mailbox.
  const reason = flags.length > 0
    ? `Valid Gmail format. Risk indicators: ${flags.join(", ")}.`
    : "Valid Gmail format, no risk indicators detected.";

  return {
    valid: true,
    status: "Valid",
    domainVerified: true,
    risk,
    reason,
    recommendation,
    flags,
    code: riskScore >= 1 ? "NEEDS_VERIFICATION" : "OK",
  };
}

// Check password strength
export function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#ef4444" };
  if (score <= 3) return { score, label: "Medium", color: "#f59e0b" };
  return { score, label: "Strong", color: "#22c55e" };
}

// Limit string length
export function maxLength(str, max) {
  if (typeof str !== "string") return "";
  return str.slice(0, max);
}
