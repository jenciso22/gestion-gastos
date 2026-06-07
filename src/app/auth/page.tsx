'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'register') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, name, email })
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        await supabase.from('couples').insert({ user_a: data.user.id, invite_code: inviteCode })
        router.refresh()
        router.push('/dashboard')
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Email o contraseña incorrectos'); setLoading(false); return }
      if (data.session) {
        router.refresh()
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Finance Tracker</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
          Gestión de<br /><span style={{ color: 'var(--accent)' }}>Gastos</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
          {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta gratis'}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '360px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <input type="text" placeholder="Tu nombre" value={name}
              onChange={e => setName(e.target.value)} required style={inputStyle} />
          )}
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          {error && <div style={{ fontSize: '13px', color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--muted)' }}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '13px 16px', fontSize: '16px',
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '8px', outline: 'none', width: '100%'
}
const btnStyle: React.CSSProperties = {
  padding: '13px', fontSize: '15px', fontWeight: 700,
  fontFamily: 'Syne, sans-serif',
  background: 'var(--accent)', color: '#0e0e0e',
  border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '4px'
}
