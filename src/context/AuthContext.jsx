import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetching = useRef(false);

  async function loadProfile(userId) {
    if (fetching.current) return;
    fetching.current = true;

    try {
      for (let retry = 0; retry < 3; retry++) {
        const { data: profileData } = await supabase.rpc("get_my_profile");

        if (profileData) {
          // Sync email verification status from auth.users
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.email_confirmed_at && !profileData.email_verified) {
            await supabase.from("profiles").update({ email_verified: true }).eq("id", userId);
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
            await supabase.from("profiles").update({ email_verified: true }).eq("id", userId);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  async function signUp(email, password, fullName, role, riskLevel = "low") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) throw error;

    if (data.user) {
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
    }

    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
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

    if (profileData?.status === "suspended") {
      await supabase.auth.signOut();
      throw new Error("Your account has been suspended. Contact the administrator.");
    }

    // Block unverified users from logging in
    if (profileData && profileData.role !== "admin" && !profileData.email_verified) {
      // Check if auth.users has email_confirmed_at set
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your email before signing in. Check your inbox for the verification code.");
      }
      // If auth says confirmed but profile doesn't, sync it
      if (authUser?.email_confirmed_at) {
        await supabase.from("profiles").update({ email_verified: true }).eq("id", data.user.id);
        profileData.email_verified = true;
      }
    }

    await supabase.auth.setSession(data.session);
    return { ...data, role: profileData?.role || "applicant", email_verified: profileData?.email_verified };
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

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signOut, loadProfile }}
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
