import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const SYSTEM_PROMPT = `You are Profile Omelette, an AI that creates optimized social media profiles.

Generate:
1. A brand foundation (tagline + handle + alternatives)
2. Platform-specific bios respecting character limits

RULES:
- Tagline: max 60 chars, catchy and memorable
- Handle: lowercase, no spaces, use underscores if needed
- Bios: respect each platform's character limit
- Match the brand vibe in tone
- Use emojis based on emoji_preference setting

RESPONSE FORMAT (JSON only):
{
  "brand_foundation": {
    "tagline": "Your tagline here",
    "core_handle": "mainhandle",
    "handle_alternatives": ["alt1", "alt2", "alt3"]
  },
  "profiles": {
    "instagram": {
      "bio": "Bio text here",
      "handle_primary": "mainhandle"
    }
  }
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const intake = req.body;
    const platforms = intake.platforms_to_generate || ['instagram', 'linkedin'];
    
    const platformLimits = platforms
      .map(p => `- ${p}: max ${PLATFORM_LIMITS[p] || 150} chars`)
      .join('\n');

    const userPrompt = `Generate profiles for:

BRAND: ${intake.business_name || 'My Business'}
INDUSTRY: ${intake.industry_category || 'General'}
WHAT THEY DO: ${intake.one_line_what_you_do || 'Not specified'}
DESCRIPTION: ${intake.long_description || ''}
AUDIENCE: ${intake.target_audience || 'General'}
VIBE: ${intake.brand_vibe_keywords || 'Professional'}
EMOJI: ${intake.emoji_preference || 'minimal'}
TAGLINE MODE: ${intake.tagline?.mode || 'generate'}
${intake.tagline?.mode === 'input' ? `USER TAGLINE: ${intake.tagline.value}` : ''}
HANDLE MODE: ${intake.handle?.mode || 'generate'}
${intake.handle?.mode === 'input' ? `PREFERRED: ${intake.handle.preferred}` : ''}

PLATFORMS:
${platformLimits}

Return valid JSON only.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json(result);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
