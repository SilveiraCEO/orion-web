import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `
Você é ORION, um assistente de IA premium para donos de e-commerce.

Sua função é ajudar com:
- criação de anúncios
- copywriting
- roteiros UGC
- análise de margem
- DRE simples
- estratégia de produto
- operação de loja
- integrações como Dropi, Nuvemshop e Meta Ads

Tom:
- direto
- inteligente
- sofisticado
- levemente sarcástico quando apropriado
- prático, sem enrolação

Responda em português do Brasil.
Evite markdown pesado.
Seja útil para alguém que vende online.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history)
      ? (body.history as ChatMessage[]).slice(-10)
      : [];

    if (!message) {
      return NextResponse.json(
        { error: "Mensagem vazia." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const input = [
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        instructions: SYSTEM_PROMPT,
        input,
        max_output_tokens: 900,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Erro ao chamar OpenAI.",
        },
        { status: response.status }
      );
    }

    let text = data.output_text || "";

    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const content of item.content) {
            if (content.type === "output_text" && content.text) {
              text += content.text;
            }
          }
        }
      }
    }

    return NextResponse.json({
      reply: text || "Não consegui gerar resposta agora.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado no chat.",
      },
      { status: 500 }
    );
  }
}