"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Cadastrando…" : "Cadastrar colaborador"}
    </button>
  );
}

export function FormNovoColaborador({
  action,
  areas,
  cargos,
  niveis,
  statuses,
  gestores,
}: {
  action: (fd: FormData) => Promise<{ erro?: string } | void>;
  areas: { id: string; nome: string }[];
  cargos: { id: string; nome: string; area: string }[];
  niveis: { id: string; codigo: string; senioridade: string }[];
  statuses: { id: string; nome: string }[];
  gestores: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | null>(null);

  async function wrapper(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
  }

  return (
    <form action={wrapper} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome completo *</label>
          <input name="nome" required className="input" placeholder="Nome do colaborador" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input name="email" type="email" className="input" />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input name="telefone" className="input" />
        </div>
        <div>
          <label className="label">CPF</label>
          <input name="cpf" className="input" placeholder="Somente números" />
        </div>
        <div>
          <label className="label">Data de nascimento</label>
          <input name="dataNascimento" type="date" className="input" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Dados profissionais</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Cargo</label>
            <select name="cargoId" className="input">
              <option value="">Selecione…</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome} — {c.area}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Área (se sem cargo)</label>
            <select name="areaId" className="input">
              <option value="">Selecione…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nível</label>
            <select name="nivelId" className="input">
              <option value="">Selecione…</option>
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>{n.codigo} · {n.senioridade}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="statusId" className="input">
              <option value="">Selecione…</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Gestor</label>
            <select name="gestorId" className="input">
              <option value="">Sem gestor</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Data de admissão</label>
            <input name="dataAdmissao" type="date" className="input" />
          </div>
          <div>
            <label className="label">Salário</label>
            <input name="salario" className="input" placeholder="0,00" />
          </div>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end">
        <Salvar />
      </div>
    </form>
  );
}
