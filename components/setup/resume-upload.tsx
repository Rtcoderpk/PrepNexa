"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FileUp, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadResumeAction } from "@/actions/resume";
import { MAX_RESUME_TEXT_CHARS } from "@/lib/validations";

interface ResumeResult {
  fileName: string;
  extractedText: string;
}

export function ResumeUpload({
  onParsed,
}: {
  onParsed: (result: ResumeResult | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resume, setResume] = useState<ResumeResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.set("file", file);

        const result = await uploadResumeAction(formData);

        if (result?.error) {
          toast.error(result.error);
          onParsed(null);
          return;
        }

        if (!result.success) return;

        const parsed: ResumeResult = {
          fileName: result.fileName,
          extractedText: result.extractedText,
        };

        const charCount = parsed.extractedText.length;
        setResume(parsed);
        onParsed(parsed);
        toast.success(
          charCount >= MAX_RESUME_TEXT_CHARS
            ? `Resume processed (truncated to ${MAX_RESUME_TEXT_CHARS.toLocaleString()} characters)`
            : `Resume processed (${charCount.toLocaleString()} characters)`,
        );
      } catch {
        toast.error("Failed to upload resume. Please try again.");
        onParsed(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [onParsed],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Only PDF files are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 5MB.");
        return;
      }
      void processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleRemove = () => {
    setResume(null);
    onParsed(null);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/70 hover:border-primary/50 hover:bg-secondary/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isProcessing ? (
          <>
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Processing your resume…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Extracting text with PDF parser
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">
              Drop your resume here, or{" "}
              <span className="text-primary">browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF up to 5MB. Optional — Alex will tailor questions to it.
            </p>
          </>
        )}
      </div>

      {resume && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3"
        >
          <FileText className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resume.fileName}</p>
            <p className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" />
              {resume.extractedText.length.toLocaleString()} characters
              extracted
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove resume"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
