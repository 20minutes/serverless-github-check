import { FixupHandler } from './classes/FixupHandler.js'

const fixup = new FixupHandler(process.env.GITHUB_TOKEN, process.env.NAMESPACE)

export async function handler(event) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    }
  }

  return fixup.handle(JSON.parse(event.body))
}
