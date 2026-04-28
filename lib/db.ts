// Terminal AI Database SDK — server-side only
const GATEWAY_URL = process.env.TERMINAL_AI_GATEWAY_URL!

async function dbRequest(
  method: string,
  path: string,
  body: unknown,
  embedToken: string,
): Promise<Response> {
  const url = `${GATEWAY_URL}/db/${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${embedToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const rawText = await res.text().catch(() => '<unreadable>')
    let errMsg: string
    try {
      const parsed = JSON.parse(rawText) as { error?: string; message?: string; detail?: string }
      errMsg = parsed.error ?? parsed.message ?? parsed.detail ?? rawText
    } catch {
      errMsg = rawText
    }
    const fullMsg = `DB ${method} ${url} → ${res.status}: ${errMsg}`
    console.error('[db]', fullMsg)
    throw new Error(fullMsg)
  }
  return res
}

export async function dbList<T = Record<string, unknown>>(
  table: string,
  filters: Record<string, string>,
  embedToken: string,
): Promise<T[]> {
  const params = new URLSearchParams(filters)
  const res = await dbRequest('GET', `${table}?${params}`, undefined, embedToken)
  return res.json() as Promise<T[]>
}

export async function dbGet<T = Record<string, unknown>>(
  table: string,
  id: string,
  embedToken: string,
): Promise<T> {
  const res = await dbRequest('GET', `${table}/${id}`, undefined, embedToken)
  return res.json() as Promise<T>
}

export async function dbInsert<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
  embedToken: string,
): Promise<T> {
  const withId = { id: crypto.randomUUID(), ...row }
  const res = await dbRequest('POST', table, withId, embedToken)
  return res.json() as Promise<T>
}

export async function dbUpdate<T = Record<string, unknown>>(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  embedToken: string,
): Promise<T> {
  const res = await dbRequest('PATCH', `${table}/${id}`, patch, embedToken)
  return res.json() as Promise<T>
}

export async function dbDelete(table: string, id: string, embedToken: string): Promise<void> {
  await dbRequest('DELETE', `${table}/${id}`, undefined, embedToken)
}
