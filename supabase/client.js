// supabase/client.js
// Defensive Supabase client: returns a real client when envs exist,
// otherwise a harmless stub that produces predictable errors so the UI can respond gracefully.

import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const RESOLVE_ERROR = "Supabase not configured";

const readRuntimeConfig = () => {
  const constantsExtra =
    (Constants?.expoConfig && Constants.expoConfig.extra) ||
    (Constants?.manifest && Constants.manifest.extra) ||
    {};

  return {
    url:
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      constantsExtra.EXPO_PUBLIC_SUPABASE_URL ??
      null,
    anonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      constantsExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      null,
  };
};

const { url: initialUrl, anonKey: initialAnonKey } = readRuntimeConfig();
const SUPABASE_URL = initialUrl;
const SUPABASE_ANON_KEY = initialAnonKey;

const asyncErrorResult = (message = RESOLVE_ERROR) =>
  Promise.resolve({ data: null, error: { message } });

const createQueryProxy = (message = RESOLVE_ERROR) => {
  const result = () => ({ data: null, error: { message } });

  const handler = {
    get(_target, prop, receiver) {
      if (prop === "then") {
        return (onFulfilled, onRejected) =>
          Promise.resolve(result()).then(onFulfilled, onRejected);
      }
      if (prop === "catch") {
        return (onRejected) => Promise.resolve(result()).catch(onRejected);
      }
      if (prop === "finally") {
        return (onFinally) => Promise.resolve(result()).finally(onFinally);
      }
      if (prop === Symbol.toStringTag) return "SupabaseQueryStub";
      if (prop === "toString") return () => "[SupabaseQueryStub]";
      return (..._args) => receiver;
    },
  };

  return new Proxy({}, handler);
};

const createChannelStub = (message = RESOLVE_ERROR) => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => {},
    toString: () => `[SupabaseChannelStub: ${message}]`,
    get status() {
      return "closed";
    },
  };
  return channel;
};

const createAuthStub = (message = RESOLVE_ERROR) => ({
  signUp: () => asyncErrorResult(message),
  signInWithPassword: () => asyncErrorResult(message),
  signOut: () => asyncErrorResult(message),
  setSession: () => asyncErrorResult(message),
  getSession: () => asyncErrorResult(message),
  getUser: () => asyncErrorResult(message),
  refreshSession: () => asyncErrorResult(message),
  onAuthStateChange: (callback) => {
    if (typeof callback === "function") {
      setTimeout(() => callback("SIGNED_OUT", null), 0);
    }
    const subscription = { unsubscribe: () => {} };
    return {
      data: { subscription },
      error: { message },
    };
  },
  get user() {
    return null;
  },
  get session() {
    return null;
  },
});

const createStorageProxy = (message = RESOLVE_ERROR) => ({
  from: () => ({
    upload: () => asyncErrorResult(message),
    createSignedUrl: () => asyncErrorResult(message),
    getPublicUrl: () => ({
      data: { publicUrl: null },
      error: { message },
    }),
    remove: () => asyncErrorResult(message),
    list: () => asyncErrorResult(message),
  }),
});

const createFunctionsStub = (message = RESOLVE_ERROR) => ({
  invoke: () => asyncErrorResult(message),
});

if (__DEV__) {
  console.log("[supabase] runtime values:", {
    EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL ? "present" : "missing",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "present" : "missing",
  });
}

/**
 * Create the real client if both values exist.
 * Otherwise return a safe stub object that won't crash the app.
 */
let supabase = null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] Supabase not configured at runtime. Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY."
  );

  supabase = {
    auth: createAuthStub(),
    from: () => createQueryProxy(),
    storage: createStorageProxy(),
    functions: createFunctionsStub(),
    channel: () => createChannelStub(),
    removeChannel: () => {},
    isConfigured: () => false,
  };
} else {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabase = client;
    supabase.isConfigured = () => true;
  } catch (err) {
    console.error("[supabase] createClient failed:", err);
    supabase = {
      auth: createAuthStub("Supabase client creation failed"),
      from: () => createQueryProxy("Supabase client creation failed"),
      storage: createStorageProxy("Supabase client creation failed"),
      functions: createFunctionsStub("Supabase client creation failed"),
      channel: () => createChannelStub("Supabase client creation failed"),
      removeChannel: () => {},
      isConfigured: () => false,
    };
  }
}

export default supabase;
export { SUPABASE_URL, SUPABASE_ANON_KEY };
export const isSupabaseConfigured = () => {
  const { url, anonKey } = readRuntimeConfig();
  return Boolean(url && anonKey);
};
