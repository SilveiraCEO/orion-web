"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
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

type BrainInfo = {
  provider: string;
  level: string;
  model: string;
  reason?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  brain?: BrainInfo;
};

const SILENCE_LIMIT_MS = 1400;
const VOICE_THRESHOLD = 0.045;

export default function OrionDashboard({ userEmail }: OrionDashboardProps) {
  const router = useRouter();
  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceFrameRef = useRef<number | null>(null);
  const voiceDetectedRef = useRef(false);
  const lastVoiceAtRef = useRef<number>(0);
  const jarvisModeRef = useRef(false);
  const processingVoiceRef = useRef(false);

  const [message, setMessage] = useState("");
  const [orbMode, setOrbMode] = useState<OrbMode>("idle");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isJarvisMode, setIsJarvisMode] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryText, setMemoryText] = useState("");

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "ORION online. Modo neural carregado. Agora podemos conversar por texto, por voz manual ou pelo Modo Jarvis.",
    },
  ]);

  const quickCommands = [
    "Crie uma copy para anúncio de produto",
    "Analise a margem desse produto",
    "Monte um roteiro UGC de 30 segundos",
    "Crie uma descrição premium para loja",
    "Monte um DRE simples do mês",
    "Use o melhor cérebro e faça uma análise máxima da estratégia da minha loja",
  ];

  useEffect(() => {
    const savedVoice = localStorage.getItem("orion_voice_enabled");
    const savedMemory = localStorage.getItem("orion_memory_enabled");
    const savedMemoryText = localStorage.getItem("orion_memory_text");

    if (savedVoice !== null) setVoiceEnabled(savedVoice === "true");
    if (savedMemory !== null) setMemoryEnabled(savedMemory === "true");
    if (savedMemoryText) setMemoryText(savedMemoryText);
  }, []);

  useEffect(() => {
    localStorage.setItem("orion_voice_enabled", String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem("orion_memory_enabled", String(memoryEnabled));
  }, [memoryEnabled]);

  useEffect(() => {
    localStorage.setItem("orion_memory_text", memoryText);
  }, [memoryText]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat, isSending]);

  useEffect(() => {
    jarvisModeRef.current = isJarvisMode;
  }, [isJarvisMode]);

  useEffect(() => {
    return () => {
      stopListeningLoop();
      cleanupMic();
    };
  }, []);

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

  function getMemoryPrompt() {
    if (!memoryEnabled || !memoryText.trim()) return "";
    return `Contexto permanente do usuário:\n${memoryText.trim()}\n\n`;
  }

  async function speakWithElevenLabs(text: string) {
    if (!voiceEnabled) {
      setOrbMode("idle");
      return;
    }

    try {
      setOrbMode("speaking");

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Falha ao gerar voz.");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.play().catch(() => resolve());
      });

      setOrbMode("idle");
    } catch (error) {
      console.warn("Falha na voz ElevenLabs:", error);
      setOrbMode("idle");
    }
  }

  async function sendToOrion(userVisibleText: string, internalText?: string) {
    const cleanText = userVisibleText.trim();
    if ((!cleanText && attachedFiles.length === 0) || isSending) return;

    const filesNote =
      attachedFiles.length > 0
        ? "\n\nArquivos anexados pelo usuário: " +
          attachedFiles.map((file) => `${file.name} (${file.type})`).join(", ") +
          "\nObservação: nesta etapa, os arquivos ainda não são enviados para análise real. Considere apenas os nomes e tipos."
        : "";

    const visibleUserContent = cleanText || "Analise os arquivos anexados.";
    const messageForAI = getMemoryPrompt() + (internalText || visibleUserContent) + filesNote;

    const userMessage: ChatMessage = {
      role: "user",
      content: visibleUserContent + filesNote,
    };

    setChat((current) => [...current, userMessage]);
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
          message: messageForAI,
          history: chat.slice(-8),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao conversar com ORION.");
      }

      const assistantText =
        data.reply || "Resposta vazia. Fascinante, mas inútil.";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantText,
        brain: data.brain,
      };

      setChat((current) => [...current, assistantMessage]);
      await speakWithElevenLabs(assistantText);
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

  async function handleSend() {
    await sendToOrion(message);
  }

  async function createMicSession() {
    cleanupMic();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    micStreamRef.current = stream;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextClass) {
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
    }

    return stream;
  }

  async function startRecording(autoMode: boolean) {
    if (isRecording || processingVoiceRef.current) return;

    try {
      const stream = await createMicSession();

      audioChunksRef.current = [];
      voiceDetectedRef.current = false;
      lastVoiceAtRef.current = Date.now();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        cleanupMic();

        if (chunks.length === 0) {
          setIsRecording(false);
          setOrbMode("idle");
          return;
        }

        const audioBlob = new Blob(chunks, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        await transcribeAndReply(audioBlob, autoMode);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setOrbMode("listening");

      if (autoMode) {
        startSilenceDetection();
      }
    } catch (error) {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Não consegui acessar o microfone. Verifique a permissão do navegador e tente novamente.",
        },
      ]);
      console.warn(error);
      setIsRecording(false);
      setOrbMode("idle");
    }
  }

  function stopCurrentRecording() {
    stopListeningLoop();

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupMic();
      setIsRecording(false);
      setOrbMode("idle");
    }
  }

  async function transcribeAndReply(audioBlob: Blob, autoRestart: boolean) {
    processingVoiceRef.current = true;
    setIsRecording(false);
    setOrbMode("processing");

    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], "orion-voice.webm", {
        type: audioBlob.type || "audio/webm",
      });

      formData.append("audio", audioFile);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao transcrever áudio.");
      }

      const transcript = String(data.text || "").trim();

      if (!transcript) {
        setChat((current) => [
          ...current,
          {
            role: "assistant",
            content: "Não consegui entender o áudio. Um silêncio bastante filosófico.",
          },
        ]);

        setOrbMode("idle");
        return;
      }

      await sendToOrion(transcript);
    } catch (error) {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Falhei ao processar sua voz. " +
            (error instanceof Error ? error.message : "Erro desconhecido."),
        },
      ]);
      setOrbMode("idle");
    } finally {
      processingVoiceRef.current = false;

      if (autoRestart && jarvisModeRef.current) {
        window.setTimeout(() => {
          if (jarvisModeRef.current && !processingVoiceRef.current) {
            startRecording(true);
          }
        }, 500);
      }
    }
  }

  function getCurrentAmplitude() {
    const analyser = analyserRef.current;
    if (!analyser) return 0;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const value = (dataArray[i] - 128) / 128;
      sum += value * value;
    }

    return Math.sqrt(sum / dataArray.length);
  }

  function startSilenceDetection() {
    stopListeningLoop();

    const tick = () => {
      if (!jarvisModeRef.current) return;

      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state !== "recording") return;

      const amplitude = getCurrentAmplitude();
      const now = Date.now();

      if (amplitude > VOICE_THRESHOLD) {
        voiceDetectedRef.current = true;
        lastVoiceAtRef.current = now;
      }

      const hasFinishedTalking =
        voiceDetectedRef.current && now - lastVoiceAtRef.current > SILENCE_LIMIT_MS;

      if (hasFinishedTalking) {
        stopCurrentRecording();
        return;
      }

      silenceFrameRef.current = requestAnimationFrame(tick);
    };

    silenceFrameRef.current = requestAnimationFrame(tick);
  }

  function stopListeningLoop() {
    if (silenceFrameRef.current) {
      cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
  }

  function cleanupMic() {
    stopListeningLoop();

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => undefined);
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());

    audioContextRef.current = null;
    analyserRef.current = null;
    micStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  function handleManualVoiceClick() {
    if (isJarvisMode) {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "O Modo Jarvis está ativo. Desative-o primeiro para usar a gravação manual.",
        },
      ]);
      return;
    }

    if (isRecording) {
      stopCurrentRecording();
      return;
    }

    startRecording(false);
  }

  function toggleJarvisMode() {
    if (isJarvisMode) {
      setIsJarvisMode(false);
      jarvisModeRef.current = false;
      stopCurrentRecording();

      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content: "Modo Jarvis desligado. Voltando ao modo civilizado.",
        },
      ]);

      return;
    }

    setIsJarvisMode(true);
    jarvisModeRef.current = true;

    setChat((current) => [
      ...current,
      {
        role: "assistant",
        content:
          "Modo Jarvis ativado. Fale normalmente; quando você parar, eu respondo. Uma ideia perigosamente eficiente.",
      },
    ]);

    startRecording(true);
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
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
    <main className="h-screen bg-[#020611] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,212,255,0.14),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(249,115,22,0.08),transparent_22%),radial-gradient(circle_at_15%_90%,rgba(14,165,233,0.08),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute left-1/2 top-[18%] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 h-screen flex flex-col overflow-hidden">
        <header className="h-16 shrink-0 border-b border-cyan-400/15 bg-[#06111d]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
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
            <TopBadge
              label={voiceEnabled ? "Voz ativa" : "Voz desligada"}
              tone={voiceEnabled ? "cyan" : "orange"}
            />
            <TopBadge
              label={isJarvisMode ? "Jarvis on" : "Jarvis off"}
              tone={isJarvisMode ? "green" : "cyan"}
            />
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
              tone={
                orbMode === "speaking"
                  ? "orange"
                  : orbMode === "listening"
                  ? "green"
                  : "cyan"
              }
            />
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full border border-cyan-400/20 px-4 py-2 text-xs text-slate-300 hover:border-cyan-300 hover:text-cyan-100 transition"
          >
            Sair
          </button>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_315px] gap-4 p-4 md:p-6 overflow-hidden">
          <aside className="hidden xl:flex flex-col gap-4 min-h-0 overflow-hidden">
            <Panel title="SISTEMA">
              <StatusRow label="Motor de IA" value="Online" status="ok" />
              <StatusRow label="Supabase" value="Conectado" status="ok" />
              <StatusRow label="Chat" value="Ativo" status="ok" />
              <StatusRow
                label="Voz"
                value={voiceEnabled ? "Ativa" : "Desligada"}
                status={voiceEnabled ? "ok" : "warn"}
              />
              <StatusRow
                label="Modo Jarvis"
                value={isJarvisMode ? "Ativo" : "Manual"}
                status={isJarvisMode ? "ok" : "off"}
              />
              <StatusRow label="Arquivos" value="Preparado" status="ok" />
              <StatusRow label="Dropi" value="Aguardando" status="off" />
            </Panel>

            <Panel title="USO">
              <div className="space-y-4">
                <UsageBar
                  label="Mensagens"
                  value={`${chat.length} / 100`}
                  percent={Math.min(chat.length, 100)}
                />
                <UsageBar
                  label="Arquivos"
                  value={`${attachedFiles.length} / 8`}
                  percent={(attachedFiles.length / 8) * 100}
                />
                <UsageBar label="Integrações" value="0 / 3" percent={0} />
              </div>
            </Panel>

            <Panel title="PERFIL">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                Conta conectada
              </p>
              <p className="mt-2 break-all text-sm text-slate-300">{userEmail}</p>

              <div className="mt-4 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Plano atual
                </p>
                <p className="mt-1 text-xl font-bold text-white">Beta Founder</p>
              </div>
            </Panel>
          </aside>

          <section className="min-h-0 rounded-[28px] border border-cyan-400/15 bg-[#04101b]/75 backdrop-blur-xl shadow-[0_0_80px_rgba(0,212,255,0.08)] overflow-hidden flex flex-col">
            <div className="shrink-0 border-b border-cyan-400/10 px-5 md:px-8 py-4 flex items-center justify-between">
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
                  label="Speaking"
                  active={orbMode === "speaking"}
                  onClick={() => setOrbMode("speaking")}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 2xl:grid-cols-[390px_minmax(0,1fr)] gap-4 px-4 md:px-6 py-4 overflow-hidden">
              <div className="hidden 2xl:flex flex-col items-center justify-center min-h-0">
                <OrbCore mode={orbMode} waveformHeights={waveformHeights} />

                <h2 className="mt-5 text-3xl font-black tracking-[0.34em] text-cyan-100 text-center uppercase">
                  ORION
                </h2>

                <p className="mt-3 max-w-sm text-center text-slate-400 text-sm">
                  Converse por texto, gravação manual ou Modo Jarvis com detecção de silêncio.
                </p>
              </div>

              <div className="min-h-0 rounded-3xl border border-cyan-400/10 bg-[#020611]/70 overflow-hidden flex flex-col">
                <div className="shrink-0 border-b border-cyan-400/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                      Conversa neural
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Texto, voz manual e conversa automática em Modo Jarvis.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <ToggleButton
                      label="Voz"
                      active={voiceEnabled}
                      onClick={() => setVoiceEnabled((value) => !value)}
                    />
                    <ToggleButton
                      label="Memória"
                      active={memoryEnabled}
                      onClick={() => setMemoryEnabled((value) => !value)}
                    />
                  </div>
                </div>

                <div
                  ref={chatScrollRef}
                  className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
                >
                  {chat.map((item, index) => (
                    <ChatBubble key={index} message={item} />
                  ))}

                  {isSending && (
                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4 text-sm text-cyan-100">
                      ORION está analisando. Um raro momento em que pensar antes de falar ajuda.
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-cyan-400/10 bg-black/20 px-4 py-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quickCommands.map((item) => (
                      <QuickChip
                        key={item}
                        text={item}
                        onClick={() => applyQuickCommand(item)}
                      />
                    ))}
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="mb-3 rounded-2xl border border-cyan-400/10 bg-[#020611]/70 p-3">
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
                      onClick={handleManualVoiceClick}
                      disabled={isSending || isJarvisMode}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                        isRecording && !isJarvisMode
                          ? "border-red-400/30 bg-red-400/[0.08] text-red-200"
                          : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-400/[0.1]"
                      }`}
                    >
                      {isRecording && !isJarvisMode ? "Enviar voz" : "Falar"}
                    </button>

                    <button
                      onClick={toggleJarvisMode}
                      disabled={isSending}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                        isJarvisMode
                          ? "border-orange-400/30 bg-orange-400/[0.08] text-orange-200"
                          : "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-400/[0.1]"
                      }`}
                    >
                      {isJarvisMode ? "Parar Jarvis" : "Modo Jarvis"}
                    </button>

                    <button
                      onClick={handleAttachClick}
                      className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm font-bold text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-400/[0.1] transition"
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
                      className="flex-1 min-w-0 bg-transparent px-4 py-3 outline-none text-white placeholder:text-slate-600 disabled:opacity-50"
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

                  <p className="mt-2 text-xs text-slate-600">
                    Falar: clique para gravar e clique novamente para enviar. Modo Jarvis: respondo sozinho quando você parar de falar.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden xl:flex flex-col gap-4 min-h-0 overflow-hidden">
            <Panel title="MEMÓRIA">
              <p className="text-xs text-slate-500 mb-3">
                Informações que o ORION deve considerar nas respostas.
              </p>

              <textarea
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                className="h-32 w-full resize-none rounded-2xl border border-cyan-400/10 bg-black/30 p-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                placeholder="Ex: trabalho com e-commerce, vendo produtos físicos, foco em Meta Ads, quero respostas diretas..."
              />

              <button
                onClick={() => setMemoryText("")}
                className="mt-3 w-full rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-2 text-sm text-slate-300 hover:text-cyan-100 transition"
              >
                Limpar memória local
              </button>
            </Panel>

            <Panel title="INTEGRAÇÕES">
              <IntegrationItem title="Dropi" subtitle="Produtos e pedidos" state="Configurar" />
              <IntegrationItem title="Nuvemshop" subtitle="Catálogo e loja" state="Em breve" />
              <IntegrationItem title="Meta Ads" subtitle="Campanhas e criativos" state="Em breve" />
              <IntegrationItem title="WhatsApp" subtitle="Atendimento e follow-up" state="Em breve" />
            </Panel>

            <Panel title="ROADMAP">
              <RoadmapItem done text="Autenticação web" />
              <RoadmapItem done text="Painel premium" />
              <RoadmapItem done text="Chat real com IA" />
              <RoadmapItem done text="Roteador de modelos" />
              <RoadmapItem done text="Voz manual" />
              <RoadmapItem done text="Modo Jarvis beta" />
              <RoadmapItem text="Ondas sonoras reativas reais" />
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
        className={`max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "border-orange-400/20 bg-orange-400/[0.06] text-orange-50"
            : "border-cyan-400/15 bg-cyan-400/[0.05] text-slate-200"
        }`}
      >
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] opacity-60">
          {isUser ? "Usuário" : "ORION"}
        </p>

        <div>{message.content}</div>

        {!isUser && message.brain && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-cyan-400/10 pt-3">
            <SmallBadge text={message.brain.provider} />
            <SmallBadge text={message.brain.level} />
            <SmallBadge text={message.brain.model} />
          </div>
        )}
      </div>
    </div>
  );
}

function SmallBadge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
      {text}
    </span>
  );
}

function ToggleButton({
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
      className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
        active
          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
          : "border-slate-600/40 bg-white/[0.02] text-slate-500"
      }`}
    >
      {label}: {active ? "on" : "off"}
    </button>
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
    <div className="relative flex items-center justify-center h-[20rem] w-[20rem]">
      <div className="absolute inset-0 rounded-full border border-cyan-300/8" />
      <div className="absolute inset-5 rounded-full border border-cyan-300/10" />
      <div className="absolute inset-10 rounded-full border border-cyan-400/18" />
      <div className="absolute inset-16 rounded-full border border-orange-300/10" />

      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(34,211,238,0.22),transparent,rgba(56,189,248,0.14),transparent)] animate-spin [animation-duration:18s]" />
      <div className="absolute inset-8 rounded-full bg-[conic-gradient(from_180deg,transparent,rgba(251,146,60,0.20),transparent,rgba(34,211,238,0.20),transparent)] animate-spin [animation-duration:10s] [animation-direction:reverse]" />

      {waveformHeights.map((height, index) => {
        const angle = (360 / waveformHeights.length) * index;

        return (
          <div
            key={index}
            className="absolute left-1/2 top-1/2 origin-center"
            style={{
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-128px)`,
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

      <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-cyan-200/30 bg-[#020611] shadow-[inset_0_0_70px_rgba(34,211,238,0.14),0_0_90px_rgba(34,211,238,0.16)]">
        <div className="absolute inset-4 rounded-full border border-cyan-300/12" />
        <div className="absolute h-10 w-10 rounded-full bg-cyan-300 shadow-[0_0_32px_rgba(34,211,238,1)]" />
        <div className="absolute h-24 w-[2px] bg-gradient-to-b from-transparent via-cyan-300 to-transparent opacity-80" />
        <div className="absolute h-[2px] w-24 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-80" />

        <div className="absolute top-7 text-[10px] tracking-[0.35em] text-cyan-200/80 uppercase">
          {mode === "listening"
            ? "Ouvindo"
            : mode === "processing"
            ? "Analisando"
            : mode === "speaking"
            ? "Falando"
            : "Core"}
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

function RoadmapItem({ text, done }: { text: string; done?: boolean }) {
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