import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Platform character limits
const PLATFORM_LIMITS = {
  instagram: 150,
  tiktok: 150,
  x: 160,
  linkedin: 2000,
  youtube: 1000,
  facebook: 500,
  google: 750,
  threads: 150,
  pinterest: 500,
  linkinbio: 80,
};

// System prompt for profile generation
const SYSTEM_PROMPT = `You are Profile Omelette, an AI that creates optimized social media profiles for brands and businesses.

You will receive intake data about a business and generate:
1. A brand foundation (tagline + handle + alternatives)
2. Platform-specific bios optimized for each platform's character limits and audience

RULES:
- Generate a catchy, memorable tagline (max 60 chars)
- Generate a primary handle and 3 alternatives (lowercase, no spaces, use underscores if needed)
- Each bio MUST respect the platform's character limit
- Bios should feel native to each platform's culture
- Use emojis based on the emoji_preference setting
- Match the brand vibe keywords in tone

RESPONSE FORMAT (JSON):
{
  "brand_foundation": {
    "tagline": "Your catchy tagline here",
    "core_handle": "mainhandle",
    "handle_alternatives": ["handle_alt1", "handle_alt2", "handle_alt3"]
  },
  "profiles": {
    "platform_name": {
      "bio": "Platform-optimized bio text",
      "handle_primary": "mainhandle",
      "handle_alternatives": ["alt1", "alt2"]
    }
  }
}`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const intake = req.body;

    // Build the user prompt
    const platformList = intake.platforms_to_generate || ['instagram', 'linkedin'];
    const platformLimitsText = platformList
      .map(p => `- ${p}: max ${PLATFORM_LIMITS[p] || 150} characters`)
      .join('\n');

    const userPrompt = `Generate social media profiles for this brand:

BRAND NAME: ${intake.business_name || 'My Business'}
FOUNDER: ${intake.founder_name || 'Not specified'}
INDUSTRY: ${intake.industry_category || 'General'}
WHAT THEY DO: ${intake.one_line_what_you_do || 'Not specified'}
LONGER DESCRIPTION: ${intake.long_description || 'Not provided'}
WEBSITE: ${intake.website_url || 'None'}
LOCATION: ${intake.location || 'Remote'}

TARGET AUDIENCE: ${intake.target_audience || 'General'}
BRAND VIBE: ${intake.brand_vibe_keywords || 'Professional, Friendly'}
EMOJI PREFERENCE: ${intake.emoji_preference || 'minimal'}

TAGLINE MODE: ${intake.tagline?.mode || 'generate'}
${intake.tagline?.mode === 'input' ? `USER'S TAGLINE: ${intake.tagline.value}` : 'Generate a fresh tagline.'}

HANDLE MODE: ${intake.handle?.mode || 'generate'}
${intake.handle?.mode === 'input' ? `PREFERRED HANDLE: ${intake.handle.preferred}` : 'Generate handle suggestions based on brand name.'}

PLATFORMS TO GENERATE (with character limits):
${platformLimitsText}

Generate the brand foundation and all platform bios. Return valid JSON only.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 2000,
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Profile Omelette API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate profiles',
      message: error.message 
    });
  }
}
