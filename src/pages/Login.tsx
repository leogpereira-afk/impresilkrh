import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { SENHA_DEMO } from "@/data/seed";

const ATALHOS = [
  { id: "larissa-andrade-souza", rotulo: "RH (Administrador)" },
  { id: "pedro-henrique-goncalves", rotulo: "Gestor — Operações" },
  { id: "saulo-rodrigues-ferreira", rotulo: "Gestor — Montagem" },
  { id: "bruno-dias-do-nascimento", rotulo: "Colaborador" },
];

export function Login() {
  const { entrar } = useAuth();
  const { db } = useStore();
  const nav = useNavigate();
  const [sel, setSel] = useState("larissa-andrade-souza");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== SENHA_DEMO) { setErro("Senha incorreta."); return; }
    const c = db.colaboradores.find((x) => x.id === sel);
    const u = db.usuarios.find((x) => x.colaboradorId === sel);
    if (!c || !u) { setErro("Usuário não encontrado."); return; }
    entrar({ colaboradorId: c.id, perfil: u.perfil, nome: c.nome });
    nav("/");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-ink p-12 text-white lg:flex">
        <div className="text-2xl font-bold tracking-tight">impresilk<span className="text-gold">.</span> <span className="ml-1 text-xs uppercase tracking-widest text-slate-400">Comunicação Visual</span></div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Gestão de Pessoas</h1>
          <p className="mt-3 max-w-sm text-slate-300">Centralize colaboradores, carreira, comunicação e procedimentos — leve, rápido e sem complicação.</p>
        </div>
        <p className="text-xs text-slate-500">© Impresilk · 40+ anos de mercado</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden text-2xl font-bold text-brand-ink">impresilk<span className="text-gold">.</span></div>
          <div>
            <h2 className="text-xl font-semibold text-brand-ink">Acessar o sistema</h2>
            <p className="mt-1 text-sm text-slate-500">Selecione um perfil de demonstração.</p>
          </div>
          <div>
            <label className="label">Perfil / usuário</label>
            <select value={sel} onChange={(e) => setSel(e.target.value)} className="input">
              {ATALHOS.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="input" placeholder="••••••••" />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button type="submit" className="btn-primary w-full">Entrar</button>
          <p className="text-center text-xs text-slate-400">Senha de demonstração: <span className="font-mono">{SENHA_DEMO}</span></p>
        </form>
      </div>
    </div>
  );
}
