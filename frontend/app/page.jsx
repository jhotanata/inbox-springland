'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export default function InboxPage() {
  const router = useRouter();
  const [atendente, setAtendente] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [novaMsg, setNovaMsg] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const threadRef = useRef(null);

  // Verifica autenticação
  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('inbox_token');
    const at = typeof window !== 'undefined' && localStorage.getItem('inbox_atendente');
    if (!token || !at) {
      router.push('/login');
      return;
    }
    setAtendente(JSON.parse(at));
  }, [router]);

  // Carrega lista de conversas
  async function carregarConversas() {
    try {
      const data = await api.conversas('aberta');
      setConversas(data);
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (atendente) carregarConversas();
  }, [atendente]);

  // Socket.io em tempo real
  useEffect(() => {
    if (!atendente) return;
    const socket = getSocket();

    socket.on('nova_conversa', () => {
      carregarConversas();
    });

    socket.on('nova_mensagem', (data) => {
      carregarConversas();
      if (conversaAtiva && data.conversa_id === conversaAtiva.id) {
        setMensagens((prev) => [...prev, data.mensagem]);
      }
    });

    socket.on('conversa_atualizada', () => {
      carregarConversas();
    });

    return () => {
      socket.off('nova_conversa');
      socket.off('nova_mensagem');
      socket.off('conversa_atualizada');
    };
  }, [atendente, conversaAtiva]);

  // Carrega mensagens quando seleciona conversa
  async function selecionarConversa(c) {
    setConversaAtiva(c);
    try {
      const data = await api.conversa(c.id);
      setMensagens(data.mensagens);
      setTimeout(() => threadRef.current?.scrollTo(0, threadRef.current.scrollHeight), 100);
    } catch (e) {
      console.error(e);
    }
  }

  // Enviar mensagem
  async function enviarMensagem() {
    if (!novaMsg.trim() || !conversaAtiva || enviando) return;
    setEnviando(true);
    try {
      const data = await api.enviarMensagem(conversaAtiva.id, novaMsg, atendente.id);
      setMensagens((prev) => [...prev, data.mensagem]);
      setNovaMsg('');
      setTimeout(() => threadRef.current?.scrollTo(0, threadRef.current.scrollHeight), 50);
    } catch (e) {
      alert('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  }

  // Logout
  function sair() {
    localStorage.removeItem('inbox_token');
    localStorage.removeItem('inbox_atendente');
    router.push('/login');
  }

  // Criar conversa de teste
  async function criarTeste() {
    try {
      await api.criarTeste();
      carregarConversas();
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }

  // Filtros
  const conversasFiltradas = conversas.filter(c => {
    if (filtro === 'minhas' && c.atendente_id !== atendente?.id) return false;
    if (filtro === 'sem_atendente' && c.atendente_id) return false;
    if (busca) {
      const texto = `${c.contato_nome || ''} ${c.ultima_mensagem || ''}`.toLowerCase();
      if (!texto.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  if (!atendente) return null;

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f5f5f5',
      overflow: 'hidden',
    }}>
      {/* ============ SIDEBAR ============ */}
      <aside style={{
        width: '70px',
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        gap: '20px',
      }}>
        <div style={{ fontSize: '28px' }}>🍔</div>

        <button
          title="Conversas"
          style={{
            width: '46px',
            height: '46px',
            background: '#FFD90F',
            borderRadius: '12px',
            fontSize: '22px',
          }}
        >💬</button>

        <button
          title="Estatísticas"
          onClick={() => window.open('https://chat.chatgruporango.tech/admin', '_blank')}
          style={{
            width: '46px',
            height: '46px',
            background: 'transparent',
            color: '#888',
            borderRadius: '12px',
            fontSize: '20px',
          }}
        >📊</button>

        <div style={{ flex: 1 }} />

        <button
          title="Sair"
          onClick={sair}
          style={{
            width: '46px',
            height: '46px',
            background: '#333',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {atendente.nome[0]}
        </button>
      </aside>

      {/* ============ LISTA DE CONVERSAS ============ */}
      <section style={{
        width: '340px',
        background: 'white',
        borderRight: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e8e8e8',
          background: '#1a1a1a',
          color: 'white',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#FFD90F', fontWeight: 600 }}>OLÁ,</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{atendente.nome}</div>
            </div>
            <span style={{
              background: '#2ecc71',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              animation: 'pulse 2s infinite',
            }}>● ONLINE</span>
          </div>

          <input
            placeholder="🔍 Buscar conversa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#333',
              color: 'white',
              border: '1px solid #444',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Filtros */}
        <div style={{
          display: 'flex',
          padding: '12px',
          gap: '6px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'minhas', label: 'Minhas' },
            { id: 'sem_atendente', label: 'Sem atendente' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                background: filtro === f.id ? '#FFD90F' : '#f5f5f5',
                color: filtro === f.id ? '#1a1a1a' : '#888',
                transition: 'all 0.15s',
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {carregando ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Carregando...</div>
          ) : conversasFiltradas.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>💬</div>
              <p style={{ fontSize: '14px' }}>Nenhuma conversa ainda</p>
              <button
                onClick={criarTeste}
                style={{
                  marginTop: '16px',
                  padding: '10px 16px',
                  background: '#FFD90F',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                }}
              >+ Criar conversa de teste</button>
            </div>
          ) : (
            conversasFiltradas.map(c => (
              <div
                key={c.id}
                onClick={() => selecionarConversa(c)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #f5f5f5',
                  cursor: 'pointer',
                  background: conversaAtiva?.id === c.id ? '#FFFBE6' : 'white',
                  borderLeft: conversaAtiva?.id === c.id ? '4px solid #FFD90F' : '4px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
                    {c.contato_nome || 'Sem nome'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    {c.canal === 'whatsapp' ? '📱' : '📷'}
                  </div>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#666',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {c.ultima_mensagem || '(sem mensagens)'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: c.marca === 'springland' ? '#FFD90F' : '#FF8C42',
                    color: c.marca === 'springland' ? '#1a1a1a' : 'white',
                    fontWeight: 600,
                  }}>
                    {c.marca?.toUpperCase()}
                  </span>
                  {c.atendente_nome && (
                    <span style={{ fontSize: '10px', color: '#999' }}>
                      👤 {c.atendente_nome}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ============ THREAD DE MENSAGENS ============ */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {!conversaAtiva ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}>
            <div style={{ fontSize: '80px', marginBottom: '20px', opacity: 0.3 }}>💬</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', color: '#666' }}>
              Selecione uma conversa
            </h2>
            <p style={{ fontSize: '14px' }}>Escolha à esquerda para começar a atender</p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div style={{
              padding: '16px 24px',
              background: 'white',
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>
                  {conversaAtiva.contato_nome || 'Sem nome'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {conversaAtiva.canal === 'whatsapp' ? '📱 WhatsApp' : '📷 Instagram'} ·
                  {' '}{conversaAtiva.contato_telefone || conversaAtiva.contato_instagram || ''}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Encerrar essa conversa?')) {
                    await api.fecharConversa(conversaAtiva.id);
                    setConversaAtiva(null);
                    carregarConversas();
                  }
                }}
                style={{
                  padding: '8px 14px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#666',
                }}
              >✓ Encerrar</button>
            </div>

            {/* Mensagens */}
            <div ref={threadRef} style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {mensagens.map(m => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.direcao === 'enviada' ? 'flex-end' : 'flex-start',
                    maxWidth: '65%',
                    animation: 'fadeIn 0.3s',
                  }}
                >
                  <div style={{
                    background: m.direcao === 'enviada' ? '#FFD90F' : 'white',
                    color: '#1a1a1a',
                    padding: '12px 16px',
                    borderRadius: m.direcao === 'enviada' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    fontSize: '14px',
                    lineHeight: '1.4',
                  }}>
                    {m.conteudo}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '4px', textAlign: m.direcao === 'enviada' ? 'right' : 'left' }}>
                    {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div style={{
              padding: '16px',
              background: 'white',
              borderTop: '1px solid #e8e8e8',
              display: 'flex',
              gap: '12px',
            }}>
              <input
                placeholder="Digite sua mensagem..."
                value={novaMsg}
                onChange={(e) => setNovaMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: '24px',
                  border: '2px solid #f0f0f0',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={enviarMensagem}
                disabled={enviando || !novaMsg.trim()}
                style={{
                  padding: '0 24px',
                  background: '#1a1a1a',
                  color: '#FFD90F',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  opacity: enviando || !novaMsg.trim() ? 0.5 : 1,
                }}
              >
                Enviar →
              </button>
            </div>
          </>
        )}
      </section>

      {/* ============ PAINEL DO CONTATO ============ */}
      {conversaAtiva && (
        <aside style={{
          width: '280px',
          background: 'white',
          borderLeft: '1px solid #e8e8e8',
          padding: '24px',
          overflowY: 'auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD90F, #F4A100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 700,
              color: '#1a1a1a',
              margin: '0 auto 12px',
            }}>
              {(conversaAtiva.contato_nome || '?')[0]}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{conversaAtiva.contato_nome || 'Sem nome'}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              {conversaAtiva.contato_telefone || conversaAtiva.contato_instagram}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '8px', letterSpacing: '0.5px' }}>
              INFORMAÇÕES
            </div>
            <div style={{ fontSize: '13px', lineHeight: '2' }}>
              <div><strong>Canal:</strong> {conversaAtiva.canal}</div>
              <div><strong>Marca:</strong> {conversaAtiva.marca}</div>
              <div><strong>Status:</strong> {conversaAtiva.status}</div>
              <div><strong>Iniciada:</strong> {new Date(conversaAtiva.criada_em).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '8px', letterSpacing: '0.5px' }}>
              AÇÕES RÁPIDAS
            </div>
            <button style={{
              width: '100%',
              padding: '10px',
              background: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '8px',
              textAlign: 'left',
            }}>📌 Adicionar tag</button>
            <button style={{
              width: '100%',
              padding: '10px',
              background: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '8px',
              textAlign: 'left',
            }}>📝 Nota interna</button>
            <button style={{
              width: '100%',
              padding: '10px',
              background: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '13px',
              textAlign: 'left',
            }}>👤 Atribuir</button>
          </div>
        </aside>
      )}
    </div>
  );
}
