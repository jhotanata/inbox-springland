'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const data = await api.login(email, senha);
      localStorage.setItem('inbox_token', data.token);
      localStorage.setItem('inbox_atendente', JSON.stringify(data.atendente));
      router.push('/');
    } catch (err) {
      setErro(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFD90F 0%, #F4A100 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.4s ease-out',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>🍔</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>
            Inbox Springland
          </h1>
          <p style={{ color: '#888', marginTop: '6px', fontSize: '14px' }}>
            Atendimento WhatsApp + Instagram
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#555',
              marginBottom: '6px',
            }}>EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '10px',
                fontSize: '16px',
                border: '2px solid #eee',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#555',
              marginBottom: '6px',
            }}>SENHA</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '10px',
                fontSize: '16px',
                border: '2px solid #eee',
              }}
            />
          </div>

          {erro && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              ⚠️ {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#1a1a1a',
              color: '#FFD90F',
              padding: '16px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#FFFBE6',
          borderRadius: '10px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center',
        }}>
          💡 Use o email cadastrado pelo admin
        </div>
      </div>
    </div>
  );
}
