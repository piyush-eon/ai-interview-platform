// app/api/webhooks/stream/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/prisma";

export async function POST(request) {
  const body = await request.json();
  const eventType = body.type;

  console.log(`\n[stream-webhook] ← Received event: ${eventType}`);

  if (
    eventType !== "call.transcription_ready" &&
    eventType !== "call.recording_ready"
  ) {
    console.log(`[stream-webhook] Ignoring event type: ${eventType}`);
    return Response.json({ ok: true });
  }

  // call_cid arrives as "default:mock_123_abc" — we stored just "mock_123_abc"
  const callCid = body.call_cid ?? "";
  const streamCallId = callCid.includes(":") ? callCid.split(":")[1] : callCid;
  console.log(
    `[stream-webhook] call_cid: ${callCid} → streamCallId: ${streamCallId}`
  );

  if (!streamCallId) {
    console.log(`[stream-webhook] No streamCallId found, skipping`);
    return Response.json({ ok: true });
  }

  try {
    console.log(`[stream-webhook] Looking up booking in DB...`);
    const booking = await db.booking.findUnique({
      where: { streamCallId },
      include: {
        interviewer: {
          select: { id: true, clerkUserId: true, name: true, categories: true },
        },
        interviewee: {
          select: { id: true, clerkUserId: true, name: true },
        },
        feedback: { select: { id: true } },
      },
    });

    if (!booking) {
      console.log(
        `[stream-webhook] No booking found for streamCallId: ${streamCallId}`
      );
      return Response.json({ ok: true });
    }

    console.log(
      `[stream-webhook] Booking found: ${booking.id} | interviewer: ${booking.interviewer.name} | interviewee: ${booking.interviewee.name}`
    );

    // ── Recording ready ───────────────────────────────────────────────────────
    if (eventType === "call.recording_ready") {
      const recordingUrl = body.call_recording?.url;

      if (!recordingUrl) {
        console.log(
          `[stream-webhook] call.recording_ready received but no URL in payload`
        );
        return Response.json({ ok: true });
      }

      console.log(`[stream-webhook] Saving recording URL to booking...`);
      await db.booking.update({
        where: { id: booking.id },
        data: { recordingUrl },
      });

      console.log(
        `[stream-webhook] ✓ Recording URL saved for booking ${booking.id}`
      );
      return Response.json({ ok: true });
    }

    // ── Transcription ready ───────────────────────────────────────────────────
    if (eventType === "call.transcription_ready") {
      // Outer guard — catches sequential retries
      if (booking.feedback) {
        console.log(
          `[stream-webhook] Feedback already exists for booking ${booking.id}, skipping duplicate webhook`
        );
        return Response.json({ ok: true });
      }

      const transcriptUrl = body.call_transcription?.url;
      if (!transcriptUrl) {
        console.log(
          `[stream-webhook] call.transcription_ready received but no transcript URL in payload`
        );
        return Response.json({ ok: true });
      }

      // 1. Download JSONL from Stream CDN
      console.log(`[stream-webhook] Downloading transcript from Stream CDN...`);
      const transcriptRes = await fetch(transcriptUrl);
      const transcriptText = await transcriptRes.text();
      console.log(
        `[stream-webhook] Transcript downloaded (${transcriptText.length} chars)`
      );

      // 2. Parse JSONL into readable conversation
      console.log(`[stream-webhook] Parsing JSONL transcript...`);
      const lines = transcriptText
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry) => entry?.type === "speech");

      console.log(`[stream-webhook] Parsed ${lines.length} speech segments`);

      if (lines.length === 0) {
        console.log(
          `[stream-webhook] No speech segments found in transcript, skipping`
        );
        return Response.json({ ok: true });
      }

      // Map clerkUserId to display name
      const speakerMap = {
        [booking.interviewer.clerkUserId]:
          booking.interviewer.name ?? "Interviewer",
        [booking.interviewee.clerkUserId]:
          booking.interviewee.name ?? "Interviewee",
      };

      const transcript = lines
        .map((l) => `${speakerMap[l.speaker_id] ?? l.speaker_id}: ${l.text}`)
        .join("\n");

      console.log(
        `[stream-webhook] Transcript preview:\n${transcript.slice(0, 300)}${
          transcript.length > 300 ? "..." : ""
        }`
      );

      // 3. Generate feedback via Gemini
      console.log(
        `[stream-webhook] Sending transcript to Gemini (gemini-2.5-flash-lite)...`
      );
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });
      const categories =
        booking.interviewer.categories?.join(", ") ?? "General";

      const prompt = `You are an expert technical interviewer evaluating a mock interview.

Interview categories: ${categories}
Interviewer: ${booking.interviewer.name}
Candidate: ${booking.interviewee.name}

TRANSCRIPT:
${transcript}

Analyze the candidate's performance. Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation:
{
  "summary": "2-3 sentence overall summary of the session",
  "technical": "Assessment of technical knowledge and accuracy",
  "communication": "Assessment of clarity, structure, and communication style",
  "problemSolving": "Assessment of problem-solving approach and thought process",
  "recommendation": "HIRE / CONSIDER / NO_HIRE with a one-sentence reason",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "overallRating": "POOR or AVERAGE or GOOD or EXCELLENT"
}`;

      const result = await model.generateContent(prompt);
      const raw = result.response
        .text()
        .trim()
        .replace(/^```json|^```|```$/gm, "")
        .trim();

      console.log(
        `[stream-webhook] Gemini raw response:\n${raw.slice(0, 500)}${
          raw.length > 500 ? "..." : ""
        }`
      );

      const feedbackData = JSON.parse(raw);
      console.log(
        `[stream-webhook] Feedback parsed — overallRating: ${feedbackData.overallRating} | recommendation: ${feedbackData.recommendation}`
      );

      // 4. Write to DB — upsert handles concurrent webhook retries cleanly (no P2002)
      console.log(`[stream-webhook] Writing feedback to DB...`);
      await db.$transaction([
        db.feedback.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            summary: feedbackData.summary,
            technical: feedbackData.technical,
            communication: feedbackData.communication,
            problemSolving: feedbackData.problemSolving,
            recommendation: feedbackData.recommendation,
            strengths: feedbackData.strengths,
            improvements: feedbackData.improvements,
            overallRating: feedbackData.overallRating,
          },
          update: {}, // already exists — no-op, keep the original
        }),
        db.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED" },
        }),
      ]);
      console.log(
        `[stream-webhook] Feedback upserted + booking marked COMPLETED`
      );

      // Credit transaction is outside the main transaction so we can check first
      const earnExists = await db.creditTransaction.findFirst({
        where: { bookingId: booking.id, type: "BOOKING_EARNING" },
      });
      if (!earnExists) {
        await db.creditTransaction.create({
          data: {
            userId: booking.interviewer.id,
            amount: booking.creditsCharged,
            type: "BOOKING_EARNING",
            bookingId: booking.id,
          },
        });
        console.log(
          `[stream-webhook] Credit earning transaction created (+${booking.creditsCharged} credits for interviewer)`
        );
      } else {
        console.log(
          `[stream-webhook] Earning transaction already exists, skipping`
        );
      }

      console.log(`[stream-webhook] ✓ All done for booking ${booking.id}`);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[stream-webhook] ✗ ${eventType} error:`, err);
    // Always 200 — non-2xx triggers Stream retries, making the race worse
    return Response.json({ ok: true });
  }
}
