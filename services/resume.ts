import { createClient } from "@/lib/supabase/server";
import { MAX_RESUME_TEXT_CHARS } from "@/lib/validations";

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf"];
const MAX_PARSE_ATTEMPTS = 2;

interface ParsedResume {
  text: string;
  fileName: string;
  size: number;
}

export async function parseResumePdf(
  file: File,
): Promise<ParsedResume> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are supported");
  }

  if (!ACCEPTED_TYPES.includes(file.type) && file.type !== "") {
    throw new Error("Invalid file type. Please upload a PDF.");
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // pdf-parse can be flaky on some documents; retry once before failing.
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      const text = result.text ?? "";
      if (!text.trim()) {
        throw new Error("No extractable text found in this PDF");
      }
      return {
        text: text.slice(0, MAX_RESUME_TEXT_CHARS),
        fileName: file.name,
        size: file.size,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? new Error(`Could not read the PDF: ${lastError.message}`)
    : new Error("Could not read the PDF file");
}

export async function uploadResumeToStorage(params: {
  userId: string;
  file: File;
  parsed: ParsedResume;
}): Promise<string> {
  const supabase = await createClient();
  const { userId, file, parsed } = params;

  const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Failed to upload resume. Please try again.");
  }

  const { data, error } = await supabase
    .from("resume_files")
    .insert({
      user_id: userId,
      storage_path: storagePath,
      file_name: parsed.fileName,
      file_size: parsed.size,
      extracted_text: parsed.text,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage
      .from("resumes")
      .remove([storagePath])
      .catch(() => {});
    throw new Error("Failed to save resume details");
  }

  return data.id;
}
