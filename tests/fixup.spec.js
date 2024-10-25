import fetchMock from '@fetch-mock/jest'
import { FixupHandler } from '../functions/classes/FixupHandler'
import { handler } from '../functions/fixup'

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

describe('Fixup commits check', () => {
  afterEach(() => {
    fetchMock.removeRoutes({ includeSticky: true, includeFallback: true })
    fetchMock.clearHistory()
    fetchMock.unmockGlobal()
  })

  test('got a fixup commit', async () => {
    fetchMock
      .mockGlobal()
      .route(
        'https://api.github.com/repos/foo/bar/compare/1e55a1223ce20c3e7cb776349cb7f8efb7b8851e...ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
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
        }
      )
      .route(
        'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        200
      )

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    const fixup = new FixupHandler('GH_TOKEN', 'THE BRAND')
    await fixup.handle(githubEvent, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: failure',
      statusCode: 204,
    })

    expect(fetch).toHaveLastFetched(
      'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
      {
        body: {
          state: 'failure',
          description: 'Fixup commits in history, please squash them!',
          context: 'THE BRAND - Fixup check',
        },
      }
    )
  })

  test('got a non-fixup commit', async () => {
    fetchMock
      .mockGlobal()
      .route(
        'https://api.github.com/repos/foo/bar/compare/1e55a1223ce20c3e7cb776349cb7f8efb7b8851e...ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
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
        }
      )
      .route(
        'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        200
      )

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    const fixup = new FixupHandler('GH_TOKEN', 'THE BRAND')
    await fixup.handle(githubEvent, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })

    expect(fetch).toHaveLastFetched(
      'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
      {
        body: {
          state: 'success',
          description: 'No fixup commits in history',
          context: 'THE BRAND - Fixup check',
        },
      }
    )
  })

  test('got a merge commit', async () => {
    fetchMock
      .mockGlobal()
      .route(
        'https://api.github.com/repos/foo/bar/compare/1e55a1223ce20c3e7cb776349cb7f8efb7b8851e...ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
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
        }
      )
      .route(
        'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
        200
      )

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
        name: 'bar',
        full_name: 'foo/bar',
        owner: {
          login: 'foo',
        },
      },
    }

    const fixup = new FixupHandler('GH_TOKEN', 'THE BRAND')
    await fixup.handle(githubEvent, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Process finished with state: success',
      statusCode: 204,
    })

    expect(fetch).toHaveLastFetched(
      'https://api.github.com/repos/foo/bar/statuses/ee55a1223ce20c3e7cb776349cb7f8efb7b88511',
      {
        body: {
          state: 'success',
          description: 'No fixup commits in history',
          context: 'THE BRAND - Fixup check',
        },
      }
    )
  })
})
