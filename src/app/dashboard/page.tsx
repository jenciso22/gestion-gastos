'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { classifyExpense, parseAmount, fmtMXN, CATEGORIES } from '@/types'
import type { Expense, Profile, Couple } from '@/types'

type Tab = 'add' | 'list' | 'dash' | 'config'

export default function Dashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('add')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [couple, setCouple] = useState<Couple | null>(null)
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [resultMsg, setResultMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [inviteCode, setInviteCode] = useState('')
  const [joiningCode, setJoiningCode] = useState('')
  const [joinMsg, setJoinMsg] = useState('')

  const loadData = useCallback(async () => {
    setSyncing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/auth'); return }
    setProfile(prof)

    const { data: coupleData } = await supabase.from('couples').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).single()
    setCouple(coupleData)

    if (coupleData) {
      setInviteCode(coupleData.invite_code)
      const partnerId = coupleData.user_a === user.id ? coupleData.user_b : coupleData.user_a
      if (partnerId) {
        const { data: partner } = await supabase.from('profiles').select('*').eq('id', partnerId).single()
        setPartnerProfile(partner)
      }

      const { data: expData } = await supabase.from('expenses').select('*')
        .eq('couple_id', coupleData.id).order('expense_date', { ascending: false })
      setExpenses(expData || [])
    }

    setSyncing(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const now = new Date()
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  async function addExpense() {
    if (!input.trim() || !profile || !couple) return
    const parsed = parseAmount(input)
    if (!parsed) { setResultMsg({ type: 'err', text: 'No encontré el monto. Ej: "800 mercado walmart"' }); return }
    const cat = classifyExpense(parsed.desc || input)
    const words = (parsed.desc || input).trim().split(' ')
    const description = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const merchant = words[words.length - 1] || ''

    setLoading(true)
    setInput('')
    setResultMsg(null)

    const { data, error } = await supabase.from('expenses').insert({
      user_id: profile.id,
      couple_id: couple.id,
      description,
      amount: parsed.amount,
      category: cat.name,
      emoji: cat.emoji,
      merchant,
      paid_by: profile.name,
      expense_date: new Date().toISOString().split('T')[0],
    }).select().single()

    if (error) {
      setResultMsg({ type: 'err', text: 'Error al guardar. Intenta de nuevo.' })
    } else {
      setExpenses(prev => [data, ...prev])
      setResultMsg({ type: 'ok', text: `${cat.emoji} $${parsed.amount.toLocaleString('es-MX')} — ${description} guardado` })
    }
    setLoading(false)
  }

  async function joinCouple() {
    if (!joiningCode.trim() || !profile) return
    const { data: targetCouple } = await supabase.from('couples').select('*')
      .eq('invite_code', joiningCode.toUpperCase()).single()
    if (!targetCouple) { setJoinMsg('Código no encontrado'); return }
    if (targetCouple.user_b) { setJoinMsg('Esta pareja ya está completa'); return }
    if (targetCouple.user_a === profile.id) { setJoinMsg('No puedes unirte a tu propio código'); return }

    const { error } = await supabase.from('couples').update({ user_b: profile.id }).eq('id', targetCouple.id)
    if (error) { setJoinMsg('Error al unirse'); return }

    // Delete own couple
    if (couple) await supabase.from('couples').delete().eq('id', couple.id)
    setJoinMsg('¡Vinculados! 🎉')
    setTimeout(() => loadData(), 1000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // Dashboard calculations
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return key === selectedMonth
  })
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const myTotal = monthExpenses.filter(e => e.paid_by === profile?.name).reduce((s, e) => s + e.amount, 0)
  const partnerTotal = total - myTotal
  const cats: Record<string, number> = {}
  monthExpenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
  const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const maxCat = sortedCats[0]?.[1] || 1

  const availableMonths = [...new Set(expenses.map(e => {
    const d = new Date(e.expense_date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))].sort().reverse()

  function monthLabel(key: string) {
    const [y, m] = key.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })
  }

  if (syncing && !profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: 'var(--accent)' }}>Cargando...</div>
    </div>
  )

  const partnerName = partnerProfile?.name || 'Sin pareja aún'
  const hasPartner = !!couple?.user_b

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Finance Tracker</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-1px' }}>
          Gestión de <span style={{ color: 'var(--accent)' }}>Gastos</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          {profile?.name}{hasPartner ? ` & ${partnerName}` : ' · Modo individual'}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: 'rgba(74,222,128,0.12)', color: 'var(--green)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '20px', padding: '3px 10px', marginTop: '8px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }}></div>
          {syncing ? 'Sincronizando...' : `${expenses.length} gastos sincronizados`}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0' }}>
        {(['add', 'list', 'dash', 'config'] as Tab[]).map((t, i) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 4px', fontSize: '12px', fontWeight: 500,
            textAlign: 'center', cursor: 'pointer', borderRadius: '8px',
            border: `1px solid ${tab === t ? 'var(--border)' : 'transparent'}`,
            color: tab === t ? 'var(--text)' : 'var(--muted)',
            background: tab === t ? 'var(--surface2)' : 'none',
            fontFamily: 'DM Sans, sans-serif'
          }}>
            {['+ Agregar', 'Lista', 'Dashboard', 'Config'][i]}
          </button>
        ))}
      </div>

      {/* ADD TAB */}
      {tab === 'add' && (
        <div style={{ padding: '20px 24px 40px' }}>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
            Escribe monto y descripción: <strong style={{ color: 'var(--text)' }}>800 mercado walmart</strong>
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExpense()}
              placeholder="ej: 1200 gasolina pemex"
              style={{ flex: 1, padding: '13px 16px', fontSize: '16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none' }} />
            <button onClick={addExpense} disabled={loading}
              style={{ padding: '13px 18px', fontSize: '14px', fontWeight: 700, fontFamily: 'Syne, sans-serif', background: 'var(--accent)', color: '#0e0e0e', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              Agregar
            </button>
          </div>

          {resultMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px',
              background: resultMsg.type === 'ok' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
              color: resultMsg.type === 'ok' ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${resultMsg.type === 'ok' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              {resultMsg.text}
            </div>
          )}

          {/* Recent */}
          {expenses.slice(0, 3).map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px' }}>{e.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{e.description}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{e.category} · {e.paid_by}</div>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700 }}>{fmtMXN(e.amount)}</div>
            </div>
          ))}
        </div>
      )}

      {/* LIST TAB */}
      {tab === 'list' && (
        <div style={{ padding: '20px 24px 40px' }}>
          {expenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧾</div>
              <div>Aún no hay gastos</div>
            </div>
          ) : expenses.map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px' }}>{e.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{new Date(e.expense_date).toLocaleDateString('es-MX')} · {e.category}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700 }}>{fmtMXN(e.amount)}</div>
                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', marginTop: '3px', display: 'inline-block',
                  background: e.paid_by === profile?.name ? 'rgba(96,165,250,0.12)' : 'rgba(74,222,128,0.12)',
                  color: e.paid_by === profile?.name ? 'var(--blue)' : 'var(--green)' }}>
                  {e.paid_by}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DASHBOARD TAB */}
      {tab === 'dash' && (
        <div style={{ padding: '20px 24px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px' }}>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', fontSize: '14px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none' }}>
              {availableMonths.map(k => <option key={k} value={k}>{monthLabel(k)}</option>)}
              {!availableMonths.includes(selectedMonth) && selectedMonth && (
                <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>
              )}
            </select>
            <button onClick={loadData} style={{ padding: '10px 14px', fontSize: '12px', background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>
              ↻ Sync
            </button>
          </div>

          {monthExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
              <div>Sin gastos este mes</div>
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Total — {monthLabel(selectedMonth)}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '40px', fontWeight: 800, letterSpacing: '-2px', color: 'var(--accent)' }}>{fmtMXN(total)}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{monthExpenses.length} transacciones</div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👤 {profile?.name}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>{fmtMXN(myTotal)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>{total > 0 ? Math.round(myTotal / total * 100) : 0}%</div>
                </div>
                <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--green)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👤 {partnerName}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>{fmtMXN(partnerTotal)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>{total > 0 ? Math.round(partnerTotal / total * 100) : 0}%</div>
                </div>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Por categoría</div>
              {sortedCats.map(([cat, val]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '13px', minWidth: '140px' }}>{cat}</span>
                  <div style={{ flex: 1, margin: '0 10px', height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
                    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--accent)', width: `${Math.round(val / maxCat * 100)}%` }}></div>
                  </div>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: 600, minWidth: '80px', textAlign: 'right' }}>{fmtMXN(val)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* CONFIG TAB */}
      {tab === 'config' && (
        <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Profile */}
          <div style={cardStyle}>
            <div style={cfgLabelStyle}>Mi cuenta</div>
            <div style={{ fontSize: '15px', fontWeight: 500 }}>{profile?.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{profile?.email}</div>
          </div>

          {/* Partner */}
          <div style={cardStyle}>
            <div style={cfgLabelStyle}>Pareja</div>
            {hasPartner ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👤</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>{partnerProfile?.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--green)' }}>✅ Vinculados</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Aún no tienes pareja vinculada.</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Tu código de invitación:</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '4px', color: 'var(--accent)', marginBottom: '14px' }}>{inviteCode}</div>
                <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }}></div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>¿Tienes un código? Únetelo:</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={joiningCode} onChange={e => setJoiningCode(e.target.value.toUpperCase())}
                    placeholder="ABC123" maxLength={6}
                    style={{ flex: 1, padding: '10px 13px', fontSize: '16px', letterSpacing: '3px', fontFamily: 'Syne, sans-serif', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none' }} />
                  <button onClick={joinCouple}
                    style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, background: 'var(--accent)', color: '#0e0e0e', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    Unirme
                  </button>
                </div>
                {joinMsg && <div style={{ fontSize: '13px', color: joinMsg.includes('🎉') ? 'var(--green)' : 'var(--red)', marginTop: '8px' }}>{joinMsg}</div>}
              </>
            )}
          </div>

          {/* Sign out */}
          <button onClick={signOut}
            style={{ padding: '12px', fontSize: '14px', fontWeight: 600, fontFamily: 'Syne, sans-serif', background: 'rgba(248,113,113,0.1)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input::placeholder { color: var(--muted); }
        select option { background: var(--surface); color: var(--text); }
      `}</style>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '12px', padding: '16px'
}
const cfgLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px'
}
