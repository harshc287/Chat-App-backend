const Message = require('../models/message');
const Chat = require('../models/chat');
const User = require('../models/user');

// @desc    Send a message
// @route   POST /api/messages/
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({ message: 'Invalid data passed into request' });
    }

    const newMessage = {
      sender: req.user._id,
      content,
      chat: chatId
    };

    let message = await Message.create(newMessage);

    message = await message.populate('sender', 'username profilePicture');
    message = await message.populate('chat');
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'username email profilePicture'
    });

    // Update latest message in chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all messages for a chat
// @route   GET /api/messages/:chatId
// @access  Private
const allMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'username profilePicture email')
      .populate('chat')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/:chatId/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user._id;

    // Mark all messages in this chat as read by this user
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $ne: userId }
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  allMessages,
  markAsRead
};