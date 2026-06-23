import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { GlossarioComportamental } from "@/components/comportamental/glossario";

export default function Comportamental() {
  const [params] = useSearchParams();
  const foco = params.get("perfil"); // ex.: vindo da ficha de um colaborador

  return (
    <div>
      <PageHeader
        title="Guia Comportamental"
        description="Perfis, clima, aprendizagem, motivação e risco — como identificar e como lidar com cada pessoa (e consigo mesmo)."
      />
      <GlossarioComportamental focoPerfil={foco} />
    </div>
  );
}
