import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { useColecao } from "@/lib/store";
import { useDominio, enquadrar } from "@/lib/dominio";
import { useToast } from "@/components/ui/toast";
import { NIVEIS_RISCO, PERFIS_COMPORTAMENTAIS, HUMORES, ESTILOS_APRENDIZAGEM, EMPRESAS, CATEGORIAS_CNH } from "@/lib/constants";
import type { Colaborador, ContatoEmergencia } from "@/data/types";

const POTENCIAIS = ["Baixo", "Médio", "Alto"];

export function ColaboradorForm({
  aberto,
  onFechar,
  editar,
}: {
  aberto: boolean;
  onFechar: () => void;
  editar?: Colaborador | null;
}) {
  const toast = useToast();
  const d = useDominio();
  const { criar, atualizar } = useColecao("colaboradores");
  const { criar: criarMov } = useColecao("movimentacoes");

  const vazio: Partial<Colaborador> = {
    nome: "", areaId: "producao", statusId: "ativo", nivelId: "N1", qtdFilhos: 0,
    riscoSaida: "Baixo", potencial: "Médio", perfil: "COLABORADOR", valeTransporte: true,
  };
  const [form, setForm] = useState<Partial<Colaborador>>(editar ?? vazio);
  const set = (patch: Partial<Colaborador>) => setForm((f) => ({ ...f, ...patch }));

  const filhos = form.filhos ?? [];
  const addFilho = () => setForm((f) => ({ ...f, filhos: [...(f.filhos ?? []), { nome: "" }] }));
  const removeFilho = (i: number) => setForm((f) => ({ ...f, filhos: (f.filhos ?? []).filter((_, j) => j !== i) }));
  const setFilho = (i: number, patch: Partial<{ nome: string; nascimento: string }>) =>
    setForm((f) => {
      const arr = [...(f.filhos ?? [])];
      arr[i] = { ...arr[i], ...patch };
      return { ...f, filhos: arr };
    });
  const setEmergencia = (patch: Partial<ContatoEmergencia>) =>
    setForm((f) => ({
      ...f,
      contatoEmergencia: { nome: "", parentesco: "", telefone: "", ...f.contatoEmergencia, ...patch },
    }));

  const cargosArea = useMemo(
    () => d.cargos.filter((c) => c.areaId === form.areaId),
    [d.cargos, form.areaId],
  );
  const gestoresPossiveis = useMemo(
    () => d.colaboradores.filter((c) => c.id !== editar?.id),
    [d.colaboradores, editar],
  );

  const salvar = () => {
    if (!form.nome?.trim()) {
      toast("Informe o nome do colaborador.", "erro");
      return;
    }
    const cargo = form.cargoId ? d.cargoById.get(form.cargoId) : undefined;
    // Recalcula sempre que há cargo+salário; senão limpa (deixa o cálculo dinâmico assumir),
    // em vez de manter um enquadramento antigo "grudado".
    const enquadramento = cargo && form.salario != null ? enquadrar(form.salario, cargo.faixas) : null;
    const filhosLimpos = (form.filhos ?? []).filter((x) => x.nome?.trim());
    const ce = form.contatoEmergencia;
    const temContato = !!(ce && (ce.nome?.trim() || ce.telefone?.trim() || ce.parentesco?.trim()));
    const dados: Partial<Colaborador> = {
      ...form,
      filhos: filhosLimpos,
      qtdFilhos: filhosLimpos.length,
      contatoEmergencia: temContato ? ce : undefined,
      refMin: cargo?.faixas[0] ?? form.refMin ?? null,
      refMax: cargo?.faixas[4] ?? form.refMax ?? null,
      enquadramento,
      // Reativar (status ativo) limpa a data de desligamento para o colaborador
      // voltar a contar no quadro e o botão "Desligar" reaparecer.
      dataDesligamento: form.statusId === "ativo" ? null : (form.dataDesligamento ?? null),
    };

    if (editar) {
      atualizar(editar.id, dados);
      toast("Colaborador atualizado.");
    } else {
      const novo = criar(dados);
      if (form.dataAdmissao) {
        criarMov({
          colaboradorId: novo.id,
          tipo: "Admissão",
          data: form.dataAdmissao,
          descricao: `Admissão no cargo de ${cargo?.nome ?? "—"}.`,
          cargoNovo: cargo?.nome ?? null,
          nivelNovo: form.nivelId ?? null,
          salarioNovo: form.salario ?? null,
          registradoPor: "RH",
        });
      }
      toast("Colaborador cadastrado.");
    }
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={editar ? "Editar colaborador" : "Novo colaborador"}
      descricao="Dados pessoais e profissionais. O enquadramento é recalculado pela faixa do cargo."
      largura="max-w-2xl"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nome completo" obrigatorio className="sm:col-span-2">
          <Input value={form.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} />
        </Campo>
        <Campo label="CPF"><Input value={form.cpf ?? ""} onChange={(e) => set({ cpf: e.target.value })} placeholder="Somente números" /></Campo>
        <Campo label="E-mail"><Input value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></Campo>
        <Campo label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => set({ telefone: e.target.value })} /></Campo>
        <Campo label="Nascimento"><Input type="date" value={(form.dataNascimento ?? "").slice(0, 10)} onChange={(e) => set({ dataNascimento: e.target.value })} /></Campo>

        <Campo label="Área">
          <Select value={form.areaId ?? ""} onChange={(e) => set({ areaId: e.target.value, cargoId: null })}>
            {d.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Cargo">
          <Select value={form.cargoId ?? ""} onChange={(e) => set({ cargoId: e.target.value })}>
            <option value="">— selecione —</option>
            {cargosArea.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Nível">
          <Select value={form.nivelId ?? ""} onChange={(e) => set({ nivelId: e.target.value })}>
            {d.niveis.map((n) => <option key={n.id} value={n.id}>{n.codigo} · {n.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Salário (R$)"><Input type="number" step="0.01" value={form.salario ?? ""} onChange={(e) => set({ salario: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
        <Campo label="Admissão"><Input type="date" value={(form.dataAdmissao ?? "").slice(0, 10)} onChange={(e) => set({ dataAdmissao: e.target.value })} /></Campo>

        <Campo label="Gestor (reporta-se a)">
          <Select value={form.gestorId ?? ""} onChange={(e) => set({ gestorId: e.target.value || null })}>
            <option value="">— nenhum (topo) —</option>
            {gestoresPossiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Status">
          <Select value={form.statusId ?? ""} onChange={(e) => set({ statusId: e.target.value })}>
            {d.status.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Perfil de acesso">
          <Select value={form.perfil ?? "COLABORADOR"} onChange={(e) => set({ perfil: e.target.value as Colaborador["perfil"] })}>
            <option value="COLABORADOR">Colaborador</option>
            <option value="GESTOR">Gestor</option>
            <option value="ADMIN_RH">Administrador de RH</option>
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Risco de saída">
            <Select value={form.riscoSaida ?? "Baixo"} onChange={(e) => set({ riscoSaida: e.target.value })}>
              {NIVEIS_RISCO.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Campo>
          <Campo label="Potencial">
            <Select value={form.potencial ?? "Médio"} onChange={(e) => set({ potencial: e.target.value })}>
              {POTENCIAIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Campo>
        </div>

        <Campo label="Endereço (rua)"><Input value={form.enderecoRua ?? ""} onChange={(e) => set({ enderecoRua: e.target.value })} /></Campo>
        <Campo label="Número"><Input value={form.enderecoNumero ?? ""} onChange={(e) => set({ enderecoNumero: e.target.value })} placeholder="nº" /></Campo>
        <Campo label="Complemento"><Input value={form.enderecoComplemento ?? ""} onChange={(e) => set({ enderecoComplemento: e.target.value })} placeholder="Apto, bloco…" /></Campo>
        <Campo label="Bairro"><Input value={form.enderecoBairro ?? ""} onChange={(e) => set({ enderecoBairro: e.target.value })} /></Campo>
        <Campo label="CEP"><Input value={form.enderecoCep ?? ""} onChange={(e) => set({ enderecoCep: e.target.value })} /></Campo>
        <Campo label="Cidade"><Input value={form.cidade ?? ""} onChange={(e) => set({ cidade: e.target.value })} /></Campo>
        <Campo label="Cônjuge"><Input value={form.conjugeNome ?? ""} onChange={(e) => set({ conjugeNome: e.target.value })} /></Campo>
        <Campo label="Telefone do cônjuge"><Input value={form.conjugeTelefone ?? ""} onChange={(e) => set({ conjugeTelefone: e.target.value })} placeholder="(00) 00000-0000" /></Campo>
        <Campo label="Matrícula eSocial"><Input value={form.matriculaEsocial ?? ""} onChange={(e) => set({ matriculaEsocial: e.target.value })} /></Campo>
        <Campo label="Vale-transporte">
          <label className="flex h-[42px] items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.valeTransporte ?? false} onChange={(e) => set({ valeTransporte: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            Optante pelo vale-transporte
          </label>
        </Campo>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filhos</p>
          <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={addFilho}>+ Adicionar filho</button>
        </div>
        {filhos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum filho cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {filhos.map((f, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <Campo label="Nome"><Input value={f.nome ?? ""} onChange={(e) => setFilho(i, { nome: e.target.value })} /></Campo>
                <Campo label="Nascimento"><Input type="date" value={(f.nascimento ?? "").slice(0, 10)} onChange={(e) => setFilho(i, { nascimento: e.target.value })} /></Campo>
                <button type="button" className="btn-outline h-[42px] text-red-600" onClick={() => removeFilho(i)}>Remover</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contato de emergência</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Nome"><Input value={form.contatoEmergencia?.nome ?? ""} onChange={(e) => setEmergencia({ nome: e.target.value })} /></Campo>
          <Campo label="Parentesco"><Input value={form.contatoEmergencia?.parentesco ?? ""} onChange={(e) => setEmergencia({ parentesco: e.target.value })} placeholder="Cônjuge, Mãe…" /></Campo>
          <Campo label="Telefone"><Input value={form.contatoEmergencia?.telefone ?? ""} onChange={(e) => setEmergencia({ telefone: e.target.value })} placeholder="(00) 00000-0000" /></Campo>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Perfil comportamental & clima</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Empresa">
            <Select value={form.empresa ?? "Impresilk"} onChange={(e) => set({ empresa: e.target.value })}>
              {EMPRESAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Campo>
          <Campo label="Sexo">
            <Select value={form.sexo ?? ""} onChange={(e) => set({ sexo: e.target.value })}>
              <option value="">—</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </Select>
          </Campo>
          <Campo label="Perfil comportamental">
            <Select value={form.perfilComportamental ?? ""} onChange={(e) => set({ perfilComportamental: e.target.value })}>
              <option value="">—</option>
              {PERFIS_COMPORTAMENTAIS.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Campo>
          <Campo label="Humor / engajamento">
            <Select value={form.humor ?? ""} onChange={(e) => set({ humor: e.target.value })}>
              <option value="">—</option>
              {HUMORES.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Campo>
          <Campo label="Estilo de aprendizagem">
            <Select value={form.estiloAprendizagem ?? ""} onChange={(e) => set({ estiloAprendizagem: e.target.value })}>
              <option value="">—</option>
              {ESTILOS_APRENDIZAGEM.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Campo>
          <Campo label="Padrinho (mentor)">
            <Select value={form.padrinhoId ?? ""} onChange={(e) => set({ padrinhoId: e.target.value || null })}>
              <option value="">— nenhum —</option>
              {gestoresPossiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Campo>
          <Campo label="Subárea" hint="Financeiro, RH, Compras…">
            <Input value={form.subarea ?? ""} onChange={(e) => set({ subarea: e.target.value })} />
          </Campo>
          <Campo label="Motivação (0–100)" hint="Indicador interno de gestão">
            <Input type="number" min={0} max={100} value={form.motivacao ?? ""} onChange={(e) => set({ motivacao: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Campo>
          <Campo label="Início no cargo atual">
            <Input type="date" value={(form.dataInicioCargo ?? "").slice(0, 10)} onChange={(e) => set({ dataInicioCargo: e.target.value })} />
          </Campo>
          <Campo label="Categoria de CNH">
            <Select value={form.cnh ?? ""} onChange={(e) => set({ cnh: e.target.value })}>
              <option value="">—</option>
              {CATEGORIAS_CNH.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Campo>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Organização & financeiro</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Setor" hint="Agrupamento (pode espelhar a área)">
            <Input value={form.setor ?? ""} onChange={(e) => set({ setor: e.target.value })} />
          </Campo>
          <Campo label="Função (planilha)" hint="Função original quando não há cargo">
            <Input value={form.funcao ?? ""} onChange={(e) => set({ funcao: e.target.value })} />
          </Campo>
          <Campo label="Cargo livre (Direção)" hint="Rótulo p/ Direção sem cargo">
            <Input value={form.cargoLivre ?? ""} onChange={(e) => set({ cargoLivre: e.target.value })} />
          </Campo>
          <Campo label="Adicionais (R$)" hint="Benefícios — painel financeiro">
            <Input type="number" step="0.01" value={form.adicionais ?? ""} onChange={(e) => set({ adicionais: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Campo>
          <Campo label="Motivação anterior (0–100)" hint="Registro anterior (tendência)">
            <Input type="number" min={0} max={100} value={form.motivacaoAnterior ?? ""} onChange={(e) => set({ motivacaoAnterior: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Campo>
          <Campo label="É Direção?" hint="Fundador/diretor — não conta no headcount">
            <label className="flex h-[42px] items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.ehDirecao ?? false} onChange={(e) => set({ ehDirecao: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              Não contar como headcount
            </label>
          </Campo>
          <Campo label="Observação de enquadramento" className="sm:col-span-2 lg:col-span-3">
            <Input value={form.observacaoEnquadramento ?? ""} onChange={(e) => set({ observacaoEnquadramento: e.target.value })} placeholder="Notas sobre o enquadramento salarial" />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}
