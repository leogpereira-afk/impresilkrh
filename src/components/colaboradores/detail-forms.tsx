"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { CATEGORIAS_DOCUMENTO, TIPOS_MOVIMENTACAO } from "@/lib/constants";

function BotaoSalvar({ label = "Salvar" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Salvando…" : label}
    </button>
  );
}

function Disclosure({
  rotulo,
  children,
}: {
  rotulo: string;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-outline flex items-center gap-2 text-sm">
        <Plus className="h-4 w-4" /> {rotulo}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">{rotulo}</h4>
        <button onClick={() => setAberto(false)} className="btn-ghost p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children(() => setAberto(false))}
    </div>
  );
}

function useFormReset(action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function wrapper(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
    else ref.current?.reset();
  }
  return { ref, erro, wrapper };
}

export function FormDocumento({
  colaboradorId,
  action,
}: {
  colaboradorId: string;
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const { ref, erro, wrapper } = useFormReset(action);
  return (
    <Disclosure rotulo="Adicionar documento">
      {() => (
        <form ref={ref} action={wrapper} className="space-y-3">
          <input type="hidden" name="colaboradorId" value={colaboradorId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Categoria</label>
              <select name="categoria" className="input">
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nome do documento *</label>
              <input name="nome" required className="input" placeholder="Ex.: ASO Admissional" />
            </div>
            <div>
              <label className="label">Data de emissão</label>
              <input type="date" name="dataEmissao" className="input" />
            </div>
            <div>
              <label className="label">Data de vencimento</label>
              <input type="date" name="dataVencimento" className="input" />
            </div>
            <div>
              <label className="label">Arquivo (nome)</label>
              <input name="arquivoNome" className="input" placeholder="aso-admissional.pdf" />
            </div>
            <div>
              <label className="label">Observação</label>
              <input name="observacao" className="input" />
            </div>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <BotaoSalvar />
        </form>
      )}
    </Disclosure>
  );
}

export function FormFerias({
  colaboradorId,
  action,
}: {
  colaboradorId: string;
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const { ref, erro, wrapper } = useFormReset(action);
  return (
    <Disclosure rotulo="Registrar férias">
      {() => (
        <form ref={ref} action={wrapper} className="space-y-3">
          <input type="hidden" name="colaboradorId" value={colaboradorId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Início</label>
              <input type="date" name="dataInicio" className="input" />
            </div>
            <div>
              <label className="label">Retorno</label>
              <input type="date" name="dataRetorno" className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input">
                <option>Agendada</option>
                <option>Em andamento</option>
                <option>Concluída</option>
                <option>Em aberto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observação</label>
            <input name="observacao" className="input" />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <BotaoSalvar />
        </form>
      )}
    </Disclosure>
  );
}

export function FormMovimentacao({
  colaboradorId,
  action,
}: {
  colaboradorId: string;
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const { ref, erro, wrapper } = useFormReset(action);
  return (
    <Disclosure rotulo="Registrar movimentação">
      {() => (
        <form ref={ref} action={wrapper} className="space-y-3">
          <input type="hidden" name="colaboradorId" value={colaboradorId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tipo *</label>
              <select name="tipo" required className="input">
                {TIPOS_MOVIMENTACAO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" name="data" className="input" />
            </div>
            <div>
              <label className="label">Novo cargo</label>
              <input name="cargoNovo" className="input" />
            </div>
            <div>
              <label className="label">Novo nível</label>
              <input name="nivelNovo" className="input" placeholder="N3" />
            </div>
            <div>
              <label className="label">Novo salário</label>
              <input name="salarioNovo" className="input" placeholder="0,00" />
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input name="descricao" className="input" />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <BotaoSalvar />
        </form>
      )}
    </Disclosure>
  );
}
