import { client } from 'octonode'
import { updateStatus, validateWebhook } from './utils/github'

export async function checkLabel(event, context, callback) {
  let response
  const githubClient = client(process.env.GITHUB_TOKEN)
  const blockLabels = process.env.BLOCK_LABELS
    // convert to array
    .split(',')
    // trim each value
    .map(label => label.trim())
    // remove empty value
    .filter(label => label.trim().length)
  const payload = {
    success: {
      state: 'success',
      description: 'Label validation passed',
      context: `${process.env.NAMESPACE} - Label validation`,
    },
    failure: {
      state: 'failure',
      description: 'Label validation failed',
      context: `${process.env.NAMESPACE} - Label validation`,
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

  // no block level defined: we allow the PR
  if (blockLabels.length === 0) {
    response = await updateStatus(githubClient, body, payload.success)

    console.log('Success: no blocked labels defined')

    return callback(null, response)
  }

  // no labels defined in the PR: we block the PR
  if (body.pull_request.labels.length === 0) {
    response = await updateStatus(githubClient, body, payload.failure)

    console.log('Fail: no labels defined in the PR')

    return callback(null, response)
  }

  // loop through PR labels to see if we found one which should block the PR
  const validation = body.pull_request.labels.every(({ name }) => {
    if (blockLabels.find(blockLabel => blockLabel === name)) {
      console.log('Fail: at least one blocked label found')

      return false
    }

    return true
  })

  response = await updateStatus(githubClient, body, validation ? payload.success : payload.failure)

  return callback(null, response)
}
