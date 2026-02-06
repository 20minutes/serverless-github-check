import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'build',
      reporter: ['html', 'text-summary'],
      include: ['functions/**/*.js'],
      exclude: ['**/node_modules/**'],
    },
  },
})
