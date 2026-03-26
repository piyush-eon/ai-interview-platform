"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";
import { Resend } from "resend";
import { WithdrawalRequestEmail } from "@/emails/WithdrawalRequestEmail";
import { render } from "@react-email/render";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = "piyushagarwalvo@gmail.com";

const withdrawalLimiter = createRateLimiter({
  refillRate: 1,
  interval: "1h",
  capacity: 3,
});

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────

export const setAvailability = async ({ startTime, endTime }) => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") throw new Error("Forbidden");

  if (!startTime || !endTime) throw new Error("Start and end time required");
  if (new Date(startTime) >= new Date(endTime))
    throw new Error("Start time must be before end time");

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
    throw new Error("Failed to save availability");
  }
};

export const getAvailability = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

  return db.availability.findFirst({
    where: { interviewerId: dbUser.id, status: "AVAILABLE" },
  });
};

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export const getInterviewerAppointments = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

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
  if (!user) throw new Error("Unauthorized");

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
  if (!dbUser) throw new Error("User not found");

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
  if (!user) throw new Error("Unauthorized");

  const req = await request();
  const rateLimitError = await checkRateLimit(withdrawalLimiter, req, user.id);
  if (rateLimitError) throw new Error(rateLimitError);

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") throw new Error("Forbidden");

  if (!credits || credits <= 0) throw new Error("Invalid credit amount");
  if (credits > dbUser.creditBalance)
    throw new Error("Insufficient credit balance");
  if (!paymentMethod || !paymentDetail)
    throw new Error("Payment details required");

  const PLATFORM_FEE = 0.2;
  const netAmount = credits * (1 - PLATFORM_FEE);
  const platformFee = credits * PLATFORM_FEE;

  try {
    const [payout] = await db.$transaction([
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

    // Fire admin email — non-blocking, failure won't affect the user
    try {
      const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payout/${payout.id}`;
      const html = await render(
        WithdrawalRequestEmail({
          interviewerName: dbUser.name ?? "Unknown",
          interviewerEmail: dbUser.email,
          credits,
          platformFee,
          netAmount,
          paymentMethod,
          paymentDetail,
          reviewUrl,
        })
      );
      await resend.emails.send({
        from: "Prept <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        subject: `Withdrawal Request — ${dbUser.name} · ${credits} credits`,
        html,
      });
    } catch (emailErr) {
      console.error("Withdrawal email failed:", emailErr);
    }

    revalidatePath("/dashboard");
    return { success: true, netAmount };
  } catch (err) {
    console.error(err);
    throw new Error("Withdrawal request failed");
  }
};

export const getWithdrawalHistory = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

  return db.payout.findMany({
    where: { interviewerId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
};
