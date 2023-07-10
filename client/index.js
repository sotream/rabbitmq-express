const amqplib = require('amqplib')
const log4js = require('log4js')
const jsonLayoutFactory = require('./utils')

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: jsonLayoutFactory({
        prettify: true
      }, 'client').getLog4jsLayout()
    }
  },
  categories: { default: { appenders: ['out'], level: 'trace' } }
})

const logger = log4js.getLogger('main:client')

const queue = 'tasks'

let ch1;

(async () => {
  const conn = await amqplib.connect('') // TOOD; move it to the .env file

  ch1 = await conn.createChannel()

  process.once('SIGINT', function () {
    conn.close()
  })

  await ch1.assertQueue(queue)
  await ch1.assertQueue(`${queue}.reply`)

  // Listener
  await ch1.consume(queue, (msg) => {
    const content = JSON.parse(msg.content.toString())
    const { correlationId } = msg.properties

    // logger.trace(correlationId, content)

    const reply = {
      code: 200,
      data: { name: 'John' }
    }

    if (content.error) {
      delete reply.data

      reply.code = 400
      reply.error = 'Something went wrong'
    }

    ch1.sendToQueue(`${queue}.reply`, Buffer.from(JSON.stringify(reply)), { correlationId })

    ch1.ack(msg)
  })
})()
