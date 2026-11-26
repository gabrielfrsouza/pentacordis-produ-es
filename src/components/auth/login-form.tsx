"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";

type LoginFormProps = {
  missingSetup: boolean;
};

export function LoginForm({ missingSetup }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Não foi possível acessar o sistema. Verifique as configurações do Supabase.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-[420px] bg-white px-2 py-10">
      <div className="mb-12 text-center">
        <BrandLogo variant="black" size="lg" animated className="mx-auto" />
        <h1 className="mt-3 font-light text-[34px] leading-none">Acesso administrativo</h1>
      </div>

      {missingSetup ? (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">E-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full border-0 border-b border-neutral-300 bg-transparent px-0 text-sm outline-none transition-colors duration-500 focus:border-black"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full border-0 border-b border-neutral-300 bg-transparent px-0 text-sm outline-none transition-colors duration-500 focus:border-black"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-none bg-black text-[11px] font-medium uppercase tracking-[0.25em] text-white transition-opacity duration-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : null}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
