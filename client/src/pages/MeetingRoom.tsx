import { useMemo, useRef, useState } from "react";
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
  CalendarClock,
  ExternalLink,
  FileText,
  ListChecks,
  Radio,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Captions,
  Circle,
  Square,
  X,
} from "lucide-react";
import { Spinner, Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { aiApi, meetingApi } from "@/api";
import { useAuth } from "@/stores/auth";
import { useWebRTC } from "@/features/meeting/useWebRTC";
import { useCaptions } from "@/features/meeting/useCaptions";
import { VideoTile } from "@/features/meeting/VideoTile";
import { ChatPanel } from "@/features/meeting/ChatPanel";
import { apiErrorMessage } from "@/lib/http";
import {
  isMeetingJoinable,
  isMeetingOver,
  minutesUntilClose,
  minutesUntilOpen,
} from "@/lib/meetingState";
import { formatMeetingWhen, parseEmails } from "@/lib/meetings";
import { cn } from "@/lib/utils";
import type { Meeting, Summary } from "@/types";

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

  const {
    data: meeting,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["meeting", code],
    queryFn: () => meetingApi.get(code!),
    enabled: !!code,
  });

  const joinable = meeting ? isMeetingJoinable(meeting) : false;
  const finalized = meeting ? isMeetingOver(meeting) : false;

  const { data: summary } = useQuery({
    queryKey: ["summary", code],
    queryFn: () => aiApi.getSummary(code!),
    enabled: !!code && finalized,
    retry: false,
  });

  const {
    localStream,
    remotePeers,
    micOn,
    cameraOn,
    sharing,
    participantCount,
    error,
    socket,
    toggleMic,
    toggleCamera,
    toggleShare,
    leave,
  } = useWebRTC(joinable ? code : undefined, user?.name ?? "Guest");

  const captions = useCaptions(socket, code ?? "", user?.name ?? "Guest");
  const [chatOpen, setChatOpen] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [recording, setRecording] = useState(false);
  const [endingMeeting, setEndingMeeting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

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

  const recordingMutation = useMutation({
    mutationFn: (blob: Blob) => meetingApi.uploadRecording(code!, blob),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meeting", code] });
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      push("Recording uploaded successfully", "success");
    },
    onError: (err) => push(apiErrorMessage(err), "error"),
  });

  const transcriptText = useMemo(
    () => captions.captions.map((caption) => `${caption.name}: ${caption.text}`).join("\n"),
    [captions.captions]
  );

  const handleLeave = () => {
    leave();
    navigate("/app/meetings");
  };

  const startRecording = async () => {
    try {
      if (!window.MediaRecorder) {
        push("Recording is not supported in this browser", "error");
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      recordingChunksRef.current = [];
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(displayStream, options);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setRecording(false);
        const blob = new Blob(recordingChunksRef.current, {
          type: (recorder.mimeType || mimeType || "video/webm").split(";")[0],
        });
        if (blob.size > 0) recordingMutation.mutate(blob);
        else push("No recording data was captured", "error");
        displayStream.getTracks().forEach((track) => track.stop());
      };

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
        recorderRef.current = null;
      });

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      push("Recording started", "info");
    } catch {
      push("Screen recording permission was denied", "error");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const handleEndMeeting = async () => {
    if (endingMeeting) return;
    setEndingMeeting(true);

    if (recording) stopRecording();

    if (transcriptText.trim()) {
      try {
        await meetingApi.saveTranscript(code!, transcriptText);
        await aiApi.generateSummary(code!, transcriptText);
        void qc.invalidateQueries({ queryKey: ["summary", code] });
      } catch {
        push("Transcript could not be saved before ending", "error");
      }
    }

    try {
      await endMutation.mutateAsync();
    } finally {
      setEndingMeeting(false);
    }
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

  // The backend enforces host-only start/end; only show those controls to the
  // actual host so non-hosts don't get 403s.
  const isHost = !!user && meeting.host === user.id;

  if (finalized) {
    return (
      <MeetingDetails
        meeting={meeting}
        summary={summary ?? null}
        onBack={() => navigate("/app/meetings")}
      />
    );
  }

  if (meeting.status === "scheduled" && !joinable) {
    return <MeetingNotOpen meeting={meeting} onBack={() => navigate("/app/meetings")} />;
  }

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
            {meeting.status === "ended" && joinable && (
              <p className="mt-1 text-xs text-ai-400">
                Join remains open for {minutesUntilClose(meeting)} more minutes.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-text-mid">
            <Users className="size-4" /> {participantCount}
          </span>
          {isHost && meeting.status === "scheduled" && (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || !joinable}
            >
              {startMutation.isPending ? <Spinner /> : "Start meeting"}
            </Button>
          )}
          {isHost && meeting.status === "live" && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => void handleEndMeeting()}
              disabled={endMutation.isPending || endingMeeting}
            >
              {endMutation.isPending || endingMeeting ? <Spinner /> : "End for all"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-ai-500/30 bg-ai-500/10 px-4 py-2.5 text-sm text-ai-400">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stage: video grid + optional chat side panel */}
      <div className="flex gap-4">
        <div className="relative min-w-0 flex-1">
          <div className={cn("grid gap-3", cols)}>
            <VideoTile
              stream={localStream}
              name={user?.name ?? "You"}
              muted
              isLocal
              micOn={micOn}
              cameraOn={cameraOn || sharing}
              mirror={!sharing}
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
            <p className="mt-4 text-center text-sm text-text-lo">
              Waiting for others to join… share the code{" "}
              <span className="font-mono text-text-mid">{meeting.code}</span> to invite people.
            </p>
          )}

          {/* Live captions overlay */}
          {captionsVisible && captions.captions.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto max-w-2xl px-4">
              <div className="rounded-xl bg-ink-950/85 px-4 py-2.5 backdrop-blur">
                {captions.captions.slice(-2).map((c, i) => (
                  <p key={c.at + i} className="text-sm leading-snug text-text-hi">
                    <span className="font-medium text-signal-400">{c.name}:</span> {c.text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat side panel */}
        {chatOpen && (
          <aside className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-ink-850/70 md:flex">
            <div className="flex items-center justify-between border-b border-line py-1.5 pl-1 pr-2">
              <span className="pl-3 text-xs text-text-lo">Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                className="grid size-7 place-items-center rounded-md text-text-lo hover:bg-ink-700 hover:text-text-hi"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel socket={socket} code={code!} myName={user?.name ?? "Guest"} />
            </div>
          </aside>
        )}
      </div>

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

        {/* Captions toggle (only when the browser supports speech recognition) */}
        {captions.supported && (
          <ControlButton
            active={!captions.enabled}
            onClick={() => {
              captions.toggle();
              setCaptionsVisible(true);
            }}
            label={captions.enabled ? "Turn off captions" : "Turn on captions"}
          >
            <Captions className={cn("size-5", captions.enabled && "text-signal-400")} />
          </ControlButton>
        )}

        {isHost && meeting.status === "live" && (
          <ControlButton
            active={!recording}
            onClick={
              recordingMutation.isPending
                ? () => undefined
                : recording
                  ? stopRecording
                  : () => void startRecording()
            }
            label={
              recordingMutation.isPending
                ? "Uploading recording"
                : recording
                  ? "Stop recording"
                  : "Start recording"
            }
          >
            {recordingMutation.isPending ? (
              <Spinner className="size-5" />
            ) : recording ? (
              <Square className="size-5 text-danger-500" />
            ) : (
              <Circle className="size-5" />
            )}
          </ControlButton>
        )}

        {/* Chat toggle */}
        <ControlButton
          active={!chatOpen}
          onClick={() => setChatOpen((v) => !v)}
          label={chatOpen ? "Close chat" : "Open chat"}
        >
          <MessageSquare className={cn("size-5", chatOpen && "text-signal-400")} />
        </ControlButton>

        <div className="mx-1 h-8 w-px bg-line" />
        <ControlButton danger onClick={handleLeave} label="Leave meeting">
          <PhoneOff className="size-5" />
        </ControlButton>
      </div>
    </div>
  );
}

function MeetingNotOpen({ meeting, onBack }: { meeting: Meeting; onBack: () => void }) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-ai-500/15 text-ai-400">
          <CalendarIcon />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-text-hi">{meeting.title}</h1>
          <p className="mt-2 text-sm text-text-mid">
            This meeting is scheduled for {formatMeetingWhen(meeting)}.
          </p>
          <p className="mt-2 text-xs text-text-lo">
            The room opens 15 minutes before start time. Opens in {minutesUntilOpen(meeting)}{" "}
            minutes.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to meetings
        </Button>
      </Card>
    </div>
  );
}

function CalendarIcon() {
  return <CalendarClock className="size-6" />;
}

function MeetingDetails({
  meeting,
  summary,
  onBack,
}: {
  meeting: Meeting;
  summary: Summary | null;
  onBack: () => void;
}) {
  const attendees = meeting.attendees ?? [];
  const invited = parseEmails(meeting.emails);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to meetings">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-text-hi">{meeting.title}</h1>
              <Badge tone="muted">Over</Badge>
            </div>
            <p className="mt-1 text-sm text-text-mid">{formatMeetingWhen(meeting)}</p>
            <p className="mt-1 font-mono text-xs text-text-lo">{meeting.code}</p>
          </div>
        </div>
        {meeting.recordingUrl && (
          <Button onClick={() => window.open(meeting.recordingUrl, "_blank", "noopener")}>
            <ExternalLink className="size-4" /> Open recording
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display font-semibold text-text-hi">
              <ListChecks className="size-4 text-signal-400" /> Agenda
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-mid">
              {meeting.description || "No agenda was added for this meeting."}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display font-semibold text-text-hi">
              <FileText className="size-4 text-ai-400" /> Transcript
            </h2>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink-950/40 p-4 text-xs leading-relaxed text-text-mid">
              {summary?.transcript || "No transcript was captured for this meeting."}
            </pre>
          </Card>

          <Card className="p-5">
            <h2 className="font-display font-semibold text-text-hi">Summary</h2>
            <p className="mt-3 text-sm leading-relaxed text-text-mid">
              {summary?.summary || "No summary has been generated yet."}
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display font-semibold text-text-hi">
              <Users className="size-4 text-signal-400" /> Attendees
            </h2>
            <div className="mt-3 space-y-2">
              {attendees.length ? (
                attendees.map((attendee) => (
                  <div
                    key={`${attendee.user}-${attendee.joinedAt}`}
                    className="rounded-lg border border-line bg-ink-900/40 p-3"
                  >
                    <div className="text-sm font-medium text-text-hi">{attendee.name}</div>
                    <div className="text-xs text-text-lo">{attendee.email}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-lo">No attendees were recorded.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display font-semibold text-text-hi">Invited</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {invited.length ? (
                invited.map((email) => (
                  <span
                    key={email}
                    className="rounded-full border border-line bg-ink-900 px-2.5 py-1 text-xs text-text-mid"
                  >
                    {email}
                  </span>
                ))
              ) : (
                <p className="text-sm text-text-lo">No invitees were added.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display font-semibold text-text-hi">Recording</h2>
            {meeting.recordingUrl ? (
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => window.open(meeting.recordingUrl, "_blank", "noopener")}
              >
                <ExternalLink className="size-4" /> Open recording
              </Button>
            ) : (
              <p className="mt-3 text-sm text-text-lo">No recording was saved.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
