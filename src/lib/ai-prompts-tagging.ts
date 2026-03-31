// Tagging Beast AI Prompts
// These functions build the AI prompts by combining the stored instruction text
// with the current taxonomy data and the user's source text

export interface TaggingContext {
  sourceText: string
  taggingBeastPrompt: string
  validatorPrompt: string
  categories: string  // JSON string of all categories from taxonomy
  tags: string        // JSON string of all tags from taxonomy
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

=== INSTRUCTIONS ===
Classify the above source content using ONLY the authorized taxonomy above.
Follow every rule in the Tagging Beast prompt exactly.
Output FINAL JSON ONLY. No markdown. No commentary. No deviation.`
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

=== INSTRUCTIONS ===
Validate the proposed classification above against the authorized taxonomy and source content.
Apply Negative Selection ONLY - you cannot add, only purge.
Verbatim or Void - if not a 1:1 string match with taxonomy, DELETE it.
Output FINAL validated JSON ONLY. No markdown. No commentary.`
}
