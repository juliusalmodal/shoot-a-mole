const { app } = require('@azure/functions')
const { TableClient } = require('@azure/data-tables')
const { OAuth2Client } = require('google-auth-library')

const TABLE = 'moleScores'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID)

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
  return rows.slice(0, 20).map((e, i) => ({
    rank: i + 1,
    sub: e.rowKey,
    name: e.name,
    picture: e.picture || null,
    score: e.score,
  }))
}

async function verifyGoogleToken(idToken) {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured.')
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })
  return ticket.getPayload()
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

    const token = (request.headers.get('x-id-token') || '').trim()
    if (!token) {
      return { status: 401, headers: cors, jsonBody: { error: 'Missing token' } }
    }
    const parts = token.split('.')
    const debug = {
      tokenPreview: token.slice(0, 60) + '...',
      parts: parts.length,
      header: null,
      payloadKeys: null,
    }
    try {
      debug.header = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
      const payloadRaw = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
      debug.payloadKeys = Object.keys(payloadRaw)
      debug.iss = payloadRaw.iss
      debug.aud = payloadRaw.aud
    } catch (e) { debug.decodeError = e.message }

    let payload
    try {
      payload = await verifyGoogleToken(token)
    } catch (err) {
      return { status: 401, headers: cors, jsonBody: { error: `Token verify failed: ${err.message}`, debug } }
    }

    let body = {}
    try { body = await request.json() } catch {}

    const { score } = body
    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return { status: 400, headers: cors, jsonBody: { error: 'Invalid score' } }
    }

    const sub = payload.sub
    const name = (payload.name || payload.email || 'Player').slice(0, 80)
    const picture = payload.picture || null

    try {
      const client = getClient()
      await ensureTable(client)

      let existing = null
      try { existing = await client.getEntity('scores', sub) } catch {}

      const nextScore = existing ? Math.max(existing.score, Math.floor(score)) : Math.floor(score)
      await client.upsertEntity({
        partitionKey: 'scores',
        rowKey: sub,
        name,
        picture,
        score: nextScore,
      }, 'Replace')

      return { headers: cors, jsonBody: { leaderboard: await getLeaderboard(client) } }
    } catch (err) {
      return { status: 500, headers: cors, jsonBody: { error: err.message } }
    }
  },
})
