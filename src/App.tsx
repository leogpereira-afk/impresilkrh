import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Colaboradores } from "@/pages/Colaboradores";
import { ColaboradorDetalhe } from "@/pages/ColaboradorDetalhe";
import { Organograma } from "@/pages/Organograma";
import { Carreira } from "@/pages/Carreira";
import { Desempenho } from "@/pages/Desempenho";
import { Comunicacao } from "@/pages/Comunicacao";
import { Pops } from "@/pages/Pops";
import { Documentos } from "@/pages/Documentos";
import { MeuPerfil } from "@/pages/MeuPerfil";
import { PainelControle } from "@/pages/PainelControle";

function Protegida({ children, perfis }: { children: React.ReactNode; perfis?: string[] }) {
  const { sessao } = useAuth();
  const loc = useLocation();
  if (!sessao) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (perfis && !perfis.includes(sessao.perfil)) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protegida><Dashboard /></Protegida>} />
      <Route path="/colaboradores" element={<Protegida perfis={["ADMIN_RH", "GESTOR"]}><Colaboradores /></Protegida>} />
      <Route path="/colaboradores/:id" element={<Protegida><ColaboradorDetalhe /></Protegida>} />
      <Route path="/organograma" element={<Protegida perfis={["ADMIN_RH", "GESTOR"]}><Organograma /></Protegida>} />
      <Route path="/carreira" element={<Protegida><Carreira /></Protegida>} />
      <Route path="/desempenho" element={<Protegida><Desempenho /></Protegida>} />
      <Route path="/comunicacao" element={<Protegida><Comunicacao /></Protegida>} />
      <Route path="/pops" element={<Protegida><Pops /></Protegida>} />
      <Route path="/documentos" element={<Protegida><Documentos /></Protegida>} />
      <Route path="/meu-perfil" element={<Protegida><MeuPerfil /></Protegida>} />
      <Route path="/painel" element={<Protegida perfis={["ADMIN_RH"]}><PainelControle /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
