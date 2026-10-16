export const SITUACOES_ENDO = ["Planejada", "Em preparação", "Realizada", "Cancelada"] as const;
export type SituacaoEndo = typeof SITUACOES_ENDO[number];
export const TEMAS_ENDO = ["Acolhimento", "Reconhecimento", "Escuta", "Conexão", "Bem-estar", "Desenvolvimento", "Celebração"] as const;
export type TemaEndo = typeof TEMAS_ENDO[number];
export interface AnexoEndo { id: string; nome: string; tamanho: number; naNuvem: boolean }
export interface AcaoEndomarketing {
  anexos?: AnexoEndo[];
  id: string;
  titulo: string;
  tema: TemaEndo;
  data: string;
  responsavelId: string;
  colaboradorId?: string;
  origemId?: string;
  objetivo: string;
  publico: string;
  situacao: SituacaoEndo;
  checklist: { id: string; texto: string; feito: boolean }[];
  observacoes: string;
  resultado: string;
  criterio?: string;
  concluidaEm?: string;
  historico: { em: string; por: string; texto: string }[];
}
export interface ModeloEndo {
  id: string; titulo: string; tema: TemaEndo; objetivo: string;
  publico: string; frequencia: string; passos: string[]; avaliar: string;
}
export const FONTES_ENDO = [
  { titulo: "OMS · Saúde mental no trabalho", url: "https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work" },
  { titulo: "CIPD · Bem-estar no trabalho", url: "https://www.cipd.org/uk/knowledge/factsheets/well-being-factsheet/" },
  { titulo: "CIPD · Escuta das pessoas", url: "https://www.cipd.org/uk/knowledge/factsheets/voice-factsheet/" },
];
// Conteúdo editorial sugerido. Nunca importado como ação realizada ou agendada.
export const MODELOS_ENDO: ModeloEndo[] = [
  { id: "boas-vindas", titulo: "Boas-vindas com acompanhamento", tema: "Acolhimento", objetivo: "Ajudar quem chega a conhecer as pessoas, os canais e o trabalho.", publico: "Pessoas recém-admitidas e suas lideranças", frequencia: "Na entrada, com retorno em 7 e 30 dias", passos: ["Combinar um colega de apoio disponível", "Apresentar canais, benefícios e rotina", "Perguntar o que ainda está difícil", "Registrar próximo apoio e data de retorno"], avaliar: "O que ficou mais claro e qual apoio ainda falta?" },
  { id: "aniversario", titulo: "Aniversário do jeito da pessoa", tema: "Celebração", objetivo: "Celebrar respeitando as preferências de cada pessoa.", publico: "Aniversariantes do mês", frequencia: "Mensal", passos: ["Confirmar se a pessoa quer homenagem pública", "Combinar formato e horário acessíveis", "Preparar mensagem pessoal sem divulgar idade", "Conferir se todos os turnos foram considerados"], avaliar: "O formato respeitou a vontade da pessoa?" },
  { id: "tempo-casa", titulo: "Reconhecer a trajetória", tema: "Reconhecimento", objetivo: "Valorizar contribuições concretas no aniversário de empresa.", publico: "Pessoas que completam anos de empresa", frequencia: "Na data do marco", passos: ["Confirmar data no cadastro", "Ouvir a liderança sobre uma contribuição específica", "Combinar reconhecimento com a pessoa", "Registrar agradecimento sem comparação entre colegas"], avaliar: "A homenagem foi específica e significativa?" },
  { id: "escuta", titulo: "Escuta com retorno combinado", tema: "Escuta", objetivo: "Transformar sugestões sobre a rotina em decisões acompanháveis.", publico: "Equipe, com representação dos turnos", frequencia: "Mensal", passos: ["Escolher um tema e explicar como os comentários serão usados", "Oferecer canal reservado para questões individuais", "Escolher uma melhoria viável e um responsável", "Dar retorno sobre o que será feito e o que não será possível"], avaliar: "Qual melhoria foi feita e quando será reavaliada?" },
  { id: "carga", titulo: "Conversa sobre carga e prioridades", tema: "Bem-estar", objetivo: "Identificar obstáculos de trabalho e combinar apoios práticos.", publico: "Lideranças e respectivas equipes", frequencia: "Quinzenal", passos: ["Revisar prioridades e prazos reais", "Ouvir dificuldades sem pedir diagnósticos de saúde", "Ajustar um obstáculo sob responsabilidade da liderança", "Marcar retorno para conferir se o ajuste ajudou"], avaliar: "O obstáculo foi reduzido? O que continua pendente?" },
  { id: "conexao", titulo: "Café entre áreas", tema: "Conexão", objetivo: "Aproximar pessoas que colaboram no dia a dia.", publico: "Áreas e turnos diferentes", frequencia: "Mensal, participação voluntária", passos: ["Escolher horário sem prejudicar pausas ou operação", "Oferecer formato acessível a todos os turnos", "Conversar sobre como uma área pode ajudar outra", "Combinar uma melhoria de comunicação"], avaliar: "Que dificuldade entre áreas ganhou um encaminhamento?" },
  { id: "reconhecer", titulo: "Obrigado por esta contribuição", tema: "Reconhecimento", objetivo: "Reconhecer atitudes de colaboração com exemplos concretos.", publico: "Toda a equipe", frequencia: "Quinzenal", passos: ["Convidar relatos voluntários de ajuda recebida", "Pedir autorização antes de divulgar nomes ou fotos", "Reconhecer diferentes funções e turnos", "Evitar votação, ranking ou competição"], avaliar: "O reconhecimento alcançou diferentes áreas de forma justa?" },
  { id: "aprender", titulo: "Troca de conhecimentos", tema: "Desenvolvimento", objetivo: "Abrir espaço para aprender com colegas e identificar necessidades de formação.", publico: "Pessoas interessadas no tema", frequencia: "Mensal", passos: ["Ouvir temas que ajudariam a equipe", "Convidar facilitador e reservar tempo de trabalho", "Oferecer material acessível e prática orientada", "Encaminhar necessidades para Treinamento"], avaliar: "O que as pessoas conseguem aplicar depois da troca?" },
  { id: "mudancas", titulo: "O que mudou e por quê", tema: "Conexão", objetivo: "Explicar decisões e mudanças com clareza e espaço para dúvidas.", publico: "Pessoas afetadas pela mudança", frequencia: "A cada mudança relevante", passos: ["Explicar motivo, impacto e data da mudança", "Definir quem responde dúvidas", "Garantir acesso para todos os turnos", "Publicar retorno das perguntas sem expor quem perguntou"], avaliar: "Quais dúvidas persistiram e precisam de nova explicação?" },
  { id: "retorno", titulo: "Acolhimento no retorno", tema: "Acolhimento", objetivo: "Apoiar o retorno à rotina com coordenação do RH e da liderança.", publico: "Pessoas que retornam ao trabalho", frequencia: "No retorno, conforme necessidade", passos: ["Combinar conversa reservada com a pessoa", "Alinhar apoios com RH e saúde ocupacional quando necessário", "Apresentar mudanças da equipe e rotina", "Marcar acompanhamento sem divulgar motivos pessoais"], avaliar: "Os apoios combinados foram oferecidos? Registrar só o andamento, sem dados de saúde." },
  { id: "inclusao", titulo: "Participação sem barreiras", tema: "Bem-estar", objetivo: "Tornar encontros e comunicações acessíveis e respeitosos.", publico: "Organizadores e participantes das ações", frequencia: "Antes de cada evento", passos: ["Consultar necessidades de participação em canal privado", "Conferir local, linguagem, formato e horários", "Oferecer alternativa para quem não pode participar", "Solicitar sugestões de melhoria sem obrigar exposição pessoal"], avaliar: "Que barreiras foram removidas e quais faltam resolver?" },
  { id: "apoios", titulo: "Conheça os apoios disponíveis", tema: "Bem-estar", objetivo: "Facilitar o acesso aos benefícios e canais de apoio que a empresa realmente oferece.", publico: "Toda a equipe", frequencia: "Trimestral e na integração", passos: ["Validar com RH os benefícios e contatos vigentes", "Explicar como solicitar apoio de forma reservada", "Oferecer orientação em diferentes turnos", "Conferir dúvidas sem registrar situações pessoais na campanha"], avaliar: "As pessoas sabem onde buscar ajuda?" },
  { id: "datas", titulo: "Data especial com propósito", tema: "Celebração", objetivo: "Associar uma data relevante a uma ação útil para as pessoas.", publico: "Público definido conforme a data", frequencia: "Conforme calendário", passos: ["Escolher a data com a equipe e conferir sua referência", "Definir uma ação além da mensagem comemorativa", "Respeitar crenças, preferências e participação voluntária", "Registrar aprendizado e melhoria concreta"], avaliar: "O que a ação trouxe além da divulgação da data?" },
  { id: "fechamento", titulo: "Devolutiva do mês", tema: "Escuta", objetivo: "Mostrar o que foi ouvido, realizado e o que ainda precisa de atenção.", publico: "Equipe e lideranças", frequencia: "Mensal", passos: ["Revisar ações planejadas e realizadas", "Separar participação de satisfação: são medidas diferentes", "Compartilhar avanços e pendências sem dados pessoais", "Definir responsável e prazo para a próxima melhoria"], avaliar: "Quantas decisões tiveram retorno? Não inferir engajamento só pela presença." },
];
