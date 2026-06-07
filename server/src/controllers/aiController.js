import Meeting from "../models/Meeting.js";
import Summary from "../models/Summary.js";
import { ApiError, asyncHandler, isMember } from "../utils/helpers.js";

// --- Mock AI (default) ---------------------------------------------------
// The frontend already ships with hardcoded AI text. These mocks produce the
// same shapes so the UI works with zero external keys. If OPENAI_API_KEY is
// set, callOpenAI() is used instead.

function mockSummaryFromTranscript(transcript, meeting) {
  const base = transcript?.trim() ? transcript : `Discussion for "${meeting.title}".`;
  return {
    summary:
      `The team reviewed progress on ${meeting.title}. Key updates were shared, ` +
      `blockers discussed, and next steps agreed. ${base.slice(0, 140)}`,
    keyPoints: [
      "Frontend progress reviewed",
      "Dashboard enhancements discussed",
      "Action items assigned to owners",
    ],
    actionItems: [
      { text: "Finalize dashboard UI", assignee: "Frontend Team", done: false },
      { text: "Prepare client demo", assignee: meeting.title.includes("Client") ? "Lead" : "PM", done: false },
    ],
    accuracy: 88,
    generatedBy: "mock",
  };
}

async function callOpenAI(transcript, meeting) {
  // Minimal Chat Completions call. Kept dependency-free via fetch (Node 18+).
  const prompt =
    `Summarize this meeting transcript. Return STRICT JSON with keys: ` +
    `summary (string), keyPoints (string[]), actionItems ({text,assignee}[]).\n\n` +
    `Meeting: ${meeting.title}\nTranscript:\n${transcript}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 600,
    }),
  });
  if (!resp.ok) throw new ApiError(502, "AI provider error");
  const data = await resp.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return {
    summary: parsed.summary || "",
    keyPoints: parsed.keyPoints || [],
    actionItems: (parsed.actionItems || []).map((a) => ({
      text: a.text,
      assignee: a.assignee || "Unassigned",
      done: false,
    })),
    accuracy: 90,
    generatedBy: "openai",
  };
}

// POST /api/ai/meetings/:code/summary  { transcript }
export const generateSummary = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isMember(meeting, req.user)) {
    throw new ApiError(403, "You don't have access to this meeting");
  }

  const transcript = req.body.transcript || "";
  const result = process.env.OPENAI_API_KEY
    ? await callOpenAI(transcript, meeting)
    : mockSummaryFromTranscript(transcript, meeting);

  const summary = await Summary.findOneAndUpdate(
    { meeting: meeting._id },
    { meeting: meeting._id, transcript, ...result },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, summary: summary.toPublic() });
});

// GET /api/ai/meetings/:code/summary
export const getSummary = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isMember(meeting, req.user)) {
    throw new ApiError(403, "You don't have access to this meeting");
  }
  const summary = await Summary.findOne({ meeting: meeting._id });
  if (!summary) throw new ApiError(404, "No summary generated yet");
  res.json({ success: true, summary: summary.toPublic() });
});

// PATCH /api/ai/summaries/:id/action-items/:itemId  { done }
export const toggleActionItem = asyncHandler(async (req, res) => {
  const summary = await Summary.findById(req.params.id);
  if (!summary) throw new ApiError(404, "Summary not found");
  const meeting = await Meeting.findById(summary.meeting);
  if (!meeting || !isMember(meeting, req.user)) {
    throw new ApiError(403, "You don't have access to this summary");
  }
  const item = summary.actionItems.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Action item not found");
  item.done = req.body.done ?? !item.done;
  await summary.save();
  res.json({ success: true, summary: summary.toPublic() });
});

// POST /api/ai/chat  { message }  -> powers the AIChatbot widget
export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) throw new ApiError(400, "message is required");

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      success: true,
      reply: `I'm the IntellMeet assistant. You said: "${message}". I can summarize meetings, list action items, and help you schedule.`,
    });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are the IntellMeet meeting assistant." },
        { role: "user", content: message },
      ],
      max_tokens: 300,
    }),
  });
  if (!resp.ok) throw new ApiError(502, "AI provider error");
  const data = await resp.json();
  res.json({ success: true, reply: data.choices?.[0]?.message?.content || "" });
});
