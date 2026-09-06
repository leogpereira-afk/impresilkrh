import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { LogIn, Eye, EyeOff, User, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useSessao } from "@/lib/session";
import { MODO_JWT, loginServidor } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const sessao = useSessao();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  if (sessao) return <Navigate to="/painel" replace />;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando) return;
    setErro("");
    setEntrando(true);
    try {
      if (!MODO_JWT) throw new Error("O acesso ao servidor não está configurado. Fale com a administração.");
      await loginServidor(nome.trim(), senha, lembrar);
      navigate("/painel");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally { setEntrando(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Apresentação */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-ink via-brand to-brand-light p-14 text-white lg:flex">
        <Logo variant="white" className="h-14 w-auto max-w-[280px] self-start object-contain animate-fade-in" />
        <div className="max-w-md animate-slide-up">
          <h1 className="text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
            Gestão de pessoas, centralizada e sob controle.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-brand-100">
            Colaboradores, carreira, desempenho, férias, conformidade e comunicação interna — tudo
            em um só lugar, com a clareza que a Impresilk constrói há mais de 40 anos.
          </p>
        </div>
        <p className="text-xs tracking-wide text-brand-200">Impresilk Soluções Visuais · Montes Claros/MG</p>
        <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-brand-300/10 blur-3xl" />
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md animate-scale-in rounded-3xl bg-white p-8 shadow-soft ring-1 ring-slate-100 sm:p-10">
          <div className="mb-7 flex justify-center">
            <Logo variant="color" className="h-14 w-auto max-w-[220px] object-contain" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Acessar o sistema</h2>
          <p className="mt-1.5 text-sm text-slate-500">O mesmo usuário e a mesma senha dos outros sistemas.</p>

          <form onSubmit={submeter} className="mt-7 space-y-5">
            <label className="block">
              <span className="label">Usuário ou nome completo</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setErro(""); }}
                  placeholder="ex.: leonardo"
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="label">Senha</span>
              <div className="relative">
                <input
                  type={verSenha ? "text" : "password"}
                  className="input pr-10"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErro(""); }}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                />
                <button type="button" aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVerSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {/* "Manter conectado" é sobre a SESSÃO durar mais (30 dias parados
                em vez de 12 horas), não sobre guardar a senha. A frase de baixo
                diz isso em português: quem lê "salvar login" costuma imaginar a
                senha gravada, e é justamente o que não acontece. */}
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>
                Manter conectado neste aparelho
                <span className="block text-xs text-slate-400">
                  Entra direto por 30 dias. Só no seu computador — a senha não fica guardada, e “Sair” encerra na hora.
                </span>
              </span>
            </label>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button type="submit" className="btn-primary w-full" disabled={entrando}>
              {entrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Acesso</p>
            <p className="mt-1">
              Use o mesmo usuário dos outros sistemas (ex.: leonardo). O nome completo
            também funciona. Esqueceu a senha? Fale com a direção.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
