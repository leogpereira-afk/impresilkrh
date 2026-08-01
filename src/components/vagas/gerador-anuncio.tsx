// ============================================================================
// "Gerar anúncio" de uma vaga.
//
// O trabalho pesado já está feito no cadastro: o CARGO tem descrição,
// competências técnicas e comportamentais, requisitos e faixa salarial por
// nível. A tela só junta isso com o que muda a cada divulgação (local, tipo de
// contratação, benefícios, como se candidatar) e monta o texto de cada canal.
//
// O que muda a cada vaga vem do cadastro; o que se repete em toda vaga
// (benefícios, jornada, como se candidatar) fica guardado na configuração, para
// não ser redigitado toda vez.
// ============================================================================
import { useMemo, useState } from "react";
import { Copy, Check, Download, Megaphone } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Textarea, Select, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useDominio, faixaNoNivel } from "@/lib/dominio";
import { obterConfig, salvarConfig } from "@/lib/store";
import { gerarAnuncio, CANAIS, type CanalAnuncio, type DadosAnuncio } from "@/lib/anuncioVaga";
import { cn } from "@/lib/cn";
import type { Vaga } from "@/data/types";

const TIPOS_CONTRATACAO = ["CLT", "CLT (experiência 90 dias)", "Estágio", "Jovem Aprendiz", "PJ", "Temporário"];

export function GeradorAnuncio({ vaga, onFechar }: { vaga: Vaga; onFechar: () => void }) {
  const d = useDominio();
  const toast = useToast();
  const cfg = obterConfig();
  const cargo = vaga.cargoId ? d.cargoById.get(vaga.cargoId) : undefined;

  const [canal, setCanal] = useState<CanalAnuncio>("whatsapp");
  const [copiado, setCopiado] = useState(false);

  // O que se repete em toda vaga fica guardado; o que é da vaga vem do cadastro.
  const [local, setLocal] = useState(cfg.anuncioLocal ?? "Montes Claros/MG");
  const [tipoContratacao, setTipoContratacao] = useState(cfg.anuncioContratacao ?? TIPOS_CONTRATACAO[0]);
  const [jornada, setJornada] = useState(cfg.anuncioJornada ?? "Segunda a sexta, horário comercial");
  const [beneficios, setBeneficios] = useState(cfg.anuncioBeneficios ?? "Vale-transporte\nPlano de saúde\nParticipação em treinamentos");
  const [comoCandidatar, setComoCandidatar] = useState(cfg.anuncioComoCandidatar ?? "Envie seu currículo para o WhatsApp do RH.");
  const [mostrarSalario, setMostrarSalario] = useState(false);

  // Descrição e requisitos: começam no que o cargo já diz, e ficam editáveis.
  const [descricao, setDescricao] = useState(
    vaga.descricao?.trim() || cargo?.descricao?.trim() || cargo?.competenciasTecnicas?.trim() || "",
  );
  const [requisitos, setRequisitos] = useState(
    vaga.requisitos?.trim() || cargo?.requisitos?.trim() || "",
  );
  const [diferenciais, setDiferenciais] = useState(cargo?.competenciasComportamentais?.trim() || "");

  const salario = useMemo(() => faixaNoNivel(cargo, vaga.nivelId), [cargo, vaga.nivelId]);

  const dados: DadosAnuncio = {
    titulo: vaga.titulo,
    empresa: "Impresilk Comunicação Visual",
    cidade: local,
    area: vaga.areaId ? d.nomeArea(vaga.areaId) : undefined,
    quantidade: vaga.quantidade,
    descricao, requisitos, diferenciais, beneficios,
    tipoContratacao, jornada,
    salario, mostrarSalario,
    comoCandidatar,
  };
  const texto = gerarAnuncio(dados, canal);

  const guardarPadroes = () => {
    salvarConfig({
      anuncioLocal: local,
      anuncioContratacao: tipoContratacao,
      anuncioJornada: jornada,
      anuncioBeneficios: beneficios,
      anuncioComoCandidatar: comoCandidatar,
    });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      guardarPadroes();
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissão de área de transferência (acontece em navegador antigo ou
      // fora de HTTPS): em vez de falhar calado, avisa o que fazer.
      toast("O navegador não deixou copiar. Selecione o texto e use Ctrl+C.", "info");
    }
  };

  const baixar = () => {
    guardarPadroes();
    const nome = `anuncio-${vaga.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${canal}.txt`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Gerar anúncio da vaga"
      descricao={`${vaga.titulo}${cargo ? ` · ${cargo.nome}` : ""} — o texto sai do cadastro do cargo e você ajusta antes de publicar.`}
      largura="max-w-4xl"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Fechar</button>
          <button className="btn-outline" onClick={baixar}><Download className="h-4 w-4" /> Baixar .txt</button>
          <button className="btn-primary" onClick={() => void copiar()}>
            {copiado ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Local"><Input value={local} onChange={(e) => setLocal(e.target.value)} /></Campo>
            <Campo label="Contratação">
              <Select value={tipoContratacao} onChange={(e) => setTipoContratacao(e.target.value)}>
                {TIPOS_CONTRATACAO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Campo>
          </div>
          <Campo label="Jornada"><Input value={jornada} onChange={(e) => setJornada(e.target.value)} /></Campo>
          <Campo label="O que a pessoa vai fazer" hint="Uma atividade por linha">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
          <Campo label="Requisitos" hint="Um por linha">
            <Textarea value={requisitos} onChange={(e) => setRequisitos(e.target.value)} />
          </Campo>
          <Campo label="Diferenciais" hint="Um por linha">
            <Textarea value={diferenciais} onChange={(e) => setDiferenciais(e.target.value)} />
          </Campo>
          <Campo label="Benefícios" hint="Um por linha — fica guardado para as próximas vagas">
            <Textarea value={beneficios} onChange={(e) => setBeneficios(e.target.value)} />
          </Campo>
          <Campo label="Como se candidatar"><Input value={comoCandidatar} onChange={(e) => setComoCandidatar(e.target.value)} /></Campo>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <Toggle
              checked={mostrarSalario}
              onChange={setMostrarSalario}
              label={salario ? `Divulgar o salário (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(salario)})` : "Divulgar o salário"}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {salario
                ? "Vem da faixa do nível no cadastro do cargo. Desligado, o anúncio diz “A combinar”."
                : "Sem faixa cadastrada para este cargo/nível — o anúncio dirá “A combinar”."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {CANAIS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCanal(c.id)}
                title={c.dica}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  canal === c.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">{CANAIS.find((c) => c.id === canal)?.dica}</p>
          {/* Pré-visualização, não campo: o texto é montado a cada tecla do lado
              esquerdo. Quem quiser mexer na palavra final copia e edita onde vai
              publicar — assim o anúncio nunca fica fora de sincronia com o que
              está preenchido aqui. */}
          <pre className="max-h-[26rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs leading-relaxed text-slate-700">
            {texto}
          </pre>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Megaphone className="h-3.5 w-3.5" /> {texto.length} caracteres
          </p>
        </div>
      </div>
    </Modal>
  );
}
