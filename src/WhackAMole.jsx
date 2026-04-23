import { useState, useEffect, useRef } from 'react'
import './WhackAMole.css'

const SIZE_MIN = 36
const SIZE_MAX = 90

const BLOCKED_WORDS = [
  'NIGGA','NIGGER','NIGER','NIGA','N1GGA','N1GGER',
  'CHINK','GOOK','SPIC','SPICK','KIKE','WETBACK','BEANER','RAGHEAD',
  'FAGGOT','FAGOT',
  'CUNT','RETARD','TRANNY',
]
const isNickBlocked = (name) => BLOCKED_WORDS.some(w => name.includes(w))
const sanitizeNick = (raw) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 8)

function getLifespan(score) {
  // 2200ms at score 0, decreases 45ms per point, floor 500ms
  return Math.max(500, 2200 - score * 45)
}

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

const LB_PER_PAGE = 10

function Leaderboard({ data, highlight }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / LB_PER_PAGE)
  const slice = data.slice(page * LB_PER_PAGE, (page + 1) * LB_PER_PAGE)

  useEffect(() => {
    if (!highlight) return
    const idx = data.findIndex(r => r.nickname === highlight)
    if (idx >= 0) setPage(Math.floor(idx / LB_PER_PAGE))
  }, [highlight, data])

  return (
    <div className="wam-lb">
      <p className="wam-label">Leaderboard</p>
      {data.length === 0
        ? <p className="wam-lb-empty">No scores yet. Be the first!</p>
        : (
          <>
            <ol className="wam-lb-list">
              {slice.map(r => (
                <li key={r.rank} className={`wam-lb-row ${highlight === r.nickname ? 'wam-lb-me' : ''}`}>
                  <span className="wam-lb-rank">#{r.rank}</span>
                  <span className="wam-lb-nick">{r.nickname}</span>
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
  const [phase, setPhase] = useState('nickname')
  const [consent, setConsent] = useState(() => localStorage.getItem('wam_consent')) // null | 'yes' | 'no'
  const [inputName, setInputName] = useState(() =>
    localStorage.getItem('wam_consent') === 'yes' ? (localStorage.getItem('wam_nick') || '') : ''
  )
  const [score, setScore] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [moles, setMoles] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [myRank, setMyRank] = useState(null)
  const [nickError, setNickError] = useState('')

  const boardRef = useRef(null)
  const crosshairRef = useRef(null)
  const molesRef = useRef([])
  const scoreRef = useRef(0)
  const nickRef = useRef('')
  const consentRef = useRef(localStorage.getItem('wam_consent'))
  const missTimerRef = useRef(null)
  const gameOverRef = useRef(false)
  const fnRef = useRef({})
  const audioCtxRef = useRef(null)

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

    // 1. Suppressed muzzle blast — muffled "pfft" (low-pass noise)
    const pfft = noise(0.09)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    const gPfft = ctx.createGain()
    gPfft.gain.setValueAtTime(0.55, t)
    gPfft.gain.exponentialRampToValueAtTime(0.001, t + 0.075)
    pfft.connect(lp); lp.connect(gPfft); gPfft.connect(ctx.destination)
    pfft.start(t)

    // 2. Subsonic thump — body of the shot (low sine)
    const oThump = ctx.createOscillator(), gThump = ctx.createGain()
    oThump.type = 'sine'
    oThump.frequency.setValueAtTime(110, t)
    oThump.frequency.exponentialRampToValueAtTime(55, t + 0.1)
    gThump.gain.setValueAtTime(0.45, t)
    gThump.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    oThump.connect(gThump); gThump.connect(ctx.destination)
    oThump.start(t); oThump.stop(t + 0.1)

    // 3. Slide/casing click — metallic tick slightly after shot
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

    if (consentRef.current === 'yes') {
      setSubmitting(true)
      fetch('/api/mole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickRef.current, score: scoreRef.current }),
      })
        .then(r => r.json())
        .then(d => {
          const lb = d.leaderboard || []
          setLeaderboard(lb)
          const idx = lb.findIndex(r => r.nickname === nickRef.current)
          setMyRank(idx >= 0 ? idx + 1 : null)
        })
        .catch(() => {})
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

  const beginGame = (saveData) => {
    const name = sanitizeNick(inputName.trim())
    if (!name) return
    if (isNickBlocked(name)) { setNickError('That nickname isn\'t allowed.'); return }
    setNickError('')
    const c = saveData ? 'yes' : 'no'
    localStorage.setItem('wam_consent', c)
    consentRef.current = c
    setConsent(c)
    if (saveData) localStorage.setItem('wam_nick', name)
    nickRef.current = name
    scoreRef.current = 0
    gameOverRef.current = false
    molesRef.current = []
    setMoles([])
    setScore(0)
    setMyRank(null)
    fnRef.current.audio?.()  // prime AudioContext on user gesture
    setCountdown(3)
    enterFullscreen()
    setPhase('countdown')
  }

  const startGame = (e) => {
    e.preventDefault()
    beginGame(consent === 'yes')
  }

  const forgetMe = () => {
    localStorage.removeItem('wam_consent')
    localStorage.removeItem('wam_nick')
    consentRef.current = null
    setConsent(null)
    setInputName('')
  }

  const playAgain = () => {
    clearTimeout(missTimerRef.current)
    gameOverRef.current = false
    exitFullscreen()
    setPhase('nickname')
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

      {phase === 'nickname' && <ShootBackground />}

      {phase === 'nickname' && (
        <div className="wam-gate">
          <p className="wam-label">Mini Game</p>
          <h1 className="wam-heading">Shoot-a-<em>Mole.</em></h1>
          <p className="wam-sub">
            Moles appear randomly — shoot them before they disappear.<br />
            Miss one and it's game over. How far can you go?
          </p>

          {consent === null ? (
            <>
              <div className="wam-form-row">
                <input
                  type="text"
                  className="wam-input"
                  placeholder="Nickname (8 chars, A–Z 0–9 _)"
                  value={inputName}
                  onChange={e => { setNickError(''); setInputName(sanitizeNick(e.target.value)) }}
                  maxLength={8}
                  autoFocus
                />
              </div>
              {nickError && <p className="wam-nick-error">{nickError}</p>}
              <div className="wam-consent">
                <p className="wam-consent-text">
                  We save your nickname and best score in this browser to show you on the leaderboard.
                  Your score is tied to your IP to prevent duplicate entries.
                </p>
                <div className="wam-consent-btns">
                  <button
                    className="wam-btn"
                    disabled={!inputName.trim()}
                    onClick={() => beginGame(true)}
                  >
                    Accept &amp; Play
                  </button>
                  <button
                    className="wam-btn-ghost"
                    disabled={!inputName.trim()}
                    onClick={() => beginGame(false)}
                  >
                    Play Anonymously
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={startGame} className="wam-form">
                <input
                  type="text"
                  placeholder="Nickname (8 chars, A–Z 0–9 _)"
                  value={inputName}
                  onChange={e => { setNickError(''); setInputName(sanitizeNick(e.target.value)) }}
                  maxLength={8}
                  autoFocus
                />
                <button type="submit" disabled={!inputName.trim()}>Start</button>
              </form>
              {nickError && <p className="wam-nick-error">{nickError}</p>}
              <button className="wam-forget" onClick={forgetMe}>
                {consent === 'yes' ? 'Forget me & clear data' : 'Change privacy choice'}
              </button>
            </>
          )}

          <Leaderboard data={leaderboard} highlight={null} />
        </div>
      )}

      {(phase === 'countdown' || phase === 'playing' || phase === 'gameover') && (
        <div className="wam-layout">
          <div className="wam-game-col">
            <div className="wam-hud">
              <div className="wam-stat">
                <span className="wam-stat-label">Player</span>
                <span className="wam-stat-value wam-stat-nick">{nickRef.current}</span>
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
                    {consent === 'yes'
                      ? submitting
                        ? <p className="wam-over-sub">Saving score…</p>
                        : myRank
                          ? <p className="wam-over-sub">You ranked <strong>#{myRank}</strong> on the leaderboard</p>
                          : <p className="wam-over-sub">Score saved.</p>
                      : <p className="wam-over-sub">Playing anonymously — score not saved.</p>
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
              highlight={phase === 'gameover' ? nickRef.current : null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
