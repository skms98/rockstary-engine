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
=== ARTIST ENRICHMENT (from real-time web search) ===
Use this data to help determine genre tags, nationality, and artist classification. This supplements the source content above.
${ctx.artistEnrichment}
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
