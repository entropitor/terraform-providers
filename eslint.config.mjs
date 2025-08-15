// @ts-check
import eslint from "@eslint/js";
import eslintComments from "eslint-plugin-eslint-comments";
import json from "eslint-plugin-json";
import node from "eslint-plugin-node";
import perfectionist from "eslint-plugin-perfectionist";
import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

const testFilesGlobPatterns = [
  "**/*.{spec,e2e-spec,test,e2e-test}.{js,jsx,ts,tsx}",
  "**/__mocks__/**",
  "**/{test,tests,spec,specs,__mocks__}/**",
  "**/{cypress}/**",
];

const sortConfigs = tseslint.config(
  perfectionist.configs["recommended-natural"],
  {
    rules: {
      "perfectionist/sort-classes": "off",
      "perfectionist/sort-imports": [
        "error",
        {
          groups: [
            "side-effect",
            "builtin",
            "external",
            "internal",
            "parent",
            ["sibling", "index"],
            "unknown",
          ],
          type: "natural",
        },
      ],
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-object-types": "off",
      // "perfectionist/sort-object-types": [
      //   "error",
      //   { partitionByNewLine: true, type: "natural" },
      // ],
      "perfectionist/sort-objects": "off",
      // "perfectionist/sort-objects": [
      //   "error",
      //   { partitionByNewLine: true, type: "natural" },
      // ],
    },
  },
);

const defaultConfigs = tseslint.config(
  eslint.configs.recommended,

  {
    name: "@entropitor/json",
    files: ["**/*.json"],
    languageOptions: {
      parserOptions: {
        programs: null,
      },
    },
    plugins: {
      json,
    },
    ...tseslint.configs.disableTypeChecked,
    ...json.configs["recommended"],
  },
  {
    name: "@entropitor/json/tsconfig",
    files: ["**/tsconfig.json"],
    rules: {
      "json/*": "off",
    },
  },

  {
    name: "@entropitor/index/vitest",
    files: testFilesGlobPatterns,
    ...vitest.configs.recommended,
  },

  {
    name: "@entropitor/index/eslint-comments",
    plugins: {
      "eslint-comments": eslintComments,
    },
    rules: {
      "eslint-comments/no-unused-disable": "error",
      "eslint-comments/no-unused-enable": "error",
    },
  },

  {
    name: "@entropitor/node",
    plugins: {
      node,
    },
    rules: {
      ...node.configs.recommended.rules,

      // doesn't work
      "node/no-deprecated-api": "off",
      "node/no-exports-assign": "off",
      "node/no-extraneous-require": "off",
      "node/no-missing-require": "off",

      // overrides
      "node/no-missing-import": "off",
      "node/shebang": "off",
      "node/no-unpublished-import": "off",
      "node/no-unpublished-require": "off",
      "node/no-unsupported-features/es-builtins": "off",
      "node/no-unsupported-features/es-syntax": "off",
      "node/no-unsupported-features/node-builtins": "off",
    },
  },

  // sort
  ...sortConfigs,

  // Other
  {
    name: "@entropitor/other",
    rules: {
      "class-methods-use-this": "off",
      curly: ["error", "all"],
      "default-param-last": "off", // doesn't work well with reducers
      eqeqeq: ["error", "always", { null: "never" }],
      "max-classes-per-file": "off",
      "no-console": "error",
      "no-useless-catch": "error",
      "no-useless-constructor": "off",
      "no-void": ["error", { allowAsStatement: true }],
      "object-shorthand": ["error", "always"],
      "prefer-const": "error",
      "prefer-template": "error",
    },
  },

  {
    ignores: ["**/gen/**/*", "**/dist/**/*"],
  },
);

const typescriptConfigs = tseslint.config(
  ...defaultConfigs,

  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    name: "@entropitor/typescript-eslint-config",
    rules: {
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          custom: {
            match: false,
            regex: "^I[A-Z]",
          },
          format: ["PascalCase"],
          selector: "interface",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-use-before-define": "error",
      "@typescript-eslint/prefer-ts-expect-error": "error",

      "no-underscore-dangle": "off",
      "no-use-before-define": "off",
    },
  },
  {
    files: testFilesGlobPatterns,
    name: "@entropitor/typescript-eslint-for-tests",
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/ban-ts-ignore": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ts-expect-error": "off",
    },
  },
);

const strictTypeChecked = tseslint.config(
  ...typescriptConfigs,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: false },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          // Default options strict
          ...{
            allowAny: false,
            allowBoolean: false,
            allowNever: false,
            allowNullish: false,
            allowNumber: false,
            allowRegExp: false,
          },

          allowNumber: true,
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableBoolean: true, // Allowed because otherwise there are quite some false positives
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
      ],
    },
  },

  {
    files: ["**/*.json", "**/*.{mjs,cjs,js}"],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    files: ["scripts/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "off",
      "no-process-exit": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  {
    name: "@entropitor/test-exceptions",
    files: testFilesGlobPatterns,
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  {
    files: ["{libs,providers}/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["providers/*/tsconfig.json", "libs/*/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);

export default strictTypeChecked;
