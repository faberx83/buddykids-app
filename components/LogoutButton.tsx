"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    if (isSupabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="mx-5 my-2 flex w-[calc(100%-40px)] items-center justify-center gap-2 rounded-md bg-orange-light py-3.5 text-[13px] font-bold text-trama-orange transition-colors hover:bg-orange-mid"
    >
      <i className="ti ti-logout text-base" />
      Esci dall&apos;account
    </button>
  );
}
