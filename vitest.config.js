// vitest.config.js — StockFlow Pro v9.9.14
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // happy-dom simula browser APIs (localStorage, DOM) sem headless Chrome
        environment: 'happy-dom',
        // Inclui apenas a pasta tests/
        include: ['tests/**/*.test.js'],
        // Exibe relatório compacto no terminal
        reporter: 'verbose',
    },
});
