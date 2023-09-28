import { FixupHandler } from './classes/FixupHandler'

const fixup = new FixupHandler(process.env.GITHUB_TOKEN, process.env.NAMESPACE)

export async function handler(event, context, callback) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return callback(null, {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    })
  }

  return fixup.handle(JSON.parse(event.body), callback)
}
