# Publicação autorizada do visual 3D

Autorização D-014: “ficou bom pode publicar essa versão 3D do RH”.

## Escopo fechado

Publicação da prévia `94085a5`, reaplicada sobre a reserva `a06a2b5` como `5abdd6f`. A comparação dos diretórios `src`, `public`, dependências e workflows com a prévia não apresenta diferença. A atualização de documentação registra a autorização desta etapa.

Ícones em relevo, cartões com sombras e movimentos suaves, campos e navegação acessíveis, temas claro/escuro e opção de reduzir movimentos. Cache preparado: `impresilk-rh-v18`.

Nenhuma function, migration, permissão, regra de negócio ou dado real integra esta publicação. Os testes de gravação da prévia usaram apenas fixtures locais. Relato da implementação e da conferência visual: `docs/2026-10-24-previa-visual-3d.md`.

## Validação e confirmação

Dependências reinstaladas com `npm ci` em pasta própria, Node 20. A etapa de publicação exige `npm run verificar`, `npm run build`, diff limpo e conferência do protocolo antes do push. Depois, comparar os arquivos servidos com o build e conferir a navegação autenticada em larguras de computador/celular. Sem gravações de teste em produção.

O resultado final, SHAs, execuções de CI e conferência dos arquivos servidos ficam na Passagem do `VEZ.md` ao encerrar esta publicação, preservada depois em `docs/passagens/`. Capturas e logs detalhados permanecem privados, fora deste repositório público.
