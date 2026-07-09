/** @type {import('jest').Config} */
module.exports = {
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': [
			'ts-jest',
			{
				tsconfig: {
					module: 'CommonJS',
					moduleResolution: 'Node10',
					experimentalDecorators: true,
					emitDecoratorMetadata: true,
					ignoreDeprecations: '6.0',
					baseUrl: './',
					types: ['node', 'jest'],
				},
			},
		],
	},
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
	transformIgnorePatterns: ['/node_modules/(?!uuid)'],
};
