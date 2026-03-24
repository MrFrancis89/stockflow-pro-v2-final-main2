// eslint.config.js — StockFlow Pro v9.9.14
// ══════════════════════════════════════════════════════════════════
// #22 — ESLint com config mínima para ES Modules puros.
// Executar: npx eslint .
// ══════════════════════════════════════════════════════════════════

export default [
    {
        // Arquivos alvo: todos os .js do projeto exceto dist/, node_modules/ e SW gerado
        files: ['**/*.js'],
        ignores: [
            'dist/**',
            'node_modules/**',
            'sw.js',            // gerado por generate-sw.cjs
            'generate-sw.cjs',  // CJS, não ES module
        ],

        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals: {
                // Browser globals usados no projeto
                window:        'readonly',
                document:      'readonly',
                navigator:     'readonly',
                localStorage:  'readonly',
                indexedDB:     'readonly',
                fetch:         'readonly',
                AudioContext:  'readonly',
                requestAnimationFrame:  'readonly',
                requestIdleCallback:    'readonly',
                AbortController:        'readonly',
                URL:           'readonly',
                Blob:          'readonly',
                FileReader:    'readonly',
                WeakMap:       'readonly',
                Map:           'readonly',
                Set:           'readonly',
                Promise:       'readonly',
                console:       'readonly',
                setTimeout:    'readonly',
                clearTimeout:  'readonly',
                setInterval:   'readonly',
                clearInterval: 'readonly',
            },
        },

        rules: {
            // Erros claros
            'no-undef':              'error',
            'no-unused-vars':        ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-var':                'error',
            'no-console':            'off',          // projeto usa console.warn em alguns pontos
            'eqeqeq':               ['error', 'always', { null: 'ignore' }],

            // Catch silencioso — era um dos problemas listados no backlog
            'no-empty':              ['error', { allowEmptyCatch: false }],

            // innerHTML não sanitizado — avisa mas não bloqueia (há casos legítimos)
            'no-eval':               'error',

            // Consistência de estilo mínima
            'prefer-const':          'warn',
            'no-duplicate-imports':  'error',
        },
    },

    // Script FOUC inline (var permitido — precisa ser ES5 puro para máxima compatibilidade)
    {
        files: ['index.html'],
        rules: {
            'no-var': 'off',
        },
    },
];
