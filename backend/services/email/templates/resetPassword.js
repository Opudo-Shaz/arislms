const { baseTemplate } = require('./base');

/**
 * Generate the reset-password email content.
 *
 * @param {object} opts
 * @param {string}  opts.name           - Recipient's display name
 * @param {string}  opts.resetUrl       - Full reset URL with token
 * @param {number} [opts.expiresMinutes] - Token TTL in minutes (default 30)
 * @param {string} [opts.appName]       - App display name
 *
 * @returns {{ subject: string, html: string, text: string }}
 */
function resetPasswordTemplate({ name, resetUrl, expiresMinutes = 30, appName = 'ARISLMS' }) {
  const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeUrl = resetUrl.replace(/"/g, '%22');

  const bodyContent = `
    <!-- Greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#23282c;
               font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      Password Reset Request
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#636f83;
              font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      Hi <strong style="color:#23282c;">${safeName}</strong>,
    </p>

    <!-- Body -->
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#23282c;
              font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      We received a request to reset the password for your <strong>${appName}</strong> account.
      Click the button below to choose a new password.
    </p>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:0 0 28px;">
      <tr>
        <td style="border-top:1px solid #ebedef;"></td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:0 0 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:240px;"
            arcsize="10%" stroke="f" fillcolor="#321fdb">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:15px;font-weight:700;">
              Reset My Password
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${safeUrl}"
            style="display:inline-block;background-color:#321fdb;color:#ffffff;
                   font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                   font-size:15px;font-weight:700;text-decoration:none;
                   padding:14px 36px;border-radius:6px;
                   mso-padding-alt:0;text-align:center;
                   transition:background-color 0.2s ease;">
            Reset My Password
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <!-- Expiry notice -->
    <p style="margin:0 0 20px;font-size:13px;color:#636f83;text-align:center;
              font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      This link expires in <strong style="color:#23282c;">${expiresMinutes} minutes</strong>.
    </p>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:0 0 20px;">
      <tr>
        <td style="border-top:1px solid #ebedef;"></td>
      </tr>
    </table>

    <!-- Fallback URL -->
    <p style="margin:0 0 16px;font-size:12px;color:#8a93a2;
              font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      If the button above doesn&rsquo;t work, copy and paste this URL into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:12px;word-break:break-all;
              font-family:monospace,monospace;color:#321fdb;">
      ${safeUrl}
    </p>

    <!-- Security note -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color:#f8f9fa;border-left:4px solid #321fdb;
                   border-radius:0 4px 4px 0;padding:14px 16px;">
          <p style="margin:0;font-size:13px;line-height:1.5;color:#636f83;
                    font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <strong style="color:#23282c;">Didn&rsquo;t request this?</strong><br/>
            If you did not request a password reset, you can safely ignore this email.
            Your password will remain unchanged.
          </p>
        </td>
      </tr>
    </table>
  `;

  const html = baseTemplate({ title: 'Reset Your Password', bodyContent, appName });

  const text = [
    `Password Reset Request — ${appName}`,
    '',
    `Hi ${name},`,
    '',
    `We received a request to reset the password for your ${appName} account.`,
    '',
    `Reset your password here: ${resetUrl}`,
    '',
    `This link expires in ${expiresMinutes} minutes.`,
    '',
    `If you did not request a password reset, you can safely ignore this email.`,
  ].join('\n');

  return {
    subject: `Reset your ${appName} password`,
    html,
    text,
  };
}

module.exports = { resetPasswordTemplate };
