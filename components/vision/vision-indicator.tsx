"use client";

import { motion } from "framer-motion";
import { Camera, CameraOff, Eye, Activity } from "lucide-react";
import type { VisionRuntimeState } from "@/hooks/use-vision-metrics";
import { Button } from "@/components/ui/button";

interface VisionIndicatorProps {
  vision: VisionRuntimeState;
  onToggle: () => void;
}

function confidenceTone(confidence: number | null): {
  label: string;
  color: string;
} {
  if (confidence === null) return { label: "Analyzing…", color: "text-muted-foreground" };
  if (confidence >= 70) return { label: "Confident", color: "text-emerald-500" };
  if (confidence >= 45) return { label: "Steady", color: "text-amber-500" };
  return { label: "Nervous", color: "text-rose-500" };
}

/**
 * Live vision indicator shown during an interview: camera toggle + real-time
 * confidence and eye-contact readouts. Camera frames never leave the browser.
 */
export function VisionIndicator({ vision, onToggle }: VisionIndicatorProps) {
  const isActive = vision.status === "running" || vision.status === "loading";
  const tone = confidenceTone(vision.liveConfidence);

  return (
    <div className="flex items-center gap-2">
      {isActive && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium backdrop-blur"
          >
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className={tone.color}>{tone.label}</span>
            {vision.liveConfidence !== null && (
              <span className="text-muted-foreground">
                {Math.round(vision.liveConfidence)}%
              </span>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium backdrop-blur"
            title="Eye contact"
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            {vision.liveEyeContact !== null && (
              <span className="text-muted-foreground">
                {Math.round(vision.liveEyeContact * 100)}%
              </span>
            )}
          </motion.div>
        </>
      )}

      <Button
        type="button"
        size="sm"
        variant={vision.isCameraOn ? "secondary" : "outline"}
        onClick={onToggle}
        className="gap-1.5 text-xs"
        title={
          vision.isCameraOn
            ? "Stop camera analysis"
            : vision.status === "error"
              ? vision.error ?? "Retry camera analysis"
              : "Enable camera analysis"
        }
      >
        {vision.isCameraOn ? (
          <CameraOff className="h-3.5 w-3.5" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {vision.isCameraOn ? "Camera on" : "Camera"}
      </Button>
    </div>
  );
}
