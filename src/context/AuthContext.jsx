import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { oauthRedirectTo } from "../lib/oauth";
import {
  writePendingSignup,
  readPendingSignup,
  clearPendingSignup,
} from "../lib/pendingVerification";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetching = useRef(false);

  /**
   * profiles.email_verified is a mirror of auth.users.email_confirmed_at and
   * nothing else. sync_email_verified() is the existing SECURITY DEFINER RPC
   * that reads the source of truth for auth.uid() and writes the mirror for
   * auth.uid(); callers never touch auth.users and never get to claim
   * verification on their own — profiles_security_guard enforces that too.
   *
   * The direct UPDATE is only a fallback so a missing GRANT on the RPC can
   * never strand a user whose email really is confirmed.
   */
  async function syncEmailVerified(userId) {
    try {
      const { data, error } = await supabase.rpc("sync_email_verified");
      if (!error) return data === true;
    } catch {
      // fall through to the direct update
    }
    const { error } = await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", userId);
    return !error;
  }

  async function loadProfile(userId) {
    if (fetching.current) return;
    fetching.current = true;
    // Hold the app in `loading` for the whole fetch so ProtectedRoute and the
    // pages never redirect on a half-resolved profile.
    setLoading(true);

    try {
      for (let retry = 0; retry < 3; retry++) {
        const { data: profileData } = await supabase.rpc("get_my_profile");

        if (profileData) {
          // Sync email verification status from auth.users
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.email_confirmed_at && !profileData.email_verified) {
            await syncEmailVerified(userId);
            profileData.email_verified = true;
          }
          setProfile(profileData);
          setLoading(false);
          return;
        }

        // Fallback: direct query (works with RLS disabled)
        const { data: direct } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (direct) {
          // Sync email verification status
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.email_confirmed_at && !direct.email_verified) {
            await syncEmailVerified(userId);
            direct.email_verified = true;
          }
          setProfile(direct);
          setLoading(false);
          return;
        }

        // Last fallback: try getting just the role
        const { data: role } = await supabase.rpc("get_my_role");
        if (role) {
          setProfile({ id: userId, role, full_name: "User" });
          setLoading(false);
          return;
        }

        if (retry < 2) await new Promise((r) => setTimeout(r, 600));
      }
      setProfile(null);
      setLoading(false);
    } catch {
      setProfile(null);
      setLoading(false);
    } finally {
      fetching.current = false;
    }
  }

  /**
   * Create the profile row for a signup that had to be deferred.
   *
   * With Confirm email enabled, signUp() hands back no session, so the
   * "Allow insert during signup" policy (auth.uid() = id) has nothing to
   * match against and the insert cannot run yet. The confirmation link is
   * what produces the session — by then RLS allows exactly this row, and no
   * other. Returns true when the row now exists.
   *
   * Never throws: it runs inside onAuthStateChange, where an exception would
   * break every auth notification.
   */
  async function ensureProfile(user) {
    const pending = readPendingSignup();
    if (!pending || !user?.id) return false;

    const userEmail = (user.email || "").toLowerCase();
    if (userEmail && userEmail !== String(pending.email).toLowerCase()) {
      // A different signed-in user — never adopt this pending signup.
      return false;
    }

    try {
      const meta = user.user_metadata || {};
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: String(meta.full_name || "").slice(0, 100),
        // profiles_security_guard rewrites this to "applicant" for any
        // non-admin caller, so metadata can never mint an admin.
        role: meta.role || "applicant",
        status: "active",
        email_verified: false,
        consent_accepted: true,
        consent_accepted_at: new Date().toISOString(),
        signup_risk_level: pending.riskLevel || "low",
      });

      // 23505 = already created (another tab confirmed first). Anything else
      // is left alone: the marker is kept so a retry is still possible.
      if (insertError && insertError.code !== "23505") return false;

      clearPendingSignup();
      if (!insertError) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          message: `Welcome to CJLink! Please verify your email to access all features.`,
          type: "info",
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Re-read the session from storage — used after the confirmation link
   *  lands in another tab, so this one can pick it straight back up. */
  async function refreshSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      setUser(session.user);
      await ensureProfile(session.user);
      await ensureOAuthProfile(session.user);
      await loadProfile(session.user.id);
      return session.user;
    } catch {
      return null;
    }
  }

  /**
   * Create the profile row for a Google (OAuth) sign-in, if it is missing.
   *
   * Google already proved the address, so Supabase Auth hands back a session
   * with email_confirmed_at set — but nothing has written a profiles row yet
   * (the deferred-signup marker only exists for the email+password flow).
   * Without this, ProtectedRoute would bounce every new Google user to "/"
   * because there is no readable profile.
   *
   * Hard rules, all enforced here and again by the DB:
   *   * NEVER creates a row that already exists (23505 is treated as success)
   *     and NEVER touches role/consent on an existing row — an existing Admin
   *     keeps the role the database already recorded, and only that role can
   *     ever reach /admin.
   *   * A brand-new Google user is ALWAYS "applicant". OAuth metadata can
   *     never mint an admin (profiles_security_guard rewrites it anyway).
   *   * consent_accepted starts false: a Google signup never saw the consent
   *     checkbox, so the existing /consent screen still has to collect it.
   *
   * Returns true when a profile row is readable afterwards.
   */
  async function ensureOAuthProfile(user) {
    if (!user?.id) return false;
    const provider = user.app_metadata?.provider;
    // Only OAuth identities. The email+password flow keeps its own marker path.
    if (!provider || provider === "email") return false;

    try {
      const meta = user.user_metadata || {};
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: String(meta.full_name || meta.name || "").slice(0, 100),
        role: "applicant",
        status: "active",
        email_verified: true,
        consent_accepted: false,
        signup_risk_level: "low",
      });

      // 23505 = already created (another tab, or a returning Google user).
      // Anything else is left alone so a later loadProfile retry can recover.
      if (insertError && insertError.code !== "23505") return false;
      return true;
    } catch {
      return false;
    }
  }

  async function handleSession(session) {
    if (session?.user) {
      setUser(session.user);
      // Runs before loadProfile so a deferred signup has its profile row by
      // the time loadProfile reads it.
      await ensureProfile(session.user);
      await ensureOAuthProfile(session.user);
      loadProfile(session.user.id);
    } else {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => listener?.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signUp(email, password, fullName, role, riskLevel = "low", captchaToken = "") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        // Single-use Turnstile token. Supabase Auth is the sole verifier:
        // passing it anywhere else (Edge Functions, the DB) would consume it
        // and make GoTrue reject the signup as a replay.
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) throw error;

    if (data.user) {
      if (data.session) {
        // Confirmations are off: the session exists, so the profile row can
        // be written straight away.
        const { error: insertError } = await supabase.from("profiles").insert({
          id: data.user.id,
          full_name: fullName,
          role,
          status: "active",
          email_verified: false,
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
          signup_risk_level: riskLevel,
        });
        if (insertError) {
          // The auth user already exists at this point. Remove it so a failed
          // profile insert never leaves an orphaned/inconsistent account.
          try {
            await supabase.functions.invoke("cleanup-unverified-signup", {
              body: { email },
            });
          } catch {
            // best-effort cleanup only
          }
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
          throw insertError;
        }

        await supabase.from("notifications").insert({
          user_id: data.user.id,
          message: `Welcome to CJLink! Please verify your email to access all features.`,
          type: "info",
        });
      } else {
        // Confirm email is enabled: no session, so RLS cannot match
        // auth.uid() = id yet. Nothing has failed — the row is created as
        // soon as the confirmation link issues a session. The account is
        // never rolled back here. Keyed on the address the user submitted so
        // a mismatched signed-in user can never claim this signup.
        writePendingSignup(email, riskLevel);
      }
    }

    return data;
  }


  async function signIn(email, password, captchaToken = "") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      // /token (password grant) is captcha-protected once the Dashboard
      // toggle is on, so the login screen supplies a token too.
      options: captchaToken ? { captchaToken } : {},
    });
    if (error) throw error;

    // Check suspension and email verification BEFORE setting session
    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("status, role, email_verified")
      .eq("id", data.user.id)
      .single();

    // Surface a missing/unavailable profiles table instead of silently
    // falling back to role "applicant", which would hide admin accounts.
    if (profileErr?.code === "PGRST205") {
      await supabase.auth.signOut();
      throw new Error("Unable to load your profile right now. Please try again later.");
    }

    // Never invent a role. If there is no readable profile row we cannot say
    // who this user is, so refuse instead of defaulting to "applicant".
    // PGRST116 = .single() found no row (the account is unusable) -> sign out;
    // anything else is a transient read failure -> keep the session, but still
    // refuse to hand back a guessed role.
    if (!profileData) {
      if (profileErr?.code === "PGRST116") {
        await supabase.auth.signOut();
      }
      throw new Error("Unable to load your profile right now. Please try again later.");
    }

    if (profileData.status === "suspended") {
      await supabase.auth.signOut();
      throw new Error("Your account has been suspended. Contact the administrator.");
    }

    // An unverified applicant keeps their session — the caller routes them to
    // /verify-email, which cannot do anything without an authenticated user.
    // Signing out here would strand them and bounce /login <-> /verify-email.
    if (profileData.role !== "admin" && !profileData.email_verified) {
      // auth.users is the source of truth; sync it back onto the profile.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.email_confirmed_at) {
        await syncEmailVerified(data.user.id);
        profileData.email_verified = true;
      }
    }

    await supabase.auth.setSession(data.session);
    return {
      ...data,
      role: profileData.role,
      email_verified: Boolean(profileData.email_verified),
    };
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    supabase.auth.stopAutoRefresh();
    setUser(null);
    setProfile(null);
    window.location.replace("/");
  }

  /**
   * Start a Google sign-in.
   *
   * Only the PUBLIC site origin ever appears here. The Google client ID and
   * secret live exclusively in Supabase Dashboard -> Authentication ->
   * Providers -> Google and are never sent to the browser.
   *
   * Supabase redirects the browser to Google and back to /auth/callback,
   * where the session is picked up, the profile row is created if missing,
   * and the role-based redirect runs. A disabled provider or a bad redirect
   * URL surfaces as an AuthApiError the calling screen classifies.
   */
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: oauthRedirectTo(),
      },
    });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signInWithGoogle, signOut, loadProfile, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
