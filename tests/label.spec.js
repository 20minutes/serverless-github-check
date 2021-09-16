import { client } from 'octonode'
import { checkLabel } from '../functions/label'

jest.mock('octonode')

// mimic serverless environment variables
process.env.NAMESPACE = '20 Minutes'
process.env.BLOCK_LABELS = 'wip , work in progress'

describe('Validating GitHub event', () => {
  test('bad event body', async () => {
    const callback = jest.fn()

    await checkLabel({ body: '{}' }, {}, callback)

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

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

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

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

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

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Hello diego, the webhook is now enabled for the organization 20minutes, enjoy!',
      statusCode: 200,
    })
  })
})

describe('Validating label', () => {
  test('got a blocking label', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('failure')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
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
        labels: [
          {
            name: 'wip',
          },
        ],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('got a blocking label in multiple labels', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('failure')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
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
        labels: [
          {
            name: 'foo',
          },
          {
            name: 'wip',
          },
          {
            name: 'bar',
          },
        ],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('no label found in the PR', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('failure')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'This is a pretty simple change that we need to pull into master.',
        body: 'Update',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        labels: [],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('no blocking label found', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('success')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update the README with new information',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        labels: [
          {
            name: 'ready!',
          },
        ],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })

  test('no blocking label found (with partial label)', async () => {
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('success')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update the README with new information',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        labels: [
          {
            name: 'work in progre',
          },
        ],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })

  test('no blocking label defined', async () => {
    process.env.BLOCK_LABELS = ''
    client.mockReturnValue({
      repo: jest.fn((params) => {
        expect(params).toBe('foo/bar')

        return {
          statusAsync: jest.fn((commit, payload) => {
            expect(commit).toBe('ee55a1223ce20c3e7cb776349cb7f8efb7b88511')
            expect(payload.state).toBe('success')
            expect(payload.context).toBe('20 Minutes - Label validation')
            expect(payload.description).toBeDefined()
          }),
        }
      }),
    })
    const callback = jest.fn()
    const githubEvent = {
      pull_request: {
        number: 42,
        title: 'Update the README with new information',
        body: 'This is a pretty simple change that we need to pull into master.',
        head: {
          sha: 'ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        },
        labels: [
          {
            name: 'wip',
          },
        ],
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await checkLabel({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })
})
