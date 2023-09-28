import { SpecificationHandler } from './classes/SpecificationHandler'

const spec = new SpecificationHandler(
  process.env.GITHUB_TOKEN,
  process.env.NAMESPACE,
  process.env.CHECK_TITLE_LENGTH,
  process.env.CHECK_BODY_LENGTH
)

export async function handler(event, context, callback) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return callback(null, {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    })
  }

  return spec.handle(JSON.parse(event.body), callback)
}
