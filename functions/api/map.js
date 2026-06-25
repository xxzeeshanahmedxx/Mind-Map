const MAP_ID = 'default'

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  })
}

async function ensureSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run()
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ ok: false, error: 'D1 binding DB is not configured.' }, { status: 500 })
  }

  await ensureSchema(env.DB)
  const row = await env.DB
    .prepare('SELECT data, updated_at FROM maps WHERE id = ?')
    .bind(MAP_ID)
    .first()

  if (!row) {
    return json({ ok: true, exists: false, map: null })
  }

  return json({
    ok: true,
    exists: true,
    updatedAt: row.updated_at,
    map: JSON.parse(row.data),
  })
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) {
    return json({ ok: false, error: 'D1 binding DB is not configured.' }, { status: 500 })
  }

  const map = await request.json()
  const updatedAt = new Date().toISOString()

  await ensureSchema(env.DB)
  await env.DB
    .prepare(`
      INSERT INTO maps (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `)
    .bind(MAP_ID, JSON.stringify(map), updatedAt)
    .run()

  return json({ ok: true, updatedAt })
}

export async function onRequestDelete({ env }) {
  if (!env.DB) {
    return json({ ok: false, error: 'D1 binding DB is not configured.' }, { status: 500 })
  }

  await ensureSchema(env.DB)
  await env.DB.prepare('DELETE FROM maps WHERE id = ?').bind(MAP_ID).run()
  return json({ ok: true })
}
