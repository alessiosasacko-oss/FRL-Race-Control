import "server-only";
import nodemailer from "nodemailer";
import {
  EmailDeliveryStatus,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";

const MAX_ATTEMPTS = 5;

function smtpTransport() {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM;

  if (!smtpUrl || !from) {
    throw new Error("SMTP_URL and EMAIL_FROM are required.");
  }

  return nodemailer.createTransport(smtpUrl, {
    from,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function processEmailOutbox(
  limit = 25,
): Promise<{ sent: number; failed: number }> {
  const prisma = getPrismaClient();
  await prisma.emailDelivery.updateMany({
    where: {
      status: EmailDeliveryStatus.SENDING,
      updatedAt: {
        lt: new Date(Date.now() - 15 * 60 * 1000),
      },
    },
    data: {
      status: EmailDeliveryStatus.FAILED,
      scheduledFor: new Date(),
      lastError: "Interrupted delivery recovered by outbox processor.",
    },
  });
  const deliveries = await prisma.emailDelivery.findMany({
    where: {
      status: {
        in: [
          EmailDeliveryStatus.PENDING,
          EmailDeliveryStatus.FAILED,
        ],
      },
      attempts: { lt: MAX_ATTEMPTS },
      scheduledFor: { lte: new Date() },
    },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
  if (deliveries.length === 0) return { sent: 0, failed: 0 };

  const transport = smtpTransport();
  const from = process.env.EMAIL_FROM as string;
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const claimed = await prisma.emailDelivery.updateMany({
      where: {
        id: delivery.id,
        status: {
          in: [
            EmailDeliveryStatus.PENDING,
            EmailDeliveryStatus.FAILED,
          ],
        },
      },
      data: {
        status: EmailDeliveryStatus.SENDING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count === 0) continue;

    try {
      await transport.sendMail({
        from,
        to: delivery.recipient,
        subject: delivery.subject,
        html: delivery.html,
      });
      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailDeliveryStatus.SENT,
          sentAt: new Date(),
        },
      });
      sent += 1;
    } catch (error: unknown) {
      const nextAttempt = delivery.attempts + 1;
      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status:
            nextAttempt >= MAX_ATTEMPTS
              ? EmailDeliveryStatus.SKIPPED
              : EmailDeliveryStatus.FAILED,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : "Unknown email delivery error",
          scheduledFor: new Date(
            Date.now() +
              Math.min(24, 2 ** nextAttempt) * 60 * 60 * 1000,
          ),
        },
      });
      failed += 1;
    }
  }

  return { sent, failed };
}
