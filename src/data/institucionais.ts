import type { DocumentoInstitucional } from "./types";
import { HOJE } from "./_gen";

const ts = HOJE.toISOString();

// Documentos institucionais (Apêndice H — Código de Ética; SST: PGR/PCMSO; Treinamentos).
export const INSTITUCIONAIS: DocumentoInstitucional[] = [
  {
    id: "codigo-etica",
    titulo: "Código de Ética e Conduta",
    categoria: "Código de Ética",
    versao: "2026.1",
    descricao: "Principal referencial orientador da conduta na Impresilk Comunicação Visual.",
    atualizadoEm: ts,
    blocos: [
      { tipo: "subtitulo", texto: "Missão" },
      { tipo: "paragrafo", texto: "Ajudar negócios a encontrarem sua essência e oportunidades para se diferenciar, crescer e transformar suas marcas por meio de soluções visuais inteligentes, promovendo um ambiente de trabalho inspirador para nossos colaboradores e impacto positivo na comunidade." },
      { tipo: "subtitulo", texto: "Visão" },
      { tipo: "paragrafo", texto: "Ser reconhecida como a principal referência em comunicação visual, liderando o mercado por meio de inovações constantes, tecnologia de ponta e uma equipe de profissionais altamente qualificados." },
      { tipo: "subtitulo", texto: "Valores" },
      { tipo: "lista", itens: [
        "Inovação com Inteligência — soluções visuais criativas, funcionais e com propósito.",
        "Excelência em Execução — qualidade em cada etapa, do projeto à entrega.",
        "Pessoas em Primeiro Lugar — respeitamos, desenvolvemos e valorizamos nossos colaboradores.",
        "Relações de Confiança — ética, transparência e responsabilidade.",
        "Impacto Social e Comunitário — transformar realidades ao nosso redor.",
        "Sustentabilidade e Consciência — gerar valor com o menor impacto ambiental possível.",
      ] },
      { tipo: "subtitulo", texto: "Abrangência" },
      { tipo: "paragrafo", texto: "Aplica-se a todos os gestores, colaboradores, parceiros, fornecedores e prestadores de serviços. O cumprimento é obrigatório durante toda a vigência do contrato, não sendo permitido alegar desconhecimento de seu conteúdo." },
      { tipo: "subtitulo", texto: "Temas principais" },
      { tipo: "lista", itens: [
        "Relacionamento com clientes.",
        "Sigilo e confidencialidade.",
        "Pontualidade e jornada de trabalho.",
        "Faltas e penalidades.",
        "Férias.",
        "Pagamento de salário.",
        "Uniformes e EPIs.",
        "Ponto biométrico.",
        "Uso de veículos.",
        "Saúde e segurança no trabalho.",
      ] },
    ],
  },
  {
    id: "pop-institucional",
    titulo: "POP — Procedimentos Operacionais Padrão",
    categoria: "POP",
    versao: "1.0",
    descricao: "Procedimentos operacionais padrão de produção, montagem e atendimento.",
    atualizadoEm: ts,
    conteudo:
      "Todos os colaboradores devem obrigatoriamente ler e estar cientes dos Procedimentos Operacionais (POPs). O conhecimento e a adesão a essas diretrizes são fundamentais para o bom funcionamento da equipe e o sucesso organizacional. O detalhamento de cada fluxo está na seção POPs e Procedimentos.",
  },
  {
    id: "pgr",
    titulo: "PGR — Programa de Gerenciamento de Riscos",
    categoria: "SST",
    versao: "2026",
    descricao: "Documento de Saúde e Segurança do Trabalho (NR-01).",
    atualizadoEm: ts,
    conteudo:
      "Programa de Gerenciamento de Riscos da Impresilk. Identifica perigos, avalia riscos ocupacionais e define plano de ação para os setores de produção, impressão/sublimação, CNC, serralheria e montagem em campo. Uso obrigatório de EPIs.",
  },
  {
    id: "pcmso",
    titulo: "PCMSO — Programa de Controle Médico de Saúde Ocupacional",
    categoria: "SST",
    versao: "2026",
    descricao: "Documento de Saúde e Segurança do Trabalho (NR-07).",
    atualizadoEm: ts,
    conteudo:
      "Programa de Controle Médico de Saúde Ocupacional. Define a realização de exames admissionais, periódicos, de retorno ao trabalho, de mudança de função e demissionais (ASO).",
  },
  {
    id: "treinamento-integracao",
    titulo: "Treinamento de Integração (Onboarding)",
    categoria: "Treinamento",
    versao: "1.0",
    descricao: "Material de integração de novos colaboradores.",
    atualizadoEm: ts,
    conteudo:
      "Boas-vindas à Impresilk Comunicação Visual. Apresentação da empresa, da missão, visão e valores, das normas de conduta, da estrutura de áreas e do plano de carreira por níveis (N1 a N5).",
  },
];
