import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "plugin:prettier/recommended",
  ),
  {
    rules: {
      // Disable Prettier as an ESLint error source; formatting is handled separately.
      "prettier/prettier": "off",
      // Warn on unused variables to avoid blocking builds on stylistic issues.
      "@typescript-eslint/no-unused-vars": "warn",
      // Error on explicit any to encourage proper typing in new code.
      // Existing any usages have been addressed or are justified with comments.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;
