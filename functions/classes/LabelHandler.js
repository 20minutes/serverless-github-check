import { Handler } from './Handler'

export class LabelHandler extends Handler {
  constructor(githubToken, namespace = '', blockLabels = '') {
    super(githubToken)

    this.namespace = namespace
    this.blockLabels = blockLabels
      // convert to array
      .split(',')
      // trim each value
      .map((label) => label.trim())
      // remove empty value
      .filter((label) => label.trim().length)
  }

  async handle(body, callback) {
    let response = this.validateEvent(body)

    if (response !== true) {
      return callback(null, response)
    }

    console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

    const payload = {
      success: {
        state: 'success',
        description: 'Label validation passed',
        context: `${this.namespace} - Label validation`,
      },
      failure: {
        state: 'failure',
        description: 'Label validation failed',
        context: `${this.namespace} - Label validation`,
      },
    }

    // no block level defined: we allow the PR
    if (this.blockLabels.length === 0) {
      response = await this.updateStatus(body, payload.success)

      console.log('Success: no blocked labels defined')

      return callback(null, response)
    }

    // no labels defined in the PR: we block the PR
    if (body.pull_request.labels.length === 0) {
      response = await this.updateStatus(body, payload.failure)

      console.log('Fail: no labels defined in the PR')

      return callback(null, response)
    }

    // loop through PR labels to see if we found one which should block the PR
    const validation = body.pull_request.labels.every(({ name }) => {
      if (this.blockLabels.find((blockLabel) => blockLabel === name)) {
        console.log('Fail: at least one blocked label found')

        return false
      }

      return true
    })

    response = await this.updateStatus(body, validation ? payload.success : payload.failure)

    return callback(null, response)
  }
}
