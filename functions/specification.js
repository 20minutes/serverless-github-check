import { client } from 'octonode'
import { updateStatus, validateWebhook } from './utils/github'

export async function checkSpecification(event, context, callback) {
  let response
  const githubClient = client(process.env.GITHUB_TOKEN)

  const body = JSON.parse(event.body)

  // when creating the webhook
  if (body && ('hook' in body)) {
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

  if (!(body && ('pull_request' in body))) {
    response = {
      statusCode: 500,
      body: 'Event is not a Pull Request',
    }

    return callback(null, response)
  }

  console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

  const payload = {
    state: 'success',
    description: 'Specification passed',
    context: `${process.env.NAMESPACE} - PR Specification`,
  }

  if (body.pull_request.title.length < process.env.CHECK_TITLE_LENGTH) {
    payload.state = 'failure'
    payload.description = 'Specification failed'

    console.log('Fail: title too short')
  }

  if (body.pull_request.body.length < process.env.CHECK_BODY_LENGTH) {
    payload.state = 'failure'
    payload.description = 'Specification failed'

    console.log('Fail: body too short')
  }

  response = await updateStatus(githubClient, body, payload)

  return callback(null, response)
}
