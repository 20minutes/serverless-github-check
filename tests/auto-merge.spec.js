import nock from 'nock'
import { handler } from '../functions/auto-merge'

// mimic serverless environment variables
process.env.NAMESPACE = '20 Minutes'

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

describe('Auto merge', () => {
  test('got a PR approved & merged', async () => {
    nock('https://api.github.com')
      .post('/graphql', (body) => {
        expect(body.query).toEqual(expect.stringContaining('addPullRequestReview'))
        expect(body.query).toEqual(expect.stringContaining('event: APPROVE'))
        expect(body.variables.pullRequestId).toBe('PR_kwDOHDoTgM5BdXq1')

        return true
      })
      .reply(200)
    nock('https://api.github.com')
      .post('/graphql', (body) => {
        expect(body.query).toEqual(expect.stringContaining('enablePullRequestAutoMerge'))
        expect(body.variables.pullRequestId).toBe('PR_kwDOHDoTgM5BdXq1')

        return true
      })
      .reply(200)

    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: true,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'All done!',
      statusCode: 204,
    })
  })

  test('PR is not opened or reopened', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'closed',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: false,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Wrong action',
      statusCode: 204,
    })
  })

  test('PR is not mergeable', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'reopened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: false,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: "PR can't be merged",
      statusCode: 204,
    })
  })

  test('repo has not the auto_merge enabled', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: false,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: true,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Repo does not allow auto merge',
      statusCode: 204,
    })
  })

  test('PR is not from dependabot', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'Joe',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: true,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Not a PR from dependabot',
      statusCode: 204,
    })
  })

  test('PR is about a major change', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 7.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: null,
        merged: false,
        mergeable: true,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'Update is a major version',
      statusCode: 204,
    })
  })

  test('PR has already auto_merge enabled', async () => {
    nock('https://api.github.com')
      .post('/graphql', (body) => {
        expect(body.query).toEqual(expect.stringContaining('addPullRequestReview'))
        expect(body.query).toEqual(expect.stringContaining('event: APPROVE'))
        expect(body.variables.pullRequestId).toBe('PR_kwDOHDoTgM5BdXq1')

        return true
      })
      .reply(200)

    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump @storybook/addon-essentials from 6.5.12 to 6.5.13',
        user: {
          login: 'dependabot[bot]',
        },
        base: {
          repo: {
            allow_auto_merge: true,
          },
        },
        auto_merge: true,
        merged: false,
        mergeable: true,
        rebaseable: true,
      },
      repository: {
        full_name: 'foo/bar',
      },
    }

    await handler({ body: JSON.stringify(githubEvent) }, {}, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null, {
      body: 'All done!',
      statusCode: 204,
    })
  })
})
