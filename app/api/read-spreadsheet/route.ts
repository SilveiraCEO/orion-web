import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

function truncateText(text: string, maxLength = 12000) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n\n[Conteúdo truncado para não exceder o limite.]";
}

function sheetToReadableText(workbook: XLSX.WorkBook) {
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, 6)) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    parts.push(`\n# Aba: ${sheetName}`);
    parts.push(`Total de linhas lidas: ${rows.length}`);

    if (rows.length === 0) {
      parts.push("Aba vazia.");
      continue;
    }

    const columns = Object.keys(rows[0] ?? {});
    parts.push(`Colunas: ${columns.join(", ")}`);

    const previewRows = rows.slice(0, 80);

    parts.push("\nPrévia dos dados:");
    previewRows.forEach((row, index) => {
      const line = columns
        .map((column) => `${column}: ${String(row[column] ?? "").trim()}`)
        .join(" | ");

      parts.push(`${index + 1}. ${line}`);
    });

    if (rows.length > previewRows.length) {
      parts.push(
        `\n[Foram exibidas ${previewRows.length} de ${rows.length} linhas nesta aba.]`
      );
    }
  }

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId obrigatório." },
        { status: 400 }
      );
    }

    const { data: file, error: fileError } = await supabase
      .from("orion_files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    const isSpreadsheet =
      file.file_type?.includes("spreadsheet") ||
      file.file_type?.includes("excel") ||
      file.file_type?.includes("csv") ||
      file.file_name?.toLowerCase().endsWith(".xlsx") ||
      file.file_name?.toLowerCase().endsWith(".xls") ||
      file.file_name?.toLowerCase().endsWith(".csv");

    if (!isSpreadsheet) {
      return NextResponse.json(
        { error: "Este arquivo não é uma planilha suportada." },
        { status: 400 }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(file.bucket)
      .download(file.path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Erro ao baixar a planilha." },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: false,
    });

    const extractedText = sheetToReadableText(workbook);
    const finalText = truncateText(extractedText, 50000);

    await supabase
      .from("orion_files")
      .update({
        extracted_text: finalText,
        analysis_status: "processed",
      })
      .eq("id", fileId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      text: truncateText(extractedText, 12000),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erro interno ao ler planilha.",
        details: String(error),
      },
      { status: 500 }
    );
  }
}