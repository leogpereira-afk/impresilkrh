/** Sinal remoto invalida antes da consulta. Respostas antigas nunca reabrem acesso. */
export function criarVigiaAcesso<T>(d: {
  consultar: (id: string) => Promise<T | null>;
  suspender: () => void;
  aplicar: (perfil: T) => void;
  revogar: () => void;
  podeConferir: () => boolean;
  observar: (id: string, sinal: () => void, conectado: (ok: boolean) => void) => () => void;
}) {
  let usuario: string | null = null;
  let geracao = 0;
  let conectado = false;
  let limpar: (() => void) | undefined;
  const suspender = () => { geracao++; d.suspender(); };
  const conferir = async () => {
    suspender();
    const id = usuario, vez = geracao;
    if (!id || !d.podeConferir()) return;
    try {
      const perfil = await d.consultar(id);
      if (vez !== geracao || id !== usuario) return;
      if (!perfil) { d.revogar(); return; }
      if (conectado && d.podeConferir()) d.aplicar(perfil);
    } catch { /* Sem confirmação mantém os alertas ocultos. */ }
  };
  return {
    conferir, suspender,
    desconectar() { conectado = false; suspender(); },
    usuario(id: string | null) {
      if (id === usuario) { void conferir(); return; }
      const antes = limpar;
      limpar = undefined; usuario = id; conectado = false; suspender(); antes?.();
      if (!id) return;
      limpar = d.observar(id, () => { if (usuario === id) void conferir(); }, ok => {
        if (usuario !== id) return;
        conectado = ok;
        if (ok) void conferir(); else suspender();
      });
      void conferir();
    },
    parar() { usuario = null; conectado = false; suspender(); limpar?.(); limpar = undefined; },
  };
}
