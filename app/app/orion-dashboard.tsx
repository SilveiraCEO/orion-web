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
import Orb3D from "@/components/Orb3D";

type OrionDashboardProps = {
  userEmail: string;
  userId: string;
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

export default function OrionDashboard({
  userEmail,
  userId,
}: OrionDashboardProps) {
  const router = useRouter();
const supabase = useMemo(() => createClient(), []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceFrameRef = useRef<number | null>(null);
  const liveLevelFrameRef = useRef<number | null>(null);
  const voiceDetectedRef = useRef(false);
  const lastVoiceAtRef = useRef<number>(0);
  const jarvisModeRef = useRef(false);
  const processingVoiceRef = useRef(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const speechSessionRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const shouldResumeJarvisAfterSpeechRef = useRef(false);

  const [message, setMessage] = useState("");
  const [orbMode, setOrbMode] = useState<OrbMode>("idle");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isJarvisMode, setIsJarvisMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
const [memoryText, setMemoryText] = useState("");
const [isMemoryLoading, setIsMemoryLoading] = useState(true);
const [isMemorySaving, setIsMemorySaving] = useState(false);
const [memoryStatus, setMemoryStatus] = useState("");
  const [liveLevel, setLiveLevel] = useState(0);

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "ORION online. Núcleo neural iniciado. Podemos operar por texto, voz manual ou Modo Jarvis.",
    },
  ]);

  const quickCommands = [
    "Crie uma copy premium para anúncio",
    "Analise a margem desse produto",
    "Monte um roteiro UGC de 30 segundos",
    "Crie uma descrição premium para minha loja",
    "Monte um DRE simples do mês",
    "Use o melhor cérebro e faça uma análise máxima da minha loja",
  ];

  const waveformHeights = useMemo(() => {
    const level = Math.min(1, Math.max(0, liveLevel));
    const now = Date.now();

    return Array.from({ length: 24 }, (_, index) => {
      const waveA = Math.sin(now / 135 + index * 0.58) * 8;
      const waveB = Math.cos(now / 220 + index * 0.8) * 6;
      const envelope = 14 + Math.abs(Math.sin((index / 24) * Math.PI * 2)) * 20;

      const boost =
        orbMode === "speaking"
          ? 22 + level * 42
          : orbMode === "listening"
          ? 18 + level * 30
          : orbMode === "processing"
          ? 8 + level * 12
          : 2;

      return Math.max(8, Math.round(envelope + boost + waveA + waveB));
    });
  }, [orbMode, liveLevel]);

  useEffect(() => {
  const savedVoice = localStorage.getItem("orion_voice_enabled");
  const savedMemory = localStorage.getItem("orion_memory_enabled");

  if (savedVoice !== null) setVoiceEnabled(savedVoice === "true");
  if (savedMemory !== null) setMemoryEnabled(savedMemory === "true");

  hardStopAllSpeech();
}, []);

  useEffect(() => {
    localStorage.setItem("orion_voice_enabled", String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
  if (!voiceEnabled) {
    hardStopAllSpeech();
  }
}, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem("orion_memory_enabled", String(memoryEnabled));
  }, [memoryEnabled]);

  useEffect(() => {
    jarvisModeRef.current = isJarvisMode;
  }, [isJarvisMode]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat, isSending]);

  useEffect(() => {
    return () => {
      stopListeningLoop();
      stopLiveLevelLoop();
      cleanupMic();
      hardStopAllSpeech();
    };
  }, []);

  useEffect(() => {
  let mounted = true;

  async function loadUserMemory() {
    setIsMemoryLoading(true);
    setMemoryStatus("");

    const { data, error } = await supabase
      .from("user_memories")
      .select("memory_text")
      .eq("user_id", userId)
      .maybeSingle();

    if (!mounted) return;

    if (error) {
      setMemoryStatus("Não consegui carregar a memória do Supabase.");
      setIsMemoryLoading(false);
      return;
    }

    setMemoryText(data?.memory_text ?? "");
    setIsMemoryLoading(false);
  }

  void loadUserMemory();

  return () => {
    mounted = false;
  };
}, [supabase, userId]);

  async function handleLogout() {
    hardStopAllSpeech();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function getMemoryPrompt() {
    if (!memoryEnabled || !memoryText.trim()) return "";
    return `Contexto permanente do usuário:\n${memoryText.trim()}\n\n`;
  }
  
  async function saveMemoryToSupabase(nextMemory = memoryText) {
  setIsMemorySaving(true);
  setMemoryStatus("");

  const { error } = await supabase.from("user_memories").upsert(
    {
      user_id: userId,
      memory_text: nextMemory.trim(),
    },
    {
      onConflict: "user_id",
    }
  );

  setIsMemorySaving(false);

  if (error) {
    setMemoryStatus("Erro ao salvar memória: " + error.message);
    return;
  }

  setMemoryStatus("Memória salva no Supabase.");

  setTimeout(() => {
    setMemoryStatus("");
  }, 2200);
}

  function stopListeningLoop() {
    if (silenceFrameRef.current) {
      cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
  }

  function stopLiveLevelLoop() {
    if (liveLevelFrameRef.current) {
      cancelAnimationFrame(liveLevelFrameRef.current);
      liveLevelFrameRef.current = null;
    }
  }

  function hardStopAllSpeech() {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }

    speechSessionRef.current += 1;
    isSpeakingRef.current = false;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }

    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }

    setLiveLevel(0);

    if (!isRecording && !isSending) {
      setOrbMode("idle");
    }
  }

  function stopCurrentSpeech() {
    hardStopAllSpeech();
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

  function startLiveLevelFromMic(stopWhen?: () => boolean) {
    stopLiveLevelLoop();

    const tick = () => {
      const level = getCurrentAmplitude();
      setLiveLevel((current) => current * 0.66 + level * 0.34);

      if (stopWhen && stopWhen()) {
        setLiveLevel(0);
        liveLevelFrameRef.current = null;
        return;
      }

      liveLevelFrameRef.current = requestAnimationFrame(tick);
    };

    liveLevelFrameRef.current = requestAnimationFrame(tick);
  }

  async function speakWithElevenLabs(text: string) {
    if (!voiceEnabled) {
      setLiveLevel(0);
      setOrbMode("idle");

      if (jarvisModeRef.current && shouldResumeJarvisAfterSpeechRef.current) {
        shouldResumeJarvisAfterSpeechRef.current = false;

        setTimeout(() => {
          if (
            jarvisModeRef.current &&
            !processingVoiceRef.current &&
            !isSpeakingRef.current
          ) {
            startRecording(true);
          }
        }, 350);
      }

      return;
    }

    hardStopAllSpeech();

    const speechId = speechSessionRef.current + 1;
    speechSessionRef.current = speechId;
    isSpeakingRef.current = true;
    setOrbMode("speaking");

    try {
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

      if (speechSessionRef.current !== speechId) return;

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      let voiceContext: AudioContext | null = null;
      let voiceFrame = 0;

      if (AudioContextClass) {
        voiceContext = new AudioContextClass();

        const source = voiceContext.createMediaElementSource(audio);
        const analyser = voiceContext.createAnalyser();

        analyser.fftSize = 512;
        source.connect(analyser);
        analyser.connect(voiceContext.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const animateVoice = () => {
          if (
            speechSessionRef.current !== speechId ||
            audio.paused ||
            audio.ended
          ) {
            setLiveLevel(0);
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          let sum = 0;

          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }

          const avg = sum / dataArray.length / 255;
          setLiveLevel((current) => current * 0.55 + avg * 0.45);

          voiceFrame = requestAnimationFrame(animateVoice);
        };

        animateVoice();
      }

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });

      if (voiceFrame) cancelAnimationFrame(voiceFrame);

      if (voiceContext && voiceContext.state !== "closed") {
        await voiceContext.close().catch(() => undefined);
      }

      if (speechSessionRef.current === speechId) {
        setLiveLevel(0);
        isSpeakingRef.current = false;

        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }

        currentAudioRef.current = null;

        if (!isRecording && !isSending) {
          setOrbMode("idle");
        }

        if (jarvisModeRef.current && shouldResumeJarvisAfterSpeechRef.current) {
          shouldResumeJarvisAfterSpeechRef.current = false;

          setTimeout(() => {
            if (
              jarvisModeRef.current &&
              !processingVoiceRef.current &&
              !isSpeakingRef.current
            ) {
              startRecording(true);
            }
          }, 350);
        }
      }
    } catch (error) {
      console.warn("Falha na voz ElevenLabs:", error);
      isSpeakingRef.current = false;
      setLiveLevel(0);

      if (!isRecording && !isSending) {
        setOrbMode("idle");
      }
    }
  }

  async function sendToOrion(userVisibleText: string, internalText?: string) {
    const cleanText = userVisibleText.trim();

    if ((!cleanText && attachedFiles.length === 0) || isSending) return;

    const historySnapshot = [...chat];

    const filesNote =
      attachedFiles.length > 0
        ? "\n\nArquivos anexados pelo usuário: " +
          attachedFiles.map((file) => `${file.name} (${file.type})`).join(", ") +
          "\nObservação: nesta etapa, os arquivos ainda não são enviados para análise real. Considere apenas os nomes e tipos."
        : "";

    const visibleUserContent = cleanText || "Analise os arquivos anexados.";
    const messageForAI =
      getMemoryPrompt() + (internalText || visibleUserContent) + filesNote;

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
          history: historySnapshot.slice(-8),
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
      setIsSending(false);

      if (jarvisModeRef.current) {
        shouldResumeJarvisAfterSpeechRef.current = true;
      }

      void speakWithElevenLabs(assistantText);

      if (!voiceEnabled && jarvisModeRef.current) {
        shouldResumeJarvisAfterSpeechRef.current = false;

        setTimeout(() => {
          if (
            jarvisModeRef.current &&
            !processingVoiceRef.current &&
            !isSpeakingRef.current
          ) {
            startRecording(true);
          }
        }, 300);
      }
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

      setIsSending(false);
      setOrbMode("idle");
    }
  }

  async function handleSend() {
    if (isJarvisMode && isRecording) {
      stopCurrentRecording();
    }

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
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextClass) {
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      source.connect(analyser);

      micAudioContextRef.current = audioContext;
      analyserRef.current = analyser;
    }

    return stream;
  }

  async function startRecording(autoMode: boolean) {
    if (isRecording || processingVoiceRef.current || isSpeakingRef.current) {
      return;
    }

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

      startLiveLevelFromMic(() => {
        const recorder = mediaRecorderRef.current;
        return !recorder || recorder.state !== "recording";
      });

      if (autoMode) {
        startSilenceDetection();
      }
    } catch (error) {
      console.warn(error);

      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Não consegui acessar o microfone. Verifique a permissão do navegador e tente novamente.",
        },
      ]);

      setIsRecording(false);
      setLiveLevel(0);
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
      setLiveLevel(0);
      setOrbMode("idle");
    }
  }

  async function transcribeAndReply(audioBlob: Blob, autoRestart: boolean) {
    processingVoiceRef.current = true;
    setIsRecording(false);
    setLiveLevel(0);
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
            content:
              "Não consegui entender o áudio. Houve mais mistério do que informação.",
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

      if (autoRestart && jarvisModeRef.current && !voiceEnabled) {
        setTimeout(() => {
          if (
            jarvisModeRef.current &&
            !processingVoiceRef.current &&
            !isSpeakingRef.current
          ) {
            startRecording(true);
          }
        }, 350);
      }
    }
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
        voiceDetectedRef.current &&
        now - lastVoiceAtRef.current > SILENCE_LIMIT_MS;

      if (hasFinishedTalking) {
        stopCurrentRecording();
        return;
      }

      silenceFrameRef.current = requestAnimationFrame(tick);
    };

    silenceFrameRef.current = requestAnimationFrame(tick);
  }

  function cleanupMic() {
    stopListeningLoop();
    stopLiveLevelLoop();

    if (
      micAudioContextRef.current &&
      micAudioContextRef.current.state !== "closed"
    ) {
      micAudioContextRef.current.close().catch(() => undefined);
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());

    micAudioContextRef.current = null;
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
            "O Modo Jarvis está ativo. Desative-o antes de usar a gravação manual.",
        },
      ]);

      return;
    }

    if (isSpeakingRef.current) {
      stopCurrentSpeech();
    }

    if (isRecording) {
      stopCurrentRecording();
      return;
    }

    startRecording(false);
  }

  function toggleVoiceEnabled() {
  const isTurningOff = voiceEnabled;

  if (isTurningOff) {
    shouldResumeJarvisAfterSpeechRef.current = false;
    hardStopAllSpeech();

    if (jarvisModeRef.current && !isRecording && !processingVoiceRef.current) {
      setTimeout(() => {
        if (
          jarvisModeRef.current &&
          !processingVoiceRef.current &&
          !isSpeakingRef.current
        ) {
          startRecording(true);
        }
      }, 350);
    }
  }

  setVoiceEnabled((current) => !current);
}

  function toggleJarvisMode() {
    if (isJarvisMode) {
      setIsJarvisMode(false);
      jarvisModeRef.current = false;
      shouldResumeJarvisAfterSpeechRef.current = false;

      if (isRecording) {
        stopCurrentRecording();
      }

      setChat((current) => [
        ...current,
        {
          role: "assistant",
          content: "Modo Jarvis desligado. Voltando ao modo manual.",
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
          "Modo Jarvis ativado. Fale normalmente; quando você parar, eu respondo.",
      },
    ]);

    if (!isSpeakingRef.current && !processingVoiceRef.current) {
      startRecording(true);
    } else {
      shouldResumeJarvisAfterSpeechRef.current = true;
    }
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

  const orbSpeakingLevel =
  orbMode === "speaking"
    ? Math.max(0.18, Math.min(1, liveLevel * 2.8))
    : orbMode === "listening"
    ? Math.max(0.14, Math.min(1, liveLevel * 2.2))
    : orbMode === "processing"
    ? 0.18
    : 0.045;
  return (
    <main className="h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(97,239,255,0.12),transparent_30%),radial-gradient(circle_at_85%_78%,rgba(123,97,255,0.11),transparent_24%),radial-gradient(circle_at_15%_90%,rgba(255,140,90,0.06),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(97,239,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(97,239,255,0.028)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative z-10 flex h-screen flex-col overflow-hidden">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-cyan-300/10 bg-[#071224]/80 px-5 backdrop-blur-2xl md:px-8">
          <div className="flex items-center gap-4">
            <BrandMark />

            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/75">
                Autonomous Commerce Intelligence
              </p>
              <h1 className="mt-1 text-xl font-black tracking-[0.34em] text-cyan-100">
                ORION
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
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
            className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-2 text-sm font-bold text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:shadow-[0_0_22px_rgba(97,239,255,0.12)]"
          >
            Sair
          </button>
        </header>

        <section className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden p-4 md:p-6 xl:grid-cols-[280px_minmax(0,1fr)_315px]">
          <aside className="hidden min-h-0 flex-col gap-4 overflow-hidden xl:flex">
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
                <UsageBar
                  label="Nível neural"
                  value={`${Math.round(orbSpeakingLevel * 100)}%`}
                  percent={Math.min(100, Math.round(orbSpeakingLevel * 100))}
                />
              </div>
            </Panel>

            <Panel title="CONTA">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
                Usuário conectado
              </p>
              <p className="mt-2 break-all text-sm text-slate-300">
                {userEmail}
              </p>

              <div className="mt-4 rounded-3xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Plano atual
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  Beta Founder
                </p>
              </div>
            </Panel>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[34px] border border-cyan-300/12 bg-[#071224]/76 shadow-[0_0_80px_rgba(97,239,255,0.06)] backdrop-blur-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-300/10 px-5 py-4 md:px-8">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">
                  Neural Command Center
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">
                  Painel principal do ORION
                </h2>
              </div>

              <div className="hidden items-center gap-2 md:flex">
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

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden p-4 md:p-5 2xl:grid-cols-[430px_minmax(0,1fr)]">
              <div className="hidden min-h-0 flex-col overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[#050816]/70 2xl:flex">
                <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(97,239,255,0.10),transparent_35%),radial-gradient(circle_at_70%_75%,rgba(123,97,255,0.10),transparent_25%)]" />
                  <div className="relative z-10 h-full w-full">
                    <Orb3D mode={orbMode} speakingLevel={orbSpeakingLevel} />
                  </div>
                </div>

                <div className="border-t border-cyan-300/10 p-5">
                  <div className="flex h-16 items-end justify-center gap-1">
                    {waveformHeights.map((height, index) => (
                      <div
                        key={index}
                        className={`w-[4px] rounded-full transition-all duration-100 ${
                          orbMode === "speaking"
                            ? "bg-cyan-200 shadow-[0_0_14px_rgba(97,239,255,0.7)]"
                            : orbMode === "listening"
                            ? "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.5)]"
                            : "bg-cyan-300/40"
                        }`}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>

                  <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                    O geoide reage ao nível de voz e ficará ainda mais vivo
                    quando conectarmos o modo speaking/listening definitivo.
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[#030817]/76">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
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
  onClick={toggleVoiceEnabled}
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
                  className="orion-scroll flex-1 min-h-0 overflow-y-auto p-4"
                >
                  <div className="space-y-3">
                    {chat.map((item, index) => (
                      <ChatBubble key={index} message={item} />
                    ))}

                    {isSending && (
                      <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100">
                        ORION está analisando sua solicitação.
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 border-t border-cyan-300/10 bg-black/20 px-4 py-4">
                  <div className="orion-scroll-thin mb-3 flex gap-2 overflow-x-auto pb-1">
                    {quickCommands.map((item) => (
                      <QuickChip
                        key={item}
                        text={item}
                        onClick={() => applyQuickCommand(item)}
                      />
                    ))}
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="mb-3 rounded-2xl border border-cyan-300/10 bg-[#050816]/70 p-3">
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

                  <div className="rounded-2xl border border-cyan-300/15 bg-[#050816]/82 p-2 transition-all duration-300 focus-within:border-cyan-300/40 focus-within:shadow-[0_0_30px_rgba(97,239,255,0.1)]">
                    <div className="flex gap-2">
                      <button
                        onClick={handleManualVoiceClick}
                        disabled={isSending || isJarvisMode}
                        className={`rounded-xl border px-4 py-3 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 ${
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
                        className={`rounded-xl border px-4 py-3 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 ${
                          isJarvisMode
                            ? "border-orange-400/30 bg-orange-400/[0.08] text-orange-200"
                            : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-300/[0.1]"
                        }`}
                      >
                        {isJarvisMode ? "Parar Jarvis" : "Modo Jarvis"}
                      </button>

                      <button
                        onClick={handleAttachClick}
                        className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-black text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[0.1]"
                      >
                        Anexar
                      </button>

                      <input
                        value={message}
                        disabled={isSending}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleSend();
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
                        placeholder="Digite um comando para o ORION..."
                      />

                      <button
                        onClick={() => void handleSend()}
                        disabled={isSending}
                        className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-black transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_24px_rgba(97,239,255,0.22)] disabled:opacity-50"
                      >
                        {isSending ? "..." : "Enviar"}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600">
                    Falar: clique para gravar e clique novamente para enviar.
                    Modo Jarvis: responde automaticamente quando você parar de
                    falar.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 flex-col gap-4 overflow-hidden xl:flex">
            <Panel title="MEMÓRIA">
  <p className="mb-3 text-xs text-slate-500">
    Informações que o ORION deve considerar nas respostas. Agora isso fica salvo
    no Supabase por usuário.
  </p>

  {isMemoryLoading && (
    <div className="mb-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3 text-xs text-cyan-100">
      Carregando memória...
    </div>
  )}

  <textarea
    value={memoryText}
    disabled={isMemoryLoading}
    onChange={(event) => setMemoryText(event.target.value)}
    className="orion-scroll h-32 w-full resize-none rounded-2xl border border-cyan-300/10 bg-black/30 p-3 text-sm text-slate-200 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-cyan-300/40 focus:shadow-[0_0_24px_rgba(97,239,255,0.08)] disabled:opacity-50"
    placeholder="Ex: trabalho com e-commerce, vendo produtos físicos, foco em Meta Ads, quero respostas diretas..."
  />

  <div className="mt-3 grid grid-cols-2 gap-2">
    <button
      onClick={() => void saveMemoryToSupabase()}
      disabled={isMemoryLoading || isMemorySaving}
      className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-sm font-bold text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.12] disabled:opacity-50"
    >
      {isMemorySaving ? "Salvando..." : "Salvar memória"}
    </button>

    <button
      onClick={() => {
        setMemoryText("");
        void saveMemoryToSupabase("");
      }}
      disabled={isMemoryLoading || isMemorySaving}
      className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-sm font-bold text-red-200 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-400/[0.1] disabled:opacity-50"
    >
      Limpar
    </button>
  </div>

  {memoryStatus && (
    <p className="mt-3 text-xs text-slate-400">
      {memoryStatus}
    </p>
  )}
</Panel>

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

            <Panel title="ROADMAP">
              <RoadmapItem done text="Autenticação web" />
              <RoadmapItem done text="Chat real com IA" />
              <RoadmapItem done text="Roteador de modelos" />
              <RoadmapItem done text="Voz ElevenLabs" />
              <RoadmapItem done text="Modo Jarvis beta" />
              <RoadmapItem done text="Geoide 3D" />
              <RoadmapItem text="Memória persistente" />
            </Panel>
          </aside>
        </section>
      </div>

      <style jsx global>{`
        .orion-scroll::-webkit-scrollbar {
          width: 10px;
        }

        .orion-scroll::-webkit-scrollbar-track {
          background: rgba(2, 6, 17, 0.82);
          border-left: 1px solid rgba(97, 239, 255, 0.05);
          border-radius: 999px;
        }

        .orion-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(97, 239, 255, 0.14),
            rgba(97, 239, 255, 0.46),
            rgba(123, 97, 255, 0.28)
          );
          border: 2px solid rgba(2, 6, 17, 0.92);
          border-radius: 999px;
        }

        .orion-scroll-thin::-webkit-scrollbar {
          height: 6px;
        }

        .orion-scroll-thin::-webkit-scrollbar-track {
          background: transparent;
        }

        .orion-scroll-thin::-webkit-scrollbar-thumb {
          background: rgba(97, 239, 255, 0.22);
          border-radius: 999px;
        }
      `}</style>
    </main>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap transition-all duration-300 hover:shadow-[0_0_28px_rgba(97,239,255,0.08)] ${
          isUser
            ? "border-orange-400/20 bg-orange-400/[0.06] text-orange-50"
            : "border-cyan-300/15 bg-cyan-300/[0.05] text-slate-200"
        }`}
      >
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] opacity-60">
          {isUser ? "Usuário" : "ORION"}
        </p>

        <div>{message.content}</div>

        {!isUser && message.brain && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-cyan-300/10 pt-3">
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
    <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
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
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all duration-300 hover:-translate-y-0.5 ${
        active
          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
          : "border-slate-600/40 bg-white/[0.02] text-slate-500"
      }`}
    >
      {label}: {active ? "on" : "off"}
    </button>
  );
}

function BrandMark() {
  return (
    <div className="relative h-12 w-12 shrink-0">
      <div className="absolute inset-0 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-300/15 via-violet-400/10 to-orange-300/10 shadow-[0_0_30px_rgba(97,239,255,0.16)]" />
      <div className="absolute inset-[7px] rounded-xl border border-cyan-200/15 bg-[#030817]" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(97,239,255,1)]" />
      <div className="absolute left-1/2 top-1/2 h-8 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-200 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-200">{file.name}</p>
        <p className="text-xs text-slate-500">
          {formatFileSize(file.size)} · {formatFileType(file.type)}
        </p>
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 rounded-full border border-red-400/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-400/10"
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
      : "border-cyan-300/20 bg-cyan-300/10 text-cyan-300";

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
      className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-300 hover:-translate-y-0.5 ${
        active
          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
          : "border-cyan-300/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-cyan-300/12 bg-[#071224]/75 p-4 shadow-[0_0_40px_rgba(97,239,255,0.04)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-300/8 pb-3">
        <span className="text-cyan-300">▸</span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
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
    <div className="flex items-center justify-between border-b border-cyan-300/5 py-2.5 last:border-none">
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

      <div className="h-2 overflow-hidden rounded-full bg-cyan-300/10">
        <div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(97,239,255,0.8)] transition-all duration-300"
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
      className="shrink-0 rounded-full border border-cyan-300/12 bg-cyan-300/[0.05] px-3 py-2 text-xs text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.09] hover:text-cyan-100"
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
    <button className="mb-3 w-full rounded-2xl border border-cyan-300/12 bg-white/[0.02] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.04] last:mb-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <span className="shrink-0 rounded-full border border-cyan-300/15 px-3 py-1 text-[10px] text-cyan-200">
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
            : "bg-cyan-300/30"
        }`}
      />
      <span
        className={done ? "text-sm text-slate-300" : "text-sm text-slate-500"}
      >
        {text}
      </span>
    </div>
  );
}