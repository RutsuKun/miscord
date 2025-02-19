const log = logger.withScope('messenger:handleEvent')

import { EventType, MessageEvent, PlanEvent, PollEvent, Event } from 'libfb'
import Connection from '../Connection'
import { getThread } from './index'
import handlePlan from './handlePlan'
import handlePoll from './handlePoll'

export default async function handleEvent (_event: { event: Event, type: EventType }) {
  log.trace('event', _event)
  const { event, type } = _event
  if (type === 'readReceiptEvent' || type === 'deliveryReceiptEvent') return

  const messageEvent = event as MessageEvent

  if (type.startsWith('event')) return handlePlan({ type, event: event as PlanEvent })
  if (type.startsWith('poll')) return handlePoll({ type, event: event as PollEvent })

  if (!config.messenger.handleEvents) return

  const thread = await getThread(event.threadId, type !== 'threadNameEvent')
  log.debug('Got Messenger thread')
  log.trace('thread', thread, 1)
  if (!thread) return

  let connection = await connections.getWithCreateFallback(event.threadId, thread.cleanName)
  if (!connection) return

  if (type === 'threadNameEvent') await connection.checkChannelRenames(thread.name)

  const channels = connection.getWritableChannels()
  channels.forEach(endpoint => {
    discord.getChannel(endpoint.id).send(`*${(connection as Connection).getThreads().length > 1 ? thread.name + ': ' : ''}${messageEvent.message}*`)
  })

  const threads = connection.getOtherWritableThreads(event.threadId)
  threads.forEach(async _thread => {
    log.debug('Sending Messenger message')
    const info = await messenger.client.sendMessage(_thread.id, `_${thread.name}: ${messageEvent.message}_`)
    log.trace('sent message info', info)
    log.debug('Sent message on Messenger')
  })
}
