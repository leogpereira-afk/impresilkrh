import { exigirSessao } from "@/lib/auth";
import { PERFIS } from "@/lib/constants";
import { sincronizarNotificacoes, listarNotificacoes } from "@/lib/notificacoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { BotaoDigest } from "@/components/notificacoes/botao-digest";
import { marcarComoLida, marcarTodasLidas, enviarDigest } from "./actions";
import Link from "next/link";
import { Bell, Check, CheckCheck, AlertTriangle, Info, FileWarning } from "lucide-react";

export default async function NotificacoesPage() {
  const sessao = await exigirSessao();
  // Recalcula as notificações com o estado atual ao abrir a central.
  await sincronizarNotificacoes(sessao);
  const notifs = await listarNotificacoes(sessao.sub);
  const naoLidas = notifs.filter((n) => !n.lida).length;

  const icone = (sev: string) =>
    sev === "danger" ? <AlertTriangle className="h-4 w-4 text-red-500" />
      : sev === "warning" ? <FileWarning className="h-4 w-4 text-amber-500" />
        : <Info className="h-4 w-4 text-blue-500" />;

  return (
    <>
      <PageHeader
        title="Central de Notificações"
        description={`${naoLidas} não lida(s) de ${notifs.length}`}
      >
        {sessao.perfil === PERFIS.ADMIN_RH && <BotaoDigest action={enviarDigest} />}
        {naoLidas > 0 && (
          <form action={marcarTodasLidas}>
            <button className="btn-primary flex items-center gap-2">
              <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
            </button>
          </form>
        )}
      </PageHeader>

      {notifs.length === 0 ? (
        <EmptyState title="Nenhuma notificação" description="Você está em dia! 🎉" icon={<Bell className="h-8 w-8" />} />
      ) : (
        <Card>
          <CardBody className="divide-y divide-slate-100 p-0">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${n.lida ? "opacity-60" : "bg-slate-50/40"}`}
              >
                <span className="mt-0.5">{icone(n.severidade)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
                  {n.mensagem && <p className="text-xs text-slate-500">{n.mensagem}</p>}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{n.tipo}</span>
                    {n.link && (
                      <Link href={n.link} className="text-xs font-medium text-brand hover:underline">
                        Ver
                      </Link>
                    )}
                  </div>
                </div>
                {!n.lida && (
                  <form action={marcarComoLida}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="btn-ghost p-1.5 text-slate-400 hover:text-green-600" title="Marcar como lida">
                      <Check className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
