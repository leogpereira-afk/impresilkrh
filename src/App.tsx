import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { useSessao } from "@/lib/session";
import Login from "@/pages/Login";

function Protegido({ children }: { children: React.ReactNode }) {
  const sessao = useSessao();
  if (!sessao) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Protegido>
              <AppShell />
            </Protegido>
          }
        >
          <Route path="/painel" element={<div className="text-sm text-slate-500">Painel em construção…</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Routes>
    </ToastProvider>
  );
}
