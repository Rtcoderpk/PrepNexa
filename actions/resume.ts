"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  parseResumePdf,
  uploadResumeToStorage,
  MAX_RESUME_SIZE_BYTES,
} from "@/services/resume";

export async function uploadResumeAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to upload a resume." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }

  if (!rateLimit(`resume:${user.id}`)) {
    return { error: "Too many uploads. Please try again later." };
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return { error: "File is too large. Maximum size is 5MB." };
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

    return {
      success: true,
      resumeId,
      fileName: parsed.fileName,
      extractedText: parsed.text,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to upload resume.",
    };
  }
}
