import fetchMock from '@fetch-mock/jest'
import { ArtifactsHandler } from '../functions/classes/ArtifactsHandler'
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

describe('Artifacts check', () => {
  afterEach(() => {
    fetchMock.removeRoutes({ includeSticky: true, includeFallback: true })
    fetchMock.clearHistory()
    fetchMock.unmockGlobal()
  })

  test('no package.json file', async () => {
    fetchMock
      .mockGlobal()
      .route('https://api.github.com/repos/foo/bar/pulls/42/files', [
        {
          sha: '439ab55046d47ca9cbe2d0edbfad02813e1df661',
          filename: 'src/assets.ts',
          status: 'modified',
          additions: 20,
          deletions: 0,
          changes: 20,
          blob_url:
            'https://github.com/foo/bar/blob/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          raw_url:
            'https://github.com/foo/bar/raw/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          contents_url:
            'https://api.github.com/repos/foo/bar/contents/src%2Fassets.ts?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
          patch:
            "@@ -1,6 +1,8 @@\n import type {} from 'typed-query-selector/strict'\n \n let headerMobile: HTMLElement | null\n+let headerBtnMenu: HTMLButtonElement | null\n+let headerBtnBack: HTMLButtonElement",
        },
      ])
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

    const fixup = new ArtifactsHandler('GH_TOKEN', 'THE BRAND', 'REGEX')
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
          description: 'No artifacts found in deps',
          context: 'THE BRAND - Artifacts check',
        },
      }
    )
  })

  test('got a package.json file but regex fail', async () => {
    fetchMock
      .mockGlobal()
      .route('https://api.github.com/repos/foo/bar/pulls/42/files', [
        {
          sha: 'c14ebcf2a1782dec1bf65b2d4fbc295964b81754',
          filename: 'package.json',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/foo/bar/blob/d3f0969ba9b5d5f5713fd804246886917adab874/package.json',
          raw_url:
            'https://github.com/foo/bar/raw/d3f0969ba9b5d5f5713fd804246886917adab874/package.json',
          contents_url:
            'https://api.github.com/repos/foo/bar/contents/package.json?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
          patch:
            '@@ -53,7 +53,7 @@\n   },\n   "dependencies": {\n     "aws-rum-web": "^1.25.0",\n-     "classnames": "^2.5.0",\n+     "classnames": "^2.5.1",\n     "dodo": "^0.11.7",',
        },
        {
          sha: '439ab55046d47ca9cbe2d0edbfad02813e1df661',
          filename: 'src/assets.ts',
          status: 'modified',
          additions: 20,
          deletions: 0,
          changes: 20,
          blob_url:
            'https://github.com/foo/bar/blob/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          raw_url:
            'https://github.com/foo/bar/raw/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          contents_url:
            'https://api.github.com/repos/foo/bar/contents/src%2Fassets.ts?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
          patch:
            "@@ -1,6 +1,8 @@\n import type {} from 'typed-query-selector/strict'\n \n let headerMobile: HTMLElement | null\n+let headerBtnMenu: HTMLButtonElement | null\n+let headerBtnBack: HTMLButtonElement",
        },
      ])
      .route(
        'https://api.github.com/repos/foo/bar/contents/package.json?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
        {
          name: 'package.json',
          path: 'package.json',
          sha: 'c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
          size: 2868,
          url: 'https://api.github.com/repos/20minutes/thundra/contents/package.json?ref=d85673bd0d81b4ecdc3c4c52936cbcdb778b7751',
          html_url:
            'https://github.com/20minutes/thundra/blob/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json',
          git_url:
            'https://api.github.com/repos/20minutes/thundra/git/blobs/c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
          download_url:
            'https://raw.githubusercontent.com/20minutes/thundra/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json?token=AAUILIMSMV5HAKKH4FRRQH3JBX7YI',
          type: 'file',
          content:
            'ewogICJuYW1lIjogIm15X3BhY2thZ2UiLAogICJkZXNjcmlwdGlvbiI6ICJtYWtlIHlvdXIgcGFja2FnZSBlYXNpZXIgdG8gZmluZCBvbiB0aGUgbnBtIHdlYnNpdGUiLAogICJ2ZXJzaW9uIjogIjEuMC4wIiwKICAic2NyaXB0cyI6IHsKICAgICJ0ZXN0IjogImVjaG8gXCJFcnJvcjogbm8gdGVzdCBzcGVjaWZpZWRcIiAmJiBleGl0IDEiCiAgfSwKICAicmVwb3NpdG9yeSI6IHsKICAgICJ0eXBlIjogImdpdCIsCiAgICAidXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9tb25hdGhlb2N0b2NhdC9teV9wYWNrYWdlLmdpdCIKICB9LAogICJrZXl3b3JkcyI6IFtdLAogICJhdXRob3IiOiAiIiwKICAibGljZW5zZSI6ICJJU0MiLAogICJidWdzIjogewogICAgInVybCI6ICJodHRwczovL2dpdGh1Yi5jb20vbW9uYXRoZW9jdG9jYXQvbXlfcGFja2FnZS9pc3N1ZXMiCiAgfSwKICAiaG9tZXBhZ2UiOiAiaHR0cHM6Ly9naXRodWIuY29tL21vbmF0aGVvY3RvY2F0L215X3BhY2thZ2UiCn0=',
          encoding: 'base64',
          _links: {
            self: 'https://api.github.com/repos/20minutes/thundra/contents/package.json?ref=d85673bd0d81b4ecdc3c4c52936cbcdb778b7751',
            git: 'https://api.github.com/repos/20minutes/thundra/git/blobs/c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
            html: 'https://github.com/20minutes/thundra/blob/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json',
          },
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

    const fixup = new ArtifactsHandler('GH_TOKEN', 'THE BRAND', 'REGEX')
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
          description: 'No artifacts found in deps',
          context: 'THE BRAND - Artifacts check',
        },
      }
    )
  })

  test('got a package.json file and block merge', async () => {
    fetchMock
      .mockGlobal()
      .route('https://api.github.com/repos/foo/bar/pulls/42/files', [
        {
          sha: 'c14ebcf2a1782dec1bf65b2d4fbc295964b81754',
          filename: 'package.json',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/foo/bar/blob/d3f0969ba9b5d5f5713fd804246886917adab874/package.json',
          raw_url:
            'https://github.com/foo/bar/raw/d3f0969ba9b5d5f5713fd804246886917adab874/package.json',
          contents_url:
            'https://api.github.com/repos/foo/bar/contents/package.json?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
          patch:
            '@@ -53,7 +53,7 @@\n   },\n   "dependencies": {\n     "aws-rum-web": "^1.25.0",\n-     "classnames": "^2.5.0",\n+     "classnames": "^2.5.1",\n     "dodo": "^0.11.7",',
        },
        {
          sha: '439ab55046d47ca9cbe2d0edbfad02813e1df661',
          filename: 'src/assets.ts',
          status: 'modified',
          additions: 20,
          deletions: 0,
          changes: 20,
          blob_url:
            'https://github.com/foo/bar/blob/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          raw_url:
            'https://github.com/foo/bar/raw/d3f0969ba9b5d5f5713fd804246886917adab874/src%2Fassets.ts',
          contents_url:
            'https://api.github.com/repos/foo/bar/contents/src%2Fassets.ts?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
          patch:
            "@@ -1,6 +1,8 @@\n import type {} from 'typed-query-selector/strict'\n \n let headerMobile: HTMLElement | null\n+let headerBtnMenu: HTMLButtonElement | null\n+let headerBtnBack: HTMLButtonElement",
        },
      ])
      .route(
        'https://api.github.com/repos/foo/bar/contents/package.json?ref=d3f0969ba9b5d5f5713fd804246886917adab874',
        {
          name: 'package.json',
          path: 'package.json',
          sha: 'c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
          size: 2868,
          url: 'https://api.github.com/repos/20minutes/thundra/contents/package.json?ref=d85673bd0d81b4ecdc3c4c52936cbcdb778b7751',
          html_url:
            'https://github.com/20minutes/thundra/blob/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json',
          git_url:
            'https://api.github.com/repos/20minutes/thundra/git/blobs/c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
          download_url:
            'https://raw.githubusercontent.com/20minutes/thundra/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json?token=AAUILIMSMV5HAKKH4FRRQH3JBX7YI',
          type: 'file',
          content:
            'ewogICJuYW1lIjogIm15X3BhY2thZ2UiLAogICJkZXNjcmlwdGlvbiI6ICJtYWtlIHlvdXIgcGFja2FnZSBlYXNpZXIgdG8gZmluZCBvbiB0aGUgbnBtIHdlYnNpdGUiLAogICJ2ZXJzaW9uIjogIjEuMC4wIiwKICAic2NyaXB0cyI6IHsKICAgICJ0ZXN0IjogImVjaG8gXCJFcnJvcjogbm8gdGVzdCBzcGVjaWZpZWRcIiAmJiBleGl0IDEiCiAgfSwKICAicmVwb3NpdG9yeSI6IHsKICAgICJ0eXBlIjogImdpdCIsCiAgICAidXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9tb25hdGhlb2N0b2NhdC9teV9wYWNrYWdlLmdpdCIKICB9LAogICJrZXl3b3JkcyI6IFtdLAogICJhdXRob3IiOiAiIiwKICAibGljZW5zZSI6ICJJU0MiLAogICJidWdzIjogewogICAgInVybCI6ICJodHRwczovL2dpdGh1Yi5jb20vbW9uYXRoZW9jdG9jYXQvbXlfcGFja2FnZS9pc3N1ZXMiCiAgfSwKICAiaG9tZXBhZ2UiOiAiaHR0cHM6Ly9naXRodWIuY29tL21vbmF0aGVvY3RvY2F0L215X3BhY2thZ2UiCn0=',
          encoding: 'base64',
          _links: {
            self: 'https://api.github.com/repos/20minutes/thundra/contents/package.json?ref=d85673bd0d81b4ecdc3c4c52936cbcdb778b7751',
            git: 'https://api.github.com/repos/20minutes/thundra/git/blobs/c366d3955407f49b5110aae7d8d04fcf0b3ef1de',
            html: 'https://github.com/20minutes/thundra/blob/d85673bd0d81b4ecdc3c4c52936cbcdb778b7751/package.json',
          },
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

    const fixup = new ArtifactsHandler('GH_TOKEN', 'THE BRAND', '(monatheoctocat|super)')
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
          description: 'Artifacts found in deps, remove them to merge',
          context: 'THE BRAND - Artifacts check',
        },
      }
    )
  })
})
