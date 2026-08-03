"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Rocket, FileText, AlignLeft } from "lucide-react";
import { startInterviewAction } from "@/actions/interview";
import { ResumeUpload } from "@/components/setup/resume-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function SetupForm() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState<{
    fileName: string;
    extractedText: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"role" | "description">("role");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedRole = jobRole.trim();
    const trimmedDescription = jobDescription.trim();

    if (mode === "role" && trimmedRole.length < 2) {
      toast.error("Please enter a job role (e.g. Senior Frontend Engineer).");
      return;
    }

    if (mode === "description" && trimmedDescription.length < 20) {
      toast.error(
        "Please paste a job description (at least 20 characters).",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("jobRole", mode === "role" ? trimmedRole : "");
      formData.set(
        "jobDescription",
        mode === "description" ? trimmedDescription : "",
      );
      formData.set("resumeText", resume?.extractedText ?? "");
      formData.set("resumeFileName", resume?.fileName ?? "");

      const result = await startInterviewAction(formData);
      if (result?.error) {
        toast.error(result.error);
      }
      router.refresh();
    } catch {
      toast.error("Failed to start the interview. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="glass">
        <CardContent className="space-y-5 pt-6">
          <div>
            <Label className="mb-2 block">Interview target</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("role")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  mode === "role"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 hover:border-primary/30 hover:bg-secondary/50",
                )}
              >
                <Rocket className="h-4 w-4" />
                Job role
              </button>
              <button
                type="button"
                onClick={() => setMode("description")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  mode === "description"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 hover:border-primary/30 hover:bg-secondary/50",
                )}
              >
                <AlignLeft className="h-4 w-4" />
                Paste job description
              </button>
            </div>
          </div>

          {mode === "role" ? (
            <div className="space-y-2">
              <Label htmlFor="jobRole">Job role</Label>
              <Input
                id="jobRole"
                placeholder="e.g. Senior Frontend Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                maxLength={100}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="jobDescription">Job description</Label>
              <Textarea
                id="jobDescription"
                placeholder="Paste the job description here…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                maxLength={5000}
                className="min-h-[180px]"
              />
              <p className="text-right text-xs text-muted-foreground">
                {jobDescription.length} / 5000
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resume (optional)
            </Label>
            <ResumeUpload
              onParsed={(result) =>
                setResume(result ?? null)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        variant="gradient"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up your interview…
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            Start interview with Alex
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your interview has up to 5 questions across introduction, technical,
        behavioral, scenario, and problem-solving categories.
      </p>
    </form>
  );
}
