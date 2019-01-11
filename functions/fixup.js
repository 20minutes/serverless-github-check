import { client } from 'octonode'
import { updateStatus, validateWebhook } from './utils/github'

export async function checkFixupCommits(event, context, callback) {
  let response
  const githubClient = client(process.env.GITHUB_TOKEN)
  const payload = {
    success: {
      state: 'success',
      description: 'No fixup commits in history',
      context: `${process.env.NAMESPACE} - Fixup check`,
    },
    failure: {
      state: 'failure',
      description: 'Fixup commits in history, please squash them!',
      context: `${process.env.NAMESPACE} - Fixup check`,
    },
  }

  const body = JSON.parse(event.body)

  // when creating the webhook
  if (body && ('hook' in body)) {
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

  if (!(body && ('pull_request' in body))) {
    response = {
      statusCode: 500,
      body: 'Event is not a Pull Request',
    }

    return callback(null, response)
  }

  console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

  const compare = await githubClient
    .repo(body.repository.full_name)
    .compareAsync(body.pull_request.base.sha, body.pull_request.head.sha)

  // loop through PR labels to see if we found one which should block the PR
  const validation = compare[0].commits.every(({ commit, parents }) => {
    const isMerge = parents && parents.length > 1

    if (isMerge) {
      return true
    }

    const match = /^fixup! .*$/im.exec(commit.message)

    if (match === null) {
      return true
    }

    console.log(`Fixup commit found: "${commit.message}"`)

    return false
  })

  response = await updateStatus(githubClient, body, validation ? payload.success : payload.failure)

  return callback(null, response)
}
