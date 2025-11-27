import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], // Apply to all js, ts files
    plugins: {
      js,
      import: importPlugin,
      jsdoc,
    },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    rules: {
      // Enforce explicit types everywhere
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/typedef": [
        "error",
        {
          "arrayDestructuring": true,
          "arrowParameter": true,
          "variableDeclaration": true,
          "variableDeclarationIgnoreFunction": false,
          "objectDestructuring": true,
          "parameter": true,
          "propertyDeclaration": true,
        },
      ],
      // Ignore all unused vars that begin with an underscore
      "no-unused-vars": "error",
      "@typescript-eslint/no-unused-vars": "error",
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
      "no-redeclare": "error", // Enforce no redeclaration
      "no-undef": "error", // Enforce no undefined variables
      "no-dupe-keys": "error", // Enforce no duplicate keys in tables
      "no-empty-function": "error", // Enforce no empty functions
      "consistent-return": "error", // Enforce consistent function returns
      "no-magic-numbers": ["error", { ignore: [-1, 0, 1, 2, 100] }], // Enforce no magic numbers
      "indent": ["error", 2], // Enforce 2 space indentation
      "quotes": ["error", "double", { avoidEscape: true }], // Enforce double quotes
      "semi": ["error", "always"], // Enforce semicolons at end of lines
      "no-extra-semi": "error", // Enforces no extra semicolons
      "comma-dangle": ["error", "always-multiline"], // Enforce multiline table comma dangle
      "curly": ["error", "all"], // Enforce curly brackets for blocks
      "prefer-const": "error", // Enforce const for unchanging variables
      "prefer-arrow-callback": "error", // Enforce arrow notation for callbacks
      "prefer-template": "error", // Enforce template strings over concatenation
      "no-var": "error", // Enforce no var variables
      "eqeqeq": "error", // Enforce no type coercion (triple equals only)
      "max-len": ["error", { "code": 100 }], // Enforce max line length 100 chars
    },
  },
  tseslint.configs.recommended,
]);
