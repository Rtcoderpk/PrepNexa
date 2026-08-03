"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
} from "@/lib/validations";

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const fwd = headerList.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`)) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: error.message === "Invalid login credentials"
        ? "Incorrect email or password"
        : error.message,
    };
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const parsed = signupSchema.safeParse({
    fullName,
    email,
    password,
    confirmPassword,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const ip = await getClientIp();
  if (!rateLimit(`signup:${ip}`)) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user || data.user.identities?.length === 0) {
    return {
      error: "An account with this email already exists. Please sign in.",
    };
  }

  redirect("/login?message=Account created! Please check your email to confirm.");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const ip = await getClientIp();
  if (!rateLimit(`forgot:${ip}`)) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password`,
    },
  );

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "If an account exists for that email, a reset link has been sent.",
  };
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
