export function extractJsonArray(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in AI response')
  return match[0]
}

export function extractJsonObject(text: string): string {
  // Greedy match: first '{' to last '}'. Callers wrap JSON.parse in try/catch,
  // so any non-JSON content fails closed rather than passing bad data through.
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object in AI response')
  return match[0]
}
