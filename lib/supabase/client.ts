"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey, warnIfNotConfigured, cookieDomain } from "./env";

// Browser-side Supabase client. Use inside client components ("use client").
export function createClient() {
  warnIfNotConfigured("createClient (browser)");
  return createBrowserClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    cookieDomain ? { cookieOptions: { domain: cookieDomain } } : undefined
  );
}
