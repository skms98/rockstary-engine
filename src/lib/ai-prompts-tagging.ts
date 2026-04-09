// Tagging Beast AI Prompts
// These functions build the AI prompts by combining the stored instruction text
// with the current taxonomy data and the user's source text

export interface TaggingContext {
  sourceText: string
  taggingBeastPrompt: string
  validatorPrompt: string
  categories: string  // formatted list of all categories from taxonomy
  tags: string        // formatted list of all tags from taxonomy
  artistEnrichment?: string  // real-time web search results for artist genre/nationality
}

export function buildInitialTaggingPrompt(ctx: TaggingContext): string {
  return `${ctx.taggingBeastPrompt}

=== AUTHORIZED TAXONOMY ===

CATEGORIES (Selectable Leaves Only):
${ctx.categories}

MARKETING TAGS:
${ctx.tags}

=== SOURCE CONTENT TO CLASSIFY ===
${ctx.sourceText}
${ctx.artistEnrichment ? `
=== ARTIST ENRICHMENT (from real-time web search) ===
Use this data to help determine genre tags, nationality, and artist classification. This supplements the source content above.
${ctx.artistEnrichment}
` : ''}
=== CRITICAL ENFORCEMENT: VERBATIM OR VOID ===
RULE 1 — STRING MATCHING IS NON-NEGOTIABLE.
Every category and tag you output MUST be a character-perfect, verbatim copy of a string in the AUTHORIZED TAXONOMY above.
No abbreviations. No synonyms. No paraphrasing. No invented strings. No partial matches.

RULE 2 — THE ONLY VALID STRINGS ARE THOSE LISTED ABOVE.
If a string does not appear EXACTLY in the CATEGORIES or MARKETING TAGS lists above, it is FORBIDDEN.
You cannot output anything that is not in those lists. Not even close approximations.

RULE 3 — WHEN IN DOUBT, OMIT.
If you are not 100% certain a string is an exact verbatim match from the taxonomy above, do NOT include it.
It is better to output fewer correct entries than any incorrect ones.

RULE 4 — NO HALLUCINATION UNDER ANY CIRCUMSTANCES.
You are a deterministic classification engine. You do not create. You only select from the given list.
Treat every category/tag slot as: does this exact string appear in the authorized list? YES → include. NO → exclude.

=== OUTPUT INSTRUCTIONS ===
Output FINAL JSON ONLY. No markdown. No commentary. No deviation.
Every string in your output must be verifiable as an exact match in the taxonomy above.`
}

export function buildValidatorPrompt(ctx: TaggingContext, initialResult: string): string {
  return `${ctx.validatorPrompt}

=== AUTHORIZED TAXONOMY ===

CATEGORIES (Selectable Leaves Only):
${ctx.categories}

MARKETING TAGS:
${ctx.tags}

=== SOURCE CONTENT ===
${ctx.sourceText}

=== PROPOSED CLASSIFICATION (FROM INITIAL TAGGING) ===
${initialResult}

=== CRITICAL ENFORCEMENT: VERBATIM OR VOID ===
Your ONLY job is to audit and purge. You apply Negative Selection exclusively.

STEP 1 — CHECK EVERY SINGLE CATEGORY in the proposed classification.
For each category string: scan the CATEGORIES list above for an exact verbatim match.
If found → KEEP. If not found (even a minor difference in wording, capitalisation, or punctuation) → DELETE.

STEP 2 — CHECK EVERY SINGLE TAG in the proposed classification.
For each tag string: scan the MARKETING TAGS list above for an exact verbatim match.
If found → KEEP. If not found → DELETE.

STEP 3 — DO NOT ADD ANYTHING.
You are a validator, not a tagger. You cannot add new categories or tags. You can only remove invalid ones.

HARD RULES:
- A string that looks similar to a taxonomy entry but is not identical → DELETE IT
- A string that approximates the meaning of a taxonomy entry but uses different words → DELETE IT
- Any string you cannot find verbatim in the taxonomy above → DELETE IT
- Zero tolerance for hallucinated or approximated strings

=== OUTPUT INSTRUCTIONS ===
Output FINAL validated JSON ONLY. No markdown. No commentary. No explanation.
What remains must be 100% verifiable against the taxonomy lists above.`
}
