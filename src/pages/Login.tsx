import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { LogIn, Eye, EyeOff, User, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import type { Perfil } from "@/data/types";
import { useDominio } from "@/lib/dominio";
import { useColecao } from "@/lib/store";
import { MASTER_COLAB_ID } from "@/lib/rbac";
import { SENHA_DEMO, entrar, useSessao } from "@/lib/session";
import { MODO_JWT, loginServidor, ErroAuth } from "@/lib/auth";

const normalizar = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export default function Login() {
  const navigate = useNavigate();
  const sessao = useSessao();
  const { colaboradores } = useDominio();
  const { items: usuarios } = useColecao("usuarios");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Quem pode entrar: colaboradores ativos (inclui diretoria). O perfil de acesso
  // vem do próprio cadastro de cada pessoa.
  const pessoas = useMemo(() => colaboradores.filter((c) => c.statusId !== "inativo"), [colaboradores]);

  if (sessao) return <Navigate to="/painel" replace />;

  // Resolve nome+senha pela base local (login antigo). Usado quando NÃO há login
  // por servidor, ou como degradação segura quando o servidor está fora do ar.
  const resolverLocal = (): { perfil: Perfil; colaboradorId: string } | { erro: string } => {
    const n = normalizar(nome);
    const exatos = pessoas.filter((c) => normalizar(c.nome) === n);
    let alvo = exatos.length === 1 ? exatos[0] : undefined;
    if (exatos.length > 1) {
      alvo = exatos.find((c) => usuarios.some((u) => u.ativo && u.colaboradorId === c.id));
      if (!alvo) return { erro: "Há mais de um colaborador com esse nome. Use o nome completo." };
    } else if (exatos.length === 0 && n.length >= 3) {
      const prefixo = pessoas.filter((c) => normalizar(c.nome).startsWith(n));
      if (prefixo.length === 1) alvo = prefixo[0];
      else if (prefixo.length > 1) {
        const comUsuario = prefixo.filter((c) => usuarios.some((u) => u.ativo && u.colaboradorId === c.id));
        if (comUsuario.length === 1) alvo = comUsuario[0];
        else return { erro: "Nome incompleto encontrou mais de uma pessoa. Digite o nome completo." };
      }
    }
    if (!alvo) return { erro: "Nome não encontrado. Digite seu nome completo como está cadastrado." };
    const usuario = usuarios.find((u) => u.ativo && u.colaboradorId === alvo!.id);
    const senhaUsuario = usuario?.senha?.trim();
    const ok = senha === SENHA_DEMO || (!!senhaUsuario && senha === senhaUsuario);
    if (!ok) return { erro: "Senha incorreta." };
    const perfil = alvo.id === MASTER_COLAB_ID ? "ADMIN_RH" : (usuario?.perfil ?? alvo.perfil ?? "COLABORADOR");
    return { perfil, colaboradorId: alvo.id };
  };
  const entrarLocal = (): boolean => {
    const r = resolverLocal();
    if ("erro" in r) { setErro(r.erro); return false; }
    entrar(r.perfil, r.colaboradorId);
    navigate("/painel");
    return true;
  };

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    // Login real (servidor confere a senha e emite o crachá). Se o servidor
    // estiver indisponível/sem internet, cai no login local para não travar.
    if (MODO_JWT) {
      setEntrando(true);
      try {
        await loginServidor(nome, senha);
        navigate("/painel");
      } catch (err) {
        if (err instanceof ErroAuth && err.tipo === "credencial") setErro(err.message || "Senha incorreta.");
        else if (!entrarLocal()) setErro("Sem conexão para entrar agora. Tente novamente com internet.");
      } finally {
        setEntrando(false);
      }
      return;
    }
    entrarLocal();
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
          <p className="mt-1.5 text-sm text-slate-500">Informe seu nome e sua senha.</p>

          <form onSubmit={submeter} className="mt-7 space-y-5">
            <label className="block">
              <span className="label">Nome</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setErro(""); }}
                  placeholder="Digite seu nome"
                  autoFocus
                  autoComplete="off"
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
                />
                <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              Entre com seu nome e a sua senha. Esqueceu a senha? Fale com o RH para redefinir no Painel de Controle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
