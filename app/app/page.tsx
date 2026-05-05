import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OrionAppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#03070d] text-white overflow-hidden">
      <div className="border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-[0.35em] text-cyan-300">
            ORION
          </h1>
          <p className="text-xs text-slate-500 tracking-[0.2em]">
            PAINEL NEURAL WEB
          </p>
        </div>

        <div className="text-sm text-slate-400">{user.email}</div>
      </div>

      <section className="grid lg:grid-cols-[280px_1fr_280px] gap-4 p-4 min-h-[calc(100vh-73px)]">
        <aside className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <h2 className="text-xs tracking-[0.25em] text-cyan-300 mb-4">
            SISTEMAS
          </h2>
          <div className="space-y-3 text-sm text-slate-400">
            <p>IA: online</p>
            <p>Voz: aguardando ElevenLabs</p>
            <p>Dropi: não conectado</p>
            <p>Plano: beta</p>
          </div>
        </aside>

        <section className="rounded-2xl border border-cyan-500/20 bg-black/30 p-6 flex flex-col items-center justify-center">
          <div className="relative w-56 h-56 rounded-full border border-cyan-300/40 flex items-center justify-center shadow-[0_0_80px_rgba(34,211,238,0.18)]">
            <div className="absolute inset-6 rounded-full border border-cyan-400/20 animate-pulse" />
            <div className="absolute inset-12 rounded-full bg-cyan-400/10 blur-xl" />
            <div className="text-5xl font-bold text-cyan-300">O</div>
          </div>

          <h2 className="mt-8 text-2xl font-bold tracking-[0.4em] text-cyan-300">
            ORION
          </h2>
          <p className="mt-2 text-slate-400">
            Assistente de IA para e-commerce.
          </p>

          <div className="mt-8 w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-[#050b14] p-4">
            <input
              className="w-full bg-transparent outline-none text-white placeholder:text-slate-600"
              placeholder="Digite um comando para o ORION..."
            />
          </div>
        </section>

        <aside className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <h2 className="text-xs tracking-[0.25em] text-cyan-300 mb-4">
            INTEGRAÇÕES
          </h2>
          <div className="space-y-3">
            <button className="w-full rounded-xl border border-cyan-500/20 py-3 text-left px-4 text-slate-300">
              Dropi
            </button>
            <button className="w-full rounded-xl border border-cyan-500/20 py-3 text-left px-4 text-slate-300">
              Nuvemshop
            </button>
            <button className="w-full rounded-xl border border-cyan-500/20 py-3 text-left px-4 text-slate-300">
              Meta Ads
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}