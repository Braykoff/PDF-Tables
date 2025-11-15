import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js, import: importPlugin, jsdoc },
    languageOptions: { globals: globals.browser },
    rules: {
      // Ignore all unused vars that begin with an underscore
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // Enforce import alphabetization and formatting
      "import/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/export": "error",
      "import/first": "error",
      "import/no-duplicates": "error",
      // Enforce jsdoc on all functions
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
      // Other JS formatting
      "no-redeclare": "error",
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-empty-function": "error",
      "consistent-return": "error",
      "no-magic-numbers": ["error", { ignore: [-1, 0, 1, 2] }],
      "indent": ["error", 2],
      "quotes": ["error", "double", { avoidEscape: true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "curly": ["error", "all"],
      "prefer-const": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "no-var": "error",
    },
  },
]);
