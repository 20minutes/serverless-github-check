import { Handler } from './Handler.js'

export class SpecificationHandler extends Handler {
  constructor(githubToken, namespace = '', titleLength = 8, bodyLength = 8) {
    super(githubToken)

    this.namespace = namespace
    this.titleLength = titleLength
    this.bodyLength = bodyLength
  }

  async handle(body, callback) {
    let response = this.validateEvent(body)

    if (response !== true) {
      return callback(null, response)
    }

    console.log(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

    const payload = {
      state: 'success',
      description: 'All good!',
      context: `${this.namespace} - PR Specification`,
    }

    if (!body.pull_request?.title || body.pull_request?.title?.length < this.titleLength) {
      payload.state = 'failure'
      payload.description = 'Title is too short.'

      console.log('Fail: title too short')
    }

    if (!body.pull_request?.body || body?.pull_request?.body?.length < this.bodyLength) {
      payload.state = 'failure'
      payload.description = 'PR description is too short.'

      console.log('Fail: body too short')
    }

    response = await this.updateStatus(body, payload)

    return callback(null, response)
  }
}
