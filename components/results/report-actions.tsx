"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Share2, Link as LinkIcon, Check, Printer } from "lucide-react";
import type { ResultsData } from "@/lib/results";
import { buildReportHtml } from "@/lib/pdf-report";
import { Button } from "@/components/ui/button";

export function ReportActions({ data }: { data: ResultsData }) {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    try {
      const html = buildReportHtml(data);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prepnexa-report-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded. Open it and use Print → Save as PDF for a PDF copy.");
    } catch {
      toast.error("Failed to download the report.");
    }
  };

  const handlePrint = () => {
    try {
      const html = buildReportHtml(data);
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) {
        toast.error("Popup blocked. Please allow popups to print the report.");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      win.onload = () => {
        win.print();
      };
      toast.success("Use the print dialog to save as PDF.");
    } catch {
      toast.error("Failed to open the print view.");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "My PrepNexa Result",
          text: `I scored ${data.interview.overall_score}/10 on my ${data.interview.job_role ?? "interview"} practice session.`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not share the result.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="gradient" onClick={handleDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download Report
      </Button>
      <Button variant="outline" onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        Print / Save PDF
      </Button>
      <Button variant="outline" onClick={handleShare}>
        {copied ? (
          <Check className="mr-2 h-4 w-4 text-success" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        Share result
      </Button>
      <Button
        variant="ghost"
        className="text-muted-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
            setCopied(true);
            toast.success("Link copied!");
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Could not copy the link.");
          }
        }}
      >
        <LinkIcon className="mr-2 h-4 w-4" />
        Copy link
      </Button>
    </div>
  );
}
