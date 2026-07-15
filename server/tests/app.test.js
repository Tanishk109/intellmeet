import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import Meeting from "../src/models/Meeting.js";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_access_secret";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "7d";
delete process.env.OPENAI_API_KEY;

let mongo;
let app;

async function signup(overrides = {}) {
  const body = {
    name: "Test User",
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: "Password123!",
    ...overrides,
  };
  const response = await request(app).post("/api/auth/signup").send(body);
  return { body, response, token: response.body.accessToken, user: response.body.user };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("Health endpoint", () => {
  it("returns an OK response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe("ok");
  });
});

describe("Authentication", () => {
  it("signs up a new user", async () => {
    const { response } = await signup();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toContain("@example.com");
  });

  it("rejects duplicate signup", async () => {
    const email = "duplicate@example.com";
    await signup({ email });

    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Again", email, password: "Password123!" });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("logs in with valid credentials", async () => {
    const { body } = await signup({ email: "login@example.com" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: body.email, password: body.password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects invalid login", async () => {
    await signup({ email: "invalid-login@example.com" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "invalid-login@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("Meetings", () => {
  it("protects meeting endpoints", async () => {
    const response = await request(app).get("/api/meetings");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("prevents a non-host from ending a meeting", async () => {
    const host = await signup({ email: "host@example.com" });
    const guest = await signup({ email: "guest@example.com" });
    const created = await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({ title: "Host Only", date: "2026-07-15", time: "10:00" });

    const response = await request(app)
      .post(`/api/meetings/${created.body.meeting.code}/end`)
      .set(auth(guest.token));

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("lists meetings where the user was invited by email before signup", async () => {
    const host = await signup({ email: "early-host@example.com" });
    const inviteeEmail = "later-invitee@example.com";

    await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({
        title: "Email Invite",
        date: "2026-07-15",
        time: "12:00",
        emails: inviteeEmail,
      });

    const invitee = await signup({ email: inviteeEmail });
    const response = await request(app).get("/api/meetings").set(auth(invitee.token));

    expect(response.status).toBe(200);
    expect(response.body.meetings.some((meeting) => meeting.title === "Email Invite")).toBe(true);
  });

  it("saves transcript text and returns it with recording artifacts", async () => {
    const host = await signup({ email: "artifact-host@example.com" });
    const created = await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({ title: "Artifact Meeting", date: "2026-07-15", time: "13:00" });
    const code = created.body.meeting.code;

    await Meeting.findOneAndUpdate(
      { code },
      { recordingUrl: "http://localhost:5050/uploads/recordings/demo.webm" }
    );

    const transcriptResponse = await request(app)
      .put(`/api/meetings/${code}/transcript`)
      .set(auth(host.token))
      .send({ transcript: "Host: This transcript is stored for later use." });

    const artifactsResponse = await request(app)
      .get("/api/meetings/recordings")
      .set(auth(host.token));

    expect(transcriptResponse.status).toBe(200);
    expect(transcriptResponse.body.transcript).toContain("stored for later use");
    expect(artifactsResponse.status).toBe(200);
    expect(artifactsResponse.body.recordings).toHaveLength(1);
    expect(artifactsResponse.body.recordings[0].recordingUrl).toContain("demo.webm");
    expect(artifactsResponse.body.recordings[0].transcript).toContain("stored for later use");
  });

  it("accepts browser recording MIME types with codec parameters", async () => {
    const host = await signup({ email: "recording-host@example.com" });
    const created = await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({
        title: "Recording Upload",
        date: "2026-07-15",
        time: "13:30",
        scheduledAt: new Date(Date.now() - 60 * 1000).toISOString(),
      });

    const response = await request(app)
      .post(`/api/meetings/${created.body.meeting.code}/recording`)
      .set(auth(host.token))
      .attach("recording", Buffer.from("fake webm data"), {
        filename: "recording.webm",
        contentType: "video/webm;codecs=vp9,opus",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.recordingUrl).toContain("/uploads/recordings/");
    expect(response.body.meeting.recordingUrl).toBe(response.body.recordingUrl);
  });

  it("keeps ended meetings joinable for 15 minutes and closes them after", async () => {
    const host = await signup({ email: "grace-host@example.com" });
    const created = await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({
        title: "Grace Window",
        date: "2026-07-15",
        time: "14:00",
        scheduledAt: new Date(Date.now() - 60 * 1000).toISOString(),
      });
    const code = created.body.meeting.code;

    const started = await request(app).post(`/api/meetings/${code}/start`).set(auth(host.token));
    expect(started.body.meeting.status).toBe("live");

    const ended = await request(app).post(`/api/meetings/${code}/end`).set(auth(host.token));
    expect(ended.body.meeting.status).toBe("ended");
    expect(ended.body.meeting.canJoin).toBe(true);
    expect(ended.body.meeting.joinAvailableUntil).toEqual(expect.any(String));

    await Meeting.findOneAndUpdate(
      { code },
      { endedAt: new Date(Date.now() - 16 * 60 * 1000) }
    );

    const closed = await request(app).get(`/api/meetings/${code}`).set(auth(host.token));
    expect(closed.body.meeting.status).toBe("ended");
    expect(closed.body.meeting.canJoin).toBe(false);
  });

  it("stores exact scheduled time and blocks invalid lifecycle transitions", async () => {
    const host = await signup({ email: "timing-host@example.com" });
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = await request(app)
      .post("/api/meetings")
      .set(auth(host.token))
      .send({
        title: "Future Meeting",
        date: "2026-07-15",
        time: "18:00",
        scheduledAt,
        timezone: "Asia/Kolkata",
      });
    const code = created.body.meeting.code;

    expect(created.status).toBe(201);
    expect(created.body.meeting.scheduledAt).toBe(scheduledAt);
    expect(created.body.meeting.timezone).toBe("Asia/Kolkata");
    expect(created.body.meeting.canJoin).toBe(false);

    const earlyStart = await request(app).post(`/api/meetings/${code}/start`).set(auth(host.token));
    expect(earlyStart.status).toBe(400);

    const endScheduled = await request(app).post(`/api/meetings/${code}/end`).set(auth(host.token));
    expect(endScheduled.status).toBe(400);
  });
});

describe("Tasks", () => {
  it("creates a task for the signed-in user", async () => {
    const { token } = await signup();

    const response = await request(app)
      .post("/api/tasks")
      .set(auth(token))
      .send({ title: "Write tests", priority: "high", status: "todo" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.task.title).toBe("Write tests");
    expect(response.body.task.priority).toBe("high");
  });
});

describe("AI summaries", () => {
  it("generates a mock summary fallback", async () => {
    const { token, user } = await signup();
    const meeting = await Meeting.create({
      title: "Fallback Summary",
      date: "2026-07-15",
      time: "11:00",
      host: user.id,
      participants: [user.id],
    });

    const response = await request(app)
      .post(`/api/ai/meetings/${meeting.code}/summary`)
      .set(auth(token))
      .send({ transcript: "Alex will fix the refresh token bug by Friday." });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary.generatedBy).toBe("mock");
    expect(response.body.summary.transcript).toContain("refresh token");
    expect(response.body.summary.actionItems.length).toBeGreaterThan(0);
  });
});
