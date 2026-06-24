// Importador de lista simples "nome + valor" com PRÉVIA, usado para as
// comissões das vendedoras e para a limpeza. Você escolhe a coluna do nome e a
// do valor (funciona com qualquer layout), confere quem casou/não casou e só
// então aplica. Cada linha casada vira um Pagamento do tipo escolhido — que já
// soma automaticamente na ficha, na folha e nos totais.
import { useMemo, useState } from "react";
import { Check, AlertTriangle, UserX, Coins } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/form";
import { formatBRL } from "@/lib/format";
import { compLabelLongo, valorBR, criarCasadorDeNomes } from "@/lib/custos";
import type { Pagamento } from "@/data/types";

type Celula = string | number | null;
type Linha = Celula[];

const letra = (c: number) => (c < 26 ? String.fromCharCode(65 + c) : `${c + 1}`);
const ehNumerico = (v: Celula) => v != null && String(v).trim() !== "" && /^[\sR$.,\d-]+$/.test(String(v)) && valorBR(v) > 0;

export function ImportarListaNome({
  titulo,
  tipo,
  linhas,
  competencias,
  competenciaInicial,
  colaboradores,
  nomeColab,
  contarSubstituir,
  onAplicar,
  onFechar,
}: {
  titulo: string;
  tipo: string;
  linhas: Linha[];
  competencias: string[];
  competenciaInicial: string;
  colaboradores: { id: string; nome: string }[];
  nomeColab: (id: string) => string;
  contarSubstituir: (tipo: string, competencia: string) => number;
  onAplicar: (registros: Pagamento[], tipo: string, competencia: string) => void;
  onFechar: () => void;
}) {
  const ncols = Math.max(1, ...linhas.map((l) => l.length));
  const cols = Array.from({ length: ncols }, (_, i) => i);

  // Amostra de cada coluna (1º valor não-vazio) para rotular os seletores.
  const amostra = (col: number) => {
    for (const l of linhas) { const v = l[col]; if (v != null && String(v).trim()) return String(v).trim(); }
    return "";
  };

  // Detecção automática inicial: nome = coluna com mais texto; valor = coluna com
  // mais números. Usa também o cabeçalho, se houver palavras-chave.
  const auto = useMemo(() => {
    const header = (linhas[0] ?? []).map((c) => String(c ?? "").toLowerCase());
    let cn = header.findIndex((h) => /nome|vendedor|colab|funcion|prestador|pessoa/.test(h));
    let cv = header.findIndex((h) => /valor|comiss|total|l[ií]quido|limpeza|pagar|receb/.test(h));
    const cont = cols.map(() => ({ txt: 0, num: 0 }));
    for (const l of linhas.slice(1)) for (const c of cols) {
      const v = l[c]; if (v == null || String(v).trim() === "") continue;
      if (ehNumerico(v)) cont[c].num++; else cont[c].txt++;
    }
    if (cn < 0) cn = cols.reduce((b, c) => (cont[c].txt > cont[b].txt ? c : b), 0);
    if (cv < 0) cv = cols.reduce((b, c) => (c !== cn && cont[c].num > (cont[b]?.num ?? -1) ? c : b), cn === 0 ? Math.min(1, ncols - 1) : 0);
    // Cabeçalho provável: a 1ª linha da coluna de valor não é número.
    const temCab = !ehNumerico((linhas[0] ?? [])[cv]);
    return { cn: Math.max(0, cn), cv: Math.max(0, cv), temCab };
  }, [linhas]); // eslint-disable-line react-hooks/exhaustive-deps

  const [colNome, setColNome] = useState(auto.cn);
  const [colValor, setColValor] = useState(auto.cv);
  const [pulaCab, setPulaCab] = useState(auto.temCab);
  const [competencia, setCompetencia] = useState(competenciaInicial);

  const casar = useMemo(() => criarCasadorDeNomes(colaboradores), [colaboradores]);
  const previa = useMemo(() => {
    const dados = pulaCab ? linhas.slice(1) : linhas;
    const casados: { nome: string; id: string; valor: number }[] = [];
    const naoCasados: string[] = [];
    for (const l of dados) {
      const nome = String(l[colNome] ?? "").trim();
      const valor = valorBR(l[colValor]);
      if (!nome || valor <= 0) continue;
      const id = casar(nome);
      if (id) casados.push({ nome, id, valor }); else naoCasados.push(nome);
    }
    return { casados, naoCasados, total: casados.reduce((a, c) => a + c.valor, 0) };
  }, [linhas, colNome, colValor, pulaCab, casar]);

  const substituir = contarSubstituir(tipo, competencia);

  const aplicar = () => {
    const lote = Date.now().toString(36);
    const registros: Pagamento[] = previa.casados.map((c, i) => ({
      id: `pg_imp_${lote}_${i}`,
      colaboradorId: c.id,
      competencia,
      tipo,
      valor: Math.round(c.valor * 100) / 100,
      dataPagamento: `${competencia}-20`,
    }));
    onAplicar(registros, tipo, competencia);
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={titulo}
      descricao="Confira as colunas e a prévia; só os nomes que casarem com colaboradores serão lançados."
      largura="max-w-2xl"
      rodape={<>
        <button className="btn-outline" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary disabled:opacity-50" disabled={previa.casados.length === 0} onClick={aplicar}>
          <Coins className="h-4 w-4" /> Lançar {previa.casados.length} em {compLabelLongo(competencia)}
        </button>
      </>}
    >
      <div className="space-y-4">
        {/* Mapeamento de colunas + competência */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Coluna do nome</span>
            <Select value={colNome} onChange={(e) => setColNome(Number(e.target.value))}>
              {cols.map((c) => <option key={c} value={c}>{letra(c)} · {amostra(c).slice(0, 16) || "(vazia)"}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Coluna do valor</span>
            <Select value={colValor} onChange={(e) => setColValor(Number(e.target.value))}>
              {cols.map((c) => <option key={c} value={c}>{letra(c)} · {amostra(c).slice(0, 16) || "(vazia)"}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Competência</span>
            <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)}>
              {competencias.map((c) => <option key={c} value={c}>{compLabelLongo(c)}</option>)}
            </Select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={pulaCab} onChange={(e) => setPulaCab(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          A primeira linha é cabeçalho (ignorar)
        </label>

        {/* Resumo */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-green-700"><Check className="h-4 w-4" /> {previa.casados.length} casaram</span>
          <span className="text-slate-400">·</span>
          <span className="flex items-center gap-1.5 font-medium text-amber-700"><UserX className="h-4 w-4" /> {previa.naoCasados.length} sem match</span>
          <span className="ml-auto font-semibold text-brand-ink">Total: {formatBRL(previa.total)}</span>
        </div>
        {substituir > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Já existem {substituir} lançamento(s) de <strong>{tipo}</strong> em {compLabelLongo(competencia)} — serão substituídos por esta importação.
          </p>
        )}

        {/* Prévia de quem casou */}
        {previa.casados.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="th">Nome na lista</th><th className="th">Colaborador</th><th className="th text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {previa.casados.map((c, i) => (
                  <tr key={i}>
                    <td className="td text-slate-500">{c.nome}</td>
                    <td className="td font-medium text-slate-700">{nomeColab(c.id)}</td>
                    <td className="td text-right tabular-nums">{formatBRL(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Não encontrados */}
        {previa.naoCasados.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="mb-1.5 text-xs font-semibold text-amber-800">Não encontrados (não serão lançados — confira o cadastro):</p>
            <div className="flex flex-wrap gap-1.5">
              {previa.naoCasados.map((n, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">{n}</span>)}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
