import { useMemo, useState } from "react";
import {
  CalendarDays, Cake, PartyPopper, Flag, Sparkles, CalendarClock, Building2,
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeGerir } from "@/lib/rbac";
import { cn } from "@/lib/cn";
import { parseData, MESES_PT } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { EventoCalendario, TipoEvento } from "@/data/types";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPOS: { tipo: string; cor: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
  { tipo: "Aniversário", cor: "#db2777", Icon: Cake },
  { tipo: "Tempo de empresa", cor: "#c2a14d", Icon: PartyPopper },
  { tipo: "Feriado", cor: "#dc2626", Icon: Flag },
  { tipo: "Comemorativa", cor: "#2563eb", Icon: Sparkles },
  { tipo: "Reunião", cor: "#16334f", Icon: CalendarClock },
  { tipo: "Empresa", cor: "#16a34a", Icon: Building2 },
];
const corDe = (t: string) => TIPOS.find((x) => x.tipo === t)?.cor ?? "#64748b";
const iconDe = (t: string) => TIPOS.find((x) => x.tipo === t)?.Icon ?? CalendarDays;
const TIPOS_EDITAVEIS: TipoEvento[] = ["Comemorativa", "Reunião", "Feriado", "Empresa", "Outro"];

type Item = { dia: number; tipo: string; titulo: string; sub?: string; eventoId?: string };

export default function Calendario() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: eventos, remover } = useColecao("eventos");
  const gere = podeGerir(sessao);
  const [ano, setAno] = useState(HOJE.getFullYear());
  const [mes, setMes] = useState(HOJE.getMonth()); // 0-based
  const [edit, setEdit] = useState<EventoCalendario | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<EventoCalendario | null>(null);

  // Eventos do mês = aniversários + tempo de empresa (derivados) + eventos salvos.
  const itens = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of d.ativos) {
      const n = parseData(c.dataNascimento);
      if (n && n.getMonth() === mes) {
        const idade = ano - n.getFullYear();
        out.push({ dia: n.getDate(), tipo: "Aniversário", titulo: c.nome, sub: idade > 0 ? `${idade} anos` : undefined });
      }
      const a = parseData(c.dataAdmissao);
      if (a && a.getMonth() === mes) {
        const anos = ano - a.getFullYear();
        out.push({ dia: a.getDate(), tipo: "Tempo de empresa", titulo: c.nome, sub: anos > 0 ? `${anos} ${anos === 1 ? "ano" : "anos"} de casa` : "Entrou agora" });
      }
    }
    for (const e of eventos) {
      const dt = parseData(e.data);
      if (!dt) continue;
      const match = e.recorrenteAnual ? dt.getMonth() === mes : (dt.getFullYear() === ano && dt.getMonth() === mes);
      if (!match) continue;
      const sub = e.hora ? `${e.hora}${e.descricao ? ` · ${e.descricao}` : ""}` : (e.descricao ?? undefined);
      out.push({ dia: dt.getDate(), tipo: e.tipo, titulo: e.titulo, sub: sub ?? undefined, eventoId: e.id });
    }
    return out.sort((x, y) => x.dia - y.dia || x.tipo.localeCompare(y.tipo));
  }, [d.ativos, eventos, ano, mes]);

  const porDia = useMemo(() => {
    const m = new Map<number, Item[]>();
    for (const it of itens) { const arr = m.get(it.dia) ?? []; arr.push(it); m.set(it.dia, arr); }
    return m;
  }, [itens]);

  // Grade de 6 semanas começando no domingo.
  const offset = new Date(ano, mes, 1).getDay();
  const celulas = Array.from({ length: 42 }, (_, i) => new Date(ano, mes, 1 - offset + i));
  const ehHoje = (dt: Date) => dt.getFullYear() === HOJE.getFullYear() && dt.getMonth() === HOJE.getMonth() && dt.getDate() === HOJE.getDate();

  const navMes = (delta: number) => {
    let m = mes + delta, y = ano;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMes(m); setAno(y);
  };

  return (
    <div>
      <PageHeader title="Calendário" description="Aniversários, tempo de empresa, feriados, datas comemorativas e reuniões — nada esquecido.">
        {gere && <button className="btn-primary" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo evento</button>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-outline px-2" onClick={() => navMes(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[150px] text-center text-lg font-semibold text-brand-ink">{MESES_PT[mes]} {ano}</span>
          <button className="btn-outline px-2" onClick={() => navMes(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          <button className="btn-ghost text-sm" onClick={() => { setMes(HOJE.getMonth()); setAno(HOJE.getFullYear()); }}>Hoje</button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {TIPOS.map((t) => <span key={t.tipo} className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.cor }} />{t.tipo}</span>)}
        </div>
      </div>

      <Card className="mb-6">
        <CardBody className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {DOW.map((x) => <div key={x} className="py-2">{x}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {celulas.map((dt, i) => {
              const noMes = dt.getMonth() === mes;
              const evs = noMes ? (porDia.get(dt.getDate()) ?? []) : [];
              return (
                <div key={i} className={cn("min-h-[88px] border-b border-r border-slate-100 p-1.5", !noMes && "bg-slate-50/40", ehHoje(dt) && "bg-brand-50/50")}>
                  <div className={cn("mb-1 text-xs font-medium", noMes ? "text-slate-600" : "text-slate-300", ehHoje(dt) && "font-bold text-brand")}>{dt.getDate()}</div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e, j) => (
                      <div key={j} className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white" style={{ background: corDe(e.tipo) }} title={`${e.titulo}${e.sub ? ` — ${e.sub}` : ""}`}>{e.titulo}</div>
                    ))}
                    {evs.length > 3 && <div className="px-1 text-[10px] font-medium text-slate-400">+{evs.length - 3} mais</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Tudo de ${MESES_PT[mes]}`} subtitle="Lista completa do mês, em ordem de data" icon={<CalendarDays className="h-[18px] w-[18px]" />} />
        <CardBody>
          {itens.length === 0 ? (
            <EmptyState title="Nada marcado neste mês" description="Use “Novo evento” para adicionar reuniões e datas comemorativas." icon={<CalendarDays className="h-8 w-8" />} />
          ) : (
            <div className="space-y-1.5">
              {itens.map((it, i) => {
                const Icon = iconDe(it.tipo);
                const ev = it.eventoId ? eventos.find((e) => e.id === it.eventoId) : null;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ background: corDe(it.tipo) }}>
                      <span className="text-[8px] uppercase leading-none">{MESES_PT[mes].slice(0, 3)}</span>
                      <span className="text-sm font-bold leading-none">{it.dia}</span>
                    </span>
                    <Icon className="h-4 w-4 shrink-0" style={{ color: corDe(it.tipo) }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{it.titulo}</p>
                      <p className="truncate text-xs text-slate-400">{it.tipo}{it.sub ? ` · ${it.sub}` : ""}</p>
                    </div>
                    {gere && ev && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => setEdit(ev)} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setDel(ev)} aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {(novo || edit) && <EventoModal onFechar={() => { setNovo(false); setEdit(null); }} editar={edit} />}
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => { if (del) { remover(del.id); toast("Evento removido."); } }}
        titulo="Remover evento?"
        mensagem={del ? `“${del.titulo}” será removido do calendário.` : ""}
      />
    </div>
  );
}

function EventoModal({ onFechar, editar }: { onFechar: () => void; editar: EventoCalendario | null }) {
  const toast = useToast();
  const { criar, atualizar } = useColecao("eventos");
  const [form, setForm] = useState<Partial<EventoCalendario>>(editar ?? { tipo: "Comemorativa", recorrenteAnual: false, data: "" });
  const set = (p: Partial<EventoCalendario>) => setForm((f) => ({ ...f, ...p }));

  const salvar = () => {
    if (!form.titulo?.trim()) return toast("Informe o título do evento.", "erro");
    if (!form.data) return toast("Informe a data.", "erro");
    const dados = {
      titulo: form.titulo.trim(),
      data: form.data,
      tipo: form.tipo ?? "Comemorativa",
      recorrenteAnual: !!form.recorrenteAnual,
      hora: form.hora || null,
      descricao: form.descricao || null,
    };
    if (editar) { atualizar(editar.id, dados); toast("Evento atualizado."); }
    else { criar(dados); toast("Evento adicionado ao calendário."); }
    onFechar();
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={editar ? "Editar evento" : "Novo evento"}
      descricao="Reuniões, datas comemorativas, feriados e marcos da empresa."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}
    >
      <div className="space-y-3">
        <Campo label="Título" obrigatorio><Input value={form.titulo ?? ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Reunião geral, Dia das Mães…" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data" obrigatorio><Input type="date" value={(form.data ?? "").slice(0, 10)} onChange={(e) => set({ data: e.target.value })} /></Campo>
          <Campo label="Tipo"><Select value={form.tipo} onChange={(e) => set({ tipo: e.target.value as TipoEvento })}>{TIPOS_EDITAVEIS.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Hora" hint="Opcional (reuniões)"><Input type="time" value={form.hora ?? ""} onChange={(e) => set({ hora: e.target.value })} /></Campo>
          <Campo label="Repetição">
            <label className="flex h-[42px] items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.recorrenteAnual} onChange={(e) => set({ recorrenteAnual: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              Repete todo ano
            </label>
          </Campo>
        </div>
        <Campo label="Descrição" hint="Opcional"><Textarea value={form.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value })} placeholder="Detalhe a comemoração, a pauta da reunião, etc." /></Campo>
      </div>
    </Modal>
  );
}
