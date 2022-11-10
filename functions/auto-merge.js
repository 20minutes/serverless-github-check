import { GraphqlResponseError, graphql } from '@octokit/graphql'
import semverDiff from 'semver-diff'
import { validateWebhook } from './utils/github'

export async function handler(event, context, callback) {
  let response
  const body = JSON.parse(event.body)

  // when creating the webhook
  if (body?.hook) {
    try {
      const message = validateWebhook(body)

      console.log(message)

      return callback(null, {
        statusCode: 200,
        body: message,
      })
    } catch (e) {
      console.log(e.message)

      return callback(null, {
        statusCode: 500,
        body: e.message,
      })
    }
  }

  if (!body?.pull_request) {
    response = {
      statusCode: 500,
      body: 'Event is not a Pull Request',
    }

    return callback(null, response)
  }

  console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

  if (!['opened', 'reopened', 'synchronize'].includes(body?.action)) {
    console.log(`Wrong action: ${body?.action}`)

    response = {
      statusCode: 204,
      body: 'Wrong action',
    }

    return callback(null, response)
  }

  if (body?.pull_request?.mergeable === false) {
    console.log(`PR can't be merged`)

    response = {
      statusCode: 204,
      body: `PR can't be merged`,
    }

    return callback(null, response)
  }

  if (body?.pull_request?.base?.repo?.allow_auto_merge !== true) {
    console.log(
      `Repo does not allow auto merge: ${body?.pull_request?.base?.repo?.allow_auto_merge}`
    )

    response = {
      statusCode: 204,
      body: 'Repo does not allow auto merge',
    }

    return callback(null, response)
  }

  if (body?.pull_request?.user?.login !== 'dependabot[bot]') {
    console.log(`Not a PR from dependabot: ${body?.pull_request?.user?.login}`)

    response = {
      statusCode: 204,
      body: 'Not a PR from dependabot',
    }

    return callback(null, response)
  }

  const [, oldVersion, newVersion] = body.pull_request.title.match(/from (.*) to (.*)/i)
  const updateType = semverDiff(oldVersion, newVersion)

  if (updateType === 'major') {
    console.log(`Update is a major version: ${body?.pull_request?.title}`)

    response = {
      statusCode: 204,
      body: 'Update is a major version',
    }

    return callback(null, response)
  }

  console.log(JSON.stringify(body))

  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
  })

  // validate PR
  await graphqlWithAuth(
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
      await graphqlWithAuth(
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
      error.errors?.some((e) => e.message.toLowerCase().includes('pull request is in clean status'))
    ) {
      await graphqlWithAuth(
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

  response = {
    statusCode: 204,
    body: 'All done!',
  }

  return callback(null, response)
}