import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: "Nenhum áudio recebido." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const transcriptionForm = new FormData();
    transcriptionForm.append("file", audio);
    transcriptionForm.append(
      "model",
      process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe"
    );
    transcriptionForm.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: transcriptionForm,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Erro ao transcrever áudio." },
        { status: response.status }
      );
    }

    return NextResponse.json({
      text: data.text || "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado na transcrição.",
      },
      { status: 500 }
    );
  }
}