import { exigirSessao } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();
  return (
    <AppShell
      user={{ nome: sessao.nome, perfil: sessao.perfil, email: sessao.email }}
    >
      {children}
    </AppShell>
  );
}
