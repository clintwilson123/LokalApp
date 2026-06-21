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
        // Use RPC to bypass RLS
        const { data: role } = await supabase.rpc("get_my_role");

        if (role) {
          // Fetch full profile using RLS (should work now since we know it exists)
          const { data: full } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          setProfile(full || { id: userId, role, full_name: "User" });
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

  async function signUp(email, password, fullName, role) {
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
      });
      if (insertError) throw insertError;

      await supabase.from("notifications").insert({
        user_id: data.user.id,
        message: `Welcome to Lokal! Your account has been created as ${role}.`,
        type: "info",
      });
    }

    // Sign out immediately so user needs to log in manually
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);

    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    await supabase.auth.setSession(data.session);
    return data;
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
