import baseConfig from '@20minutes/eslint-config'

export default [
  ...baseConfig,
  {
    settings: {
      react: {
        version: '18.0',
      },
    },
    rules: {
      'import/no-unresolved': [
        'error',
        {
          // because https://github.com/octokit/rest.js/pull/501
          ignore: ['^@octokit/graphql$', '^@octokit/rest$'],
        },
      ],
    },
  },
]
