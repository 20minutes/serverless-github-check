import { GraphqlResponseError } from '@octokit/graphql'
import semverDiff from 'semver/functions/diff.js'
import { Handler } from './Handler.js'

export class AutomergeHandler extends Handler {
  async handle(body, callback) {
    const response = this.validateEvent(body)

    if (response !== true) {
      return callback(null, response)
    }

    console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

    if (!['opened', 'reopened', 'synchronize'].includes(body?.action)) {
      console.log(`Wrong action: ${body?.action}`)

      return callback(null, {
        statusCode: 204,
        body: 'Wrong action',
      })
    }

    if (body?.pull_request?.mergeable === false) {
      console.log(`PR can't be merged`)

      return callback(null, {
        statusCode: 204,
        body: `PR can't be merged`,
      })
    }

    if (body?.pull_request?.base?.repo?.allow_auto_merge !== true) {
      console.log(
        `Repo does not allow auto merge: ${body?.pull_request?.base?.repo?.allow_auto_merge}`
      )

      return callback(null, {
        statusCode: 204,
        body: 'Repo does not allow auto merge',
      })
    }

    if (body?.pull_request?.user?.login !== 'dependabot[bot]') {
      console.log(`Not a PR from dependabot: ${body?.pull_request?.user?.login}`)

      return callback(null, {
        statusCode: 204,
        body: 'Not a PR from dependabot',
      })
    }

    let updateType
    const titleMatch = body.pull_request.title.match(/from ([\w.-]+) to ([\w.-]+)/i)

    // try for one deps to be updated
    // otherwise try for grouped deps, look for new version in the body instead
    if (titleMatch) {
      const [, oldVersion, newVersion] = titleMatch
      updateType = semverDiff(oldVersion, newVersion)
    } else if (body.pull_request.body.match(/Updates (.*) from (.*) to (.*)/)) {
      const res = [...body.pull_request.body.matchAll(/Updates (.*) from (.*) to (.*)/g)].some(
        (update) => {
          const [, , oldVersion, newVersion] = update

          return semverDiff(oldVersion, newVersion) === 'major'
        }
      )

      updateType = res === false ? 'minor' : 'major'
    } else {
      console.log(`Unable to dermine the update type...`)
      console.log(JSON.stringify(body.pull_request))

      return callback(null, {
        statusCode: 204,
        body: 'Unable to dermine the update type',
      })
    }

    if (updateType === 'major') {
      console.log(`Update is a major version: ${body?.pull_request?.title}`)

      return callback(null, {
        statusCode: 204,
        body: 'Update is a major version',
      })
    }

    // validate PR
    await this.graphql(
      `
    mutation validatePR($pullRequestId: ID!) {
      addPullRequestReview(input: {pullRequestId: $pullRequestId, event: APPROVE}) {
        clientMutationId
      }
    }
  `,
      {
        pullRequestId: body.pull_request.node_id,
      }
    )

    console.log('PR approved!')

    // enable auto merge OR merge it
    try {
      if (body?.pull_request?.auto_merge === null) {
        await this.graphql(
          `
        mutation enableAutoMerge($pullRequestId: ID!) {
          enablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId}) {
            clientMutationId
          }
        }
      `,
          {
            pullRequestId: body.pull_request.node_id,
          }
        )

        console.log('PR (soon to be) merged!')
      }
    } catch (error) {
      // in case of error about the PR not in clean status, it means the PR can be merge without automerge enabled
      if (
        error instanceof GraphqlResponseError &&
        error.errors?.some((e) =>
          e.message.toLowerCase().includes('pull request is in clean status')
        )
      ) {
        await this.graphql(
          `
        mutation mergePR($pullRequestId: ID!) {
          mergePullRequest(input: {pullRequestId: $pullRequestId}) {
            clientMutationId
          }
        }
      `,
          {
            pullRequestId: body.pull_request.node_id,
          }
        )

        console.log('PR merged!')
      } else {
        throw error
      }
    }

    return callback(null, {
      statusCode: 204,
      body: 'All done!',
    })
  }
}
