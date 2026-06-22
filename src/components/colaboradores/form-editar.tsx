"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { NIVEIS_RISCO } from "@/lib/constants";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Salvando…" : "Salvar alterações"}
    </button>
  );
}

interface Valores {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCep: string | null;
  conjugeNome: string | null;
  qtdFilhos: number;
  valeTransporte: boolean;
  cargoId: string | null;
  areaId: string | null;
  nivelId: string | null;
  statusId: string | null;
  gestorId: string | null;
  salario: number | null;
  riscoSaida: string | null;
  potencial: string | null;
}

export function FormEditarColaborador({
  action,
  valores,
  areas,
  cargos,
  niveis,
  statuses,
  gestores,
}: {
  action: (fd: FormData) => Promise<{ erro?: string } | void>;
  valores: Valores;
  areas: { id: string; nome: string }[];
  cargos: { id: string; nome: string; area: string }[];
  niveis: { id: string; codigo: string; senioridade: string }[];
  statuses: { id: string; nome: string }[];
  gestores: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const v = valores;

  async function wrapper(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
  }

  return (
    <form action={wrapper} className="space-y-6">
      <input type="hidden" name="id" value={v.id} />

      {/* Dados pessoais */}
      <section>
        <p className="mb-3 text-sm font-semibold text-slate-700">Dados pessoais</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome completo *</label>
            <input name="nome" required defaultValue={v.nome} className="input" />
          </div>
          <div><label className="label">E-mail</label><input name="email" type="email" defaultValue={v.email ?? ""} className="input" /></div>
          <div><label className="label">Telefone</label><input name="telefone" defaultValue={v.telefone ?? ""} className="input" /></div>
          <div><label className="label">CPF</label><input name="cpf" defaultValue={v.cpf ?? ""} className="input" placeholder="Somente números" /></div>
          <div><label className="label">Data de nascimento</label><input name="dataNascimento" type="date" defaultValue={v.dataNascimento ?? ""} className="input" /></div>
        </div>
      </section>

      {/* Endereço e família */}
      <section className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Endereço e família</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Rua</label><input name="enderecoRua" defaultValue={v.enderecoRua ?? ""} className="input" /></div>
          <div><label className="label">Número</label><input name="enderecoNumero" defaultValue={v.enderecoNumero ?? ""} className="input" /></div>
          <div><label className="label">Bairro</label><input name="enderecoBairro" defaultValue={v.enderecoBairro ?? ""} className="input" /></div>
          <div><label className="label">CEP</label><input name="enderecoCep" defaultValue={v.enderecoCep ?? ""} className="input" /></div>
          <div><label className="label">Cônjuge</label><input name="conjugeNome" defaultValue={v.conjugeNome ?? ""} className="input" /></div>
          <div><label className="label">Nº de filhos</label><input name="qtdFilhos" type="number" min="0" defaultValue={v.qtdFilhos} className="input" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="valeTransporte" defaultChecked={v.valeTransporte} className="rounded border-slate-300" />
            Recebe vale-transporte
          </label>
        </div>
      </section>

      {/* Dados profissionais */}
      <section className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Dados profissionais</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Cargo</label>
            <select name="cargoId" defaultValue={v.cargoId ?? ""} className="input">
              <option value="">Selecione…</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.area}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Área (se sem cargo)</label>
            <select name="areaId" defaultValue={v.areaId ?? ""} className="input">
              <option value="">Selecione…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nível</label>
            <select name="nivelId" defaultValue={v.nivelId ?? ""} className="input">
              <option value="">Selecione…</option>
              {niveis.map((n) => <option key={n.id} value={n.id}>{n.codigo} · {n.senioridade}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="statusId" defaultValue={v.statusId ?? ""} className="input">
              <option value="">Selecione…</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Gestor</label>
            <select name="gestorId" defaultValue={v.gestorId ?? ""} className="input">
              <option value="">Sem gestor</option>
              {gestores.filter((g) => g.id !== v.id).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Data de admissão</label><input name="dataAdmissao" type="date" defaultValue={v.dataAdmissao ?? ""} className="input" /></div>
          <div><label className="label">Salário</label><input name="salario" defaultValue={v.salario ?? ""} className="input" placeholder="0,00" /></div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Mudanças de cargo, nível ou salário geram automaticamente um registro no histórico.
        </p>
      </section>

      {/* Retenção */}
      <section className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Retenção (matriz 9-Box)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Risco de saída</label>
            <select name="riscoSaida" defaultValue={v.riscoSaida ?? "Baixo"} className="input">
              {NIVEIS_RISCO.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Potencial</label>
            <select name="potencial" defaultValue={v.potencial ?? "Médio"} className="input">
              {NIVEIS_RISCO.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Desligamento */}
      <section className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Desligamento</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Data de desligamento</label>
            <input name="dataDesligamento" type="date" defaultValue={v.dataDesligamento ?? ""} className="input" />
            <p className="mt-1 text-xs text-slate-400">Preencha apenas em caso de desligamento. Lembre de ajustar o status.</p>
          </div>
        </div>
      </section>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Salvar />
      </div>
    </form>
  );
}
