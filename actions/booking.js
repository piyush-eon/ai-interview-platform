"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { StreamClient } from "@stream-io/node-sdk";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";

// 5 booking attempts per hour — generous enough for real users,
// tight enough to block automated abuse
const bookingLimiter = createRateLimiter({
  refillRate: 2,
  interval: "1h",
  capacity: 5,
});

export const getInterviewerProfile = async (interviewerId) => {
  try {
    const interviewer = await db.user.findUnique({
      where: { id: interviewerId, role: "INTERVIEWER" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        title: true,
        company: true,
        yearsExp: true,
        bio: true,
        categories: true,
        creditRate: true,
        availabilities: {
          where: { status: "AVAILABLE" },
          select: { startTime: true, endTime: true },
          take: 1,
        },
        bookingsAsInterviewer: {
          where: { status: "SCHEDULED" },
          select: { startTime: true, endTime: true },
        },
      },
    });

    return interviewer ?? null;
  } catch (err) {
    console.error("getInterviewerProfile error:", err);
    return null;
  }
};

export const bookSlot = async ({ interviewerId, startTime, endTime }) => {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  // ── Arcjet rate limit ──────────────────────────────────────────────────────
  const req = await request();
  const rateLimitError = await checkRateLimit(bookingLimiter, req, user.id);
  if (rateLimitError) return { error: rateLimitError };
  // ──────────────────────────────────────────────────────────────────────────

  const [dbUser, interviewer] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: user.id } }),
    db.user.findUnique({ where: { id: interviewerId } }),
  ]);

  if (!dbUser || dbUser.role !== "INTERVIEWEE")
    return { error: "Only interviewees can book sessions" };
  if (!interviewer || interviewer.role !== "INTERVIEWER")
    return { error: "Interviewer not found" };

  const credits = interviewer.creditRate ?? 10;

  if (dbUser.credits < credits)
    return { error: "Insufficient credits. Please upgrade your plan." };

  // Check slot isn't already taken
  const conflict = await db.booking.findFirst({
    where: {
      interviewerId,
      status: "SCHEDULED",
      startTime: { lt: new Date(endTime) },
      endTime: { gt: new Date(startTime) },
    },
  });
  if (conflict)
    return { error: "This slot was just booked. Please pick another." };

  // ── Create Stream call ─────────────────────────────────────────────────────
  let streamCallId;
  try {
    const streamClient = new StreamClient(
      process.env.NEXT_PUBLIC_STREAM_API_KEY,
      process.env.STREAM_SECRET_KEY
    );

    await streamClient.upsertUsers([
      {
        id: dbUser.clerkUserId,
        name: dbUser.name ?? "Interviewee",
        image: dbUser.imageUrl ?? undefined,
        role: "user",
      },
      {
        id: interviewer.clerkUserId,
        name: interviewer.name ?? "Interviewer",
        image: interviewer.imageUrl ?? undefined,
        role: "user",
      },
    ]);

    streamCallId = `mock_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const call = streamClient.video.call("default", streamCallId);

    await call.getOrCreate({
      data: {
        created_by_id: dbUser.clerkUserId,
        members: [
          { user_id: dbUser.clerkUserId, role: "host" },
          { user_id: interviewer.clerkUserId, role: "host" },
        ],
        settings_override: {
          recording: { mode: "available", quality: "1080p" },
          screensharing: {
            enabled: true,
            // target_resolution: { width: 1920, height: 1080 },
          },
          transcription: {
            mode: "auto-on", // starts when first user joins, stops when all leave
          },
        },
      },
    });
  } catch (err) {
    console.error("Stream call creation failed:", err);
    return { error: "Failed to create video call. Please try again." };
  }

  try {
    const booking = await db.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          intervieweeId: dbUser.id,
          interviewerId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "SCHEDULED",
          creditsCharged: credits,
          streamCallId,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: dbUser.id,
          amount: -credits,
          type: "BOOKING_DEDUCTION",
          bookingId: newBooking.id,
        },
      });

      await tx.user.update({
        where: { id: dbUser.id },
        data: { credits: { decrement: credits } },
      });
      await tx.user.update({
        where: { id: interviewerId },
        data: { creditBalance: { increment: credits } },
      });

      return newBooking;
    });

    revalidatePath(`/interviewers/${interviewerId}`);
    revalidatePath("/dashboard");

    return { success: true, bookingId: booking.id, streamCallId };
  } catch (err) {
    console.error("bookSlot transaction failed:", err);
    return { error: "Booking failed. Please try again." };
  }
};
