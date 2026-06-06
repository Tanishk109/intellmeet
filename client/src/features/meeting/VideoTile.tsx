import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  muted?: boolean; // mute the <video> element (always true for local to avoid echo)
  micOn?: boolean;
  cameraOn?: boolean;
  isLocal?: boolean;
}

export function VideoTile({
  stream,
  name,
  muted,
  micOn = true,
  cameraOn = true,
  isLocal,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const showVideo = cameraOn && stream && stream.getVideoTracks().length > 0;

  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border border-line bg-ink-850">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "size-full object-cover",
          isLocal && "-scale-x-100", // mirror own camera
          !showVideo && "hidden"
        )}
      />

      {/* Avatar fallback when camera is off */}
      {!showVideo && (
        <div className="grid size-full place-items-center">
          <div className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-signal-500 to-signal-700 text-xl font-bold text-ink-950">
            {initials}
          </div>
        </div>
      )}

      {/* Name + status overlay */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink-950/80 to-transparent p-2.5">
        <span className="truncate text-sm font-medium text-text-hi">
          {name}
          {isLocal && <span className="text-text-lo"> (You)</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {!micOn && (
            <span className="grid size-6 place-items-center rounded-md bg-danger-500/90">
              <MicOff className="size-3.5 text-white" />
            </span>
          )}
          {!cameraOn && (
            <span className="grid size-6 place-items-center rounded-md bg-ink-700">
              <VideoOff className="size-3.5 text-text-mid" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
