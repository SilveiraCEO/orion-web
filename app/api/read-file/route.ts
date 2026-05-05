import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import pdf from "pdf-parse";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: "fileId obrigatório" }, { status: 400 });
    }

    // busca metadata
    const { data: file, error } = await supabase
      .from("orion_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    // baixa arquivo
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(file.bucket)
      .download(file.path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Erro ao baixar arquivo" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    let extractedText = "";

    // PDF
    if (file.file_type === "application/pdf") {
      const parsed = await pdf(buffer);
      extractedText = parsed.text;
    }

    // TXT / CSV
    else if (
      file.file_type.includes("text") ||
      file.file_type.includes("csv") ||
      file.file_name.endsWith(".txt")
    ) {
      extractedText = buffer.toString("utf-8");
    }

    // fallback
    else {
      extractedText = "[Arquivo não suportado para leitura automática ainda]";
    }

    // salva texto extraído
    await supabase
      .from("orion_files")
      .update({
        extracted_text: extractedText.slice(0, 50000),
        analysis_status: "processed",
      })
      .eq("id", fileId);

    return NextResponse.json({
      success: true,
      text: extractedText.slice(0, 8000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro interno", details: String(err) },
      { status: 500 }
    );
  }
}