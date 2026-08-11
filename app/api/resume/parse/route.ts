import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { parseResumePdf } from "@/services/resume";

export const runtime = "nodejs";

/**
 * Server-side PDF → text extraction. pdf-parse needs Node APIs (fs), so it can
 * only run server-side — never in a client component. Upload a PDF, get back
 * the extracted text.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimitAsync(`resume-parse:${user.id}`, 20))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const parsed = await parseResumePdf(file);
    return NextResponse.json({
      text: parsed.text,
      fileName: parsed.fileName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not read the PDF.",
      },
      { status: 500 },
    );
  }
}