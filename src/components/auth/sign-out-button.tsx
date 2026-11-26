"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="flex h-9 items-center gap-2 border-b border-neutral-300 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 transition-colors duration-500 hover:border-black hover:text-black"
    >
      <LogOut size={15} />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
