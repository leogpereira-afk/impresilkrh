import { exigirSessao } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { contarNaoLidas } from "@/lib/notificacoes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();
  const naoLidas = await contarNaoLidas(sessao.sub);
  return (
    <AppShell
      user={{ nome: sessao.nome, perfil: sessao.perfil, email: sessao.email }}
      naoLidas={naoLidas}
    >
      {children}
    </AppShell>
  );
}
