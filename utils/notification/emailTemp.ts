interface EmailContent {
    subject: string;
    html: string;
}

// TODO: set APP_NAME (and ideally APP_URL) in .env once branding is finalized.
const APP_NAME = process.env.APP_NAME;

function baseLayout(bodyContent: string): string {
    return `
  <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; border-radius: 16px;">

    <!-- Header / Brand -->
    <div style="text-align: center; margin-bottom: 28px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
        ${APP_NAME}
      </h2>
    </div>

    <!-- Main Card Body -->
    <div style="background-color: #ffffff; padding: 36px 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);">
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 28px; padding: 0 16px;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
      </p>
    </div>

  </div>
  `;
}

function securityNotice(): string {
    return `
    <p style="font-size: 13px; color: #64748b; margin-bottom: 0; background-color: #fdf2f8; border-left: 4px solid #f472b6; padding: 12px; border-radius: 4px;">
      <strong>Security reminder:</strong> ${APP_NAME} will never call or message you to ask for this code, your password, or any transaction PIN. If you didn't request this, you can safely ignore this email.
    </p>
  `;
}

export function welcomeEmailTemplate(fullName: string): EmailContent {
    const subject = `Welcome to ${APP_NAME}`;
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">You're in! 🎉</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      Your account has been created successfully. Welcome to ${APP_NAME}.
    </p>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${process.env.APP_URL || "#"}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
        Go to Dashboard
      </a>
    </div>
  `);
    return { subject, html };
}

export function verificationEmailTemplate(fullName: string, code: string): EmailContent {
    const subject = `Verify your ${APP_NAME} email`;
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Verify your email</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      Welcome aboard! To complete your registration, please use the verification code below:
    </p>

    <div style="background-color: #0f172a; border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 24px;">
      <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #818cf8; font-weight: 600; margin-bottom: 8px;">One-Time Verification Code</span>
      <h1 style="letter-spacing: 12px; color: #ffffff; font-size: 40px; font-weight: 800; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding-left: 12px;">${code}</h1>
    </div>

    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 24px; text-align: center;">
      <p style="font-size: 13px; color: #b45309; margin: 0;">
        This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
      </p>
    </div>

    ${securityNotice()}
  `);
    return { subject, html };
}

export function forgotPasswordEmailTemplate(fullName: string, code: string): EmailContent {
    const subject = `Reset your ${APP_NAME} password`;
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Reset your password</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      We received a request to reset the password on your ${APP_NAME} account. Use the code below to continue:
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; display: inline-block; padding: 16px 40px; border-radius: 12px; letter-spacing: 6px; font-size: 32px; font-weight: 800; color: #4f46e5; font-family: monospace;">
        ${code}
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin: 12px 0 0 0;">This code expires in <strong>10 minutes</strong>.</p>
    </div>

    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;">

    ${securityNotice()}
  `);
    return { subject, html };
}

export function passwordResetSuccessEmailTemplate(fullName: string): EmailContent {
    const subject = 'Password reset successful';
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Password reset successful</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      Your password has been successfully reset.
    </p>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0; background-color: #fdf2f8; border-left: 4px solid #f472b6; padding: 12px; border-radius: 4px;">
      <strong>Wasn't you?</strong> If you didn't perform this action, please contact our support team immediately.
    </p>
  `);
    return { subject, html };
}

export function paymentSuccessEmailTemplate(fullName: string, reference: string, amount: number): EmailContent {
    const subject = `Payment received — your order is confirmed`;
    const formattedAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Payment received ✅</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      Your order has been confirmed and your package is being processed. We'll let you know as soon as it ships.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 13px; color: #166534; padding: 4px 0;">Amount paid</td>
          <td style="font-size: 15px; color: #14532d; font-weight: 700; text-align: right; padding: 4px 0;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #166534; padding: 4px 0;">Reference</td>
          <td style="font-size: 13px; color: #14532d; font-family: monospace; text-align: right; padding: 4px 0;">${reference}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      Thanks for shopping with ${APP_NAME}.
    </p>
  `);
    return { subject, html };
}

export function paymentFailedEmailTemplate(fullName: string, reference: string, amount: number): EmailContent {
    const subject = `We couldn't process your payment`;
    const formattedAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Payment unsuccessful</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      We weren't able to confirm your payment. No charge has been completed, and your items are still saved for you.
    </p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 13px; color: #991b1b; padding: 4px 0;">Amount</td>
          <td style="font-size: 15px; color: #7f1d1d; font-weight: 700; text-align: right; padding: 4px 0;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #991b1b; padding: 4px 0;">Reference</td>
          <td style="font-size: 13px; color: #7f1d1d; font-family: monospace; text-align: right; padding: 4px 0;">${reference}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      Feel free to try again, or reach out to our support team if the problem continues.
    </p>
  `);
    return { subject, html };
}

export function refundInitiatedEmailTemplate(fullName: string, reference: string, amount: number): EmailContent {
    const subject = `Your payment is being refunded`;
    const formattedAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    const html = baseLayout(`
    <h3 style="margin-top: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Refund initiated</h3>

    <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
      Hello ${fullName},<br>
      One or more items in your order became unavailable right after your payment went through, so we're unable to fulfil it. We've started a refund for the full amount — it should reflect on your original payment method within 5–10 business days, depending on your bank.
    </p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 13px; color: #1e40af; padding: 4px 0;">Refund amount</td>
          <td style="font-size: 15px; color: #1e3a8a; font-weight: 700; text-align: right; padding: 4px 0;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #1e40af; padding: 4px 0;">Reference</td>
          <td style="font-size: 13px; color: #1e3a8a; font-family: monospace; text-align: right; padding: 4px 0;">${reference}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      We're sorry for the inconvenience — feel free to reach out to our support team with any questions about this refund.
    </p>
  `);
    return { subject, html };
}