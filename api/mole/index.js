const { app } = require('@azure/functions')
const { TableClient } = require('@azure/data-tables')

const TABLE = 'moleScores'

const BLOCKED_WORDS = [
  'NIGGA','NIGGER','NIGER','NIGA','N1GGA','N1GGER',
  'CHINK','GOOK','SPIC','SPICK','KIKE','WETBACK','BEANER','RAGHEAD',
  'FAGGOT','FAGOT','CUNT','RETARD','TRANNY',
]
const isBlocked = (name) => BLOCKED_WORDS.some(w => name.includes(w))

function getClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured.')
  return TableClient.fromConnectionString(conn, TABLE)
}

async function ensureTable(client) {
  try { await client.createTable() } catch (e) { if (e.statusCode !== 409) throw e }
}

async function getLeaderboard(client) {
  const rows = []
  for await (const entity of client.listEntities()) rows.push(entity)
  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, 20).map((e, i) => ({ rank: i + 1, nickname: e.nickname, score: e.score }))
}

app.http('mole-get', {
  methods: ['GET'],
  route: 'mole',
  authLevel: 'anonymous',
  handler: async () => {
    const cors = { 'Access-Control-Allow-Origin': '*' }
    try {
      const client = getClient()
      await ensureTable(client)
      return { headers: cors, jsonBody: { leaderboard: await getLeaderboard(client) } }
    } catch (err) {
      return { status: 500, headers: cors, jsonBody: { error: err.message } }
    }
  },
})

app.http('mole-post', {
  methods: ['POST'],
  route: 'mole',
  authLevel: 'anonymous',
  handler: async (request) => {
    const cors = { 'Access-Control-Allow-Origin': '*' }
    let body = {}
    try { body = await request.json() } catch {}

    const { nickname, score } = body
    if (!nickname || typeof score !== 'number' || score < 0) {
      return { status: 400, headers: cors, jsonBody: { error: 'Invalid payload' } }
    }

    const clean = nickname.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 8)
    if (!clean || isBlocked(clean)) {
      return { status: 400, headers: cors, jsonBody: { error: 'Nickname not allowed' } }
    }

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const rowKey = clean

    try {
      const client = getClient()
      await ensureTable(client)

      let existing = null
      try { existing = await client.getEntity('scores', rowKey) } catch {}

      if (!existing || score > existing.score) {
        await client.upsertEntity({
          partitionKey: 'scores',
          rowKey,
          nickname: clean,
          score,
          ip,
        }, 'Replace')
      }

      return { headers: cors, jsonBody: { leaderboard: await getLeaderboard(client) } }
    } catch (err) {
      return { status: 500, headers: cors, jsonBody: { error: err.message } }
    }
  },
})
