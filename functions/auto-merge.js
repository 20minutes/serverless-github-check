const { AutomergeHandler } = require('./classes/AutomergeHandler')

const autoMerge = new AutomergeHandler(process.env.GITHUB_TOKEN)

async function handler(event, context, callback) {
  if (event.headers?.['content-type'] === 'application/x-www-form-urlencoded') {
    return callback(null, {
      statusCode: 500,
      body: 'Please choose "application/json" as Content type in the webhook definition (you should re-create it)',
    })
  }

  return autoMerge.handle(JSON.parse(event.body), callback)
}

module.exports = { handler }
