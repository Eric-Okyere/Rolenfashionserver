const Message = require('../models/Message');
const logActivity = require('../utils/activityLog');
const { notifyNewMessage } = require('../utils/whatsapp');

// POST /api/messages (public contact form)
async function createMessage(req, res) {
  const message = await Message.create(req.body);

  await logActivity({
    type: 'message.received',
    summary: `New message from ${message.name}${message.subject ? `: ${message.subject}` : ''}`,
    meta: { messageId: message._id },
  });

  // Fire-and-forget (not awaited) so a slow or unconfigured WhatsApp API
  // never delays the visitor's response — see utils/whatsapp.js.
  notifyNewMessage({ name: message.name, subject: message.subject });

  res.status(201).json({ message: 'Thanks for reaching out — we will get back to you soon.', id: message._id });
}

// GET /api/messages (admin)
async function listMessages(req, res) {
  const messages = await Message.find().sort({ createdAt: -1 });
  res.json({ messages });
}

// PATCH /api/messages/:id/read (admin)
async function markRead(req, res) {
  const message = await Message.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
  if (!message) return res.status(404).json({ message: 'Message not found.' });
  res.json({ message: message });
}

// DELETE /api/messages/:id (admin)
async function deleteMessage(req, res) {
  await Message.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted.' });
}

module.exports = { createMessage, listMessages, markRead, deleteMessage };
