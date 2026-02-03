const { Octokit } = require('@octokit/rest')
const { graphql } = require('@octokit/graphql')

class Handler {
  constructor(githubToken) {
    this.githubClient = new Octokit({
      auth: githubToken,
    })

    this.graphql = graphql.defaults({
      headers: {
        authorization: `token ${githubToken}`,
      },
    })
  }

  // eslint-disable-next-line class-methods-use-this
  validateEvent(body) {
    // when creating the webhook
    if (body && 'hook' in body) {
      try {
        if (!body.hook.events.includes('pull_request')) {
          throw new Error(`This webhook needs the "${'pull_request'}" event. Please tick it.`)
        }

        let message

        if ('organization' in body) {
          message = `Hello ${body.sender.login}, the webhook is now enabled for the organization ${body.organization.login}, enjoy!`
        } else {
          message = `Hello ${body.sender.login}, the webhook is now enabled for ${body.repository.full_name}, enjoy!`
        }

        console.log(message)

        return {
          statusCode: 200,
          body: message,
        }
      } catch (e) {
        console.log(e.message)

        return {
          statusCode: 500,
          body: e.message,
        }
      }
    }

    if (!(body && 'pull_request' in body)) {
      return {
        statusCode: 500,
        body: 'Event is not a Pull Request',
      }
    }

    return true
  }

  /**
   * Update the GitHub PR Status with the given payload
   *
   * @param object body         JSON body from GitHub event
   * @param object payload      Object to update PR (keys: status, description, context)
   *
   * @return string reponse
   */
  async updateStatus(body, payload) {
    try {
      await this.githubClient.rest.repos.createCommitStatus({
        owner: body.repository.owner.login,
        repo: body.repository.name,
        sha: body.pull_request.head.sha,
        ...payload,
      })

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
}

module.exports = { Handler }
