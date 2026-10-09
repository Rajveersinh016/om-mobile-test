export interface LayoutOptions {
  preheader?: string;
  title: string;
  bodyContent: string;
  appFrontendUrl?: string;
}

export function renderMasterLayout(options: LayoutOptions): string {
  const { preheader = '', title, bodyContent, appFrontendUrl = 'http://localhost:8080' } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
    }
    .btn-primary {
      background-color: #03045E;
      color: #FFFFFF !important;
      padding: 12px 28px;
      border-radius: 8px;
      font-weight: 700;
      text-decoration: none;
      display: inline-block;
      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(3, 4, 94, 0.2);
    }
    .btn-primary:hover {
      background-color: #0077B6 !important;
    }
    @media only screen and (max-width: 600px) {
      .container-table {
        width: 100% !important;
        padding: 12px !important;
      }
      .content-card {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="background-color: #F8FAFC; margin: 0; padding: 0;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    ${preheader}
  </div>

  <table width="100%" bgcolor="#F8FAFC" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #F8FAFC; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Main Wrapper Container -->
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">
          
          <!-- Header Logo Bar -->
          <tr>
            <td align="center" style="padding: 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${appFrontendUrl}" target="_blank" style="text-decoration: none;">
                      <div style="display: inline-block; background-color: #03045E; padding: 12px 24px; border-radius: 12px; border: 1px solid #0077B6;">
                        <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: 1.5px; text-transform: uppercase;">
                          OM <span style="color: #90E0EF;">MOBILE ART</span>
                        </span>
                      </div>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Content Card -->
          <tr>
            <td>
              <table class="content-card" width="100%" bgcolor="#FFFFFF" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 16px; padding: 36px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="color: #1E293B; font-size: 15px; line-height: 1.6;">
                    ${bodyContent}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="padding: 32px 20px; text-align: center; color: #64748B; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #334155;">
                OM Mobile Art — Precision Crafted Luxury Skins
              </p>
              <p style="margin: 0 0 16px 0;">
                Shop No. 1, Swadhyaya Complex, Lajamani Chowk, Mota Varachha, Surat - 394101
              </p>
              <p style="margin: 0 0 16px 0;">
                <a href="${appFrontendUrl}/shop/pages/shop.html" style="color: #0077B6; text-decoration: none; font-weight: 600; margin: 0 8px;">Shop</a> |
                <a href="${appFrontendUrl}/shop/pages/contact.html" style="color: #0077B6; text-decoration: none; font-weight: 600; margin: 0 8px;">Support</a> |
                <a href="${appFrontendUrl}/shop/pages/faq.html" style="color: #0077B6; text-decoration: none; font-weight: 600; margin: 0 8px;">FAQ</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                © ${new Date().getFullYear()} OM Mobile Art. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
