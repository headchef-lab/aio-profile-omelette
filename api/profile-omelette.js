const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Platform targets: { min, max, unit }
const PLATFORM_TARGETS = {
  instagram: { min: 130, max: 150, unit: 'chars' },
  tiktok: { min: 130, max: 150, unit: 'chars' },
  x: { min: 140, max: 160, unit: 'chars' },
  linkedin: { min: 180, max: 260, unit: 'words' },
  youtube: { min: 150, max: 300, unit: 'words' },
  facebook: { min: 100, max: 200, unit: 'words' },
  google: { min: 120, max: 250, unit: 'words' },
  threads: { min: 130, max: 150, unit: 'chars' },
  pinterest: { min: 150, max: 200, unit: 'words' },
  linkinbio: { min: 60, max: 80, unit: 'chars' },
  substack: { min: 80, max: 120, unit: 'words' },
  medium: { min: 130, max: 160, unit: 'chars' },
};

// For UI display (max chars for progress bar)
const PLATFORM_CHAR_LIMITS = {
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
  substack: 300,
  medium: 160,
};

const SYSTEM_PROMPT = `You are Profile Omelette, an AI that creates optimized social media profiles.

YOUR MISSION:
Generate platform-specific bios that FILL the target length range while staying authentic to the user's input.

CRITICAL RULES - READ CAREFULLY:

1. LENGTH TARGETS (MUST HIT):
   - Each platform has a MIN and MAX target (chars or words)
   - You MUST write content that falls WITHIN this range
   - If the user provides sparse info, use GENERIC BUT HONEST filler phrases like:
     • "sharing experiments"
     • "building smarter workflows"
     • "learning in public"
     • "exploring what's next"
     • "making [industry] more human"
   - NEVER pad with fluff that sounds fake

2. ANTI-HALLUCINATION (STRICT):
   - NEVER invent: job titles, company names, revenue numbers, awards, certifications, years of experience, client names, or specific achievements
   - If the user didn't mention it, you CAN'T mention it
   - When in doubt, stay generic and honest

3. TONE MATCHING:
   - Match the brand_vibe_keywords exactly
   - Use emojis based on emoji_preference:
     • "yes" = use 2-4 emojis naturally
     • "minimal" = use 1-2 emojis max
     • "none" = zero emojis

4. HANDLE GENERATION:
   - core_handle: lowercase, underscores okay, memorable, 15 chars max
   - Provide 3 alternatives that are slight variations

5. TAGLINE:
   - Max 60 characters
   - Catchy, memorable, captures essence
   - If user provided one, use it exactly

RESPONSE FORMAT (JSON only):
{
  "brand_foundation": {
    "tagline": "Your tagline here",
    "core_handle": "mainhandle",
    "handle_alternatives": ["alt1", "alt2", "alt3"]
  },
  "profiles": {
    "platform_name": {
      "bio": "The full bio text here",
      "char_count": 142,
      "word_count": 28,
      "handle_primary": "mainhandle",
      "notes": ["Explanation of any sparse-input fills or choices made"]
    }
  }
}

REMEMBER: Users will see char_count displayed. Hit your targets!`;

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const intake = req.body;
    const platforms = intake.platforms_to_generate || ['instagram', 'linkedin'];

    // Build platform requirements with ranges
    const platformRequirements = platforms
      .map(p => {
        const target = PLATFORM_TARGETS[p] || { min: 100, max: 150, unit: 'chars' };
        return `- ${p}: ${target.min}-${target.max} ${target.unit} (MUST be within this range)`;
      })
      .join('\n');

    const userPrompt = `Generate profiles for this brand:

=== BRAND INFO ===
NAME: ${intake.business_name || 'My Business'}
FOUNDER: ${intake.founder_name || 'Not specified'}
INDUSTRY: ${intake.industry_category || 'General'}
WHAT THEY DO: ${intake.one_line_what_you_do || 'Not specified'}
LONGER DESCRIPTION: ${intake.long_description || 'None provided'}
WEBSITE: ${intake.website_url || 'None'}
LOCATION: ${intake.location || 'Not specified'}

=== AUDIENCE & VIBE ===
TARGET AUDIENCE: ${intake.target_audience || 'General audience'}
BRAND VIBE: ${intake.brand_vibe_keywords || 'Professional, clean'}
EMOJI PREFERENCE: ${intake.emoji_preference || 'minimal'}
https://github.com/headchef-lab/aio-profile-omelette/blob/main/api/profile-omelette.js
=== TAGLINE ===
MODE: ${intake.tagline?.mode || 'generate'}
${intake.tagline?.mode === 'input' ? `USER'S TAGLINE (use exactly): "${intake.tagline.value}"` : 'Generate a fresh tagline'}

=== HANDLE ===
MODE: ${intake.handle?.mode || 'generate'}
${intake.handle?.mode === 'input' ? `PREFERRED HANDLE: @${intake.handle.preferred}` : 'Generate handle suggestions'}

=== PLATFORMS TO GENERATE ===
${platformRequirements}

=== REMINDERS ===
- Hit the LENGTH TARGETS for each platform (check min-max range)
- Do NOT invent credentials, companies, awards, or numbers
- If info is sparse, use generic honest phrases to fill length
- Include char_count and word_count in each profile
- Add notes explaining any choices or sparse-input fills

Return valid JSON only.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Slightly lower for more consistent length adherence
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Post-process: add charLimit for UI display
    if (result.profiles) {
      for (const platform of Object.keys(result.profiles)) {
        result.profiles[platform].charLimit = PLATFORM_CHAR_LIMITS[platform] || 150;
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Profile Omelette API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
