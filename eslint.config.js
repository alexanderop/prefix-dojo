import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import eslintPluginVue from "eslint-plugin-vue"
import globals from "globals"
import typescriptEslint from "typescript-eslint"

export default typescriptEslint.config(
  { ignores: ["**/dist", "**/node_modules"] },
  {
    extends: [
      eslint.configs.recommended,
      ...typescriptEslint.configs.recommended,
      ...eslintPluginVue.configs["flat/recommended"],
    ],
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        parser: typescriptEslint.parser,
      },
    },
    rules: {
      // Lesson prose and pane text are our own strings; function props are the house style.
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  eslintConfigPrettier,
)
