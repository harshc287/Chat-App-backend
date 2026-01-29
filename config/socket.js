const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const socketConfig = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000'],
      credentials: true
    }
  });

  // Store online users
  const onlineUsers = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id;
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId.toString(), socket.id);

    // Notify others about user online status
    socket.broadcast.emit('user-online', { userId: socket.userId });

    // Join chat room
    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat: ${chatId}`);
    });

    // Leave chat room
    socket.on('leave-chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat: ${chatId}`);
    });

    // Send message
    socket.on('send-message', (data) => {
      const { chatId, message, senderId } = data;
      
      // Broadcast to everyone in the chat room except sender
      socket.to(chatId).emit('receive-message', {
        chatId,
        message,
        senderId,
        timestamp: new Date()
      });

      // Also emit to sender for real-time update
      socket.emit('message-sent', {
        chatId,
        message,
        senderId,
        timestamp: new Date()
      });
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId.toString());
      socket.broadcast.emit('user-offline', { userId: socket.userId });
    });
  });

  // Function to get socket instance
  const getSocketInstance = () => io;

  return { io, onlineUsers, getSocketInstance };
};

module.exports = socketConfig;