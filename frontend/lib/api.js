// lib/api.js
// Cliente HTTP para o backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chat.chatgruporango.tech';

async function fetchAPI(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ erro: 'Erro desconhecido' }));
    throw new Error(error.erro || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  url: API_URL,

  login: (email, senha) =>
    fetchAPI('/api/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),

  conversas: (status = 'aberta') =>
    fetchAPI(`/api/conversas?status=${status}`),

  conversa: (id) =>
    fetchAPI(`/api/conversas/${id}`),

  enviarMensagem: (conversaId, conteudo, atendenteId) =>
    fetchAPI(`/api/conversas/${conversaId}/mensagens`, {
      method: 'POST',
      body: JSON.stringify({ conteudo, atendente_id: atendenteId }),
    }),

  fecharConversa: (id) =>
    fetchAPI(`/api/conversas/${id}/fechar`, { method: 'PUT' }),

  atribuirConversa: (id, atendenteId) =>
    fetchAPI(`/api/conversas/${id}/atribuir`, {
      method: 'PUT',
      body: JSON.stringify({ atendente_id: atendenteId }),
    }),

  stats: () => fetchAPI('/api/stats'),

  criarTeste: (dados = {}) =>
    fetchAPI('/api/teste/conversa', { method: 'POST', body: JSON.stringify(dados) }),
};
