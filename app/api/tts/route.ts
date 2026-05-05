import { NextRequest, NextResponse } from "next/server";

function cleanTextForVoice(text: string) {
  return text
    .replace(/\[Sistema:[\s\S]*?\]/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1400);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText = String(body.text || "").trim();
    const text = cleanTextForVoice(rawText);

    if (!text) {
      return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY não configurada." },
        { status: 500 }
      );
    }

    if (!process.env.ELEVENLABS_VOICE_ID) {
      return NextResponse.json(
        { error: "ELEVENLABS_VOICE_ID não configurado." },
        { status: 500 }
      );
    }

    const model = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";
    const outputFormat =
      process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
    const latency = process.env.ELEVENLABS_LATENCY || "2";

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}?output_format=${outputFormat}&optimize_streaming_latency=${latency}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.28,
            similarity_boost: 0.88,
            style: 0.62,
            use_speaker_boost: true,
          },
        }),
      }
    );

    const arrayBuffer = await response.arrayBuffer();

    if (!response.ok) {
      const errorText = Buffer.from(arrayBuffer).toString("utf8");

      return NextResponse.json(
        {
          error: errorText || "Erro ao gerar áudio no ElevenLabs.",
        },
        { status: response.status }
      );
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro inesperado no TTS.",
      },
      { status: 500 }
    );
  }
}