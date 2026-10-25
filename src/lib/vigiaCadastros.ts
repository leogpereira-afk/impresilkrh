/** Sinais contêm só uma revisão; o retrato vem pela API com suas permissões. */
export function criarVigiaCadastros(d: {
  atualizar: () => Promise<void>;
  podeAtualizar: () => boolean;
  observar: (sinal: () => void, conectado: () => void) => () => void;
}) {
  let usuario: string | null = null, geracao = 0;
  let limpar: (() => void) | undefined;
  return {
    usuario(id: string | null) {
      if (usuario === id) return;
      usuario = id; const vez = ++geracao;
      limpar?.(); limpar = undefined;
      if (!id) return;
      let agendado = false;
      const sinal = () => {
        if (vez !== geracao || agendado) return;
        agendado = true;
        queueMicrotask(() => {
          agendado = false;
          if (vez === geracao && d.podeAtualizar()) void d.atualizar();
        });
      };
      limpar = d.observar(sinal, sinal);
    },
  };
}
