import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { Users, TrendingUp, ShieldCheck, GitBranch } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-ink p-12 text-white lg:flex lg:w-[46%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px, 64px 64px",
          }}
          aria-hidden
        />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" aria-hidden />
        <Logo className="relative" />

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Central de Gestão de Pessoas
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Colaboradores, plano de carreira, desempenho e retenção em um só lugar.
            Solidez e organização para quem vive de comunicação visual há mais de 40
            anos.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {[
              { icon: Users, t: "Cadastro completo e organograma navegável" },
              { icon: GitBranch, t: "Plano de carreira por níveis e faixas salariais" },
              { icon: TrendingUp, t: "Avaliação de desempenho e matriz 9-box" },
              { icon: ShieldCheck, t: "Conformidade com a LGPD em dados sensíveis" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-gold-200" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Impresilk Comunicação Visual · Montes Claros/MG
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h2 className="text-xl font-semibold text-brand-ink">Acessar o sistema</h2>
          <p className="mt-1 mb-6 text-sm text-slate-500">
            Entre com suas credenciais corporativas.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
