// Boot-time env values required by lib/env.ts when a module imports it.
// Tests never hit these services; they only need the module graph to load.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.OLLAMA_URL ??= "http://localhost:11434";
process.env.PYTHONAI_URL ??= "http://localhost:8000";
