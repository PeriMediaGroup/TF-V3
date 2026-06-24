// src/auth/AuthContext.js
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import supabase from "../supabase/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // ✅ Save session securely
  const saveSession = async (session) => {
    if (session) {
      await SecureStore.setItemAsync("supabase_session", JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync("supabase_session");
    }
  };

  // ✅ Restore session on app start
  useEffect(() => {
    const restoreSession = async () => {
      const sessionStr = await SecureStore.getItemAsync("supabase_session");
      if (sessionStr) {
        try {
          const storedSession = JSON.parse(sessionStr);
          const { data, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });
          if (error) {
            console.error("Error restoring session:", error.message);
            setUser(null);
            await saveSession(null);
          } else {
            setUser(data.user);
          }
        } catch (err) {
          console.error("Failed to parse stored session:", err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        saveSession(session);
      } else {
        setUser(null);
        saveSession(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
      authListener?.unsubscribe?.();
    };
  }, []);

  // Load profile when user changes
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!user?.id) { setProfile(null); return; }
        // Try id = auth uid (your schema)
        let source = 'id';
        let { data, error } = await supabase
          .from('profiles')
          .select('id, username, email, role, rank, city, state, dob, joined_at, about, profile_image_url, banner_url, privacy_settings, badges, is_muted, is_banned, top_friends, top_guns')
          .eq('id', user.id)
          .eq('is_deleted', false)
          .maybeSingle();
        if (!active) return;
        // If not found, fallback by email (optional)
        if ((!data || Object.keys(data || {}).length === 0) && user?.email) {
          // Optional: fallback by email if your profiles stores it
          const retry2 = await supabase
            .from('profiles')
            .select('id, username, email, role, rank, city, state, dob, joined_at, about, profile_image_url, banner_url, privacy_settings, badges, is_muted, is_banned, top_friends, top_guns')
            .eq('email', user.email)
            .eq('is_deleted', false)
            .maybeSingle();
          if (retry2.data) {
            source = 'email';
            data = retry2.data;
          }
        }
        // If still not found, attempt to create a basic profile (id matches auth uid)
        if (!data) {
          const unameBase = (user.email ? user.email.split('@')[0] : 'user');
          const uname = `${unameBase}-${String(user.id).slice(0,6)}`;
          const up = await supabase
            .from('profiles')
            .upsert([{ id: user.id, username: uname, email: user.email, joined_at: new Date().toISOString() }], { onConflict: 'id' })
            .select('id, username, email, role, rank, city, state, dob, joined_at, about, profile_image_url, banner_url, privacy_settings, badges, is_muted, is_banned, top_friends, top_guns')
            .maybeSingle();
          if (up.data) {
            source = 'created';
            data = up.data;
          } else if (up.error && __DEV__) {
            console.warn('[Auth] profile upsert error', up.error.message);
          }
        }
        // Optional developer logs removed for cleaner console
        setProfile(data || null);
      } catch (e) {
        if (__DEV__) console.warn('[Auth] profile load error', e?.message || e);
        if (active) setProfile(null);
      }
    };
    load();
    return () => { active = false; };
  }, [user?.id]);

  const adminEmails = (process.env.EXPO_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const envElevated = !!(user?.email && adminEmails.includes(String(user.email).toLowerCase()));
  if (__DEV__ && envElevated) console.log('[Auth] elevated from env email list');
  const isElevated = envElevated || !!(profile?.role && ['admin','ceo'].includes(String(profile.role).toLowerCase()));

  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
    await saveSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isElevated, setUser, logOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
