import { client } from 'octonode'
import { handler } from '../functions/fixup'

jest.mock('octonode')

// mimic serverless environment variables
process.env.NAMESPACE = '20 Minutes'

describe('Validating GitHub event', () => {
  test('bad event body', async () => {
    const callback = jest.fn()

    await handler({ body: '{}' }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Event is not a Pull Request',
      statusCode: 500,
    })
  })

  test('hook event does not include PR', async () => {
    const callback = jest.fn()
    const githubEvent = {
      zen: 'Speak like a human.',
      hook_id: 1,
      hook: {
        events: ['issue', 'push'],
      },
      repository: {
        full_name: '20minutes/serverless-github-check',
      },
      sender: {
        login: 'diego',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'This webhook needs the "pull_request" event. Please tick it.',
      statusCode: 500,
    })
  })

  test('hook event is ok', async () => {
    const callback = jest.fn()
    const githubEvent = {
      zen: 'Speak like a human.',
      hook_id: 1,
      hook: {
        events: ['pull_request', 'push'],
      },
      repository: {
        full_name: '20minutes/serverless-github-check',
      },
      sender: {
        login: 'diego',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Hello diego, the webhook is now enabled for 20minutes/serverless-github-check, enjoy!',
      statusCode: 200,
    })
  })

  test('hook event for an organization is ok', async () => {
    const callback = jest.fn()
    const githubEvent = {
      zen: 'Speak like a human.',
      hook_id: 1,
      hook: {
        events: ['pull_request', 'push'],
      },
      organization: {
        login: '20minutes',
      },
      sender: {
        login: 'diego',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Hello diego, the webhook is now enabled for the organization 20minutes, enjoy!',
      statusCode: 200,
    })
  })
})

describe('Fixup commits check', () => {
  test('got a fixup commit', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('failure')
            expect(payload.context).toBe('20 Minutes - Fixup check')
            expect(payload.description).toBeDefined()
          }),
          compareAsync: jest.fn((baseSha, headSha) => {
            expect(baseSha).toBeDefined()
            expect(headSha).toBeDefined()

            return [
              {
                commits: [
                  {
                    commit: {
                      message: 'is fine',
                    },
                    parents: [
                      {
                        sha: '11111111111',
                      },
                    ],
                  },
                  {
                    commit: {
                      message: 'is ok',
                    },
                    parents: [
                      {
                        sha: '22222222222',
                      },
                    ],
                  },
                  {
                    commit: {
                      message: 'fixup! 5555555555555',
                    },
                    parents: [
                      {
                        sha: '333333333333',
                      },
                    ],
                  },
                ],
              },
            ]
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        base: {
          sha: '1e55a1223ce20c3e7cb776349cb7f8efb7b8851e',
        },
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('got a non-fixup commit', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('success')
            expect(payload.context).toBe('20 Minutes - Fixup check')
            expect(payload.description).toBeDefined()
          }),
          compareAsync: jest.fn((baseSha, headSha) => {
            expect(baseSha).toBeDefined()
            expect(headSha).toBeDefined()

            return [
              {
                commits: [
                  {
                    commit: {
                      message: 'New feature',
                    },
                    parents: [
                      {
                        sha: '123123123',
                      },
                    ],
                  },
                  {
                    commit: {
                      message: 'fix feature',
                    },
                    parents: [
                      {
                        sha: '4564564566',
                      },
                    ],
                  },
                ],
              },
            ]
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        base: {
          sha: '1e55a1223ce20c3e7cb776349cb7f8efb7b8851e',
        },
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })

  test('got a merge commit', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('success')
            expect(payload.context).toBe('20 Minutes - Fixup check')
            expect(payload.description).toBeDefined()
          }),
          compareAsync: jest.fn((baseSha, headSha) => {
            expect(baseSha).toBeDefined()
            expect(headSha).toBeDefined()

            return [
              {
                commits: [
                  {
                    commit: {
                      message: 'new feature',
                    },
                    parents: [
                      {
                        sha: '123123123',
                      },
                      {
                        sha: '456456456',
                      },
                    ],
                  },
                ],
              },
            ]
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        base: {
          sha: '1e55a1223ce20c3e7cb776349cb7f8efb7b8851e',
        },
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })
})
