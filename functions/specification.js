import { Octokit } from '@octokit/rest'
import { updateStatus, validateWebhook } from './utils/github'

export async function handler(event, context, callback) {
  let response
  const githubClient = new Octokit({ auth: process.env.GITHUB_TOKEN })

  const body = JSON.parse(event.body)

  // when creating the webhook
  if (body?.hook) {
    try {
      const message = validateWebhook(body)

      console.log(message)

      response = {
        statusCode: 200,
        body: message,
      }
    } catch (e) {
      console.log(e.message)

      response = {
        statusCode: 500,
        body: e.message,
      }
    }

    return callback(null, response)
  }

  if (!body?.pull_request) {
    response = {
      statusCode: 500,
      body: 'Event is not a Pull Request',
    }

    return callback(null, response)
  }

  console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

  const payload = {
    state: 'success',
    description: 'All good!',
    context: `${process.env.NAMESPACE} - PR Specification`,
  }

  if (
    !body.pull_request?.title ||
    body.pull_request?.title?.length < process.env.CHECK_TITLE_LENGTH
  ) {
    payload.state = 'failure'
    payload.description = 'Title is too short.'

    console.log('Fail: title too short')
  }

  if (
    !body.pull_request?.body ||
    body?.pull_request?.body?.length < process.env.CHECK_BODY_LENGTH
  ) {
    payload.state = 'failure'
    payload.description = 'PR description is too short.'

    console.log('Fail: body too short')
  }

  response = await updateStatus(githubClient, body, payload)

  return callback(null, response)
}
