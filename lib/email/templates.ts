import type {
  NotificationPriority,
  NotificationType,
} from "@/domain";
import {
  notificationPriorityLabels,
  notificationTypeLabels,
} from "@/domain";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderNotificationEmail(input: {
  displayName: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  href?: string | null;
}): string {
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const destination = input.href
    ? new URL(input.href, baseUrl).toString()
    : new URL("/notifications", baseUrl).toString();

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#080b10;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b10;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #1e293b;border-radius:18px;background:#151b24;overflow:hidden">
            <tr>
              <td style="padding:24px;background:#0f141b;border-bottom:1px solid #1e293b">
                <div style="font-size:20px;font-weight:700;color:#ffffff">FRL Race Control</div>
                <div style="margin-top:6px;font-size:12px;color:#60a5fa;text-transform:uppercase;letter-spacing:1.5px">${escapeHtml(notificationTypeLabels[input.type])} · ${escapeHtml(notificationPriorityLabels[input.priority])}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px">
                <p style="margin:0 0 16px;color:#94a3b8">Hallo ${escapeHtml(input.displayName)},</p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#ffffff">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#cbd5e1">${escapeHtml(input.message)}</p>
                <a href="${escapeHtml(destination)}" style="display:inline-block;border-radius:12px;background:#2563eb;padding:13px 22px;color:#ffffff;text-decoration:none;font-weight:700">In FRL Race Control öffnen</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:12px">
                Benachrichtigungseinstellungen kannst du jederzeit in FRL Race Control ändern.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
