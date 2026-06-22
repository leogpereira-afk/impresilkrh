import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { useColecao } from "@/lib/store";
import { useDominio, enquadrar } from "@/lib/dominio";
import { useToast } from "@/components/ui/toast";
import { NIVEIS_RISCO } from "@/lib/constants";
import type { Colaborador } from "@/data/types";

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
    const enquadramento = cargo && form.salario != null ? enquadrar(form.salario, cargo.faixas) : form.enquadramento ?? null;
    const dados: Partial<Colaborador> = {
      ...form,
      refMin: cargo?.faixas[0] ?? form.refMin ?? null,
      refMax: cargo?.faixas[4] ?? form.refMax ?? null,
      enquadramento,
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
        <Campo label="Bairro"><Input value={form.enderecoBairro ?? ""} onChange={(e) => set({ enderecoBairro: e.target.value })} /></Campo>
      </div>
    </Modal>
  );
}
