/**
 * Validate that the given body is as the required given event in it
 *
 * @param object body          JSON body from GitHub event
 * @param string requiredEvent Required enabled event for the webhook
 *
 * @return string
 */
export function validateWebhook(body, requiredEvent = 'pull_request') {
  if (!body.hook.events.includes(requiredEvent)) {
    throw new Error(`This webhook needs the "${requiredEvent}" event. Please tick it.`)
  }

  if ('organization' in body) {
    return `Hello ${body.sender.login}, the webhook is now enabled for the organization ${body.organization.login}, enjoy!`
  }

  return `Hello ${body.sender.login}, the webhook is now enabled for ${body.repository.full_name}, enjoy!`
}

/**
 * Update the GitHub PR Status with the given payload
 *
 * @param object githubClient GitHub client from octonode
 * @param object body         JSON body from GitHub event
 * @param object payload      Object to update PR (keys: status, description, context)
 *
 * @return string reponse
 */
export async function updateStatus(githubClient, body, payload) {
  try {
    await githubClient
      .repo(body.repository.full_name)
      .statusAsync(body.pull_request.head.sha, payload)

    return {
      statusCode: 204,
      body: `Process finished with state: ${payload.state}`,
    }
  } catch (e) {
    console.error(e)

    return {
      statusCode: 500,
      body: `Process finished with error: ${e.message}`,
    }
  }
}
