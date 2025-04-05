module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier'
    ],
    env: {
      node: true,
      jest: true,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'off'
    }
  };
  