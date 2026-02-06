import { Handler } from './Handler.js'

export class FixupHandler extends Handler {
  constructor(githubToken, namespace = '') {
    super(githubToken)

    this.namespace = namespace
  }

  async handle(body) {
    let response = this.validateEvent(body)

    if (response !== true) {
      return response
    }

    console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

    const payload = {
      success: {
        state: 'success',
        description: 'No fixup commits in history',
        context: `${this.namespace} - Fixup check`,
      },
      failure: {
        state: 'failure',
        description: 'Fixup commits in history, squash them to merge',
        context: `${this.namespace} - Fixup check`,
      },
    }

    const compare = await this.githubClient.rest.repos.compareCommitsWithBasehead({
      owner: body.repository.owner.login,
      repo: body.repository.name,
      basehead: `${body.pull_request.base.sha}...${body.pull_request.head.sha}`,
    })

    // loop through PR labels to see if we found one which should block the PR
    const validation = compare.data.commits.every(({ commit, parents }) => {
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

    response = await this.updateStatus(body, validation ? payload.success : payload.failure)

    return response
  }
}
