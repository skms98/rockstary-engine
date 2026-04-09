// AI prompts for the Attractions content pipeline
// Attractions are fundamentally different from events:
// - Experience/venue-focused (evergreen), not event-date-focused (time-bound)
// - Keyword-optimized descriptions for SEO
// - No organiser trigger risk (venue-owned content)
// - No A/B tests (evergreen content, not conversion-tested)
// - Still written in Platinumlist TOV

export interface AttractionStepContext {
  attractionName: string
  attractionUrl: string
  originalDescription: string
  keywordsList: string
  recommendedVersions: string
  factCheckScores: string
  duplicateAnalysis: string
  tovScore: string
  grammarStyle: string
  reviewerOutput: string
  resolverOutput: string
  prevOriginalDescription: string
  seoAnalysis: string
  factCheckFinal: string
  optimizedDescription: string
  rankedVersions: string
}

// ═══════════════════════════════════════════════════════════════
// HUMANIZER RULES — Anti-AI Pattern Layer
// Injected into all writing, rewriting, and editorial steps
// ═══════════════════════════════════════════════════════════════
const HUMANIZER_CONTEXT = `
HUMANIZER RULES — STRIP AI PATTERNS FROM ALL OUTPUT:

BANNED WORDS (never use, no exceptions):
crucial, showcase, landscape, testament, delve, foster, navigate, leverage, unlock, elevate, streamline, pivotal, milestone, groundbreaking, game-changer, vibrant, nestled, thriving, dynamic, robust, holistic, seamless, cutting-edge, transformative, innovative

BANNED OPENERS (never start a sentence with):
Additionally, Furthermore, Moreover, It's worth noting that, It's important to note that, Notably,

BANNED CONSTRUCTIONS:
- "serves as" → use "is" instead
- "functions as" → use "is" instead
- Vague -ing modifiers: "showcasing how", "highlighting the importance of", "demonstrating that", "underscoring"
- Stacked hedges: "somewhat possibly", "might potentially", "could perhaps", "it could be argued that"
- Fake range statements: "from X to Y" that add no real information
- Forced rule-of-three: three items chosen for rhythm, not relevance — cut to two or expand to four if needed
- Generic conclusions: ending with a vague wrap-up instead of a specific point

STYLE RULES:
- Write with a clear point of view — human writing has an opinion
- Be specific: if you can't name something concrete, cut the line
- No passive voice stacking — two passive constructions in a row must be rewritten
- End every piece on a specific, grounded note — not a vague aspiration
`

export const ATTRACTION_PROMPTS: Record<string, (ctx: AttractionStepContext) => string> = {

  // Step K: Keywords List (AI-generated from description)
  keywords_list: (ctx) => `You are an SEO keyword specialist for Platinumlist.net, a leading events and entertainment ticketing platform in the Middle East.

Analyze the following attraction description and generate a comprehensive keyword list for SEO optimization.

ATTRACTION: ${ctx.attractionName}
URL: ${ctx.attractionUrl}

DESCRIPTION:
${ctx.originalDescription}

Generate keywords in these categories:

1. PRIMARY KEYWORDS (3-5): High-volume search terms directly about this attraction
2. SECONDARY KEYWORDS (5-8): Related terms people search when looking for this type of experience
3. LONG-TAIL KEYWORDS (5-10): Specific phrases like "best [attraction type] in [city]", "[attraction] tickets price", "[attraction] opening hours"
4. LOCATION KEYWORDS (3-5): Geographic terms (city, area, landmark proximity)
5. EXPERIENCE KEYWORDS (3-5): What visitors feel/do (family-friendly, thrill-seeking, immersive, etc.)
6. SEASONAL/TIMING KEYWORDS (2-4): Best time to visit, weekend activity, etc.

Format as a structured list with each category clearly labeled. Also provide a comma-separated flat list of ALL keywords at the end for easy copy-paste.`,

  // Step S2: Keyword-Optimized Versions â structured section output
  recommended_versions: (ctx) => `You are a professional content writer for Platinumlist.net, specializing in attraction and experience descriptions.

Produce a STRUCTURED keyword-optimised attraction page. Each keyword from the list must be used EXACTLY ONCE, annotated as (keyword) [number].

ATTRACTION: ${ctx.attractionName}
URL: ${ctx.attractionUrl}

ORIGINAL DESCRIPTION (source of truth â do NOT invent facts beyond this):
${ctx.originalDescription}

KEYWORDS LIST:
${ctx.keywordsList}

RULES:
- Keyword format: (keyword text) [number]. Example: (Burj Khalifa in Dubai) [1]
- Prepositions may be added inside brackets for grammar flow
- Keywords may be pluralised if grammar requires
- Each keyword used exactly ONCE across the entire output
- Max 2 keyword annotations per sentence
- No same keyword in consecutive sentences
- No em dashes. Use commas, full stops, semicolons.
- No hype or superlatives (amazing, incredible, best, unforgettable, must-see)
- Platinumlist B2C TOV: warm, inviting, informative, action-oriented, experience-focused
- Active voice preferred. Sentences max 22-24 words.
- UK English. Metric measurements.

${HUMANIZER_CONTEXT}

OUTPUT SECTIONS (use === SECTION NAME === delimiters):

=== TEASER ===
One line, max 13 words. Start with a strong action verb (Experience, Discover, Celebrate, Witness, Immerse, Ignite, Embrace, etc.). Must be short, vivid, and capture the experience + vibe. No venue, no date, no CTA, no filler, no cliches (unforgettable, incredible, amazing, must-see, like no other, promises to be). Used for SEO meta.

=== WHAT TO EXPECT ===
2-4 paragraphs. Full SEO rewrite. Weave brand/location keywords here. Follow visitor journey: arrival, activities, atmosphere, outcome.

=== CTA ===
One line starting with a warm action verb. NEVER mention Platinumlist or any platform name. Example: "Book your spot now and..."

=== HIGHLIGHTS ===
Exactly 4 lines. Each starts with present-tense action verb. Under 12 words. No adjective hype. Line-break separated. No bullets.

=== INCLUSIONS ===
From source only. Line-break separated. No bullets. If unavailable: null

=== EXCLUSIONS ===
From source only. Line-break separated. No bullets. If unavailable: null

=== TIMINGS ===
From source. If empty: "Timings vary by date. Check available sessions by pressing Select Tickets."

=== IMPORTANT THINGS TO KNOW ===
Practical info from source (preserve original wording, fix capitalisation only). End with: To check the (tickets) [n] and (price) [n], press "Select Tickets" on this page.

=== CANCELLATION POLICY ===
Use source policy verbatim or apply standard Platinumlist format. If unavailable: null

=== DIRECTIONS ===
By car: ...
By taxi: ...
By public transportation: ...
If unavailable: null`,

  // Step S3: Fact Check
  fact_check_scores: (ctx) => `You are a fact-checking analyst for Platinumlist.net.

Compare the ORIGINAL attraction description with the KEYWORD-OPTIMIZED versions. For each version, score factual accuracy from 0-100.

Check for:
- Location and venue accuracy
- Attraction features and offerings (rides, exhibits, etc.)
- Age restrictions or requirements
- Pricing references (if any)
- Any fabricated features, experiences, or claims not in the original
- Operating details accuracy

ATTRACTION: ${ctx.attractionName}

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Fact Check Score (0-100)
2. Flagged issues (if any)
3. Verdict: PASS / NEEDS REVIEW / FAIL`,

  // Step S4: Duplicate Analysis
  duplicate_analysis: (ctx) => `You are a content duplication analyst for Platinumlist.net.

Analyze the ORIGINAL and KEYWORD-OPTIMIZED attraction descriptions for originality. Are the optimized versions genuinely rewritten with keyword integration, or just superficially reshuffled?

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Originality Score (0-100, where 100 = completely fresh, 0 = copy-paste)
2. Overlapping phrases/sentences from original
3. Keyword integration quality (natural vs forced)
4. Assessment: ORIGINAL / PARTIALLY ORIGINAL / DUPLICATE`,

  // Step S5: TOV Score
  tov_score: (ctx) => `You are a brand voice analyst for Platinumlist.net.

The Platinumlist Tone of Voice (TOV) for attractions should be:
- Warm and welcoming â like a local friend recommending a must-visit spot
- Confident but not arrogant â authoritative about the experience
- Informative and helpful â practical details woven naturally into engaging copy
- Exciting without being over-the-top â builds genuine anticipation
- Professional yet approachable â trustworthy platform voice
- Action-oriented â encouraging ticket purchase / booking
- Evergreen â not dated, works year-round (unless seasonal attraction)
- Experience-focused â emphasizes what you'll see, do, and feel

Evaluate each KEYWORD-OPTIMIZED version against these attraction-specific TOV guidelines.

ATTRACTION: ${ctx.attractionName}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. TOV Score (0-100)
2. TOV strengths (specific phrases that nail the voice)
3. TOV weaknesses (where it falls flat or sounds generic)
4. Keyword-TOV balance (do keywords feel natural or forced?)
5. Overall verdict: ON-BRAND / MOSTLY ON-BRAND / OFF-BRAND`,

  // Step S6: Grammar & Style
  grammar_style: (ctx) => `You are a professional copy editor for Platinumlist.net attraction content.

${HUMANIZER_CONTEXT}

Review the KEYWORD-OPTIMIZED versions for grammar, spelling, punctuation, style, and readability.

ATTRACTION: ${ctx.attractionName}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Grammar Score (0-100)
2. Issues found (categorized: grammar, spelling, punctuation, style)
3. Readability assessment (sentence length variety, flow, scannability)
4. Keyword density check (is any keyword overused?)
5. Corrected version (if needed)`,

  // Step S7: Reviewer
  reviewer_output: (ctx) => `You are a senior content reviewer for Platinumlist.net attractions.

${HUMANIZER_CONTEXT}

Based on ALL previous analysis, review the keyword-optimized versions and provide editorial assessment.

ATTRACTION: ${ctx.attractionName}

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

KEYWORDS USED:
${ctx.keywordsList}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

FACT CHECK:
${ctx.factCheckScores}

DUPLICATE ANALYSIS:
${ctx.duplicateAnalysis}

TOV SCORE:
${ctx.tovScore}

GRAMMAR & STYLE:
${ctx.grammarStyle}

Provide:
1. Overall assessment of each version (strengths, weaknesses)
2. Keyword integration effectiveness per version
3. Which version best balances SEO + readability + TOV
4. Recommended edits for the top version(s)
5. Final ranking
6. Any versions to discard and why`,

  // Step S8: Resolver
  resolver_output: (ctx) => `You are the final content resolver for Platinumlist.net attractions.

${HUMANIZER_CONTEXT}

Based on the reviewer's feedback, create the FINAL resolved attraction description that:
- Incorporates all reviewer feedback
- Fixes all identified issues
- Maximizes keyword integration naturally
- Maintains the best elements from each version
- Is in proper attractions format (experience-focused, evergreen)
- Follows Platinumlist TOV perfectly
- Is ready for publication on Platinumlist.net

ATTRACTION: ${ctx.attractionName}

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

KEYWORDS:
${ctx.keywordsList}

REVIEWER FEEDBACK:
${ctx.reviewerOutput}

KEYWORD-OPTIMIZED VERSIONS:
${ctx.recommendedVersions}

Produce:
1. FINAL VERSION â The best resolved description ready for publication
2. ALTERNATIVE VERSION â A backup with a different keyword emphasis
3. Changelog â What was changed from the keyword-optimized versions and why`,

  // Step S9: SEO Keyword Analysis
  seo_analysis: (ctx) => `You are an SEO specialist for Platinumlist.net attractions.

Compare the ORIGINAL description with the RESOLVED versions for SEO keyword performance.

ATTRACTION: ${ctx.attractionName}

TARGET KEYWORDS:
${ctx.keywordsList}

ORIGINAL (OLD) DESCRIPTION:
${ctx.prevOriginalDescription || ctx.originalDescription}

RESOLVED (NEW) VERSIONS:
${ctx.resolverOutput}

Analyze:
1. Keyword coverage â which target keywords appear in old vs new
2. Keyword density per version (should be 1-3% per primary keyword)
3. Keyword placement quality (title, first paragraph, subheadings, body, CTA)
4. Semantic keyword variations used
5. Meta description suitability (under 160 chars, includes primary keyword)
6. Internal linking keyword opportunities
7. SEO Score for old version (0-100)
8. SEO Score for new version(s) (0-100)
9. Missing keywords that should be added
10. Over-optimized keywords that should be reduced`,

  // Step S10: Fact Check Final
  fact_check_final: (ctx) => `You are a final fact-checker for Platinumlist.net attractions.

Final verification before publication. Compare RESOLVED versions against the ORIGINAL description.

ATTRACTION: ${ctx.attractionName}

ORIGINAL DESCRIPTION:
${ctx.prevOriginalDescription || ctx.originalDescription}

RESOLVED VERSIONS:
${ctx.resolverOutput}

Verify:
1. All location/venue details are accurate
2. All attraction features and offerings are accurate
3. No fabricated experiences or amenities
4. Age/height restrictions are correct (if mentioned)
5. Pricing references accurate (if any)
6. No misleading claims introduced during optimization
7. Keywords haven't distorted factual content
8. Final Fact Check Score (0-100) for each resolved version
9. APPROVED / NOT APPROVED verdict`,

  // Step S11: Optimized Final Description â STRUCTURED SECTION OUTPUT
  // This produces the master output matching the reference Excel format
  optimized_description: (ctx) => `You are the final production editor for Platinumlist.net attractions.

Your task is to produce a PUBLICATION-READY structured attraction page by combining the best resolved version with all analysis feedback.

ATTRACTION: ${ctx.attractionName}
URL: ${ctx.attractionUrl}

TARGET KEYWORDS:
${ctx.keywordsList}

ORIGINAL DESCRIPTION (source of truth):
${ctx.originalDescription}

RESOLVED VERSIONS:
${ctx.resolverOutput}

SEO ANALYSIS:
${ctx.seoAnalysis}

FACT CHECK RESULT:
${ctx.factCheckFinal}

${HUMANIZER_CONTEXT}

HARD RULES:
- Every keyword from the list must be used EXACTLY ONCE in the output, annotated as (keyword) [number]. Example: (Burj Khalifa in Dubai) [1]
- Keywords may have prepositions added inside brackets if needed for grammar: (snorkeling tour) [4] or (tickets) [6]
- Keywords may be pluralised if grammar requires it
- No keyword may appear in consecutive sentences. Minimum 18-word gap before reuse.
- Maximum two keyword annotations per sentence
- No em dashes anywhere. Use commas, full stops, or semicolons.
- No hype, no superlatives (amazing, incredible, best, unforgettable)
- No invented facts. Every claim must trace to the ORIGINAL DESCRIPTION
- UK English. Metric measurements.
- Platinumlist B2C TOV: warm, inviting, informative, action-oriented, experience-focused
- Sentence max: 22-24 words. Active voice preferred.

OUTPUT FORMAT â Produce each section below. Use === SECTION NAME === as delimiters:

=== TEASER ===
One line, max 13 words. Start with a strong action verb (Experience, Discover, Celebrate, Witness, Immerse, Ignite, Embrace, etc.). Must be short, vivid, and capture the experience + vibe. No venue, no date, no CTA, no filler, no cliches (unforgettable, incredible, amazing, must-see, like no other, promises to be). Used for SEO meta.

=== WHAT TO EXPECT ===
Full SEO-optimised rewrite of the description. 2-4 short paragraphs. Naturally weave in brand/location keywords here. Follow the Visitor Journey flow: arrival, activities, atmosphere, outcome.

=== CTA ===
One closing line starting with a warm action verb. NEVER mention Platinumlist or any platform name. Example: "Book your spot now and..."

=== HIGHLIGHTS ===
Exactly 4 lines, each starting with a present-tense action verb (Explore, Discover, Access, View, etc.).
Under 12 words per line. No value adjectives. No bullet characters. Line-break separated.

=== INCLUSIONS ===
Clean list of what the ticket includes. No bullet characters. Line-break separated.
Only items explicitly stated in the original. If unavailable: null

=== EXCLUSIONS ===
Clean list of what is NOT included. No bullet characters. Line-break separated.
Only items explicitly stated in the original. If unavailable: null

=== TIMINGS ===
Timing info from the source. If unavailable, write: Timings vary by date. Check available sessions by pressing "Select Tickets" on this page.

=== IMPORTANT THINGS TO KNOW ===
Practical visitor info transplanted from the original (verbatim where possible, fixing only capitalisation).
MUST end with: To check the (tickets) [n] and (price) [n], press "Select Tickets" on this page. Available dates and costs are displayed there, and the booking can be completed directly.

=== CANCELLATION POLICY ===
Apply the correct policy from these options:
- No Cancellation: "This experience has a non-cancellable, non-changeable cancellation policy. Once booked, the ticket cannot be cancelled or modified."
- Free Cancellation: "Free cancellation or rescheduling is allowed up to (x) hours before the experience."
- Reschedule Only: "This experience has a reschedule-only policy: Rescheduling is allowed up to (x) hours before the tour or visit. No cancellations or refunds."
- Custom: If the source has a unique policy (e.g. partial refund), preserve the exact terms.
If unavailable in the original: null

=== DIRECTIONS ===
By car: [directions from source or factual inference]
By taxi: [directions]
By public transportation: [directions]
If unavailable: null for each sub-section

VALIDATION BEFORE OUTPUT:
- All keywords used with correct [number] annotations? Check.
- Zero stacked keywords? Check.
- No em dashes? Check.
- Fact check score 10/10 vs original? Check.
- TOV aligned? Check.
If any check fails, revise before outputting.`,

  // Step S12: Ranked Top Versions
  ranked_versions: (ctx) => `You are the final ranking judge for Platinumlist.net attraction content.

Rank all versions produced and select the TOP version for publication.

ATTRACTION: ${ctx.attractionName}

SEO ANALYSIS:
${ctx.seoAnalysis}

FINAL FACT CHECK:
${ctx.factCheckFinal}

RESOLVED VERSIONS:
${ctx.resolverOutput}

OPTIMIZED FINAL:
${ctx.optimizedDescription}

Ranking criteria (in order of importance):
1. Factual accuracy (highest fact check score)
2. SEO keyword optimization (best keyword coverage + natural integration)
3. TOV compliance (Platinumlist voice)
4. Originality (lowest duplicate score)
5. Grammar & readability
6. Attraction format quality (experience-focused, evergreen, not event-like)

Provide:
1. RANKED LIST of all versions (best to worst) with scores
2. WINNER â The #1 version to publish with explanation
3. Keyword coverage summary for the winner
4. Final publication-ready version with any last tweaks
5. Recommended meta description (under 160 chars, includes primary keyword)`,
}

// Map attraction step fields to prompt keys
export const ATTRACTION_FIELD_TO_PROMPT: Record<string, string> = {
  keywords_list: 'keywords_list',
  recommended_versions: 'recommended_versions',
  fact_check_scores: 'fact_check_scores',
  duplicate_analysis: 'duplicate_analysis',
  tov_score: 'tov_score',
  grammar_style: 'grammar_style',
  reviewer_output: 'reviewer_output',
  resolver_output: 'resolver_output',
  seo_analysis: 'seo_analysis',
  fact_check_final: 'fact_check_final',
  optimized_description: 'optimized_description',
  ranked_versions: 'ranked_versions',
}

// AI steps for attractions (different order and steps than events)
export const ATTRACTION_AI_STEPS = [
  'keywords_list',
  'recommended_versions',
  'fact_check_scores',
  'duplicate_analysis',
  'tov_score',
  'grammar_style',
  'reviewer_output',
  'resolver_output',
  'seo_analysis',
  'fact_check_final',
  'optimized_description',
  'ranked_versions',
]
