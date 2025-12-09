const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Platform targets: all in CHARACTERS now
// Updated 2025-12-09 based on actual platform limits research
const PLATFORM_TARGETS = {
  instagram: { min: 130, max: 150 },    // Platform limit: 150 chars
  tiktok: { min: 70, max: 80 },         // Platform limit: 80 chars (some accounts have 160)
  x: { min: 140, max: 160 },            // Platform limit: 160 chars
  linkedin: { min: 650, max: 750 },     // About section: 2,600 max; this targets a summary
  youtube: { min: 600, max: 1000 },     // Channel bio limit: 1,000 chars
  facebook: { min: 200, max: 255 },     // Page bio limit: 255 chars (Intro is only 101)
  google: { min: 500, max: 750 },       // Google Business Profile: 750 chars
  threads: { min: 130, max: 150 },      // Same as Instagram: 150 chars
  pinterest: { min: 400, max: 500 },    // Bio limit: 500 chars (was 160, increased 2022)
  linkinbio: { min: 60, max: 80 },      // Ultra-short for Linktree-style pages
  substack: { min: 200, max: 250 },     // Author bio limit: 250 chars
  medium: { min: 140, max: 160 },       // Profile bio limit: 160 chars
};

// For UI display (max chars for progress bar)
// Updated 2025-12-09 to match actual platform limits
const PLATFORM_CHAR_LIMITS = {
  instagram: 150,
  tiktok: 80,       // Lowered from 150 - actual limit is 80
  x: 160,
  linkedin: 750,
  youtube: 1000,
  facebook: 255,    // Lowered from 500 - Page bio limit is 255
  google: 750,
  threads: 150,
  pinterest: 500,
  linkinbio: 80,
  substack: 250,    // Lowered from 400 - author bio limit is 250
  medium: 160,
};

const SYSTEM_PROMPT = `You are Profile Omelette, an AI that creates optimized social media profiles.

YOUR MISSION:
Generate platform-specific bios that FILL the target length range while staying authentic to the user's input.

CRITICAL RULES - READ CAREFULLY:

1. LENGTH TARGETS (MUST HIT):
   - Each platform has a MIN and MAX target in CHARACTERS.
   - You will be told the range for each platform, e.g. "650-750 chars".
   - You MUST write content whose final character count (bio only) is WITHIN this range.
   - Aim for the UPPER HALF of the range, especially for long-form platforms:
     • linkedin, google, youtube, facebook, pinterest, substack
   - Do NOT undershoot by more than ~10–15% of the max unless the user provided almost no information.
   - If your draft is too long, you MUST silently trim until it fits the MAX.

2. CHARACTER COUNT INTEGRITY:
   - "char_count" MUST reflect the actual length of the bio string you output.
   - Do NOT fake or approximate char_count.
   - Users will see this count and compare it to the target ranges.

3. ANTI-HALLUCINATION (STRICT):
   - NEVER invent: job titles, company names, revenue numbers, awards, certifications, years of experience, client names, or specific achievements.
   - If the user didn't mention it, you CAN'T mention it.
   - When in doubt, stay generic and honest.

4. TONE MATCHING:
   - Match the brand_vibe_keywords exactly.
   - Use emojis based on emoji_preference:
     • "yes" = use 2-4 emojis naturally
     • "minimal" = use 1-2 emojis max
     • "none" = zero emojis

5. HANDLE GENERATION:
   - core_handle: lowercase, underscores okay, memorable, 15 chars max.
   - Provide 3 alternatives that are slight variations.

6. TAGLINE:
   - Max 60 characters.
   - Catchy, memorable, captures essence.
   - If user provided one, use it exactly.

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

REMEMBER:
- Use the per-platform ranges provided in the user message.
- Hit the range, lean high, never exceed the max.
- Users will see char_count displayed. Hitting the targets is part of your job.`;

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

    // Build platform requirements - all in CHARACTERS now
    const platformRequirements = platforms
      .map(p => {
        const target = PLATFORM_TARGETS[p] || { min: 100, max: 150 };
        return `- ${p}: ${target.min}-${target.max} chars (MUST be within this range)`;
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

=== TAGLINE ===
MODE: ${intake.tagline?.mode || 'generate'}
${intake.tagline?.mode === 'input' ? `USER'S TAGLINE (use exactly): "${intake.tagline.value}"` : 'Generate a fresh tagline'}

=== HANDLE ===
MODE: ${intake.handle?.mode || 'generate'}
${intake.handle?.mode === 'input' ? `PREFERRED HANDLE: @${intake.handle.preferred}` : 'Generate handle suggestions'}

=== PLATFORMS TO GENERATE ===
${platformRequirements}

=== REMINDERS ===
- Hit the CHARACTER TARGETS for each platform (check min-max range)
- Aim for the UPPER HALF of each range
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
      temperature: 0.7,
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
