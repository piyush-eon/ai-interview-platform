"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────

export const setAvailability = async ({ startTime, endTime }) => {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") return { error: "Forbidden" };

  if (!startTime || !endTime) return { error: "Start and end time required" };
  if (new Date(startTime) >= new Date(endTime))
    return { error: "Start time must be before end time" };

  try {
    const existing = await db.availability.findFirst({
      where: { interviewerId: dbUser.id, status: "AVAILABLE" },
    });

    if (existing) {
      await db.availability.update({
        where: { id: existing.id },
        data: { startTime: new Date(startTime), endTime: new Date(endTime) },
      });
    } else {
      await db.availability.create({
        data: {
          interviewerId: dbUser.id,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "AVAILABLE",
        },
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { error: "Failed to save availability" };
  }
};

export const getAvailability = async () => {
  const user = await currentUser();
  if (!user) return null;

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) return null;

  return db.availability.findFirst({
    where: { interviewerId: dbUser.id, status: "AVAILABLE" },
  });
};

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export const getInterviewerAppointments = async () => {
  const user = await currentUser();
  if (!user) return [];

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) return [];

  return db.booking.findMany({
    where: { interviewerId: dbUser.id },
    include: {
      interviewee: { select: { name: true, imageUrl: true, email: true } },
      feedback: true,
    },
    orderBy: { startTime: "desc" },
  });
};

// ─── EARNINGS / WITHDRAWAL ────────────────────────────────────────────────────

export const getInterviewerStats = async () => {
  const user = await currentUser();
  if (!user) return null;

  const dbUser = await db.user.findUnique({
    where: { clerkUserId: user.id },
    select: {
      creditBalance: true,
      creditRate: true,
      bookingsAsInterviewer: {
        where: { status: "COMPLETED" },
        select: { creditsCharged: true },
      },
    },
  });
  if (!dbUser) return null;

  const totalEarned = dbUser.bookingsAsInterviewer.reduce(
    (sum, b) => sum + b.creditsCharged,
    0
  );

  return {
    creditBalance: dbUser.creditBalance,
    creditRate: dbUser.creditRate,
    totalEarned,
    completedSessions: dbUser.bookingsAsInterviewer.length,
  };
};

export const requestWithdrawal = async ({
  credits,
  paymentMethod,
  paymentDetail,
}) => {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") return { error: "Forbidden" };

  if (!credits || credits <= 0) return { error: "Invalid credit amount" };
  if (credits > dbUser.creditBalance)
    return { error: "Insufficient credit balance" };
  if (!paymentMethod || !paymentDetail)
    return { error: "Payment details required" };

  const PLATFORM_FEE = 0.2;
  const netAmount = credits * (1 - PLATFORM_FEE);
  const platformFee = credits * PLATFORM_FEE;

  try {
    await db.$transaction([
      db.payout.create({
        data: {
          interviewerId: dbUser.id,
          credits,
          platformFee,
          netAmount,
          paymentMethod,
          paymentDetail,
          status: "PROCESSING",
        },
      }),
      db.user.update({
        where: { id: dbUser.id },
        data: { creditBalance: { decrement: credits } },
      }),
    ]);

    // TODO: await resend.emails.send({ to: ADMIN_EMAIL, ... })

    revalidatePath("/dashboard");
    return { success: true, netAmount };
  } catch (err) {
    console.error(err);
    return { error: "Withdrawal request failed" };
  }
};

export const getWithdrawalHistory = async () => {
  const user = await currentUser();
  if (!user) return [];

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) return [];

  return db.payout.findMany({
    where: { interviewerId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
};
