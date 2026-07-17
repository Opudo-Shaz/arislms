/**
 * Base HTML email layout — inline styles for maximum email client compatibility.
 *
 * @param {object} opts
 * @param {string}  opts.title       - Email subject / preheader text
 * @param {string}  opts.bodyContent - Inner HTML injected into the card body
 * @param {string} [opts.appName]    - App display name used in footer & alt text
 */
function baseTemplate({ title, bodyContent, appName = 'ARISLMS' }) {
  const year = new Date().getFullYear();
  const safetitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const logoUrl = process.env.APP_LOGO_URL || `${frontendUrl}/arislms_logo_fit.png`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${safetitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    * { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; padding: 16px !important; }
      .email-card   { padding: 28px 20px !important; }
      .email-header { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ebedef;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;color:#ebedef;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${safetitle}&nbsp;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#ebedef;min-width:100%;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email container -->
        <table role="presentation" class="email-wrapper" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td class="email-header"
              style="background-color:#321fdb;border-radius:8px 8px 0 0;padding:28px 40px;text-align:center;">
              <img src="${logoUrl}" alt="${appName}" width="160" height="auto"
                style="display:block;margin:0 auto;max-width:160px;height:auto;border:0;"
              />
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td class="email-card"
              style="background-color:#ffffff;padding:40px;border-radius:0 0 8px 8px;
                     box-shadow:0 4px 16px rgba(0,0,0,0.08);">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8a93a2;
                        font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                &copy; ${year} ${appName}. All rights reserved.
              </p>
              <p style="margin:0;font-size:12px;color:#8a93a2;
                        font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                This is an automated message — please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

module.exports = { baseTemplate };
