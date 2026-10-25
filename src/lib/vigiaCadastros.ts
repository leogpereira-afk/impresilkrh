/** Sinais contêm só uma revisão; o retrato vem pela API com suas permissões. */
export function criarVigiaCadastros(d: {
  atualizar: () => Promise<void>;
  podeAtualizar: () => boolean;
  observar: (sinal: () => void, conectado: (ok: boolean) => void) => () => void;
}) {
  let usuario: string | null = null, geracao = 0, falhas = 0;
  let limpar: (() => void) | undefined;
  let retentativa: ReturnType<typeof setTimeout> | undefined;
  const cancelar = () => {
    geracao++;
    clearTimeout(retentativa); retentativa = undefined;
    const antes = limpar; limpar = undefined; antes?.();
  };
  const conectar = () => {
    cancelar();
    if (!usuario) return;
    const vez = geracao;
    let agendado = false;
    const sinal = () => {
      if (vez !== geracao || agendado) return;
      agendado = true;
      queueMicrotask(() => {
        agendado = false;
        if (vez === geracao && d.podeAtualizar()) void d.atualizar();
      });
    };
    limpar = d.observar(sinal, ok => {
      if (vez !== geracao) return;
      if (ok) {
        clearTimeout(retentativa); retentativa = undefined; falhas = 0;
        sinal(); // recupera o intervalo em que o canal ficou desconectado
      } else if (!retentativa) {
        const espera = Math.min(1000 * 2 ** Math.min(falhas++, 5), 30000);
        retentativa = setTimeout(conectar, espera);
      }
    });
  };
  return {
    usuario(id: string | null) {
      if (usuario === id) return;
      usuario = id; falhas = 0; conectar();
    },
    reconectar() { falhas = 0; conectar(); },
    desconectar() { cancelar(); },
  };
}
