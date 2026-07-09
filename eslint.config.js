import eslintReact from '@eslint-react/eslint-plugin';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const baseRules = {
	'prefer-const': 'error',
	'@typescript-eslint/no-unused-vars': [
		'error',
		{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
	],
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/no-non-null-assertion': 'warn',
	'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
	'padding-line-between-statements': [
		'error',
		// All statements must be separated by a blank line
		{ blankLine: 'always', prev: '*', next: '*' },
		// Exceptions: related/same-kind statements may stay together
		{ blankLine: 'any', prev: 'import', next: 'import' },
		{ blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
		{ blankLine: 'any', prev: 'export', next: 'export' },
	],
};

export default tseslint.config(
	{
		ignores: ['**/dist/**', '**/node_modules/**', '**/.moon/**'],
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		extends: [tseslint.configs.recommended],
		rules: baseRules,
	},
	{
		files: ['apps/api/**/*.ts'],
		languageOptions: {
			parserOptions: {
				experimentalDecorators: true,
				emitDecoratorMetadata: true,
			},
		},
	},
	{
		files: ['apps/web/**/*.{ts,tsx}'],
		...eslintReact.configs['recommended'],
		plugins: {
			...eslintReact.configs['recommended'].plugins,
			'react-hooks': pluginReactHooks,
		},
		rules: {
			...eslintReact.configs['recommended'].rules,
			...pluginReactHooks.configs.recommended.rules,
		},
	},
);
