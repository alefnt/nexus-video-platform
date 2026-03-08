/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        node: true,
        browser: true,
        es2022: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        // Errors
        'no-var': 'error',
        'prefer-const': 'error',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

        // Warnings
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
        '@typescript-eslint/no-explicit-any': 'off', // Too many to fix at once
        '@typescript-eslint/ban-ts-comment': 'warn',

        // Off (too strict for migration)
        '@typescript-eslint/no-require-imports': 'off',
    },
    ignorePatterns: [
        'dist/',
        'node_modules/',
        '*.js',
        '*.cjs',
        '*.mjs',
        'client-web/dist/',
    ],
    overrides: [
        {
            files: ['client-web/src/**/*.tsx', 'client-web/src/**/*.ts'],
            env: { browser: true, node: false },
        },
    ],
};
