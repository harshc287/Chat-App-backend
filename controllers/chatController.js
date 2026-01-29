const Chat = require('../models/chat');
const User = require('../models/user');

// @desc    Create or fetch one-to-one chat
// @route   POST /api/chats/
// @access  Private
const accessChat = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'UserId param not sent with request' });
    }

    // Check if chat already exists between the two users
    let isChat = await Chat.find({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user._id } } },
        { users: { $elemMatch: { $eq: userId } } }
      ]
    })
      .populate('users', '-password')
      .populate('latestMessage');

    // Populate latestMessage sender info
    isChat = await User.populate(isChat, {
      path: 'latestMessage.sender',
      select: 'username email profilePicture'
    });

    if (isChat.length > 0) {
      return res.json(isChat[0]);
    } else {
      // Create new chat
      const chatData = {
        chatName: 'sender',
        isGroupChat: false,
        users: [req.user._id, userId]
      };

      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findById(createdChat._id).populate(
        'users',
        '-password'
      );
      res.status(201).json(fullChat);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch all chats for a user
// @route   GET /api/chats/
// @access  Private
const fetchChats = async (req, res, next) => {
  try {
    let chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate('users', '-password')
      .populate('groupAdmin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    chats = await User.populate(chats, {
      path: 'latestMessage.sender',
      select: 'username email profilePicture'
    });

    res.json(chats);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new group chat
// @route   POST /api/chats/group
// @access  Private
const createGroupChat = async (req, res, next) => {
  try {
    const { users, name } = req.body;

    if (!users || !name) {
      return res.status(400).json({ message: 'Please fill all the fields' });
    }

    // Convert string of users to array
    const usersArray = JSON.parse(users);

    if (usersArray.length < 2) {
      return res.status(400).json({ message: 'More than 2 users are required to form a group chat' });
    }

    // Add current user to the group
    usersArray.push(req.user._id);

    const groupChat = await Chat.create({
      chatName: name,
      users: usersArray,
      isGroupChat: true,
      groupAdmin: req.user._id
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    res.status(201).json(fullGroupChat);
  } catch (error) {
    next(error);
  }
};

// @desc    Rename group
// @route   PUT /api/chats/group/rename
// @access  Private
const renameGroup = async (req, res, next) => {
  try {
    const { chatId, chatName } = req.body;

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!updatedChat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(updatedChat);
  } catch (error) {
    next(error);
  }
};

// @desc    Add user to group
// @route   PUT /api/chats/group/add
// @access  Private
const addToGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    const added = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userId } },
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!added) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(added);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove user from group
// @route   PUT /api/chats/group/remove
// @access  Private
const removeFromGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    // Check if the requester is group admin
    const chat = await Chat.findById(chatId);
    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admin can remove users' });
    }

    const removed = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!removed) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(removed);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup
};