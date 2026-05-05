"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type OrionDashboardProps = {
  userEmail: string;
};

type OrbMode = "idle" | "processing" | "speaking" | "listening";

type AttachedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function OrionDashboard({ userEmail }: OrionDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [message, setMessage] = useState("");
  const [orbMode, setOrbMode] = useState<OrbMode>("idle");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "ORION online. Diga o que precisa otimizar na sua operação, senhor. Prometo não julgar suas métricas... ainda.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  const quickCommands = [
    "Crie uma copy para anúncio de produto",
    "Analise a margem desse produto",
    "Monte um roteiro UGC de 30 segundos",
    "Crie uma descrição premium para loja",
    "Monte um DRE simples do mês",
    "Sugira 5 criativos para Meta Ads",
  ];

  const waveformHeights = useMemo(() => {
    if (orbMode === "speaking") {
      return [28, 44, 22, 58, 34, 66, 20, 48, 30, 56, 24, 62, 26, 46, 19, 51];
    }

    if (orbMode === "listening") {
      return [40, 28, 54, 22, 62, 36, 48, 30, 66, 24, 52, 34, 58, 26, 46, 32];
    }

    if (orbMode === "processing") {
      return [18, 26, 14, 34, 22, 38, 16, 28, 18, 30, 14, 36, 16, 26, 14, 24];
    }

    return [8, 12, 10, 14, 11, 16, 8, 12, 9, 13, 10, 15, 9, 12, 8, 11];
  }, [orbMode]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSend() {
    const cleanMessage = message.trim();

    if ((!cleanMessage && attachedFiles.length === 0) || isSending) return;

    const fileNote =
      attachedFiles.length > 0
        ? "\n\nArquivos anexados pelo usuário: " +
          attachedFiles.map((file) => `${file.name} (${file.type})`).join(", ") +
          "\nObservação: nesta etapa, os arquivos ainda não são enviados para análise real. Apenas considere os nomes informados."
        : "";

    const userContent = cleanMessage || "Analise os arquivos anexados.";

    const userMessage: ChatMessage = {
      role: "user",
      content: userContent + fileNote,
    };

    const nextChat = [...chat, userMessage];

    setChat(nextChat);
    setMessage("");
    setAttachedFiles([]);
    setIsSending(true);
    setOrbMode("processing");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: chat.slice(-8),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao conversar com ORION.");
      }

   const brainLabel = data.brain
  ? `\n\n[Sistema: ${data.brain.provider} · ${data.brain.level} · ${data.brain.model}]`
  : "";

const assistantMessage: ChatMessage = {
  role: "assistant",
  content: assistantText + brainLabel,
};

      setChat((current) => [...current, assistantMessage]);
      setOrbMode("speaking");
      setTimeout(() => setOrbMode("idle"), 1600);
    } catch (error) {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Pequeno deslize meu. " +
            (error instanceof Error
              ? error.message
              : "Não consegui processar essa solicitação agora."),
        },
      ]);
      setOrbMode("idle");
    } finally {
      setIsSending(false);
    }
  }

  function handleVoiceClick() {
    setOrbMode("listening");

    setChat((current) => [
      ...current,
      {
        role: "assistant",
        content:
          "Microfone ainda não está conectado nesta etapa. Próximo módulo: voz real com transcrição e ElevenLabs.",
      },
    ]);

    setTimeout(() => setOrbMode("idle"), 1800);
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const mapped = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || "arquivo/desconhecido",
    }));

    setAttachedFiles((current) => [...current, ...mapped].slice(0, 8));

    event.target.value = "";
  }

  function removeFile(id: string) {
    setAttachedFiles((current) => current.filter((file) => file.id !== id));
  }

  function applyQuickCommand(text: string) {
    setMessage(text);
  }

  return (
    <main className="min-h-screen bg-[#020611] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,212,255,0.14),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(249,115,22,0.08),transparent_22%),radial-gradient(circle_at_15%_90%,rgba(14,165,233,0.08),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute left-1/2 top-[18%] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="h-16 border-b border-cyan-400/15 bg-[#06111d]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <OrionLogo />

            <div>
              <h1 className="text-lg md:text-xl font-black tracking-[0.35em] text-cyan-300">
                ORION
              </h1>
              <p className="text-[10px] tracking-[0.28em] text-slate-500 uppercase">
                Inteligência para e-commerce
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <TopBadge label="IA online" tone="green" />
            <TopBadge label="Beta founder" tone="cyan" />
            <TopBadge
              label={
                orbMode === "idle"
                  ? "Em espera"
                  : orbMode === "processing"
                  ? "Analisando"
                  : orbMode === "listening"
                  ? "Ouvindo"
                  : "Falando"
              }
              tone={orbMode === "speaking" ? "orange" : orbMode === "listening" ? "green" : "cyan"}
            />
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full border border-cyan-400/20 px-4 py-2 text-xs text-slate-300 hover:border-cyan-300 hover:text-cyan-100 transition"
          >
            Sair
          </button>
        </header>

        <section className="flex-1 grid grid-cols-1 xl:grid-cols-[285px_1fr_315px] gap-4 p-4 md:p-6">
          <aside className="space-y-4 order-2 xl:order-1">
            <Panel title="SISTEMA">
              <StatusRow label="Motor de IA" value="Online" status="ok" />
              <StatusRow label="Supabase" value="Conectado" status="ok" />
              <StatusRow label="Chat" value="Ativo" status="ok" />
              <StatusRow label="ElevenLabs" value="Próxima etapa" status="warn" />
              <StatusRow label="Arquivos" value="Preparado" status="ok" />
              <StatusRow label="Dropi" value="Aguardando" status="off" />
            </Panel>

            <Panel title="USO">
              <div className="space-y-4">
                <UsageBar label="Mensagens" value={`${chat.length} / 100`} percent={Math.min(chat.length, 100)} />
                <UsageBar label="Voz" value="0 / 30 min" percent={0} />
                <UsageBar label="Arquivos" value={`${attachedFiles.length} / 8`} percent={(attachedFiles.length / 8) * 100} />
                <UsageBar label="Integrações" value="0 / 3" percent={0} />
              </div>
            </Panel>

            <Panel title="PERFIL">
              <div className="rounded-2xl border border-cyan-400/10 bg-white/[0.02] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                  Conta conectada
                </p>
                <p className="mt-2 break-all text-sm text-slate-300">{userEmail}</p>
              </div>

              <div className="mt-3 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Plano atual
                </p>
                <p className="mt-1 text-xl font-bold text-white">Beta Founder</p>
                <p className="mt-2 text-xs text-slate-500">
                  Acesso inicial ao ecossistema ORION.
                </p>
              </div>
            </Panel>
          </aside>

          <section className="order-1 xl:order-2 rounded-[28px] border border-cyan-400/15 bg-[#04101b]/75 backdrop-blur-xl shadow-[0_0_80px_rgba(0,212,255,0.08)] overflow-hidden flex flex-col min-h-[720px]">
            <div className="border-b border-cyan-400/10 px-5 md:px-8 py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
                  Núcleo central
                </p>
                <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">
                  Painel principal do ORION
                </h2>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <ModeButton
                  label="Idle"
                  active={orbMode === "idle"}
                  onClick={() => setOrbMode("idle")}
                />
                <ModeButton
                  label="Thinking"
                  active={orbMode === "processing"}
                  onClick={() => setOrbMode("processing")}
                />
                <ModeButton
                  label="Listening"
                  active={orbMode === "listening"}
                  onClick={() => setOrbMode("listening")}
                />
                <ModeButton
                  label="Speaking"
                  active={orbMode === "speaking"}
                  onClick={() => setOrbMode("speaking")}
                />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)] gap-4 px-5 md:px-8 py-6 overflow-hidden">
              <div className="flex flex-col items-center justify-center">
                <OrbCore mode={orbMode} waveformHeights={waveformHeights} />

                <h2 className="mt-6 text-3xl md:text-[2.35rem] font-black tracking-[0.34em] text-cyan-100 text-center uppercase">
                  ORION
                </h2>

                <p className="mt-3 max-w-xl text-center text-slate-400 text-sm md:text-base">
                  Crie anúncios, analise margens, organize sua operação e tome decisões
                  com mais inteligência.
                </p>
              </div>

              <div className="min-h-[420px] rounded-3xl border border-cyan-400/10 bg-[#020611]/70 overflow-hidden flex flex-col">
                <div className="border-b border-cyan-400/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                    Conversa neural
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chat.map((item, index) => (
                    <ChatBubble key={index} message={item} />
                  ))}

                  {isSending && (
                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4 text-sm text-cyan-100">
                      ORION está analisando...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-cyan-400/10 bg-black/20 px-4 md:px-6 py-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {quickCommands.map((item) => (
                  <QuickChip
                    key={item}
                    text={item}
                    onClick={() => applyQuickCommand(item)}
                  />
                ))}
              </div>

              {attachedFiles.length > 0 && (
                <div className="mb-4 rounded-2xl border border-cyan-400/10 bg-[#020611]/70 p-3">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                    Arquivos anexados
                  </p>

                  <div className="grid gap-2 md:grid-cols-2">
                    {attachedFiles.map((file) => (
                      <AttachedFileCard
                        key={file.id}
                        file={file}
                        onRemove={() => removeFile(file.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*,.gif,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleFilesSelected}
              />

              <div className="rounded-2xl border border-cyan-400/15 bg-[#020611]/80 p-2 flex gap-2">
                <button
                  onClick={handleVoiceClick}
                  className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm font-bold text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-400/[0.1] transition"
                  title="Falar com ORION"
                >
                  Falar
                </button>

                <button
                  onClick={handleAttachClick}
                  className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm font-bold text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-400/[0.1] transition"
                  title="Anexar arquivos"
                >
                  Anexar
                </button>

                <input
                  value={message}
                  disabled={isSending}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-slate-600 disabled:opacity-50"
                  placeholder="Digite um comando para o ORION..."
                />

                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-black hover:bg-cyan-200 transition disabled:opacity-50"
                >
                  {isSending ? "..." : "Enviar"}
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4 order-3">
            <Panel title="INTEGRAÇÕES">
              <IntegrationItem
                title="Dropi"
                subtitle="Produtos e pedidos"
                state="Configurar"
              />
              <IntegrationItem
                title="Nuvemshop"
                subtitle="Catálogo e loja"
                state="Em breve"
              />
              <IntegrationItem
                title="Meta Ads"
                subtitle="Campanhas e criativos"
                state="Em breve"
              />
              <IntegrationItem
                title="WhatsApp"
                subtitle="Atendimento e follow-up"
                state="Em breve"
              />
            </Panel>

            <Panel title="ATALHOS">
              <ShortcutButton text="Criar copy para anúncio" />
              <ShortcutButton text="Gerar roteiro UGC" />
              <ShortcutButton text="Criar oferta premium" />
              <ShortcutButton text="Montar DRE simples" />
              <ShortcutButton text="Analisar margem" />
            </Panel>

            <Panel title="ROADMAP">
              <RoadmapItem done text="Autenticação web" />
              <RoadmapItem done text="Painel premium" />
              <RoadmapItem done text="Upload visual de arquivos" />
              <RoadmapItem done text="Chat real com IA" />
              <RoadmapItem text="Voz ElevenLabs" />
              <RoadmapItem text="Ondas sonoras reativas" />
              <RoadmapItem text="Integração Dropi" />
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "border-orange-400/20 bg-orange-400/[0.06] text-orange-50"
            : "border-cyan-400/15 bg-cyan-400/[0.05] text-slate-200"
        }`}
      >
        <p className="mb-1 text-[10px] uppercase tracking-[0.22em] opacity-60">
          {isUser ? "Usuário" : "ORION"}
        </p>
        {message.content}
      </div>
    </div>
  );
}

function OrionLogo() {
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div className="absolute inset-0 rounded-[14px] border border-cyan-300/35 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(249,115,22,0.16))] shadow-[0_0_26px_rgba(34,211,238,0.25)] rotate-45" />
      <div className="absolute inset-[6px] rounded-[10px] bg-[#020611] border border-cyan-200/20 rotate-45" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,1)]" />
      <div className="absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-300 to-transparent opacity-85" />
      <div className="absolute left-1/2 top-1/2 h-[2px] w-7 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-85" />
    </div>
  );
}

function OrbCore({
  mode,
  waveformHeights,
}: {
  mode: OrbMode;
  waveformHeights: number[];
}) {
  return (
    <div className="relative flex items-center justify-center h-[21rem] w-[21rem] md:h-[24rem] md:w-[24rem]">
      <div className="absolute inset-0 rounded-full border border-cyan-300/8" />
      <div className="absolute inset-5 rounded-full border border-cyan-300/10" />
      <div className="absolute inset-10 rounded-full border border-cyan-400/18" />
      <div className="absolute inset-16 rounded-full border border-orange-300/10" />

      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(34,211,238,0.22),transparent,rgba(56,189,248,0.14),transparent)] animate-spin [animation-duration:18s]" />
      <div className="absolute inset-8 rounded-full bg-[conic-gradient(from_180deg,transparent,rgba(251,146,60,0.20),transparent,rgba(34,211,238,0.20),transparent)] animate-spin [animation-duration:10s] [animation-direction:reverse]" />

      <div className="absolute h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

      {waveformHeights.map((height, index) => {
        const angle = (360 / waveformHeights.length) * index;

        return (
          <div
            key={index}
            className="absolute left-1/2 top-1/2 origin-center"
            style={{
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-150px)`,
            }}
          >
            <div
              className={`w-[4px] rounded-full ${
                mode === "speaking"
                  ? "bg-gradient-to-b from-cyan-200 via-cyan-300 to-orange-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                  : mode === "listening"
                  ? "bg-gradient-to-b from-emerald-200 via-cyan-300 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                  : mode === "processing"
                  ? "bg-gradient-to-b from-cyan-200/70 via-cyan-300/70 to-cyan-400/70"
                  : "bg-cyan-300/35"
              }`}
              style={{ height: `${height}px` }}
            />
          </div>
        );
      })}

      <div className="relative flex h-44 w-44 md:h-52 md:w-52 items-center justify-center rounded-full border border-cyan-200/30 bg-[#020611] shadow-[inset_0_0_70px_rgba(34,211,238,0.14),0_0_90px_rgba(34,211,238,0.16)]">
        <div className="absolute inset-4 rounded-full border border-cyan-300/12" />
        <div className="absolute inset-8 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="absolute h-20 w-20 rounded-full bg-cyan-300/12 blur-xl" />
        <div className="absolute h-10 w-10 rounded-full bg-cyan-300 shadow-[0_0_32px_rgba(34,211,238,1)]" />
        <div className="absolute h-28 w-[2px] bg-gradient-to-b from-transparent via-cyan-300 to-transparent opacity-80" />
        <div className="absolute h-[2px] w-28 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-80" />

        <div className="absolute top-8 text-[10px] tracking-[0.35em] text-cyan-200/80 uppercase">
          {mode === "listening"
            ? "Ouvindo"
            : mode === "processing"
            ? "Analisando"
            : mode === "speaking"
            ? "Falando"
            : "Core"}
        </div>

        <div className="absolute bottom-6 flex items-end gap-[5px]">
          {[14, 28, 18, 34, 22, 30, 16].map((h, i) => (
            <span
              key={i}
              className={`w-[4px] rounded-full ${
                mode === "speaking"
                  ? i % 3 === 0
                    ? "bg-orange-300"
                    : "bg-cyan-200"
                  : mode === "listening"
                  ? "bg-emerald-300"
                  : "bg-cyan-300/80"
              } animate-pulse`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AttachedFileCard({
  file,
  onRemove,
}: {
  file: AttachedFile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-200">{file.name}</p>
        <p className="text-xs text-slate-500">
          {formatFileSize(file.size)} · {formatFileType(file.type)}
        </p>
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 rounded-full border border-red-400/20 px-2 py-1 text-xs text-red-300 hover:bg-red-400/10 transition"
      >
        remover
      </button>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatFileType(type: string) {
  if (!type) return "arquivo";
  if (type.startsWith("image/")) return "imagem";
  if (type.startsWith("video/")) return "vídeo";
  if (type.startsWith("audio/")) return "áudio";
  if (type.includes("gif")) return "gif";
  if (type.includes("pdf")) return "pdf";
  return type;
}

function TopBadge({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "cyan" | "orange";
}) {
  const styles =
    tone === "green"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : tone === "orange"
      ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
      : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";

  return (
    <div className={`rounded-full border px-3 py-1 text-[11px] ${styles}`}>
      {label}
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
          : "border-cyan-400/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-cyan-400/15 bg-[#06111d]/75 backdrop-blur-xl p-4 shadow-[0_0_40px_rgba(0,212,255,0.04)]">
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-400/8 pb-3">
        <span className="text-cyan-300">▸</span>
        <h3 className="text-[11px] font-bold tracking-[0.24em] text-cyan-200 uppercase">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function StatusRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "ok" | "warn" | "off";
}) {
  const color =
    status === "ok"
      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
      : status === "warn"
      ? "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]"
      : "bg-slate-600";

  return (
    <div className="flex items-center justify-between border-b border-cyan-400/5 py-2.5 last:border-none">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="flex items-center gap-2 text-xs text-slate-300">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {value}
      </span>
    </div>
  );
}

function UsageBar({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-cyan-200">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cyan-400/10">
        <div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function QuickChip({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-cyan-400/12 bg-cyan-400/[0.05] px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100 transition"
    >
      {text}
    </button>
  );
}

function IntegrationItem({
  title,
  subtitle,
  state,
}: {
  title: string;
  subtitle: string;
  state: string;
}) {
  return (
    <button className="mb-3 w-full rounded-2xl border border-cyan-400/12 bg-white/[0.02] p-4 text-left hover:border-cyan-300/30 hover:bg-cyan-400/[0.04] transition last:mb-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-400/15 px-3 py-1 text-[10px] text-cyan-200">
          {state}
        </span>
      </div>
    </button>
  );
}

function ShortcutButton({ text }: { text: string }) {
  return (
    <button className="mb-2 w-full rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-3 text-left text-sm text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100 transition last:mb-0">
      {text}
    </button>
  );
}

function RoadmapItem({
  text,
  done,
}: {
  text: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          done
            ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
            : "bg-cyan-400/30"
        }`}
      />
      <span className={done ? "text-slate-300 text-sm" : "text-slate-500 text-sm"}>
        {text}
      </span>
    </div>
  );
}