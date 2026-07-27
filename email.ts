import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected — no API key in integration settings");
  }
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ??
    connectionSettings.settings.from_email ??
    (() => { throw new Error("RESEND_FROM_EMAIL env var not set and no from_email in Resend integration settings. Set RESEND_FROM_EMAIL to your verified Resend sender address."); })();
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail,
  };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({ from: fromEmail, to, subject, html });
}

export async function sendVerificationOTP(toEmail: string, name: string, code: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Your LuckyBirthstone verification code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <img src="https://luckybirthstone.com/logo.png" alt="LuckyBirthstone" style="height:36px;" onerror="this.style.display='none'" />
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;vertical-align:middle;margin-left:8px;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Verify your email</h2>
        <p style="color:#555;margin:0 0 24px;">Hi ${name}, use the code below to verify your LuckyBirthstone account.</p>
        <div style="background:#f0f4f8;border-radius:8px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#1e3a5f;margin-bottom:24px;">${code}</div>
        <p style="color:#888;font-size:13px;margin:0;">This code expires in 30 minutes. If you didn't create a LuckyBirthstone account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendEmailVerifiedConfirmation(toEmail: string, name: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Email verified — Welcome to LuckyBirthstone",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Email verified ✓</h2>
        <p style="color:#555;margin:0 0 16px;">Hi ${name}, your email has been successfully verified. You're now ready to list your inventory and connect with buyers worldwide.</p>
        <p style="color:#555;margin:0 0 24px;">Your next step is to <strong>create your first listing</strong> — it takes less than 2 minutes and puts your gems in front of serious B2B buyers globally.</p>
        <a href="https://luckybirthstone.com/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Create Your First Listing Now →</a>
        <p style="color:#888;font-size:13px;margin-top:24px;">Need help? Raise a support ticket directly from your Dashboard — we typically respond within 1 business day.</p>
      </div>
    `,
  });
}

export async function sendVerificationApproved(toEmail: string, name: string, tier: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const tierLabel = tier === "legacy_verified" ? "Legacy Verified" : tier === "verified" ? "Verified" : "Basic Verified";
  const tierColor = tier === "legacy_verified" ? "#7c3aed" : tier === "verified" ? "#0ea5e9" : "#2563eb";
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Your LuckyBirthstone account is now ${tierLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Verification approved</h2>
        <p style="color:#555;margin:0 0 16px;">Hi ${name}, great news — your account has been approved!</p>
        <div style="background:#f0f4f8;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
          <span style="display:inline-block;background:${tierColor};color:#fff;padding:6px 20px;border-radius:999px;font-weight:700;font-size:15px;">★ ${tierLabel}</span>
        </div>
        <p style="color:#555;margin:0 0 16px;">You can now list your inventory, connect with buyers, and grow your business globally.</p>
        <p style="color:#555;margin:0 0 24px;">Your next step is to <strong>create your first listing</strong> — it only takes 2 minutes.</p>
        <a href="https://luckybirthstone.com/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:12px;">Create Your First Listing Now →</a>
        <p style="color:#888;font-size:13px;margin-top:16px;">Need help? Raise a support ticket directly from your Dashboard — we typically respond within 1 business day.</p>
      </div>
    `,
  });
}

export async function sendNewMessageNotification(toEmail: string, toName: string, fromCompany: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `New message from ${fromCompany} — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">You have a new message</h2>
        <p style="color:#555;margin:0 0 24px;">Hi ${toName}, <strong>${fromCompany}</strong> sent you a message on LuckyBirthstone. Log in to read and respond.</p>
        <a href="https://luckybirthstone.com/messages" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Read message</a>
        <p style="color:#888;font-size:13px;margin-top:24px;">To stop these notifications, manage your preferences in account settings.</p>
      </div>
    `,
  });
}

export async function sendSupportTicketCreatedToUser(toEmail: string, name: string, ticketId: string, subject: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Support ticket received — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone Support</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">We received your request</h2>
        <p style="color:#555;margin:0 0 16px;">Hi ${name}, your support ticket has been submitted. Our team will get back to you shortly.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;color:#888;border-bottom:1px solid #f0f0f0;width:35%;">Ticket ID</td>
            <td style="padding:10px 0;font-family:monospace;font-size:13px;border-bottom:1px solid #f0f0f0;">${ticketId.slice(0, 8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#888;">Subject</td>
            <td style="padding:10px 0;font-weight:600;">${subject}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:13px;margin:0;">You can track your ticket status in the Support section of your dashboard.</p>
      </div>
    `,
  });
}

export async function sendSupportTicketAdminAlert(adminEmail: string, userName: string, userEmail: string, subject: string, ticketId: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: adminEmail,
    subject: `New support ticket: ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone Admin</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">New support ticket</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0;width:35%;">Ticket ID</td><td style="padding:8px 0;font-family:monospace;font-size:13px;border-bottom:1px solid #f0f0f0;">${ticketId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0;">From</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${userName} &lt;${userEmail}&gt;</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Subject</td><td style="padding:8px 0;font-weight:600;">${subject}</td></tr>
        </table>
        <a href="https://luckybirthstone.com/admin" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View in Admin Portal</a>
      </div>
    `,
  });
}

export async function sendSupportTicketReply(toEmail: string, name: string, adminMessage: string, ticketId: string, subject: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Update on your support ticket — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone Support</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">We replied to your ticket</h2>
        <p style="color:#555;margin:0 0 4px;">Hi ${name}, the support team has replied to your ticket <strong>#${ticketId.slice(0,8).toUpperCase()}</strong>: <em>${subject}</em></p>
        <div style="background:#f0f4f8;border-left:3px solid #1e3a5f;border-radius:4px;padding:16px;margin:20px 0;color:#333;">${adminMessage}</div>
        <a href="https://luckybirthstone.com/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View ticket</a>
        <p style="color:#888;font-size:13px;margin-top:24px;">Need more help? Raise a new support ticket directly from your Dashboard.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetOTP(toEmail: string, name: string, code: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Your LuckyBirthstone password reset code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Reset your password</h2>
        <p style="color:#555;margin:0 0 24px;">Hi ${name}, use the code below to reset your password. It expires in 30 minutes.</p>
        <div style="background:#f0f4f8;border-radius:8px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#1e3a5f;margin-bottom:24px;">${code}</div>
        <p style="color:#888;font-size:13px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendListingLiveEmail(
  toEmail: string,
  name: string,
  stoneName: string,
  listingId: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const marketplaceUrl = "https://luckybirthstone.com/marketplace";
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Your ${stoneName} listing is now live! — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Your listing is live! 🎉</h2>
        <p style="color:#555;margin:0 0 16px;">Hi ${name}, your <strong>${stoneName}</strong> listing has been reviewed and is now visible to buyers on the marketplace.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <p style="color:#166534;font-weight:600;margin:0 0 4px;">Listing ID: <span style="font-family:monospace;">${listingId.slice(0,8)}</span></p>
          <p style="color:#16a34a;margin:0;font-size:14px;">Status: <strong>Live on marketplace</strong></p>
        </div>
        <p style="color:#555;margin:0 0 16px;font-weight:600;">Want more buyers to see your listing?</p>
        <p style="color:#555;margin:0 0 20px;">Promote it as a <strong>Featured Listing</strong> for just <strong>$10</strong> — it appears at the top of the marketplace for 7 days, giving you maximum visibility among serious buyers.</p>
        <a href="${marketplaceUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:24px;">⭐ Promote Your Listing — $10</a>
        <p style="color:#888;font-size:13px;margin:0;">You can promote from your Dashboard → My Listings → "Promote · $10" button.</p>
      </div>
    `,
  });
}

export async function sendListingFeaturedComplimentary(
  toEmail: string,
  name: string,
  stoneName: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Great news — your ${stoneName} listing has been featured! — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Your listing has been featured! ⭐</h2>
        <p style="color:#555;margin:0 0 16px;">Hi ${name}, great news! Our team has selected your <strong>${stoneName}</strong> listing to be featured on the marketplace as a complimentary service.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <p style="color:#92400e;font-weight:700;margin:0 0 4px;">⭐ Featured Listing — Complimentary</p>
          <p style="color:#b45309;margin:0;font-size:14px;">Your listing now appears at the top of the marketplace for 7 days, giving you prime visibility to buyers worldwide.</p>
        </div>
        <p style="color:#555;margin:0 0 16px;">This is a complimentary feature provided by the LuckyBirthstone team. No action is needed on your part — simply enjoy the extra exposure!</p>
        <p style="color:#555;margin:0 0 20px;">When your feature period ends, you can re-promote your listing anytime from your Dashboard for just <strong>$10 per 7 days</strong>.</p>
        <p style="color:#888;font-size:13px;margin:0;">Thank you for being part of the LuckyBirthstone community. Need help? Raise a support ticket from your Dashboard.</p>
      </div>
    `,
  });
}

export async function sendPaymentConfirmation(
  toEmail: string,
  name: string,
  opts: {
    type: "subscription" | "listing_credits" | "boost";
    amount: number;
    description: string;
    detail: string;
  }
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const typeLabel =
    opts.type === "subscription" ? "Plan Upgrade" :
    opts.type === "listing_credits" ? "Listing Credits" : "Boost Pack";
  const iconMap: Record<string, string> = {
    subscription: "🚀",
    listing_credits: "📦",
    boost: "⭐",
  };
  const icon = iconMap[opts.type] ?? "✓";
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Payment confirmed: ${opts.description} — LuckyBirthstone`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">${icon} Payment Confirmed</h2>
        <p style="color:#555;margin:0 0 20px;">Hi ${name}, your payment was successful. Here's your receipt:</p>
        <div style="background:#f0f4f8;border-radius:10px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#888;border-bottom:1px solid #e5e7eb;width:40%;">Type</td>
              <td style="padding:8px 0;font-weight:600;border-bottom:1px solid #e5e7eb;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;border-bottom:1px solid #e5e7eb;">Description</td>
              <td style="padding:8px 0;font-weight:600;border-bottom:1px solid #e5e7eb;">${opts.description}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;border-bottom:1px solid #e5e7eb;">Detail</td>
              <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${opts.detail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;">Amount Paid</td>
              <td style="padding:8px 0;font-weight:700;color:#1e3a5f;">$${opts.amount} USD</td>
            </tr>
          </table>
        </div>
        <a href="https://luckybirthstone.com/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Go to Dashboard →</a>
        <p style="color:#888;font-size:13px;margin-top:24px;">Need help? Raise a support ticket from your dashboard — we respond within 1 business day.</p>
      </div>
    `,
  });
}

export async function sendAstrobotInquiryToPremiumUser(
  toEmail: string,
  toName: string,
  inquiry: {
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    gemstone: string;
    zodiac: string;
    concern: string;
    budget: string;
  }
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `New buyer inquiry: ${inquiry.gemstone} — LuckyBirthstone AstroBot`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:20px;">
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;">LuckyBirthstone</span>
          <span style="font-size:13px;color:#7c3aed;font-weight:600;margin-left:10px;background:#f5f3ff;padding:3px 10px;border-radius:999px;">AstroBot Lead</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 6px;">New buyer inquiry 🔮</h2>
        <p style="color:#555;margin:0 0 20px;">Hi ${toName}, a buyer on LuckyBirthstone AstroBot is looking for <strong>${inquiry.gemstone}</strong> and was matched to your profile as a premium dealer. Here are their details:</p>
        <div style="background:#f8f7ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:9px 0;color:#6d28d9;font-weight:600;border-bottom:1px solid #ede9fe;width:38%;">Stone Requested</td>
              <td style="padding:9px 0;font-weight:700;color:#1e3a5f;border-bottom:1px solid #ede9fe;">${inquiry.gemstone}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;border-bottom:1px solid #ede9fe;">Zodiac Sign</td>
              <td style="padding:9px 0;border-bottom:1px solid #ede9fe;">${inquiry.zodiac}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;border-bottom:1px solid #ede9fe;">Purpose</td>
              <td style="padding:9px 0;border-bottom:1px solid #ede9fe;">${inquiry.concern}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;border-bottom:1px solid #ede9fe;">Budget Range</td>
              <td style="padding:9px 0;border-bottom:1px solid #ede9fe;">${inquiry.budget}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;border-bottom:1px solid #ede9fe;">Buyer Name</td>
              <td style="padding:9px 0;font-weight:600;border-bottom:1px solid #ede9fe;">${inquiry.buyerName}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;border-bottom:1px solid #ede9fe;">Contact Email</td>
              <td style="padding:9px 0;border-bottom:1px solid #ede9fe;"><a href="mailto:${inquiry.buyerEmail}" style="color:#7c3aed;text-decoration:none;">${inquiry.buyerEmail}</a></td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;">Phone / WhatsApp</td>
              <td style="padding:9px 0;font-weight:600;color:#1e3a5f;">${inquiry.buyerPhone}</td>
            </tr>
          </table>
        </div>
        <p style="color:#555;margin:0 0 20px;">This lead came through our AstroBot recommendation engine. We suggest reaching out within 24 hours for the best response rate.</p>
        <a href="mailto:${inquiry.buyerEmail}" style="display:inline-block;background:#7c3aed;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Contact Buyer Now →</a>
        <p style="color:#aaa;font-size:12px;margin-top:20px;">This lead was shared with you because you hold a Premium plan on LuckyBirthstone. Upgrade your plan to keep receiving exclusive AstroBot leads at <a href="https://luckybirthstone.com/plans" style="color:#7c3aed;">luckybirthstone.com/plans</a></p>
      </div>
    `,
  });
}

export async function sendVerificationSubmittedConfirmation(
  toEmail: string,
  name: string,
  tier: string,
  paymentAmount: number,
  isFree: boolean
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const tierLabel = tier === "legacy_verified" ? "Legacy Verified" : tier === "verified" ? "Verified" : "Basic Verified";
  const paymentNote = isFree
    ? `<span style="color:#16a34a;font-weight:600;">FREE</span>`
    : `<strong>$${paymentAmount} USD</strong>`;

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Verification request received — LuckyBirthstone",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:24px;">
          <img src="https://luckybirthstone.com/logo.png" alt="LuckyBirthstone" style="height:36px;" onerror="this.style.display='none'" />
          <span style="font-size:22px;font-weight:700;color:#1e3a5f;vertical-align:middle;margin-left:8px;">LuckyBirthstone</span>
        </div>
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Verification request received</h2>
        <p style="color:#555;margin:0 0 24px;">Hi ${name}, we've received your verification request. Here are the details:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;color:#888;border-bottom:1px solid #f0f0f0;width:40%;">Tier requested</td>
            <td style="padding:10px 0;font-weight:600;border-bottom:1px solid #f0f0f0;">${tierLabel}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#888;border-bottom:1px solid #f0f0f0;">Payment</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">${paymentNote}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#888;">Status</td>
            <td style="padding:10px 0;color:#d97706;font-weight:600;">Pending admin review</td>
          </tr>
        </table>
        <p style="color:#555;margin:0 0 16px;">Our team typically reviews requests within 1–2 business days. We'll email you when it's approved or if we need anything else.</p>
        <p style="color:#888;font-size:13px;margin:0;">Need help? Raise a support ticket directly from your Dashboard — we typically respond within 1–2 business days.</p>
      </div>
    `,
  });
}

export async function sendReferralJoined(
  referrerEmail: string,
  referrerName: string,
  referredName: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: referrerEmail,
    subject: `${referredName} just joined via your referral link!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Someone joined via your link!</h1>
          <p style="color:#e9d5ff;margin:8px 0 0;font-size:14px;">LuckyBirthstone Referral</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;">Hi ${referrerName},</p>
          <p style="color:#555;">Great news — <strong>${referredName}</strong> signed up using your referral link. You'll earn <strong>+5 listing credits</strong> once they verify their business identity.</p>
          <div style="background:#f5f3ff;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="color:#7c3aed;font-weight:700;margin:0 0 4px;">How to unlock your reward</p>
            <p style="color:#6b7280;font-size:13px;margin:0;">Your referral earns credits once the new member completes email verification <em>and</em> receives any business verification badge (Basic or higher).</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">Keep sharing your referral link to earn more credits — every verified referral adds to your balance.</p>
        </div>
      </div>
    `,
  });
}

export async function sendReferralSuccessful(
  referrerEmail: string,
  referrerName: string,
  referredName: string,
  creditsAwarded: number
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: referrerEmail,
    subject: `Referral reward unlocked — +${creditsAwarded} credits!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Referral Reward Unlocked!</h1>
          <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">LuckyBirthstone Referral Program</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;">Hi ${referrerName},</p>
          <p style="color:#555;"><strong>${referredName}</strong> has successfully verified their business identity on LuckyBirthstone. Your referral reward has been credited!</p>
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
            <p style="color:#059669;font-size:28px;font-weight:700;margin:0;">+${creditsAwarded} Listing Credits</p>
            <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">Added to your account balance</p>
          </div>
          <p style="color:#555;">Use your credits to create additional gem listings and reach more buyers.</p>
          <p style="color:#888;font-size:13px;">Continue sharing your referral link from your Dashboard to earn more rewards!</p>
        </div>
      </div>
    `,
  });
}

export async function sendListingReminderEmail(toEmail: string, name: string, companyName: string | null): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const displayName = companyName ?? name;
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "🎉 Your account is verified — list your first gem today!",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">💎</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">You're Verified!</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">LuckyBirthstone · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;">Hi ${name},</p>
          <p style="color:#555;">Congratulations — <strong>${displayName}</strong> is now a verified member of LuckyBirthstone. Your verified badge is live and visible to all buyers on the marketplace.</p>
          <p style="color:#555;">The next step is to <strong>list your gemstones</strong> so buyers can discover and contact you directly. It only takes a few minutes.</p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="color:#1e40af;font-weight:600;margin:0 0 8px;">Why list now?</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
              <li>Verified listings appear higher in search results</li>
              <li>Buyers actively contact verified sellers first</li>
              <li>0% commission — you keep every dollar</li>
            </ul>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://luckybirthstone.com/dashboard" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">List My Gemstones →</a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace</p>
        </div>
      </div>
    `,
  });
}

export async function sendBroadcastEmail(toEmail: string, subject: string, htmlBody: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;text-align:center;">
          <p style="color:#fff;font-size:18px;font-weight:700;margin:0;">💎 LuckyBirthstone</p>
          <p style="color:#bfdbfe;font-size:12px;margin:4px 0 0;">B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          ${htmlBody}
        </div>
        <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace<br>luckybirthstone.com</p>
        </div>
      </div>
    `,
  });
}

export async function sendWhatsAppOptInEmail(
  toEmail: string,
  name: string,
  waNumber: string,
  appName: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const formattedNumber = waNumber.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, "+$1 ($2) $3-$4");
  const joinKeyword = appName.toLowerCase().replace(/\s+/g, "");
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Activate WhatsApp alerts from LuckyBirthstone 💬",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#075e54,#25d366);padding:28px 24px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">💬</div>
          <h1 style="color:#fff;margin:0;font-size:20px;">Activate WhatsApp Alerts</h1>
          <p style="color:#d1fae5;margin:6px 0 0;font-size:13px;">LuckyBirthstone · Real-time gem &amp; auction alerts</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
          <p style="color:#555;margin:0 0 20px;">You have a WhatsApp number registered on LuckyBirthstone. To start receiving instant alerts for new gem listings and live auctions, just follow the two steps below — it takes 30 seconds.</p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:0 0 20px;">
            <p style="color:#166534;font-weight:700;font-size:14px;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Step 1 — Save our number</p>
            <p style="color:#333;font-size:13px;margin:0 0 8px;">Save this number in your WhatsApp contacts as <strong>LuckyBirthstone Alerts</strong>:</p>
            <div style="background:#fff;border:2px solid #25d366;border-radius:8px;padding:14px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#075e54;letter-spacing:1px;">${formattedNumber}</span>
            </div>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:20px;margin:0 0 20px;">
            <p style="color:#92400e;font-weight:700;font-size:14px;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Step 2 — Send this exact message</p>
            <p style="color:#333;font-size:13px;margin:0 0 8px;">Open WhatsApp, find <strong>LuckyBirthstone Alerts</strong>, and send this message:</p>
            <div style="background:#fff;border:2px solid #f59e0b;border-radius:8px;padding:14px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#92400e;letter-spacing:2px;">join ${joinKeyword}</span>
            </div>
            <p style="color:#78716c;font-size:12px;margin:10px 0 0;">You'll receive a confirmation message once you're opted in.</p>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 20px;">
            <p style="color:#475569;font-size:13px;margin:0;"><strong>What you'll receive:</strong></p>
            <ul style="color:#64748b;font-size:13px;margin:8px 0 0;padding-left:18px;line-height:2;">
              <li>🔔 New gem listing alerts from marketplace sellers</li>
              <li>🏆 Live auction announcements</li>
              <li>✅ Account verification confirmations</li>
            </ul>
          </div>

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">You're receiving this because you have a phone number on your LuckyBirthstone account.<br>Reply STOP in WhatsApp anytime to opt out.</p>
        </div>
        <div style="background:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace · luckybirthstone.com</p>
        </div>
      </div>
    `,
  });
}

export async function sendVerificationReminderEmail(toEmail: string, name: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Get verified on LuckyBirthstone — buyers trust verified sellers",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🏅</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Get Verified Today</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">LuckyBirthstone · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;">Hi ${name},</p>
          <p style="color:#555;">Buyers on LuckyBirthstone trust and prefer verified sellers. Verified profiles get a badge, appear higher in search results, and receive more enquiries.</p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="color:#1e40af;font-weight:600;margin:0 0 8px;">Verification benefits:</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
              <li>✅ Verified badge on your profile and listings</li>
              <li>📈 Priority placement in search results</li>
              <li>🤝 More buyer trust and direct enquiries</li>
            </ul>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://luckybirthstone.com/profile" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Apply for Verification →</a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace</p>
        </div>
      </div>
    `,
  });
}

export async function sendTrialWelcomeEmail(
  toEmail: string,
  name: string,
  trialEndDate: string,
  upgradeUrl: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const formatted = new Date(trialEndDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "🎉 Your 30-Day Premium Trial Has Started!",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">💎</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Welcome to Premium!</h1>
          <p style="color:#ddd6fe;margin:6px 0 0;font-size:13px;">LuckyBirthstone · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#111;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
          <p style="color:#555;margin:0 0 16px;">Great news — your account has been activated with a <strong>free 30-day Premium trial</strong>, no credit card required.</p>
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:0 0 20px;">
            <p style="color:#6d28d9;font-weight:700;margin:0 0 12px;">✨ What's included in Premium:</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:2;">
              <li>Unlimited gemstone listings</li>
              <li>Priority placement in search results</li>
              <li>Full Trade Manager — sales, payables &amp; receivables</li>
              <li>Approval workflow for stones on consignment</li>
              <li>Co-sell partner management</li>
              <li>AstroBot gem recommendations</li>
            </ul>
          </div>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:0 0 20px;">
            <p style="color:#92400e;font-size:13px;margin:0;">⏳ Your trial is active until <strong>${formatted}</strong>. Upgrade before it ends to keep full access.</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${upgradeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">Explore Premium Features →</a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace</p>
        </div>
      </div>
    `,
  });
}

export async function sendTrialEndingSoonEmail(
  toEmail: string,
  name: string,
  daysLeft: number,
  trialEndDate: string,
  upgradeUrl: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const formatted = new Date(trialEndDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `⏳ Your Premium trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — upgrade to continue`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#d97706,#b45309);padding:32px 24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">⏳</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Your Trial Ends in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""}</h1>
          <p style="color:#fde68a;margin:6px 0 0;font-size:13px;">LuckyBirthstone · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#111;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
          <p style="color:#555;margin:0 0 16px;">Your free Premium trial expires on <strong>${formatted}</strong>. After that, your account will revert to the basic plan.</p>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;margin:0 0 20px;">
            <p style="color:#92400e;font-weight:700;margin:0 0 10px;">What you'll lose on basic:</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:2;">
              <li>Unlimited listings → limited to 10</li>
              <li>Trade Manager (sales, payables, receivables)</li>
              <li>Approval &amp; consignment workflows</li>
              <li>Co-sell partner management</li>
              <li>Priority search placement</li>
            </ul>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${upgradeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">Upgrade to Keep Premium →</a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace</p>
        </div>
      </div>
    `,
  });
}

export async function sendTrialExpiredEmail(
  toEmail: string,
  name: string,
  upgradeUrl: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Your Premium trial has ended — upgrade to restore access",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#374151);padding:32px 24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">💎</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Your Trial Has Ended</h1>
          <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">LuckyBirthstone · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#111;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
          <p style="color:#555;margin:0 0 16px;">Your 30-day Premium trial has expired and your account is now on the basic plan. Upgrade to Premium to restore full access to all your business tools.</p>
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:0 0 20px;">
            <p style="color:#6d28d9;font-weight:700;margin:0 0 12px;">✨ Upgrade to Premium and get:</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:2;">
              <li>Unlimited gemstone listings</li>
              <li>Full Trade Manager — sales, payables &amp; receivables</li>
              <li>Approval workflows &amp; consignment management</li>
              <li>Co-sell partner tools</li>
              <li>Priority placement in search</li>
            </ul>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${upgradeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">Upgrade to Premium →</a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;">Questions? Reply to this email — we're happy to help.</p>
          <p style="color:#888;font-size:12px;text-align:center;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace</p>
        </div>
      </div>
    `,
  });
}

export async function sendProspectWelcomeEmail(
  toEmail: string,
  name: string,
  companyName: string,
  tempPassword: string,
  loginUrl: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Welcome to LuckyBirthstone — Your account is ready 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">💎</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Welcome to LuckyBirthstone</h1>
          <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Zero Commission · B2B Gemstone Marketplace</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#111;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
          <p style="color:#555;margin:0 0 24px;">Your company <strong>${companyName}</strong> has been registered on LuckyBirthstone. Use the credentials below to sign in and start listing gemstones.</p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px;margin:0 0 24px;">
            <p style="color:#0369a1;font-weight:700;font-size:13px;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.05em;">Your Login Credentials</p>
            <table style="width:100%;font-size:14px;">
              <tr><td style="color:#64748b;padding:6px 0;width:90px;font-weight:600;">Email</td><td style="color:#0f172a;font-weight:700;">${toEmail}</td></tr>
              <tr><td style="color:#64748b;padding:6px 0;font-weight:600;">Password</td><td style="color:#0f172a;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:1px;">${tempPassword}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">Sign In to Your Account →</a>
          </div>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:0 0 20px;">
            <p style="color:#92400e;font-size:13px;margin:0;"><strong>⚠️ Important:</strong> Please change your password after your first login.</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
            <p style="color:#475569;font-size:13px;margin:0 0 8px;font-weight:600;">Get started:</p>
            <ul style="color:#64748b;font-size:13px;margin:0;padding-left:18px;line-height:2;">
              <li>Complete your company profile</li>
              <li>List your gemstones — no commission, no limits</li>
              <li>Connect with verified B2B buyers globally</li>
            </ul>
          </div>
        </div>
        <div style="background:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">LuckyBirthstone · Zero Commission · B2B Gemstone Marketplace · luckybirthstone.com</p>
        </div>
      </div>
    `,
  });
}
