import { Handler } from './Handler.js'

export class ArtifactsHandler extends Handler {
  constructor(githubToken, namespace = '', artifactsRegex = '') {
    super(githubToken)

    this.namespace = namespace
    this.artifactsRegex = artifactsRegex
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
        description: 'No artifacts found in deps',
        context: `${this.namespace} - Artifacts check`,
      },
      failure: {
        state: 'failure',
        description: 'Artifacts found in deps, remove them to merge',
        context: `${this.namespace} - Artifacts check`,
      },
    }

    const files = await this.githubClient.rest.pulls.listFiles({
      owner: body.repository.owner.login,
      repo: body.repository.name,
      pull_number: body.pull_request.number,
    })

    // loop through all files to see if package.json has been updated
    const file = files.data.find(({ filename }) => filename.includes('package.json'))

    if (!file) {
      console.log('No package.json found in PR')

      response = await this.updateStatus(body, payload.success)

      return response
    }

    const refMatch = file.contents_url.match(/ref=([a-z0-9]+)/)
    if (!refMatch?.[1]) {
      console.log('no ref in package.json diff url?')

      response = await this.updateStatus(body, payload.success)

      return response
    }

    const content = await this.githubClient.rest.repos.getContent({
      owner: body.repository.owner.login,
      repo: body.repository.name,
      path: file.filename,
      ref: refMatch[1],
    })

    let packageJson = ''
    try {
      packageJson = JSON.parse(
        Buffer.from(content.data.content.toString('utf8'), 'base64').toString('ascii')
      )
    } catch (e) {
      response = await this.updateStatus(body, payload.success)
      console.log('Parsing package.json failed:', e)

      return response
    }

    const deps = {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    }

    const match = JSON.stringify(deps).match(this.artifactsRegex)

    if (match === null) {
      console.log('No match, success.')

      response = await this.updateStatus(body, payload.success)
    } else {
      console.log('Match found, failure.')

      response = await this.updateStatus(body, payload.failure)
    }

    return response
  }
}
