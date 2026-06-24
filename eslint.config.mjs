// Configuração mínima de ESLint: o foco é a classe de bug que travou a aba
// Financeiro — as Rules of Hooks do React. Mantido enxuto de propósito (não liga
// os rulesets "recommended" inteiros) para ser um alarme útil, sem ruído.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "netlify", "public", "*.config.*", "scripts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
