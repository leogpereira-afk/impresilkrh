import { useSearchParams } from 'react-router-dom';
import { useAbaAtiva } from '@/components/ui/tabs';

/** Links abrem a aba indicada; a preferência continua valendo em acessos sem link. */
export function useAbaNaUrl(chave: string, ids: string[], inicial: string) {
  const [params, setParams] = useSearchParams();
  const [salva, salvar] = useAbaAtiva(chave, ids, inicial);
  const solicitada = params.get('aba');
  const ativa = solicitada && ids.includes(solicitada) ? solicitada : salva;
  const mudar = (id: string) => {
    if (!ids.includes(id)) return;
    salvar(id);
    setParams(atual => { const proximo = new URLSearchParams(atual); proximo.set('aba', id); return proximo; }, { replace: true });
  };
  return [ativa, mudar] as const;
}
