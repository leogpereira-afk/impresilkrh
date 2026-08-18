// Configuração mínima de ESLint: o foco é a classe de bug que travou a aba
// Financeiro — as Rules of Hooks do React. Mantido enxuto de propósito (não liga
// os rulesets "recommended" inteiros) para ser um alarme útil, sem ruído.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "netlify", "public", "*.config.*", "scripts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, react },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      /* Componente declarado DENTRO de outro componente.
         Esta é a segunda classe de bug que chegou aqui vinda do chão de
         fábrica, depois das Rules of Hooks. Um componente escrito dentro de
         outro nasce com identidade nova a cada desenho, e o React decide o que
         reaproveitar comparando o TIPO do elemento: tipo diferente = joga fora
         e monta de novo. O que a pessoa vê é o menu voltando ao topo, a lista
         piscando, o campo perdendo o foco a cada letra e o clique caindo em
         outro item — "clico numa coisa e vai para outra".
         Estava em três telas ao mesmo tempo (barra lateral, organograma,
         onboarding) e nenhuma ferramenta acusava: build, tipos e testes passam
         todos verdes. É "error" porque o estrago é invisível para quem revisa
         e óbvio para quem usa. */
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    },
  },
);
