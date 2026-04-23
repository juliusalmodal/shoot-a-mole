import { useState, useEffect, useRef } from 'react'
import { GOOGLE_CLIENT_ID } from './config'
import './WhackAMole.css'

const SIZE_MIN = 36
const SIZE_MAX = 90

function getLifespan(score) {
  // 2200ms at score 0, decreases 45ms per point, floor 500ms
  return Math.max(500, 2200 - score * 45)
}

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
    return JSON.parse(json)
  } catch { return null }
}

const firstName = (name) => (name || '').trim().split(/\s+/)[0] || name || ''

function Crosshair({ elRef }) {
  return (
    <svg
      ref={elRef}
      className="wam-crosshair"
      width="1" height="1"
      style={{ display: 'none' }}
      aria-hidden="true"
    >
      <g filter="drop-shadow(0 0 1.5px rgba(0,0,0,0.9))">
        <line x1="-18" y1="0" x2="-6" y2="0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6"   y1="0" x2="18"  y2="0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0" y1="-18" x2="0" y2="-6"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0" y1="6"   x2="0" y2="18"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function ShootBackground() {
  const [moles, setMoles] = useState([])
  const [crossPos, setCrossPos] = useState(null)
  const molesRef = useRef([])
  const idRef = useRef(0)

  function makeMole() {
    return {
      id: idRef.current++,
      x: 60 + Math.random() * (window.innerWidth - 120),
      y: 60 + Math.random() * (window.innerHeight - 120),
      size: 28 + Math.floor(Math.random() * 42),
      state: 'alive',
    }
  }

  function update(list) { molesRef.current = list; setMoles(list) }

  useEffect(() => {
    update(Array.from({ length: 4 }, makeMole))

    const interval = setInterval(() => {
      const alive = molesRef.current.filter(m => m.state === 'alive')
      if (alive.length === 0) return
      const tgt = alive[Math.floor(Math.random() * alive.length)]
      setCrossPos({ x: tgt.x, y: tgt.y })

      setTimeout(() => {
        if (!molesRef.current.find(m => m.id === tgt.id && m.state === 'alive')) return
        update(molesRef.current.map(m => m.id === tgt.id ? { ...m, state: 'shot' } : m))
        setTimeout(() => {
          update([...molesRef.current.filter(m => m.id !== tgt.id), makeMole()])
        }, 420)
      }, 660)
    }, 1400)

    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wam-bg-anim" aria-hidden="true">
      {moles.map(m => (
        <div
          key={m.id}
          className={`wam-bg-mole${m.state === 'shot' ? ' wam-bg-mole-shot' : ''}`}
          style={{ left: m.x - m.size / 2, top: m.y - m.size / 2, width: m.size, height: m.size }}
        />
      ))}
      {crossPos && (
        <svg
          className="wam-bg-cross"
          style={{ left: crossPos.x, top: crossPos.y }}
          width="1" height="1"
          viewBox="0 0 1 1"
          overflow="visible"
          aria-hidden="true"
        >
          <line x1="-22" y1="0"   x2="-8"  y2="0"   stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8"   y1="0"   x2="22"  y2="0"   stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0"   y1="-22" x2="0"   y2="-8"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0"   y1="8"   x2="0"   y2="22"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="11" fill="none" stroke="white" strokeWidth="1.2" />
        </svg>
      )}
    </div>
  )
}

function Avatar({ src, name, size = 24 }) {
  const [failed, setFailed] = useState(false)
  const initials = (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  if (!src || failed) {
    return (
      <div className="wam-avatar wam-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {initials}
      </div>
    )
  }
  return (
    <img
      className="wam-avatar"
      src={src}
      alt={name}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

const LB_PER_PAGE = 10

function Leaderboard({ data, highlightSub }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / LB_PER_PAGE)
  const slice = data.slice(page * LB_PER_PAGE, (page + 1) * LB_PER_PAGE)

  useEffect(() => {
    if (!highlightSub) return
    const idx = data.findIndex(r => r.sub === highlightSub)
    if (idx >= 0) setPage(Math.floor(idx / LB_PER_PAGE))
  }, [highlightSub, data])

  return (
    <div className="wam-lb">
      <p className="wam-label">Leaderboard</p>
      {data.length === 0
        ? <p className="wam-lb-empty">No scores yet. Be the first!</p>
        : (
          <>
            <ol className="wam-lb-list">
              {slice.map(r => (
                <li key={r.rank} className={`wam-lb-row ${highlightSub === r.sub ? 'wam-lb-me' : ''}`}>
                  <span className="wam-lb-rank">#{r.rank}</span>
                  <Avatar src={r.picture} name={r.name} size={28} />
                  <span className="wam-lb-nick" title={r.name}>{firstName(r.name)}</span>
                  <span className="wam-lb-score">{r.score}</span>
                </li>
              ))}
            </ol>
            {totalPages > 1 && (
              <div className="wam-lb-pages">
                <button
                  className="wam-lb-page-btn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >←</button>
                <span className="wam-lb-page-info">{page + 1} / {totalPages}</span>
                <button
                  className="wam-lb-page-btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >→</button>
              </div>
            )}
          </>
        )
      }
    </div>
  )
}

export default function WhackAMole() {
  const [phase, setPhase] = useState('gate')
  const [user, setUser] = useState(null)  // null | { idToken, sub, name, picture }
  const [score, setScore] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [moles, setMoles] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [myRank, setMyRank] = useState(null)
  const [authError, setAuthError] = useState('')

  const boardRef = useRef(null)
  const crosshairRef = useRef(null)
  const signInRef = useRef(null)
  const molesRef = useRef([])
  const scoreRef = useRef(0)
  const userRef = useRef(null)
  const missTimerRef = useRef(null)
  const gameOverRef = useRef(false)
  const fnRef = useRef({})
  const audioCtxRef = useRef(null)

  // Initialize Google Identity Services
  useEffect(() => {
    if (phase !== 'gate' || user) return

    const tryInit = () => {
      if (!window.google?.accounts?.id || !signInRef.current) return false
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const payload = decodeJwt(response.credential)
          if (!payload) { setAuthError('Sign-in failed. Try again.'); return }
          const u = {
            idToken: response.credential,
            sub: payload.sub,
            name: payload.name || payload.email,
            picture: payload.picture || null,
          }
          userRef.current = u
          setUser(u)
          setAuthError('')
        },
        auto_select: false,
      })
      window.google.accounts.id.renderButton(signInRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
      })
      return true
    }

    if (tryInit()) return
    const interval = setInterval(() => { if (tryInit()) clearInterval(interval) }, 100)
    return () => clearInterval(interval)
  }, [phase, user])

  // Countdown 3 → 2 → 1 → GO! → start spawning
  useEffect(() => {
    if (phase !== 'countdown') return
    fnRef.current.playBeep?.(countdown > 0 ? 440 : 880)
    if (countdown === 0) {
      const t = setTimeout(() => {
        setPhase('playing')
        setTimeout(() => fnRef.current.spawnMole(), 80)
      }, 700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  useEffect(() => {
    fetch('/api/mole')
      .then(r => r.json())
      .then(d => setLeaderboard(d.leaderboard || []))
      .catch(() => {})
  }, [])

  fnRef.current.audio = () => {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)() }
      catch { return null }
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }

  fnRef.current.playHit = () => {
    const ctx = fnRef.current.audio(); if (!ctx) return
    const t = ctx.currentTime

    const noise = (duration) => {
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const s = ctx.createBufferSource(); s.buffer = b; return s
    }

    const pfft = noise(0.09)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    const gPfft = ctx.createGain()
    gPfft.gain.setValueAtTime(0.55, t)
    gPfft.gain.exponentialRampToValueAtTime(0.001, t + 0.075)
    pfft.connect(lp); lp.connect(gPfft); gPfft.connect(ctx.destination)
    pfft.start(t)

    const oThump = ctx.createOscillator(), gThump = ctx.createGain()
    oThump.type = 'sine'
    oThump.frequency.setValueAtTime(110, t)
    oThump.frequency.exponentialRampToValueAtTime(55, t + 0.1)
    gThump.gain.setValueAtTime(0.45, t)
    gThump.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    oThump.connect(gThump); gThump.connect(ctx.destination)
    oThump.start(t); oThump.stop(t + 0.1)

    const click = noise(0.025)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000
    const gClick = ctx.createGain()
    gClick.gain.setValueAtTime(0.22, t + 0.045)
    gClick.gain.exponentialRampToValueAtTime(0.001, t + 0.075)
    click.connect(hp); hp.connect(gClick); gClick.connect(ctx.destination)
    click.start(t + 0.045)
  }

  fnRef.current.playMiss = () => {
    const ctx = fnRef.current.audio(); if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(280, t)
    o.frequency.exponentialRampToValueAtTime(65, t + 0.32)
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36)
    o.connect(g); g.connect(ctx.destination)
    o.start(t); o.stop(t + 0.36)
  }

  fnRef.current.playBeep = (freq) => {
    const ctx = fnRef.current.audio(); if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    o.connect(g); g.connect(ctx.destination)
    o.start(t); o.stop(t + 0.1)
  }

  fnRef.current.spawnMole = () => {
    if (gameOverRef.current || !boardRef.current) return
    const bw = boardRef.current.clientWidth
    const bh = boardRef.current.clientHeight
    const size = SIZE_MIN + Math.floor(Math.random() * (SIZE_MAX - SIZE_MIN + 1))
    const lifespan = getLifespan(scoreRef.current)
    const x = size / 2 + Math.random() * (bw - size)
    const y = size / 2 + Math.random() * (bh - size)
    const id = Date.now()

    const mole = { id, x, y, size, lifespan, state: 'alive' }
    molesRef.current = [mole]
    setMoles([mole])

    missTimerRef.current = setTimeout(() => {
      if (gameOverRef.current) return
      if (molesRef.current.find(m => m.id === id && m.state === 'alive')) {
        fnRef.current.playMiss()
        molesRef.current = molesRef.current.map(m => m.id === id ? { ...m, state: 'missed' } : m)
        setMoles([...molesRef.current])
        setTimeout(() => fnRef.current.triggerGameOver(), 480)
      }
    }, lifespan)
  }

  fnRef.current.triggerGameOver = () => {
    if (gameOverRef.current) return
    gameOverRef.current = true
    clearTimeout(missTimerRef.current)
    molesRef.current = []
    setMoles([])
    setPhase('gameover')

    if (userRef.current) {
      setSubmitting(true)
      setSubmitError('')
      const token = userRef.current.idToken
      const tokenHeader = token ? (() => {
        try { return JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))) }
        catch { return 'decode-failed' }
      })() : 'no-token'
      // eslint-disable-next-line no-console
      console.log('[wam] submitting score', { tokenHeader, len: token?.length, preview: token?.slice(0, 40) })
      fetch('/api/mole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ score: scoreRef.current }),
      })
        .then(async r => {
          const data = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(data.error || `Server error ${r.status}`)
          return data
        })
        .then(d => {
          const lb = d.leaderboard || []
          setLeaderboard(lb)
          const idx = lb.findIndex(r => r.sub === userRef.current.sub)
          setMyRank(idx >= 0 ? idx + 1 : null)
        })
        .catch(err => setSubmitError(err.message || 'Could not save score.'))
        .finally(() => setSubmitting(false))
    }
  }

  const whack = (id) => {
    if (gameOverRef.current || !molesRef.current.find(m => m.id === id && m.state === 'alive')) return
    clearTimeout(missTimerRef.current)
    fnRef.current.playHit()
    molesRef.current = molesRef.current.map(m => m.id === id ? { ...m, state: 'hit' } : m)
    setMoles([...molesRef.current])
    scoreRef.current += 1
    setScore(scoreRef.current)
    setTimeout(() => {
      molesRef.current = []
      setMoles([])
      fnRef.current.spawnMole()
    }, 150)
  }

  const enterFullscreen = () => {
    if (navigator.maxTouchPoints < 1) return
    const el = document.documentElement
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) req.call(el).catch(() => {})
  }

  const exitFullscreen = () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
      exit.call(document).catch(() => {})
    }
  }

  const beginGame = () => {
    scoreRef.current = 0
    gameOverRef.current = false
    molesRef.current = []
    setMoles([])
    setScore(0)
    setMyRank(null)
    setSubmitError('')
    fnRef.current.audio?.()
    setCountdown(3)
    enterFullscreen()
    setPhase('countdown')
  }

  const signOut = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    userRef.current = null
    setUser(null)
  }

  const playAgain = () => {
    clearTimeout(missTimerRef.current)
    gameOverRef.current = false
    exitFullscreen()
    setPhase('gate')
  }

  const onBoardMouseMove = (e) => {
    const el = crosshairRef.current
    const board = boardRef.current
    if (!el || !board) return
    const rect = board.getBoundingClientRect()
    el.style.left = `${e.clientX - rect.left}px`
    el.style.top  = `${e.clientY - rect.top}px`
  }

  const onBoardEnter = () => {
    if (crosshairRef.current) crosshairRef.current.style.display = 'block'
  }

  const onBoardLeave = () => {
    if (crosshairRef.current) crosshairRef.current.style.display = 'none'
  }

  const onBoardClick = (e) => {
    if (phase !== 'playing' || gameOverRef.current) return
    if (e.target !== boardRef.current) return
    if (molesRef.current.some(m => m.state === 'hit')) return
    clearTimeout(missTimerRef.current)
    const alive = molesRef.current.find(m => m.state === 'alive')
    if (alive) {
      fnRef.current.playMiss()
      molesRef.current = molesRef.current.map(m => m.id === alive.id ? { ...m, state: 'missed' } : m)
      setMoles([...molesRef.current])
      setTimeout(() => fnRef.current.triggerGameOver(), 480)
    } else {
      fnRef.current.triggerGameOver()
    }
  }

  return (
    <div className="wam-page">
      <a href="https://jeules.net" className="wam-back">← Back to site</a>

      {phase === 'gate' && <ShootBackground />}

      {phase === 'gate' && (
        <div className="wam-gate">
          <p className="wam-label">Mini Game</p>
          <h1 className="wam-heading">Shoot-a-<em>Mole.</em></h1>
          <p className="wam-sub">
            Moles appear randomly — shoot them before they disappear.<br />
            Miss one and it's game over. How far can you go?
          </p>

          {user ? (
            <div className="wam-user-card">
              <Avatar src={user.picture} name={user.name} size={44} />
              <div className="wam-user-info">
                <p className="wam-user-name" title={user.name}>Playing as <strong>{firstName(user.name)}</strong></p>
                <button className="wam-user-signout" onClick={signOut}>Sign out</button>
              </div>
              <button className="wam-btn" onClick={beginGame}>Start Game</button>
            </div>
          ) : (
            <>
              <div className="wam-auth">
                <p className="wam-auth-text">
                  Sign in with Google to save your score to the leaderboard.
                </p>
                <div ref={signInRef} className="wam-gsi-btn" />
                {authError && <p className="wam-nick-error">{authError}</p>}
              </div>
              <button className="wam-btn-ghost wam-anon" onClick={beginGame}>
                Play Anonymously
              </button>
              <p className="wam-anon-note">Anonymous scores aren't saved.</p>
            </>
          )}

          <Leaderboard data={leaderboard} highlightSub={null} />
        </div>
      )}

      {(phase === 'countdown' || phase === 'playing' || phase === 'gameover') && (
        <div className="wam-layout">
          <div className="wam-game-col">
            <div className="wam-hud">
              <div className="wam-stat wam-stat-player">
                <span className="wam-stat-label">Player</span>
                {user ? (
                  <div className="wam-stat-player-row">
                    <Avatar src={user.picture} name={user.name} size={28} />
                    <span className="wam-stat-value wam-stat-nick" title={user.name}>{firstName(user.name)}</span>
                  </div>
                ) : (
                  <span className="wam-stat-value wam-stat-nick">ANONYMOUS</span>
                )}
              </div>
              <div className="wam-stat wam-stat-right">
                <span className="wam-stat-label">Score</span>
                <span className="wam-stat-value">{score}</span>
              </div>
            </div>

            <div
              ref={boardRef}
              className={`wam-board ${phase === 'gameover' ? 'wam-board-over' : ''}`}
              onMouseMove={onBoardMouseMove}
              onMouseEnter={onBoardEnter}
              onMouseLeave={onBoardLeave}
              onClick={onBoardClick}
            >
              <Crosshair elRef={crosshairRef} />
              {phase === 'countdown' && (
                <div className="wam-board-overlay">
                  <p key={countdown} className="wam-countdown-num">
                    {countdown > 0 ? countdown : 'GO!'}
                  </p>
                </div>
              )}
              {moles.map(mole => (
                <button
                  key={mole.id}
                  className={`wam-mole-entity${mole.state === 'hit' ? ' wam-mole-hit' : mole.state === 'missed' ? ' wam-mole-missed' : ''}`}
                  style={{
                    left: mole.x - mole.size / 2,
                    top: mole.y - mole.size / 2,
                    width: mole.size,
                    height: mole.size,
                    '--lifespan': `${mole.lifespan}ms`,
                  }}
                  onClick={() => whack(mole.id)}
                  aria-label="mole"
                />
              ))}

              {phase === 'gameover' && (
                <div className="wam-board-overlay">
                  <div className="wam-over-content">
                    <p className="wam-over-title">Missed!</p>
                    <p className="wam-over-score">
                      You shot <strong>{score}</strong> {score === 1 ? 'mole' : 'moles'}
                    </p>
                    {user
                      ? submitting
                        ? <p className="wam-over-sub">Saving score…</p>
                        : submitError
                          ? <p className="wam-over-sub wam-over-err">Couldn't save: {submitError}</p>
                          : myRank
                            ? <p className="wam-over-sub">You ranked <strong>#{myRank}</strong> on the leaderboard</p>
                            : <p className="wam-over-sub">Score saved.</p>
                      : <p className="wam-over-sub">Playing anonymously — sign in to save your next score.</p>
                    }
                    {!submitting && (
                      <button className="wam-btn" onClick={playAgain}>Play Again</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="wam-sidebar">
            <Leaderboard
              data={leaderboard}
              highlightSub={phase === 'gameover' && user ? user.sub : null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
