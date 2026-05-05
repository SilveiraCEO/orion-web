"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/app");
  }

  return (
    <main className="min-h-screen bg-[#03070d] text-white flex items-center justify-center px-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md border border-cyan-500/30 bg-cyan-950/10 rounded-2xl p-8 shadow-2xl"
      >
        <h1 className="text-3xl font-bold tracking-[0.3em] text-cyan-300 mb-2">
          ORION
        </h1>
        <p className="text-slate-400 mb-8">
          Acesse seu assistente neural.
        </p>

        <label className="block text-sm text-cyan-200 mb-2">Email</label>
        <input
          className="w-full mb-4 rounded-xl bg-black/40 border border-cyan-500/20 px-4 py-3 outline-none focus:border-cyan-300"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
        />

        <label className="block text-sm text-cyan-200 mb-2">Senha</label>
        <input
          className="w-full mb-6 rounded-xl bg-black/40 border border-cyan-500/20 px-4 py-3 outline-none focus:border-cyan-300"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <button className="w-full rounded-xl bg-cyan-400 text-black font-bold py-3 hover:bg-cyan-300 transition">
          Entrar
        </button>

        <p className="text-sm text-slate-400 mt-6">
          Ainda não tem conta?{" "}
          <Link href="/register" className="text-cyan-300">
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}