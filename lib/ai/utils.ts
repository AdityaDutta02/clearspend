export function extractJsonArray(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in AI response')
  return match[0]
}

export function extractJsonObject(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object in AI response')
  return match[0]
}
