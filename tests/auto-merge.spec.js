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

  test('got a PR approved & merged from grouped deps', async () => {
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
        title: 'build(deps-dev): bump the storybook-dependencies group with 2 updates',
        body: `Bumps the storybook-dependencies group with 2 updates:

| Package | Update |
| --- | --- |
| [@storybook/addon-actions](https://github.com/storybookjs/storybook/tree/HEAD/code/addons/actions) | 7.0.25 to 7.0.26 |
| [@storybook/addon-essentials](https://github.com/storybookjs/storybook/tree/HEAD/code/addons/essentials) | 7.0.25 to 7.0.26 |

Updates \`@storybook/addon-actions\` from 7.0.25 to 7.0.26
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/storybookjs/storybook/releases"><code>@storybook/addon-actions</code>'s releases</a>.</em></p>
<blockquote>
<h2>v7.0.26</h2>
<h2>7.0.26</h2>
<ul>
<li>Next.js: Fix next/image usage in latest Next.js release - <a href="https://redirect.github.com/storybookjs/storybook/pull/23296">#23296</a>, thanks <a href="https://github.com/valentinpalkovic"><code>@valentinpalkovic</code></a>!</li>
<li>NextJS: Fix <code>useParams</code> support - <a href="https://redirect.github.com/storybookjs/storybook/pull/22946">#22946</a>, thanks <a href="https://github.com/gitstart-storybook"><code>@gitstart-storybook</code></a>!</li>
<li>NextJS: Allow disabling next/image lazy loading - <a href="https://redirect.github.com/storybookjs/storybook/pull/21909">#21909</a>, thanks <a href="https://github.com/martinnabhan"><code>@martinnabhan</code></a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md"><code>@storybook/addon-actions</code>'s changelog</a>.</em></p>
<blockquote>
<h2>7.0.26</h2>
<ul>
<li>Next.js: Fix next/image usage in latest Next.js release - <a href="https://redirect.github.com/storybookjs/storybook/pull/23296">#23296</a>, thanks <a href="https://github.com/valentinpalkovic"><code>@valentinpalkovic</code></a>!</li>
<li>NextJS: Fix <code>useParams</code> support - <a href="https://redirect.github.com/storybookjs/storybook/pull/22946">#22946</a>, thanks <a href="https://github.com/gitstart-storybook"><code>@gitstart-storybook</code></a>!</li>
<li>NextJS: Allow disabling next/image lazy loading - <a href="https://redirect.github.com/storybookjs/storybook/pull/21909">#21909</a>, thanks <a href="https://github.com/martinnabhan"><code>@martinnabhan</code></a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/storybookjs/storybook/commit/19f91cddc806397c30f8ca9e3e76ae997a4a13af"><code>19f91cd</code></a> Bump version from 7.0.25 to 7.0.26</li>
<li>See full diff in <a href="https://github.com/storybookjs/storybook/commits/v7.0.26/code/addons/actions">compare view</a></li>
</ul>
</details>
<br />

Updates \`@storybook/addon-essentials\` from 7.0.25 to 7.0.26
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/storybookjs/storybook/releases"><code>@storybook/addon-essentials</code>'s releases</a>.</em></p>
<blockquote>
<h2>v7.0.26</h2>
<h2>7.0.26</h2>
<ul>
<li>Next.js: Fix next/image usage in latest Next.js release - <a href="https://redirect.github.com/storybookjs/storybook/pull/23296">#23296</a>, thanks <a href="https://github.com/valentinpalkovic"><code>@valentinpalkovic</code></a>!</li>
<li>NextJS: Fix <code>useParams</code> support - <a href="https://redirect.github.com/storybookjs/storybook/pull/22946">#22946</a>, thanks <a href="https://github.com/gitstart-storybook"><code>@gitstart-storybook</code></a>!</li>
<li>NextJS: Allow disabling next/image lazy loading - <a href="https://redirect.github.com/storybookjs/storybook/pull/21909">#21909</a>, thanks <a href="https://github.com/martinnabhan"><code>@martinnabhan</code></a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/storybookjs/storybook/blob/next/CHANGELOG.md"><code>@storybook/addon-essentials</code>'s changelog</a>.</em></p>
<blockquote>
<h2>7.0.26</h2>
<ul>
<li>Next.js: Fix next/image usage in latest Next.js release - <a href="https://redirect.github.com/storybookjs/storybook/pull/23296">#23296</a>, thanks <a href="https://github.com/valentinpalkovic"><code>@valentinpalkovic</code></a>!</li>
<li>NextJS: Fix <code>useParams</code> support - <a href="https://redirect.github.com/storybookjs/storybook/pull/22946">#22946</a>, thanks <a href="https://github.com/gitstart-storybook"><code>@gitstart-storybook</code></a>!</li>
<li>NextJS: Allow disabling next/image lazy loading - <a href="https://redirect.github.com/storybookjs/storybook/pull/21909">#21909</a>, thanks <a href="https://github.com/martinnabhan"><code>@martinnabhan</code></a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/storybookjs/storybook/commit/19f91cddc806397c30f8ca9e3e76ae997a4a13af"><code>19f91cd</code></a> Bump version from 7.0.25 to 7.0.26</li>
<li>See full diff in <a href="https://github.com/storybookjs/storybook/commits/v7.0.26/code/addons/essentials">compare view</a></li>
</ul>
</details>
<br />


Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting \`@dependabot rebase\`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- \`@dependabot rebase\` will rebase this PR
- \`@dependabot recreate\` will recreate this PR, overwriting any edits that have been made to it
- \`@dependabot merge\` will merge this PR after your CI passes on it
- \`@dependabot squash and merge\` will squash and merge this PR after your CI passes on it
- \`@dependabot cancel merge\` will cancel a previously requested merge and block automerging
- \`@dependabot reopen\` will reopen this PR if it is closed
- \`@dependabot close\` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually


</details>`,
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

  test('PR is about a major change from grouped updates', async () => {
    const callback = jest.fn()
    const githubEvent = {
      action: 'opened',
      pull_request: {
        node_id: 'PR_kwDOHDoTgM5BdXq1',
        number: 615,
        title: 'build(deps-dev): bump the storybook-dependencies group with 8 updates',
        body: `Updates \`@storybook/addon-actions\` from 6.5.12 to 7.5.13
Updates \`@storybook/addon-essentials\` from 6.5.12 to 7.5.13`,
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
