const util = require('util')
const FORMAT_NAME = 'log4js-message'

module.exports = function (
  {
    maxMessageLength = 14000,
    dataFieldName = 'message',
    prettify = false,
    maxOutputLength = 16383,
    useUid = false,
    useCount = false
  } = {},
  serviceName
) {
  let count = 0
  let lastStartTime

  function stringifyDataElement (el) {
    if (typeof el === 'string') {
      return el
    } else if (el instanceof Error && el.stack) {
      return el.stack
    } else {
      try {
        return JSON.stringify(el, null, prettify ? '  ' : null)
      } catch (e) {
        if (e.message.includes('circular structure')) {
          return util.inspect(el, { depth: 20, compact: !prettify })
        } else {
          throw e
        }
      }
    }
  }

  function stringifyDataArray (data) {
    if (!Array.isArray(data)) {
      data = [data]
    }
    return data.map(stringifyDataElement).join(' ')
  }

  function wrapStringMessage (e, message) {
    const { instanceId } = process.env

    const packet = {
      startTime: e.startTime,
      categoryName: e.categoryName,
      [dataFieldName]: message,
      level: e.level,
      logger: { format: FORMAT_NAME }
    }

    if (e.logger && e.logger.instanceId) {
      packet.instanceId = e.logger.instanceId
    } else if (process.env.instanceId) {
      packet.instanceId = process.env.instanceId
    }

    if (useUid) {
      packet.uid = `${serviceName} ${instanceId} ${e.startTime.toISOString()} ${count}`
    }
    if (useCount) {
      packet.count = count
    }

    return JSON.stringify(packet)
  }

  function stringifyLog4jsEvent (e) {
    if (useCount) {
      const startTime = e.startTime.valueOf()
      if (!lastStartTime || startTime !== lastStartTime) {
        lastStartTime = startTime
        count = 0
      } else {
        count++
      }
    }

    const message = stringifyDataArray(e.data)
    const result = wrapStringMessage(
      e,
      message
    )

    return result
  }

  function getLog4jsLayout () {
    return {
      type: 'pattern',
      pattern: '%x{json}',
      tokens: {
        json: stringifyLog4jsEvent
      }
    }
  }

  return {
    getLog4jsLayout
  }
}
