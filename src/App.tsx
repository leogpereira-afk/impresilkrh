import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { useSessao } from "@/lib/session";
import type { Perfil } from "@/data/types";
import { EmptyState } from "@/components/ui/misc";
import { Lock } from "lucide-react";

import Login from "@/pages/Login";

// Code-splitting: cada módulo carrega sob demanda (abertura instantânea, bundle enxuto).
const Painel = lazy(() => import("@/pages/Painel"));
const Colaboradores = lazy(() => import("@/pages/Colaboradores"));
const ColaboradorFicha = lazy(() => import("@/pages/ColaboradorFicha"));
const Organograma = lazy(() => import("@/pages/Organograma"));
const Carreira = lazy(() => import("@/pages/Carreira"));
const Desempenho = lazy(() => import("@/pages/Desempenho"));
const Ferias = lazy(() => import("@/pages/Ferias"));
const Integracao = lazy(() => import("@/pages/Integracao"));
const Viagens = lazy(() => import("@/pages/Viagens"));
const Comunicacao = lazy(() => import("@/pages/Comunicacao"));
const Pops = lazy(() => import("@/pages/Pops"));
const Documentos = lazy(() => import("@/pages/Documentos"));
const SST = lazy(() => import("@/pages/SST"));
const MeuPerfil = lazy(() => import("@/pages/MeuPerfil"));
const Aceites = lazy(() => import("@/pages/Aceites"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const PainelControle = lazy(() => import("@/pages/PainelControle"));
const LGPD = lazy(() => import("@/pages/LGPD"));
const Ponto = lazy(() => import("@/pages/Ponto"));
const Mensagens = lazy(() => import("@/pages/Mensagens"));
const Treinamento = lazy(() => import("@/pages/Treinamento"));

function Protegido({ children }: { children: React.ReactNode }) {
  const sessao = useSessao();
  if (!sessao) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Restrito({ perfis, children }: { perfis: Perfil[]; children: React.ReactNode }) {
  const sessao = useSessao();
  if (!sessao || !perfis.includes(sessao.perfil)) {
    return <EmptyState title="Acesso restrito" description="Você não tem permissão para acessar esta página." icon={<Lock className="h-8 w-8" />} />;
  }
  return <>{children}</>;
}

function Carregando() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
    </div>
  );
}

const GESTAO: Perfil[] = ["ADMIN_RH", "GESTOR"];
const RH: Perfil[] = ["ADMIN_RH"];

export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protegido><AppShell /></Protegido>}>
            <Route path="/painel" element={<Painel />} />
            <Route path="/colaboradores" element={<Restrito perfis={GESTAO}><Colaboradores /></Restrito>} />
            <Route path="/colaboradores/:id" element={<ColaboradorFicha />} />
            <Route path="/organograma" element={<Organograma />} />
            <Route path="/carreira" element={<Restrito perfis={RH}><Carreira /></Restrito>} />
            <Route path="/desempenho" element={<Desempenho />} />
            <Route path="/treinamento" element={<Restrito perfis={GESTAO}><Treinamento /></Restrito>} />
            <Route path="/ponto" element={<Restrito perfis={GESTAO}><Ponto /></Restrito>} />
            <Route path="/ferias" element={<Restrito perfis={GESTAO}><Ferias /></Restrito>} />
            <Route path="/integracao" element={<Restrito perfis={GESTAO}><Integracao /></Restrito>} />
            <Route path="/viagens" element={<Restrito perfis={GESTAO}><Viagens /></Restrito>} />
            <Route path="/comunicacao" element={<Comunicacao />} />
          <Route path="/mensagens" element={<Restrito perfis={GESTAO}><Mensagens /></Restrito>} />
            <Route path="/pops" element={<Pops />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/sst" element={<Restrito perfis={GESTAO}><SST /></Restrito>} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />
            <Route path="/aceites" element={<Aceites />} />
            <Route path="/relatorios" element={<Restrito perfis={RH}><Relatorios /></Restrito>} />
            <Route path="/painel-controle" element={<Restrito perfis={RH}><PainelControle /></Restrito>} />
            <Route path="/lgpd" element={<Restrito perfis={RH}><LGPD /></Restrito>} />
          </Route>
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
