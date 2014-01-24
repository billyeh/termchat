var app = require('express')()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server, {log: false});

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
    console.log('Validation request for ' + data.name);
    if (data.name in users || data.name.length < 1) {
      socket.emit('validation', {valid: 'invalid', user: data.name});
    }
    else {
      socket.emit('validation', {valid: 'valid', user: data.name});
    }
  });

  socket.on('join', joinRoom);

  socket.on('leave', leaveRoom);

  socket.on('message', function(data) {
    console.log('Message ' + data.msg + ' received from ' + data.user + ' to room ' + data.room);
    io.sockets.in(data.room).emit('new_message', {user: data.user, msg: data.msg});
  });

  socket.on('get_users', function(data) {
    console.log('User list request for room ' + data.room + ' received');
    socket.emit('user_list', {users: rooms[data.room]});
  });

  socket.on('chat_request', function(data) {
    delete requests['video'][data.user];
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
    delete requests['chat'][data.user];
    console.log('Request to video chat ' + data.other + ' from ' + data.user);
    if (!(data.other in users)) {
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
  });

  socket.on('send_frame', function(data) {
    console.log('Frame received from ' + data.user + ' to ' + data.other);
    if (users[data.other]) {
      users[data.other].emit('receive_frame', {pixels: data.pixels});
    }
  });

  socket.on('disconnect', function(data) {
    console.log('Disconnecting socket with id ' + this.id);
    for (user in users) {
      if (users[user] === this) {
        leaveRoom({user: user, room: '/'}, this);
      }
    }
  });
});

function joinRoom(data, socket) {
  console.log('Request to join room ' + data.room + ' received from ' + data.user);
  if (!socket) {
    socket = this;
  }
  socket.join(data.room);
  if (data.room in rooms) {
    rooms[data.room].push(data.user);
  }
  else {
    rooms[data.room] = [data.user];
  }
  users[data.user] = socket;
  io.sockets.in(data.room).emit('new_user', {user: data.user});
}

function leaveRoom(data, socket) {
  var index;

  console.log('Request to leave room ' + data.room + ' received from ' + data.user);
  if (!socket) {
    socket = this;
  }
  socket.leave(data.room);
  if (data.room.replace('/', '') in rooms) {
    index = rooms[data.room.replace('/', '')].indexOf(data.user);
    if (index > -1) {
      rooms[data.room.replace('/', '')].splice(index, 1);
    }
  }
  if (data.room === '' || data.room === '/') {
    delete users[data.user];
  }
  delete requests['chat'][data.user];
  delete requests['video'][data.user];
  io.sockets.in(data.room.replace('/', '')).emit('leave_user', {user: data.user});
}

function startChat(u1, u2) {
  var u1Room
    , u2Room;

  console.log('Starting chat for ' + u1 + ' and ' + u2);
  // users apparently cannot leave the '' and '/' default rooms
  u1Room = Object.keys(io.sockets.manager.roomClients[users[u1].id]).filter(notDefaultRoom)[0];
  u2Room = Object.keys(io.sockets.manager.roomClients[users[u2].id]).filter(notDefaultRoom)[0];
  if (u1Room) {
    leaveRoom({room: u1Room, user: u1}, users[u1]);
  }
  if (u2Room) {
    leaveRoom({room: u2Room, user: u2}, users[u2]);
  }
  delete requests['chat'][u2];
  joinRoom({room: u1 + u2, user: u1}, users[u1]);
  joinRoom({room: u1 + u2, user: u2}, users[u2]);
  users[u1].emit('new_room', {room: u1 + u2, user: u2});
  users[u2].emit('new_room', {room: u1 + u2, user: u1});
}

function startVideo(u1, u2) {
  console.log('Starting video for ' + u1 + ' and ' + u2);
  startChat(u1, u2);
  users[u1].emit('send_video', {other: u2});
  users[u2].emit('send_video', {other: u1});
}

function notDefaultRoom(room) {
  return room !== '' && room !== '/';
}
