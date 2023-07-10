const express = require('express')
const log4js = require('log4js')
const amqplib = require('amqplib')
const bodyParser = require('body-parser')
const uuid = require('uuid')
const jsonLayoutFactory = require('./utils')

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: jsonLayoutFactory({
        prettify: true
      }, 'server').getLog4jsLayout()
    }
  },
  categories: { default: { appenders: ['out'], level: 'debug' } }
})

const app = express()

app.use(bodyParser.json())

const logger = log4js.getLogger('main:server')
const queue = 'tasks'

const storage = {}

let ch1

(async () => {
  const conn = await amqplib.connect('') // TOOD; move it to the .env file

  ch1 = await conn.createChannel()

  process.once('SIGINT', function () {
    conn.close()
  })

  await ch1.assertQueue(`${queue}.reply`)

  // Listener
  await ch1.consume(`${queue}.reply`, (msg) => {
    const deffer = storage[msg.properties.correlationId]
    const content = JSON.parse(msg.content)

    if (deffer && !content.error) {
      deffer.resolve(content)
    } else if (deffer && content.error) {
      deffer.reject(content)
    } else {
      logger.error('Can not find right correlationId')
    }

    delete storage[msg.properties.correlationId]

    ch1.ack(msg)
  })
})()

app.post('/', async (req, res) => {
  const correlationId = uuid.v4()

  // logger.trace(correlationId)

  ch1.sendToQueue(queue, Buffer.from(JSON.stringify(req.body)), { correlationId })

  try {
    const result = await new Promise((resolve, reject) => {
      storage[correlationId] = { resolve, reject }
    })

    res.status(200).json({ data: result })
  } catch (error) {
    const reply = {
      code: error.code || 500,
      error: error.message || 'Internal error'
    }
    res.status(400).json(reply)
  }
})

app.listen(process.env.PORT, () => {
  logger.debug('Server started on port', process.env.PORT)
})
