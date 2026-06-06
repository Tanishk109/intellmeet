import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Users,
  Radio,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { Spinner, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { meetingApi } from "@/api";
import { useAuth } from "@/stores/auth";
import { useWebRTC } from "@/features/meeting/useWebRTC";
import { VideoTile } from "@/features/meeting/VideoTile";
import { cn } from "@/lib/utils";

/** Pick a grid column count that keeps tiles reasonably sized. */
function gridCols(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

function ControlButton({
  active,
  danger,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-12 place-items-center rounded-full transition-all active:scale-95",
        danger
          ? "bg-danger-500 text-white hover:bg-danger-500/90"
          : active
            ? "bg-ink-700 text-text-hi hover:bg-ink-600"
            : "bg-danger-500/90 text-white hover:bg-danger-500"
      )}
    >
      {children}
    </button>
  );
}

export default function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const user = useAuth((s) => s.user);

  const { data: meeting, isLoading, isError } = useQuery({
    queryKey: ["meeting", code],
    queryFn: () => meetingApi.get(code!),
    enabled: !!code,
  });

  const {
    localStream,
    remotePeers,
    micOn,
    cameraOn,
    sharing,
    participantCount,
    error,
    toggleMic,
    toggleCamera,
    toggleShare,
    leave,
  } = useWebRTC(code, user?.name ?? "Guest");

  const startMutation = useMutation({
    mutationFn: () => meetingApi.start(code!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meeting", code] });
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      push("Meeting is live", "success");
    },
  });

  const endMutation = useMutation({
    mutationFn: () => meetingApi.end(code!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meeting", code] });
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      push("Meeting ended", "info");
      handleLeave();
    },
  });

  const handleLeave = () => {
    leave();
    navigate("/app/meetings");
  };

  const totalTiles = remotePeers.length + 1;
  const cols = useMemo(() => gridCols(totalTiles), [totalTiles]);

  if (isLoading) {
    return (
      <div className="grid h-[70vh] place-items-center">
        <Spinner className="size-6 text-signal-400" />
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-20 text-center">
        <AlertTriangle className="size-10 text-ai-400" />
        <h1 className="font-display text-xl font-bold text-text-hi">Meeting not found</h1>
        <p className="text-sm text-text-mid">
          The code <span className="font-mono">{code}</span> doesn't match any meeting.
        </p>
        <Button variant="outline" onClick={() => navigate("/app/meetings")}>
          <ArrowLeft className="size-4" /> Back to meetings
        </Button>
      </div>
    );
  }

  const isHost = true; // backend enforces host-only on start/end; UI shows controls

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Leave">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-text-hi">{meeting.title}</h1>
              {meeting.status === "live" ? (
                <Badge tone="signal" className="animate-pulse-ring">
                  <Radio className="size-3" /> Live
                </Badge>
              ) : (
                <Badge tone="muted" className="capitalize">
                  {meeting.status}
                </Badge>
              )}
            </div>
            <p className="font-mono text-xs text-text-lo">{meeting.code}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-text-mid">
            <Users className="size-4" /> {participantCount}
          </span>
          {isHost && meeting.status === "scheduled" && (
            <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              {startMutation.isPending ? <Spinner /> : "Start meeting"}
            </Button>
          )}
          {isHost && meeting.status === "live" && (
            <Button size="sm" variant="danger" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>
              {endMutation.isPending ? <Spinner /> : "End for all"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-ai-500/30 bg-ai-500/10 px-4 py-2.5 text-sm text-ai-400">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Video grid */}
      <div className={cn("grid gap-3", cols)}>
        <VideoTile
          stream={localStream}
          name={user?.name ?? "You"}
          muted
          isLocal
          micOn={micOn}
          cameraOn={cameraOn}
        />
        {remotePeers.map((peer) => (
          <VideoTile
            key={peer.socketId}
            stream={peer.stream}
            name={peer.name}
            micOn={peer.micOn}
            cameraOn={peer.cameraOn}
          />
        ))}
      </div>

      {remotePeers.length === 0 && (
        <p className="text-center text-sm text-text-lo">
          Waiting for others to join… share the code{" "}
          <span className="font-mono text-text-mid">{meeting.code}</span> to invite people.
        </p>
      )}

      {/* Control bar */}
      <div className="sticky bottom-4 z-10 mx-auto flex items-center gap-3 rounded-full border border-line bg-ink-850/90 px-5 py-3 shadow-xl backdrop-blur">
        <ControlButton active={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </ControlButton>
        <ControlButton
          active={cameraOn}
          onClick={toggleCamera}
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          {cameraOn ? <VideoIcon className="size-5" /> : <VideoOff className="size-5" />}
        </ControlButton>
        <ControlButton
          active={!sharing}
          onClick={() => void toggleShare()}
          label={sharing ? "Stop sharing" : "Share screen"}
        >
          <MonitorUp className={cn("size-5", sharing && "text-signal-400")} />
        </ControlButton>
        <div className="mx-1 h-8 w-px bg-line" />
        <ControlButton danger onClick={handleLeave} label="Leave meeting">
          <PhoneOff className="size-5" />
        </ControlButton>
      </div>
    </div>
  );
}
