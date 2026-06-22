import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Users, UserCircle, LogIn, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useDominio } from "@/lib/dominio";
import { SENHA_DEMO, entrar, useSessao } from "@/lib/session";
import type { Perfil } from "@/data/types";
import { cn } from "@/lib/cn";
import { Navigate } from "react-router-dom";

const PERFIS: { id: Perfil; titulo: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ADMIN_RH", titulo: "Administrador de RH", desc: "Acesso total e Painel de Controle.", icon: ShieldCheck },
  { id: "GESTOR", titulo: "Gestor", desc: "Gerencia apenas a sua equipe.", icon: Users },
  { id: "COLABORADOR", titulo: "Colaborador", desc: "Autoatendimento dos próprios dados.", icon: UserCircle },
];

export default function Login() {
  const navigate = useNavigate();
  const sessao = useSessao();
  const { colaboradores, colabById } = useDominio();
  const [perfil, setPerfil] = useState<Perfil>("ADMIN_RH");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");

  const rhId = "larissa-andrade-souza";
  const gestores = useMemo(
    () => colaboradores.filter((c) => c.perfil === "GESTOR" && c.statusId !== "inativo"),
    [colaboradores],
  );
  const colaboradoresAtivos = useMemo(
    () => colaboradores.filter((c) => !c.ehDirecao && c.statusId !== "inativo"),
    [colaboradores],
  );

  const [gestorId, setGestorId] = useState(gestores[0]?.id ?? "");
  const [pessoaId, setPessoaId] = useState("bruno-dias-do-nascimento");

  if (sessao) return <Navigate to="/painel" replace />;

  const alvoId = perfil === "ADMIN_RH" ? rhId : perfil === "GESTOR" ? gestorId : pessoaId;

  const submeter = (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== SENHA_DEMO) {
      setErro("Senha incorreta. Use a senha de demonstração.");
      return;
    }
    const id = alvoId && colabById.get(alvoId) ? alvoId : rhId;
    entrar(perfil, id);
    navigate("/painel");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-ink via-brand to-brand-light lg:flex-row">
      {/* Apresentação */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <Logo variant="light" />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Gestão de pessoas, centralizada e sob controle.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">
            Colaboradores, carreira, desempenho, férias, conformidade e comunicação interna — tudo
            em um só lugar, com a clareza que a Impresilk constrói há mais de 40 anos.
          </p>
        </div>
        <p className="text-xs text-brand-200">Impresilk Comunicação Visual · Montes Claros/MG</p>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
          <div className="mb-6 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h2 className="text-lg font-semibold text-brand-ink">Acessar o sistema</h2>
          <p className="mt-1 text-sm text-slate-500">Selecione o perfil de demonstração e informe a senha.</p>

          <form onSubmit={submeter} className="mt-6 space-y-5">
            <div className="grid gap-2">
              {PERFIS.map((p) => {
                const Icon = p.icon;
                const ativo = perfil === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setPerfil(p.id);
                      setErro("");
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                      ativo ? "border-brand bg-brand-50/60 ring-1 ring-brand" : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", ativo ? "bg-brand text-white" : "bg-slate-100 text-slate-500")}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{p.titulo}</span>
                      <span className="block text-xs text-slate-500">{p.desc}</span>
                    </span>
                    <span className={cn("h-4 w-4 rounded-full border-2", ativo ? "border-brand bg-brand" : "border-slate-300")} />
                  </button>
                );
              })}
            </div>

            {perfil === "GESTOR" && (
              <label className="block">
                <span className="label">Entrar como gestor</span>
                <select className="input" value={gestorId} onChange={(e) => setGestorId(e.target.value)}>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </select>
              </label>
            )}
            {perfil === "COLABORADOR" && (
              <label className="block">
                <span className="label">Entrar como colaborador</span>
                <select className="input" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                  {colaboradoresAtivos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="label">Senha</span>
              <div className="relative">
                <input
                  type={verSenha ? "text" : "password"}
                  className="input pr-10"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    setErro("");
                  }}
                  placeholder="Senha de demonstração"
                  autoFocus
                />
                <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button type="submit" className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> Entrar
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Ambiente de demonstração</p>
            <p className="mt-1">
              Senha: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-brand">{SENHA_DEMO}</code>. Os dados ficam
              somente neste navegador (localStorage); use Exportar/Importar para compartilhar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
