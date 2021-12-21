import nock from 'nock'
import { handler } from '../functions/specification'

// mimic serverless environment variables
process.env.NAMESPACE = '20 Minutes'
process.env.CHECK_BODY_LENGTH = 8
process.env.CHECK_TITLE_LENGTH = 8

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

describe('Validating specification', () => {
  test('title is too short', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('failure')
        expect(body.context).toBe('20 Minutes / PR Specification')
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

  test('body is too short', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('failure')
        expect(body.context).toBe('20 Minutes / PR Specification')
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

  test('body and title are OK', async () => {
    nock('https://api.github.com')
      .post('/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511', (body) => {
        expect(body.state).toBe('success')
        expect(body.context).toBe('20 Minutes / PR Specification')
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
