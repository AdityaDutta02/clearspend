/**
 * Decodes the payload segment of a Terminal AI embed token (JWT format)
 * and extracts the user ID from the `sub` claim.
 *
 * No JWT library is used — the middle segment is base64-decoded directly.
 * Signature verification is intentionally omitted: the token is trusted
 * by the Terminal AI embed system; this utility only reads the identity claim.
 */
export function getUserId(embedToken: string): string | null {
  try {
    const parts = embedToken.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[1])) as { sub?: string }
    return payload.sub ?? null
  } catch {
    return null
  }
}
