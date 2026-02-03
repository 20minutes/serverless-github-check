import { ArtifactsHandler } from './classes/ArtifactsHandler.js'

const artifacts = new ArtifactsHandler(
  process.env.GITHUB_TOKEN,
  process.env.NAMESPACE,
  process.env.ARTIFACTS_REGEX
)

export async function handler(event, context, callback) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return callback(null, {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    })
  }

  return artifacts.handle(JSON.parse(event.body), callback)
}
