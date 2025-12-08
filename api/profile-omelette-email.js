import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, profiles, business_name, brand_foundation } = req.body;
    
    // Support both naming conventions
    const brandName = business_name || req.body.brandName || 'Your Brand';
    const tagline = brand_foundation?.tagline || req.body.tagline || '';

    // Validate required fields
    if (!email || !profiles) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build the profile HTML - handle both array and object formats
    let profilesHtml = '';
    
    if (Array.isArray(profiles)) {
      // Frontend sends array of profile objects
      profilesHtml = profiles.map(p => `
        <div style="margin-bottom: 24px; padding: 16px; background: #f8f8f8; border-radius: 8px;">
          <h3 style="margin: 0 0 8px 0; color: #FF6B35; font-size: 16px; text-transform: uppercase;">${p.icon || ''} ${p.name || p.platform}</h3>
          <p style="margin: 0 0 6px 0; color: #666; font-size: 13px;">${p.handle || ''}</p>
          <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.5;">${p.bio || ''}</p>
          <p style="margin: 6px 0 0 0; color: #999; font-size: 12px;">${p.bio?.length || 0} / ${p.charLimit || '?'} characters</p>
        </div>
      `).join('');
    } else {
      // Fallback for object format
      profilesHtml = Object.entries(profiles)
        .map(([platform, bio]) => `
          <div style="margin-bottom: 24px; padding: 16px; background: #f8f8f8; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; color: #FF6B35; font-size: 16px; text-transform: uppercase;">${platform}</h3>
            <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.5;">${bio}</p>
          </div>
        `)
        .join('');
    }

    // Send the email
    const { data, error } = await resend.emails.send({
      from: 'Profile Omelette <chef@aiomelette.com>',
      to: email,
      subject: `🍳 Your ${brandName} Profiles Are Ready!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
          
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #FF6B35; margin: 0;">🍳 Profile Omelette</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Your Digital Presence, Sunny Side Up</p>
          </div>

          <div style="background: linear-gradient(135deg, #FF6B35 0%, #ff8c42 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px 0; font-size: 24px;">${brandName}</h2>
            ${tagline ? `<p style="margin: 0; opacity: 0.9; font-size: 16px;">${tagline}</p>` : ''}
          </div>

          <h2 style="color: #333; font-size: 18px; margin-bottom: 16px;">Your Optimized Profiles</h2>
          
          ${profilesHtml}

          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; text-align: center;">
            <p style="color: #666; font-size: 14px; margin: 0 0 8px 0;">Cooked with 🍳 by</p>
            <a href="https://aiomelette.com" style="color: #FF6B35; text-decoration: none; font-weight: bold;">Ai Omelette</a>
            <p style="color: #999; font-size: 12px; margin-top: 16px;">
              The breakfast-themed AI newsletter that makes automation delicious.
            </p>
          </div>

        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }

    // Add subscriber to MailPoet list (AiOmelette Fresh AI Served Daily)
    try {
      await fetch('https://aiomelette.com/wp-json/aio/v1/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.MAILPOET_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          email: email,
          source: 'Profile Omelette',
        }),
      });
    } catch (mailpoetError) {
      // Log but don't fail - email was still sent successfully
      console.error('MailPoet webhook error:', mailpoetError);
    }

    return res.status(200).json({ success: true, messageId: data?.id });

  } catch (error) {
    console.error('Email API error:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
