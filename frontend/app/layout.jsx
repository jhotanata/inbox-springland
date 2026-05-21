import './globals.css';

export const metadata = {
  title: 'Inbox Springland',
  description: 'Atendimento unificado WhatsApp + Instagram',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
