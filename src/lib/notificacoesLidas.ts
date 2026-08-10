// ============================================================================
// "DAR COMO LIDAS" NO SINO DE AVISOS.
//
// O sino chegou a 24 pendências e virou paisagem: número vermelho permanente
// não avisa nada, porque nunca muda. Faltava poder dizer "já vi todas".
//
// Só que estes avisos NÃO são registros guardados — são calculados do dado toda
// vez que a tela roda (um ASO vencido gera o aviso sozinho). Então "lido" não
// pode apagar: se apagasse, um exame vencido de verdade sumiria para sempre, e
// o sino passaria a esconder exatamente o que existe para mostrar.
//
// Aqui "lido" silencia o CONTADOR; o item continua na lista, marcado como já
// visto. E há uma exceção que importa: se a situação PIORA — de "a vencer" para
// "vencido" —, o aviso volta a contar sozinho. Ter visto que um exame vence em
// 30 dias não é ter visto que ele venceu.
//
// A marcação é por aparelho e por pessoa: é preferência de quem está olhando,
// não dado da empresa, e não faz sentido sincronizar.
// ============================================================================

export type Severidade = "alta" | "media" | "baixa";

/** id do aviso → severidade que ele tinha quando foi marcado como lido. */
export type Lidas = Record<string, Severidade>;

const PESO: Record<Severidade, number> = { baixa: 0, media: 1, alta: 2 };

const chave = (usuarioId: string) => `impresilk.rh.v1:notificacoes-lidas:${usuarioId}`;

export function lerLidas(usuarioId: string, storage?: Storage): Lidas {
  const st = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!st || !usuarioId) return {};
  try {
    const raw = st.getItem(chave(usuarioId));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Lidas) : {};
  } catch { return {}; }
}

export function gravarLidas(usuarioId: string, lidas: Lidas, storage?: Storage): void {
  const st = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!st || !usuarioId) return;
  try { st.setItem(chave(usuarioId), JSON.stringify(lidas)); } catch { /* cota: segue só em memória */ }
}

/**
 * Este aviso ainda conta no contador?
 *
 * Conta se nunca foi lido, ou se PIOROU desde que foi lido. Não conta se
 * melhorou — quem já viu o problema no auge não precisa ser cutucado de novo
 * porque ele amenizou.
 */
export function naoLido(aviso: { id: string; severidade: Severidade }, lidas: Lidas): boolean {
  const quando = lidas[aviso.id];
  if (!quando) return true;
  return PESO[aviso.severidade] > PESO[quando];
}

/** Marca a lista inteira como lida, guardando a severidade atual de cada uma. */
export function marcarTodas(avisos: readonly { id: string; severidade: Severidade }[], lidas: Lidas): Lidas {
  const novo: Lidas = { ...lidas };
  for (const a of avisos) novo[a.id] = a.severidade;
  return novo;
}

/**
 * Tira da memória o que não está mais na lista. Sem esta limpeza o registro
 * cresceria para sempre — cada documento renovado, cada pessoa desligada
 * deixaria uma chave morta, e um dia o localStorage estouraria a cota.
 */
export function limpar(avisos: readonly { id: string }[], lidas: Lidas): Lidas {
  const vivos = new Set(avisos.map((a) => a.id));
  const novo: Lidas = {};
  for (const id of Object.keys(lidas)) if (vivos.has(id)) novo[id] = lidas[id];
  return novo;
}
