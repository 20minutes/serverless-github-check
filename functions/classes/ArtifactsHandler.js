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

    console.info(`Working on repo ${body.repository.full_name} for PR #${body.pull_request.number}`)

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

    // loop through all files to see if package.json has been updated (root or subfolders)
    const packageJsonFiles = files.data.filter(
      ({ filename }) => filename === 'package.json' || filename.endsWith('/package.json')
    )

    if (packageJsonFiles.length === 0) {
      console.info('No package.json found in PR')

      response = await this.updateStatus(body, payload.success)

      return response
    }

    let artifactFound = false

    for (const file of packageJsonFiles) {
      const refMatch = file.contents_url.match(/ref=([a-z0-9]+)/)
      if (!refMatch?.[1]) {
        console.warn(`no ref in ${file.filename} diff url?`)
        continue
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
        console.error(`Parsing ${file.filename} failed:`, e)
        continue
      }

      const deps = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
      }

      const match = JSON.stringify(deps).match(this.artifactsRegex)

      if (match !== null) {
        artifactFound = true
        break
      }
    }

    if (!artifactFound) {
      console.info('No match, success.')

      response = await this.updateStatus(body, payload.success)
    } else {
      console.warn('Match found, failure.')

      response = await this.updateStatus(body, payload.failure)
    }

    return response
  }
}
