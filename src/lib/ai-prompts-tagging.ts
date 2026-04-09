// Tagging Beast AI Prompts
// These functions build the AI prompts by combining the stored instruction text
// with the current taxonomy data and the user's source text.
// The DB prompts (tagging_beast and validator) are the SOLE authority for
// classification rules, enforcement, and output format.
// This code only injects live taxonomy + source content — nothing else.

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
=== EVENT ENRICHMENT (supplementary reference) ===
${ctx.artistEnrichment}

How to use this data:
- "Performance Language: X" → If the show is performed/spoken in a non-English language (e.g. Arabic, Hindi), ALWAYS apply the matching language-based categories and tags from the taxonomy (e.g. "Arabic Events", "Arabic"). Performance language is a strong, mandatory signal — it means the audience will hear that language on stage.
- Artist genre info → Use ONLY to help select genre-related TAGS (e.g. "Hip Hop", "EDM", "Pop"). Do NOT let artist background influence CATEGORY selection — categories are determined by what the EVENT is (pool party, concert, comedy show, etc.), not by the artist.
` : ''}`
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
${initialResult}`
}
