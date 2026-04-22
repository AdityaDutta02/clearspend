export function extractJsonArray(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in AI response')
  return match[0]
}
