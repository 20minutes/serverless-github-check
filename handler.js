import { client } from 'octonode'

export async function checkSpecification(event, context, callback) {
  let response
  const githubClient = client(process.env.GITHUB_TOKEN)

  const body = JSON.parse(event.body)
  // when creating the webhook
  if (body && ('hook' in body)) {
    if (('organization' in body)) {
      response = {
        statusCode: 200,
        body: `Hello ${body.sender.login}, the webhook is now enabled for the organization ${body.organization.login}, enjoy!`,
      }
    } else {
      response = {
        statusCode: 200,
        body: `Hello ${body.sender.login}, the webhook is now enabled for ${body.repository.full_name}, enjoy!`,
      }
    }

    if (!body.hook.events.includes('pull_request')) {
      response = {
        statusCode: 500,
        body: 'This webhook needs the "pull_request" event. Please tick it.',
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

  if (body.pull_request.body.length < process.env.CHECK_BODY_LENGTH
   || body.pull_request.title.length < process.env.CHECK_TITLE_LENGTH) {
    payload.state = 'failure'
    payload.description = 'Specification failed'
  }

  try {
    await githubClient
      .repo(body.repository.full_name)
      .statusAsync(
        body.pull_request.head.sha,
        payload,
      )

    response = {
      statusCode: 204,
      body: `Process finished with state: ${payload.state}`,
    }
  } catch (e) {
    console.error(e)

    response = {
      statusCode: 500,
      body: `Process finished with error: ${e.message}`,
    }
  }

  console.log(response)

  return callback(null, response)
}
