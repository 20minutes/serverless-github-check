import baseConfig from '@20minutes/eslint-config'

export default [
  ...baseConfig,
  {
    settings: {
      react: {
        version: '18.0',
      },
    },
  },
]
