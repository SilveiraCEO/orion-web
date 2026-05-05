import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { fileId, prompt } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId obrigatório" },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada" },
        { status: 500 }
      );
    }

    const { data: file, error } = await supabase
      .from("orion_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (error || !file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado" },
        { status: 404 }
      );
    }

    if (!file.file_type?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Este arquivo não é uma imagem" },
        { status: 400 }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(file.bucket)
      .download(file.path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Erro ao baixar imagem" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.file_type || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const visionPrompt =
      prompt ||
      `Analise esta imagem como um especialista em e-commerce, design, marketing e conversão.
Diga o que aparece, pontos fortes, pontos fracos, melhorias visuais, clareza da mensagem e potencial para anúncio.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: visionPrompt,
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Erro ao analisar imagem",
          details: data,
        },
        { status: 500 }
      );
    }

    const analysis =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "Não consegui extrair uma análise da imagem.";

    await supabase
      .from("orion_files")
      .update({
        extracted_text: analysis.slice(0, 50000),
        analysis_status: "processed",
      })
      .eq("id", fileId);

    return NextResponse.json({
      success: true,
      text: analysis.slice(0, 8000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro interno",
        details: String(err),
      },
      { status: 500 }
    );
  }
}