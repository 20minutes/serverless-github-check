const { LabelHandler } = require('./classes/LabelHandler')

const label = new LabelHandler(
  process.env.GITHUB_TOKEN,
  process.env.NAMESPACE,
  process.env.BLOCK_LABELS
)

async function handler(event, context, callback) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return callback(null, {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    })
  }

  return label.handle(JSON.parse(event.body), callback)
}

module.exports = { handler }
