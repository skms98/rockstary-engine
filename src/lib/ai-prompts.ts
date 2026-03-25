// AI prompts for each step of the 13-step content pipeline
// These mirror the prompt docs referenced in the project instructions

export const STEP_PROMPTS: Record<string, (ctx: StepContext) => string> = {
  // Step 2: Recommended Versions
  recommended_versions: (ctx) => `You are a professional content editor for Platinumlist.net, a leading events and entertainment ticketing platform in the Middle East.

Given the following original event description, create 3 improved versions that are:
- More engaging and compelling for potential ticket buyers
- SEO-optimized with relevant keywords
- Professional tone of voice (TOV): warm, inviting, confident, informative
- Free of fluff, filler, or generic phrases
- Accurate to the original facts (dates, venues, artists, prices)
- Between 150-400 words each

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

EVENT: ${ctx.eventTitle}

Provide exactly 3 versions labeled Version A, Version B, and Version C. Each should take a slightly different angle (e.g., urgency-focused, experience-focused, information-focused).`,

  // Step 3: Fact Check Scores
  fact_check_scores: (ctx) => `You are a fact-checking analyst for Platinumlist.net.

Compare the ORIGINAL description with the RECOMMENDED versions below. For each version, score the factual accuracy from 0-100 and flag any discrepancies.

Check for:
- Dates and times accuracy
- Venue names and locations
- Artist/performer names
- Pricing information
- Event details (format, age restrictions, etc.)
- Any fabricated or assumed information not in the original

ORIGINAL DESCRIPTION (Column H):
${ctx.originalDescription}

RECOMMENDED VERSIONS (Column J):
${ctx.recommendedVersions}

For each version provide:
1. Fact Check Score (0-100)
2. Flagged issues (if any)
3. Verdict: PASS / NEEDS REVIEW / FAIL`,

  // Step 4: Duplicate Analysis
  duplicate_analysis: (ctx) => `You are a content duplication analyst for Platinumlist.net.

Analyze the ORIGINAL and RECOMMENDED descriptions for duplicate/recycled content. Check if the recommended versions are genuinely rewritten or just superficially reshuffled.

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Duplicate Score (0-100, where 100 = completely unique, 0 = copy-paste)
2. Overlapping phrases or sentences identified
3. Assessment: UNIQUE / PARTIALLY UNIQUE / DUPLICATE`,

  // Step 5: A/B Tests
  ab_tests: (ctx) => `You are a conversion optimization specialist for Platinumlist.net.

Based on the ORIGINAL and RECOMMENDED descriptions, design A/B test recommendations.

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

Provide:
1. Which version would likely perform best for click-through rate and why
2. Key differentiating elements between versions
3. Suggested headline variations for each
4. Predicted conversion ranking (best to worst)
5. Specific elements to test (CTA placement, urgency language, detail level)`,

  // Step 6: Organiser Trigger Risk
  organiser_trigger_risk: (ctx) => `You are a risk assessment specialist for Platinumlist.net.

Review the RECOMMENDED versions for content that might trigger negative reactions from event organisers. Organisers are sensitive about:
- Misrepresentation of their event
- Added claims not in the original
- Changed pricing or date information
- Tone that doesn't match their brand
- Exaggerated or understated descriptions
- Missing critical information from the original

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Risk Score (LOW / MEDIUM / HIGH)
2. Specific trigger points identified
3. Suggested mitigations`,

  // Step 7: TOV Score
  tov_score: (ctx) => `You are a brand voice analyst for Platinumlist.net.

The Platinumlist Tone of Voice (TOV) should be:
- Warm and welcoming
- Confident but not arrogant
- Informative and helpful
- Exciting without being over-the-top
- Professional yet approachable
- Clear and concise
- Action-oriented (encouraging ticket purchase)

Evaluate each RECOMMENDED version against these TOV guidelines.

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. TOV Score (0-100)
2. TOV strengths
3. TOV weaknesses
4. Specific phrases that match or violate the TOV
5. Overall TOV verdict: ON-BRAND / MOSTLY ON-BRAND / OFF-BRAND`,

  // Step 8: Grammar & Style
  grammar_style: (ctx) => `You are a professional copy editor for Platinumlist.net.

Review the RECOMMENDED versions for grammar, spelling, punctuation, and style issues.

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

For each version provide:
1. Grammar Score (0-100)
2. Issues found (categorized: grammar, spelling, punctuation, style)
3. Corrected version (if needed)
4. Style notes (sentence structure, readability, flow)`,

  // Step 9: Reviewer
  reviewer_output: (ctx) => `You are a senior content reviewer for Platinumlist.net.

Based on ALL previous analysis steps, review the recommended versions and provide your editorial assessment.

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

FACT CHECK RESULTS:
${ctx.factCheckScores}

DUPLICATE ANALYSIS:
${ctx.duplicateAnalysis}

A/B TEST RESULTS:
${ctx.abTests}

ORGANISER RISK:
${ctx.organiserTriggerRisk}

TOV SCORE:
${ctx.tovScore}

GRAMMAR & STYLE:
${ctx.grammarStyle}

Provide:
1. Overall assessment of each version
2. Recommended edits for each version
3. Final ranking of versions
4. Specific improvement suggestions
5. Any versions that should be discarded and why`,

  // Step 10: Resolver
  resolver_output: (ctx) => `You are the final content resolver for Platinumlist.net.

Based on the reviewer's feedback, create the FINAL resolved version(s) of the event description that:
- Incorporates all reviewer feedback
- Fixes all identified issues
- Maintains the best elements from each version
- Is ready for publication on Platinumlist.net

ORIGINAL DESCRIPTION:
${ctx.originalDescription}

REVIEWER FEEDBACK:
${ctx.reviewerOutput}

RECOMMENDED VERSIONS:
${ctx.recommendedVersions}

Produce:
1. FINAL VERSION - The best resolved description ready for publication
2. ALTERNATIVE VERSION - A backup option with a different angle
3. Changes made from the recommended versions (changelog)`,

  // Step 11: SEO Analysis
  seo_analysis: (ctx) => `You are an SEO specialist for Platinumlist.net.

Compare the ORIGINAL description with the RESOLVED versions for SEO performance.

ORIGINAL (OLD) DESCRIPTION:
${ctx.prevOriginalDescription || ctx.originalDescription}

RESOLVED (NEW) VERSIONS:
${ctx.resolverOutput}

Analyze:
1. Keyword density comparison (old vs new)
2. Primary and secondary keywords identified
3. Meta description suitability (under 160 chars)
4. Header/subheader optimization
5. Internal linking opportunities
6. SEO Score for old version (0-100)
7. SEO Score for new version(s) (0-100)
8. Specific SEO improvements made
9. Missing SEO opportunities`,

  // Step 12: Fact Check (Final)
  fact_check_final: (ctx) => `You are a final fact-checker for Platinumlist.net.

This is the FINAL fact check before publication. Compare the RESOLVED versions against the ORIGINAL description one last time.

ORIGINAL DESCRIPTION:
${ctx.prevOriginalDescription || ctx.originalDescription}

RESOLVED VERSIONS:
${ctx.resolverOutput}

Verify:
1. All dates, times, and locations are accurate
2. All artist/performer names are correct
3. No information has been fabricated
4. Pricing references are accurate (if any)
5. No misleading claims have been introduced
6. Final Fact Check Score (0-100) for each resolved version
7. APPROVED / NOT APPROVED verdict for each`,

  // Step 13: Ranked Top Versions
  ranked_versions: (ctx) => `You are the final ranking judge for Platinumlist.net content pipeline.

Based on ALL analysis from previous steps, rank the versions and select the TOP version(s) for publication.

SEO ANALYSIS:
${ctx.seoAnalysis}

FINAL FACT CHECK:
${ctx.factCheckFinal}

RESOLVER OUTPUT:
${ctx.resolverOutput}

Ranking criteria (in order of importance):
1. Factual accuracy (highest fact check score)
2. Lowest duplicate score (most original)
3. SEO performance
4. TOV compliance
5. Grammar & style quality
6. Low organiser trigger risk

Provide:
1. RANKED LIST of all versions (best to worst)
2. WINNER - The #1 version to publish with explanation
3. Discard any RISKY versions with explanation
4. Final publication-ready version with any last tweaks`,
}

export interface StepContext {
  eventTitle: string
  eventUrl: string
  originalDescription: string
  recommendedVersions: string
  factCheckScores: string
  duplicateAnalysis: string
  abTests: string
  organiserTriggerRisk: string
  tovScore: string
  grammarStyle: string
  reviewerOutput: string
  resolverOutput: string
  prevOriginalDescription: string
  seoAnalysis: string
  factCheckFinal: string
  rankedVersions: string
}

// Map step field names to which prompt to use
export const STEP_FIELD_TO_PROMPT: Record<string, string> = {
  recommended_versions: 'recommended_versions',
  fact_check_scores: 'fact_check_scores',
  duplicate_analysis: 'duplicate_analysis',
  ab_tests: 'ab_tests',
  organiser_trigger_risk: 'organiser_trigger_risk',
  tov_score: 'tov_score',
  grammar_style: 'grammar_style',
  reviewer_output: 'reviewer_output',
  resolver_output: 'resolver_output',
  seo_analysis: 'seo_analysis',
  fact_check_final: 'fact_check_final',
  ranked_versions: 'ranked_versions',
}
