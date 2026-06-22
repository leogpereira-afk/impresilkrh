"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { entrar, type LoginState } from "@/app/login/actions";
import { AlertCircle, LogIn, ShieldCheck } from "lucide-react";

const ATALHOS = [
  { rotulo: "RH (Administrador)", email: "rh@impresilk.com.br" },
  { rotulo: "Gestor — Operações", email: "pedro.goncalves@impresilk.com.br" },
  { rotulo: "Gestor — Montagem", email: "saulo.ferreira@impresilk.com.br" },
  { rotulo: "Colaborador", email: "bruno.nascimento@impresilk.com.br" },
];

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      <LogIn className="h-4 w-4" />
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(entrar, {});
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("Impresilk@2026");

  return (
    <div className="w-full">
      <form action={formAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            E-mail corporativo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            className="input"
            placeholder="seu.nome@impresilk.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>

        {state.erro && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.erro}
          </div>
        )}

        <BotaoEntrar />
      </form>

      <div className="mt-6">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
          Acessos de demonstração
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => setEmail(a.email)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="block font-medium text-slate-700">{a.rotulo}</span>
              <span className="block truncate text-[11px] text-slate-400">
                {a.email}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Senha padrão de demonstração: Impresilk@2026
        </p>
      </div>
    </div>
  );
}
