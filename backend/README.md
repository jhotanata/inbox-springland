# Inbox Backend — Deploy Guide

## Pré-requisitos no servidor
Node.js 20, PostgreSQL, Nginx, PM2, Certbot já instalados.

---

## 1. Enviar arquivos para o servidor

```bash
# Da sua máquina local:
scp -r ./inbox/backend root@IP_DO_SERVIDOR:/var/www/inbox/backend
```

---

## 2. Instalar dependências

```bash
cd /var/www/inbox/backend
npm install
```

---

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env   # preencha todos os valores
```

Gere um JWT_SECRET seguro:
```bash
openssl rand -base64 48
```

---

## 4. Criar banco e schema

```bash
sudo -u postgres psql inbox_db < src/db/schema.sql
```

---

## 5. Criar atendentes iniciais

```bash
node seed.js
```

Logins padrão (troque as senhas depois):
| Email                    | Senha         |
|--------------------------|---------------|
| admin@inbox.local        | Admin@123     |
| atendente1@inbox.local   | Atendente@123 |
| atendente2@inbox.local   | Atendente@123 |

---

## 6. Logs do PM2

```bash
mkdir -p /var/log/inbox
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # copie e execute o comando gerado
```

---

## 7. Nginx — config do reverse proxy

Crie `/etc/nginx/sites-available/inbox`:

```nginx
server {
    listen 80;
    server_name chat.seudominio.com.br;

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io precisa de upgrade para WebSocket
    location /api/socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/inbox /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 8. SSL gratuito

```bash
certbot --nginx -d chat.seudominio.com.br
```

---

## 9. Registrar webhooks na Meta

No painel do Meta for Developers → Webhooks:

| Canal      | URL                                               | Eventos              |
|------------|---------------------------------------------------|----------------------|
| WhatsApp   | `https://chat.seudominio.com.br/api/webhook/whatsapp`   | `messages`           |
| Instagram  | `https://chat.seudominio.com.br/api/webhook/instagram`  | `messages`           |

Verify Token = valor de `META_VERIFY_TOKEN` no `.env`

---

## 10. Testar

```bash
# Health check
curl https://chat.seudominio.com.br/api/health

# Login
curl -X POST https://chat.seudominio.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inbox.local","senha":"Admin@123"}'
```

---

## Endpoints

| Método | Rota                          | Auth | Descrição                    |
|--------|-------------------------------|------|------------------------------|
| POST   | /auth/login                   | —    | Login do atendente           |
| GET    | /conversas                    | JWT  | Lista conversas              |
| GET    | /conversas/:id/mensagens      | JWT  | Histórico da conversa        |
| POST   | /conversas/:id/enviar         | JWT  | Envia mensagem               |
| POST   | /conversas/:id/atribuir       | JWT  | Atribui atendente            |
| GET    | /webhook/whatsapp             | —    | Verificação Meta             |
| POST   | /webhook/whatsapp             | —    | Recebe mensagens WA          |
| GET    | /webhook/instagram            | —    | Verificação Meta             |
| POST   | /webhook/instagram            | —    | Recebe mensagens IG          |

## Eventos Socket.io

| Evento              | Payload                                      |
|---------------------|----------------------------------------------|
| `mensagem:nova`     | `{ conversa_id, mensagem, contato, marca? }` |
| `conversa:atualizada` | conversa completa atualizada               |
