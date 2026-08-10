import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/usage";

export const runtime = "nodejs";

/** Returns the current user's premium + usage status (server-side truth). */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getUsageStatus(user.id);
  return NextResponse.json(status);
}