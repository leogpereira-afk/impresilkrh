// ============================================================================
// Nome de pessoa que abre a ficha dela.
//
// Por que virou componente: uma varredura pelas 23 telas do sistema achou 24
// lugares onde o nome de um colaborador aparecia — na lista de férias, na tabela
// de exames, no PDI atrasado, no aceite pendente, na trilha da LGPD — e não
// levava a lugar nenhum. Em sistema de RH esse é o atrito número um: o nome está
// ali, a próxima coisa que se quer é abrir a pessoa, e era preciso decorar o
// nome, ir à barra lateral, entrar em Colaboradores e procurar de novo.
//
// Alguns desses lugares ficam DENTRO de um modal; por isso o `aoIr`, para o
// modal se fechar antes de navegar (senão a ficha abre atrás dele).
// ============================================================================
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export function LinkFicha({
  id,
  children,
  className,
  aoIr,
  titulo,
}: {
  /** id do colaborador; sem id (ou vazio) não vira link, só mostra o conteúdo. */
  id?: string | null;
  children: React.ReactNode;
  className?: string;
  /** Chamado antes de navegar — use para fechar o modal que contém o link. */
  aoIr?: () => void;
  titulo?: string;
}) {
  if (!id) return <>{children}</>;
  return (
    <Link
      to={`/colaboradores/${id}`}
      onClick={aoIr}
      title={titulo ?? "Abrir a ficha desta pessoa"}
      className={cn("rounded transition hover:text-brand hover:underline", className)}
    >
      {children}
    </Link>
  );
}
