import { useRef, useState } from "react";
import type { Freelancer } from "@/data/types";
import { useColecao } from "@/lib/store";
import { comprimirImagem } from "@/lib/imagem";
import { origemFotoFreelancer } from "@/lib/fotoFreelancer";
import { Avatar } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function FotoFreelancer({ contrato, fechar }: { contrato: Freelancer; fechar: () => void }) {
  const fichas = useColecao("colaboradores");
  const contratos = useColecao("freelancers");
  const atual = contratos.items.find((c) => c.id === contrato.id);
  const origem = origemFotoFreelancer(atual ?? contrato, fichas.items);
  const [foto, setFoto] = useState<string | null | undefined>();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const versao = useRef(0);
  const toast = useToast();
  // Uma troca de CPF ou vínculo enquanto o editor está aberto exige reabrir.
  const destinoInicial = useRef(`${origem.colecao}:${origem.id}`);
  const mudouDestino = destinoInicial.current !== `${origem.colecao}:${origem.id}`;
  const bloqueado = !atual || origem.ambiguo || mudouDestino;

  const selecionar = async (arquivo?: File) => {
    if (!arquivo) return;
    const pedido = ++versao.current;
    setErro("");
    setProcessando(false);
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return setErro("Escolha uma foto JPG, PNG ou WebP.");
    if (arquivo.size > 8 * 1024 * 1024) return setErro("A foto deve ter até 8 MB.");
    setProcessando(true);
    try {
      const resultado = await comprimirImagem(arquivo);
      if (pedido !== versao.current) return;
      if (resultado.length >= 200000) throw new Error("foto grande");
      setFoto(resultado);
    } catch {
      if (pedido === versao.current) setErro("Não foi possível preparar a foto. Tente outra imagem.");
    } finally {
      if (pedido === versao.current) setProcessando(false);
    }
  };

  const salvar = () => {
    if (bloqueado || processando || foto === undefined) return;
    try {
      (origem.colecao === "colaboradores" ? fichas : contratos).atualizar(origem.id, { fotoDataUrl: foto });
      toast("Foto salva no RH. Acompanhe a sincronização em Nuvem.");
      fechar();
    } catch {
      setErro("Não foi possível salvar. Sua foto continua aqui para tentar novamente.");
    }
  };

  return <Modal aberto onFechar={fechar} titulo={`Foto de ${contrato.nome}`} largura="max-w-md"
    rodape={<><button className="btn-ghost" onClick={fechar}>Cancelar</button>
      <button className="btn-primary" disabled={bloqueado || processando || foto === undefined} onClick={salvar}>Salvar foto</button></>}>
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Avatar nome={contrato.nome} foto={foto === undefined ? origem.foto : foto} size="lg" />
        <p className="text-sm text-slate-600">A mesma foto identifica esta pessoa no RH e nos sistemas conectados após a sincronização.</p></div>
      {bloqueado ? <p role="alert" className="text-sm text-amber-800">O vínculo do cadastro precisa ser conferido. Feche esta janela e confira a ficha antes de alterar a foto.</p> : <>
        <label className="block space-y-2 text-sm font-medium">Escolher foto
          <input className="block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { void selecionar(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="text-xs text-slate-500">JPG, PNG ou WebP, até 8 MB. {origem.colecao === "colaboradores" ? "A foto é compartilhada com a ficha em Colaboradores." : "A foto fica no cadastro deste freelancer."}</p>
        {(foto === undefined ? origem.foto : foto) && <button className="btn-ghost text-red-600" onClick={() => { ++versao.current; setProcessando(false); setErro(""); setFoto(null); }}>Remover foto</button>}
      </>}
      {processando && <p role="status" className="text-sm text-slate-500">Preparando foto…</p>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    </div>
  </Modal>;
}
