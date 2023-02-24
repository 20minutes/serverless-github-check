import nock from 'nock'
import { handler } from '../functions/label'

// mimic serverless environment variables
process.env.NAMESPACE = '20 Minutes'
process.env.BLOCK_LABELS = 'wip , work in progress'

describe('Validating GitHub event', () => {
  test('bad content type', async () => {
    const callback = jest.fn()

    await handler(
      {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'payload%3D%7B%22zen%22%3A%22Non-blocking%2Bis%2Bbetter%2Bthan%2Bblocking.%22%7D',
      },
      {},
      callback
    )

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
      statusCode: 500,
    })
  })

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

describe('Validating label', () => {
  test('got a blocking label', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('failure')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('got a blocking label in multiple labels', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('failure')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('no label found in the PR', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('failure')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })
  })

  test('no blocking label found', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('success')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })

  test('no blocking label found (with partial label)', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('success')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })
  })

  test('no blocking label defined', async () => {
    process.env.BLOCK_LABELS = ''

    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('success')
        expect(body.context).toBe('20 Minutes - Label validation')
        expect(body.description).toBeDefined()

        return true
      })
      .reply(200)

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
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
