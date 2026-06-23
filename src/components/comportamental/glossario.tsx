import { useState } from "react";
import {
  ChevronDown, Brain, Laugh, Smile, Meh, Frown, Eye, Ear, Hand,
  ThumbsUp, AlertTriangle, Lightbulb, HeartPulse, GraduationCap, DoorOpen, Gauge,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PerfilComportamentalGuia } from "@/components/ui/indicadores";
import {
  PERFIS_COMPORTAMENTAIS, ARQUETIPOS, COR_PERFIL_COMPORTAMENTAL,
  COR_HUMOR, COR_RISCO, FAIXAS_MOTIVACAO,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Glossário comportamental — referência de gestão e autoconhecimento.
// "Telas que reduzem e abrem" (acordeão) explicando cada tipo e como lidar.
// ---------------------------------------------------------------------------

function Acordeao({
  id, abertos, onToggle, cor, Icon, titulo, resumo, children,
}: {
  id: string;
  abertos: Set<string>;
  onToggle: (id: string) => void;
  cor: string;
  Icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  resumo: string;
  children: React.ReactNode;
}) {
  const aberto = abertos.has(id);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: cor }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-ink">{titulo}</p>
          <p className={cn("text-xs text-slate-500", aberto && "hidden")}>{resumo}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}

// Corpo padrão (sinais + como agir) para humor / estilos / risco.
function CorpoGuia({
  texto, blocoA, blocoB,
}: {
  texto: string;
  blocoA?: { titulo: string; itens: string[]; tom: "amber" | "green" | "blue" };
  blocoB?: { titulo: string; itens: string[]; tom: "amber" | "green" | "blue" };
}) {
  const tons: Record<string, { borda: string; bg: string; txt: string; dot: string }> = {
    amber: { borda: "border-amber-200", bg: "bg-amber-50/50", txt: "text-amber-700", dot: "bg-amber-500" },
    green: { borda: "border-green-200", bg: "bg-green-50/50", txt: "text-green-700", dot: "bg-green-500" },
    blue: { borda: "border-blue-200", bg: "bg-blue-50/50", txt: "text-blue-700", dot: "bg-blue-500" },
  };
  const Bloco = ({ b, Icon }: { b: NonNullable<typeof blocoA>; Icon: React.ComponentType<{ className?: string }> }) => {
    const t = tons[b.tom];
    return (
      <div className={cn("rounded-lg border p-3", t.borda, t.bg)}>
        <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", t.txt)}>
          <Icon className="h-3.5 w-3.5" /> {b.titulo}
        </p>
        <ul className="space-y-1">
          {b.itens.map((x, i) => (
            <li key={i} className="flex gap-1.5 text-sm text-slate-600">
              <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", t.dot)} />{x}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-slate-600">{texto}</p>
      {(blocoA || blocoB) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {blocoA && <Bloco b={blocoA} Icon={AlertTriangle} />}
          {blocoB && <Bloco b={blocoB} Icon={ThumbsUp} />}
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, descricao, Icon, children }: { titulo: string; descricao: string; Icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon className="h-[18px] w-[18px]" /></span>
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{titulo}</h2>
          <p className="text-sm text-slate-500">{descricao}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// --- Conteúdo de apoio (humor, estilos, risco) ---
const HUMOR = [
  {
    id: "h-motivado", nome: "Motivado", icon: Laugh, cor: COR_HUMOR.Motivado,
    resumo: "Engajado, com energia e iniciativa — vai além do combinado.",
    texto: "Pessoa engajada, com energia e iniciativa. Costuma ir além do pedido, ajuda os colegas e fala bem da empresa. É quem puxa o time para cima.",
    sinais: ["Proatividade e ideias novas", "Ajuda colegas sem ser pedido", "Boa qualidade e ritmo constante", "Fala positiva sobre a empresa"],
    acao: ["Reconheça publicamente", "Dê novos desafios e visibilidade", "Use como referência/multiplicador", "Cuide para não sobrecarregar"],
  },
  {
    id: "h-estavel", nome: "Estável", icon: Meh, cor: COR_HUMOR.Estável,
    resumo: "Constante e confiável, cumpre o combinado sem grandes picos.",
    texto: "Cumpre bem o que é combinado, é constante e confiável, mas sem grandes picos de energia ou iniciativa. É a base que sustenta a operação.",
    sinais: ["Entrega no prazo", "Baixo conflito", "Pouca iniciativa extra", "Previsível e confiável"],
    acao: ["Reconheça a constância", "Mantenha previsibilidade e processos claros", "Ofereça um próximo passo de desenvolvimento", "Ajude a evoluir de estável para motivado"],
  },
  {
    id: "h-desmotivado", nome: "Desmotivado", icon: Frown, cor: COR_HUMOR.Desmotivado,
    resumo: "Energia baixa, faz o mínimo — sinal de alerta de clima ou de saída.",
    texto: "Energia baixa, faz o mínimo necessário. É um sinal de alerta: pode indicar problema de clima, de liderança, de reconhecimento, salário, algo pessoal — ou risco de saída.",
    sinais: ["Atrasos e isolamento", "Reclamações frequentes", "Queda de qualidade/ritmo", "Distanciamento do time"],
    acao: ["Converse em particular o quanto antes", "Escute a causa sem julgar", "Combine ações concretas e prazo curto", "Reavalie e registre o acompanhamento"],
  },
];

const ESTILOS = [
  {
    id: "e-visual", nome: "Visual", icon: Eye, cor: "#2563eb",
    resumo: "Aprende vendo — imagens, diagramas, vídeos e demonstração.",
    texto: "Aprende melhor vendo. Prefere imagens, diagramas, vídeos e exemplos demonstrados na prática. Lembra do que viu.",
    como: ["Use fotos, esquemas e POPs ilustrados", "Demonstre a tarefa na prática", "Deixe material visual/escrito para consultar", "Quadros, cores e marcações ajudam"],
  },
  {
    id: "e-auditivo", nome: "Auditivo", icon: Ear, cor: "#7c3aed",
    resumo: "Aprende ouvindo — explicação falada, conversa e repetição.",
    texto: "Aprende melhor ouvindo. Prefere explicação falada, conversa e repetição verbal. Lembra do que foi dito.",
    como: ["Explique em voz alta, com calma", "Faça perguntas e peça para repetir com as próprias palavras", "Use áudios e diálogo", "Reforce verbalmente os pontos-chave"],
  },
  {
    id: "e-cinestesico", nome: "Cinestésico", icon: Hand, cor: "#16a34a",
    resumo: "Aprende fazendo — prática, mão na massa e experimentação.",
    texto: "Aprende melhor fazendo. Precisa colocar a mão, praticar e experimentar. Lembra do que viveu.",
    como: ["Treino na prática, 'aprender fazendo'", "Acompanhe a execução de perto no início", "Dê tarefas reais com supervisão", "Evite só teoria: intercale com prática"],
  },
];

const RISCO = [
  {
    id: "r-baixo", nome: "Risco baixo", icon: ThumbsUp, cor: COR_RISCO.Baixo,
    resumo: "Engajado e estável — baixa chance de sair no curto prazo.",
    texto: "Pessoa engajada e estável, com baixa probabilidade de saída no curto prazo. Mesmo assim, não é para descuidar.",
    acao: ["Mantenha reconhecimento", "Ofereça plano de evolução", "Continue ouvindo periodicamente"],
  },
  {
    id: "r-medio", nome: "Risco médio", icon: AlertTriangle, cor: COR_RISCO.Médio,
    resumo: "Sinais de atenção — pode sair se não houver cuidado.",
    texto: "Há sinais de atenção (clima, salário, mercado, relação com a liderança). Pode sair se os pontos de insatisfação não forem tratados.",
    acao: ["Tenha uma conversa de carreira", "Identifique e ajuste o que incomoda", "Acompanhe de perto nas próximas semanas"],
  },
  {
    id: "r-alto", nome: "Risco alto", icon: DoorOpen, cor: COR_RISCO.Alto,
    resumo: "Alta probabilidade de saída — exige ação imediata.",
    texto: "Alta probabilidade de saída. Se for uma pessoa-chave, a perda é cara (conhecimento, prazo, clima). Exige ação imediata.",
    acao: ["Monte um plano de retenção", "Ofereça valor além do salário (carreira, propósito, flexibilidade)", "1:1 frequente e próximo", "Decida rápido — janela curta"],
  },
];

export function GlossarioComportamental() {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-brand-50 to-white p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <Lightbulb className="h-4 w-4 text-gold-500" /> Como usar este guia
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Pessoas não são iguais — e tratar todo mundo do mesmo jeito gera atrito. Aqui você encontra os perfis comportamentais,
          o clima, os estilos de aprendizagem e os níveis de motivação e risco, com <strong>como identificar</strong> e
          <strong> como lidar</strong> com cada um. Use para dar feedback melhor, treinar do jeito certo, reter talentos —
          e também para se conhecer. Toque em cada item para abrir.
        </p>
      </div>

      <Secao titulo="Os 4 perfis comportamentais" descricao="Temperamentos (base DISC). Ninguém é 100% um só — há um predominante." Icon={Brain}>
        {PERFIS_COMPORTAMENTAIS.map((p) => {
          const a = ARQUETIPOS[p];
          return (
            <Acordeao
              key={p} id={`arq-${p}`} abertos={abertos} onToggle={toggle}
              cor={COR_PERFIL_COMPORTAMENTAL[p]} Icon={Brain}
              titulo={`${a.arquetipo} · ${p}`}
              resumo={`${a.disc} — ${a.explicacao}`}
            >
              <PerfilComportamentalGuia perfil={p} />
            </Acordeao>
          );
        })}
      </Secao>

      <Secao titulo="Clima e engajamento (humor)" descricao="O termômetro do dia a dia. Muda com o tempo — acompanhe." Icon={HeartPulse}>
        {HUMOR.map((h) => (
          <Acordeao key={h.id} id={h.id} abertos={abertos} onToggle={toggle} cor={h.cor} Icon={h.icon} titulo={h.nome} resumo={h.resumo}>
            <CorpoGuia
              texto={h.texto}
              blocoA={{ titulo: "Sinais", itens: h.sinais, tom: "amber" }}
              blocoB={{ titulo: "Como agir", itens: h.acao, tom: "green" }}
            />
          </Acordeao>
        ))}
      </Secao>

      <Secao titulo="Estilos de aprendizagem (VAK)" descricao="Como cada pessoa absorve melhor um treinamento ou orientação." Icon={GraduationCap}>
        {ESTILOS.map((e) => (
          <Acordeao key={e.id} id={e.id} abertos={abertos} onToggle={toggle} cor={e.cor} Icon={e.icon} titulo={e.nome} resumo={e.resumo}>
            <CorpoGuia
              texto={e.texto}
              blocoB={{ titulo: "Como treinar e comunicar", itens: e.como, tom: "blue" }}
            />
          </Acordeao>
        ))}
      </Secao>

      <Secao titulo="Termômetro de motivação (0–100)" descricao="A carinha que aparece na ficha do colaborador, faixa a faixa." Icon={Gauge}>
        <div className="rounded-xl border border-slate-200/70 bg-white p-4">
          <ul className="space-y-2.5">
            {FAIXAS_MOTIVACAO.map((f) => {
              const Icon = f.rosto === "muito-feliz" ? Laugh : f.rosto === "feliz" ? Smile : f.rosto === "neutro" ? Meh : Frown;
              const acao =
                f.min >= 80 ? "Referência do time — desafie e dê visibilidade." :
                f.min >= 60 ? "Bom engajamento — mantenha reconhecimento e desenvolvimento." :
                f.min >= 40 ? "Zona de atenção — entenda o que falta e proponha um próximo passo." :
                f.min >= 20 ? "Risco — converse, escute a causa e combine ações." :
                "Risco alto de saída — ação imediata e acompanhamento próximo.";
              return (
                <li key={f.label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: f.cor }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: f.cor }}>{f.min}–{f.max} · {f.label}</p>
                    <p className="text-sm text-slate-600">{acao}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Secao>

      <Secao titulo="Risco de saída" descricao="A probabilidade de a pessoa deixar a empresa — e o que fazer." Icon={DoorOpen}>
        {RISCO.map((r) => (
          <Acordeao key={r.id} id={r.id} abertos={abertos} onToggle={toggle} cor={r.cor} Icon={r.icon} titulo={r.nome} resumo={r.resumo}>
            <CorpoGuia
              texto={r.texto}
              blocoB={{ titulo: "O que fazer", itens: r.acao, tom: "green" }}
            />
          </Acordeao>
        ))}
      </Secao>
    </div>
  );
}
