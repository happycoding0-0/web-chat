// server.js - WebChat 서버 (Socket.io)
// 주요 기능: 방 생성, 입장, 퇴장, 채팅 메시지 및 파일 메시지 처리, 참가자 목록 업데이트

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// 메모리 상의 방 목록 (각 방에 생성 시각 포함)
let rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // 방 생성
  socket.on('create-room', (data, callback) => {
    const roomId = 'room_' + Date.now();
    rooms[roomId] = {
      id: roomId,
      roomName: data.roomName,
      category: data.category,
      creator: data.creator,
      isPrivate: data.isPrivate,
      password: data.password || null,
      participants: [],
      messages: [],
      createdAt: Date.now()
    };
    callback({ success: true, roomId });
    io.emit('room-list', getRoomList());
  });

  // 방 목록 요청
  socket.on('get-room-list', () => {
    socket.emit('room-list', getRoomList());
  });

  // 방 입장
  socket.on('join-room', (data, callback) => {
    const room = rooms[data.roomId];
    if (!room) {
      callback({ success: false, message: 'Room not found.' });
      return;
    }
    if (room.isPrivate && data.password !== room.password) {
      callback({ success: false, message: 'Incorrect password.' });
      return;
    }
    socket.join(data.roomId);
    room.participants.push({ id: socket.id, username: data.username, cam: true, mic: true, joinTime: Date.now() });
    socket.emit('participant-list', room.participants);
    io.to(data.roomId).emit('participant-list', room.participants);
    const now = new Date();
    const joinMsg = {
      username: 'System',
      message: `${data.username} joined at ${now.toLocaleTimeString()}`,
      timestamp: now.toISOString(),
      type: 'system'
    };
    room.messages.push(joinMsg);
    io.to(data.roomId).emit('chat-message', joinMsg);
    callback({ success: true, room });
  });

  // 채팅 기록 요청
  socket.on('get-chat-history', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      socket.emit('chat-history', room.messages);
    }
  });

  // 방 퇴장
  socket.on('leave-room', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      const participant = room.participants.find(p => p.id === socket.id);
      const name = participant ? participant.username : 'Unknown';
      const now = new Date();
      const leaveMsg = {
        username: 'System',
        message: `${name} left at ${now.toLocaleTimeString()}`,
        timestamp: now.toISOString(),
        type: 'system'
      };
      room.messages.push(leaveMsg);
      io.to(data.roomId).emit('chat-message', leaveMsg);
      room.participants = room.participants.filter(p => p.id !== socket.id);
      socket.leave(data.roomId);
      io.to(data.roomId).emit('participant-list', room.participants);
      if (room.participants.length === 0) {
        delete rooms[data.roomId];
        io.emit('room-list', getRoomList());
      }
    }
  });

  // 텍스트 채팅 메시지
  socket.on('chat-message', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      const now = new Date();
      const messageData = {
        username: data.username,
        message: data.message,
        timestamp: now.toISOString(),
        type: data.type || 'text'
      };
      room.messages.push(messageData);
      io.to(data.roomId).emit('chat-message', messageData);
    }
  });

  // 파일 메시지 처리
  socket.on('chat-file', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      const now = new Date();
      const messageData = {
        username: data.username,
        message: '',
        timestamp: now.toISOString(),
        type: 'file',
        file: data.file
      };
      room.messages.push(messageData);
      io.to(data.roomId).emit('chat-message', messageData);
    }
  });

  // 참가자 상태 업데이트 (cam/mic 등)
  socket.on('update-status', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      room.participants = room.participants.map(p => {
        if (p.id === socket.id) {
          return { ...p, cam: data.cam, mic: data.mic };
        }
        return p;
      });
      io.to(data.roomId).emit('participant-list', room.participants);
    }
  });

  // disconnecting 시 처리
  socket.on('disconnecting', () => {
    const socketRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    socketRooms.forEach(roomId => {
      const room = rooms[roomId];
      if (room) {
        const participant = room.participants.find(p => p.id === socket.id);
        const name = participant ? participant.username : 'Unknown';
        const now = new Date();
        const leaveMsg = {
          username: 'System',
          message: `${name} left at ${now.toLocaleTimeString()}`,
          timestamp: now.toISOString(),
          type: 'system'
        };
        room.messages.push(leaveMsg);
        io.to(roomId).emit('chat-message', leaveMsg);
        room.participants = room.participants.filter(p => p.id !== socket.id);
        io.to(roomId).emit('participant-list', room.participants);
        if (room.participants.length === 0) {
          delete rooms[roomId];
          io.emit('room-list', getRoomList());
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// 방 목록 정보 가공
function getRoomList() {
  return Object.values(rooms).map(room => ({
    id: room.id,
    roomName: room.roomName,
    category: room.category,
    creator: room.creator,
    participantsCount: room.participants.length,
    isPrivate: room.isPrivate,
    createdAt: room.createdAt
  }));
}

// 빈 방 자동 삭제 (1분 이상 유지된 빈 방)
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    if (room && room.participants.length === 0 && now - room.createdAt > 60000) {
      delete rooms[roomId];
      io.emit('room-list', getRoomList());
      console.log(`Auto-deleted room ${roomId} due to inactivity.`);
    }
  });
}, 30000);

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
