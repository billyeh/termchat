var app = require('express')()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(process.env.PORT || 8000);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// rooms[room_name] = [user1, user2, ...]
rooms = {};
// users[username] = socket
users = {};
// requests['chat'][requester_username] = requested_username
requests = {'chat': {}, 'video': {}};

io.sockets.on('connection', function (socket) {
  socket.on('check_name', function(data) {
    console.log('Validation request for ' + data.name + ': ' + (data.name in users).toString());
    if (data.name in users) {
      socket.emit('validation', {valid: 'invalid', user: data.name});
    }
    else {
      socket.emit('validation', {valid: 'valid', user: data.name});
    }
  });

  socket.on('join', joinRoom);
  socket.on('leave', leaveRoom);

  socket.on('message', function(data) {
    console.log(io.sockets.manager.rooms);
    console.log('Message ' + data.msg + ' received from ' + data.user + ' to room ' + data.room);
    io.sockets.in(data.room).emit('new_message', {user: data.user, msg: data.msg});
  });

  socket.on('get_users', function(data) {
    console.log('User list request for room ' + data.room + ' received');
    socket.emit('user_list', {users: rooms[data.room]});
  });

  socket.on('chat_request', function(data) {
    console.log('Request to chat ' + data.other + ' from ' + data.user);
    if (!(data.other in users)) {
      socket.emit('no_user', {user: data.other});
    }
    else {
      requests['chat'][data.user] = data.other;
      users[data.other].emit('chat?', {user: data.user});
    }
  });

  socket.on('video_request', function(data) {
    console.log('Request to video chat ' + data.other + ' from ' + data.user);
    if (!users[data.other]) {
      socket.emit('no_user', {user: data.other});
    }
    else {
      requests['video'][data.user] = data.other;
      users[data.other].emit('video?', {user: data.user});
    }
  });

  socket.on('accept', function(data) {
    if (!(data.other in users)) {
      console.log('Accepted chat but ' + data.other + ' is not in ' + users);
      socket.emit('no_user', {user: data.other});
    }
    else if (data.other in requests['chat']) {
      startChat(data.user, data.other);
    }
    else if (data.other in requests['video']) {
      startVideo(data.user, data.other);
    }
    else {
      socket.emit('no_request', {user: data.other});
    }
  });
});

function joinRoom(data, socket) {
  if (!socket) {
    var socket = this;
  }
  socket.join(data.room);
  if (data.room in rooms) {
    rooms[data.room].push(data.user);
  }
  else {
    rooms[data.room] = [data.user];
  }
  console.log('Request to join room ' + data.room + ' received from ' + data.user);
  users[data.user] = socket;
  io.sockets.in(data.room).emit('new_user', {user: data.user});
}

function leaveRoom(data, socket) {
  if (!socket) {
    var socket = this;
  }
  socket.leave(data.room);
  if (data.room.replace('/', '') in rooms) {
    var index = rooms[data.room.replace('/', '')].indexOf(data.user);
    if (index > -1) {
      rooms[data.room.replace('/', '')].splice(index, 1);
    }
  }
  console.log('Request to leave room ' + data.room + ' received from ' + data.user);
  if (data.room === '' || data.room === '/') {
    delete users[data.user];
  }
  delete requests['chat'][data.user];
  delete requests['video'][data.user];
  io.sockets.in(data.room.replace('/', '')).emit('leave_user', {user: data.user});
}

function startChat(u1, u2) {
  var u1Room = Object.keys(io.sockets.manager.roomClients[users[u1].id]).filter(notDefaultRoom)[0];
  var u2Room = Object.keys(io.sockets.manager.roomClients[users[u2].id]).filter(notDefaultRoom)[0];
  if (u1Room) {
    leaveRoom({room: u1Room, user: u1}, users[u1]);
  }
  if (u2Room) {
    leaveRoom({room: u2Room, user: u2}, users[u2]);
  }
  console.log('Starting chat for ' + u1 + ' and ' + u2);
  delete requests['chat'][u2];
  joinRoom({room: u1 + u2, user: u1}, users[u1]);
  joinRoom({room: u1 + u2, user: u2}, users[u2]);
  users[u1].emit('new_room', {room: u1 + u2, user: u2});
  users[u2].emit('new_room', {room: u1 + u2, user: u1});
}

function startVideo(u1, u2) {
  console.log('Starting video for ' + u1 + ' and ' + u2); 
}

function notDefaultRoom(room) {
  return room !== '' && room !== '/';
}
