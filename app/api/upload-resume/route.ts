import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  parseResumePdf,
  uploadResumeToStorage,
  MAX_RESUME_SIZE_BYTES,
} from "@/services/resume";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimitAsync(`resume:${user.id}`))) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided." },
      { status: 400 },
    );
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 5MB." },
      { status: 400 },
    );
  }

  try {
    const parsed = await parseResumePdf(file);
    const resumeId = await uploadResumeToStorage({
      userId: user.id,
      file,
      parsed,
    });

    revalidatePath("/setup");
    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      resumeId,
      fileName: parsed.fileName,
      extractedText: parsed.text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload resume.",
      },
      { status: 500 },
    );
  }
}
