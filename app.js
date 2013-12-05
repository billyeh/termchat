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

  socket.on('join', join);
  socket.on('leave', leave);

  socket.on('message', function(data) {
    console.log('Message ' + data.msg + ' received from ' + data.user + ' to room ' + data.room);
    io.sockets.in('/' + data.room).emit('new_message', {user: data.user, msg: data.msg});
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
    console.log(data.user + ' accepting ' + data.other + '\'s chat request.');
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

function join(data) {
  this.join(data.room);
  if (data.room in rooms) {
    rooms[data.room].push(data.user);
  }
  else {
    rooms[data.room] = [data.user];
  }
  console.log('Request to join room ' + data.room + ' received from ' + data.user);
  users[data.user] = this;
  io.sockets.in(data.room).emit('new_user', {user: data.user});
}

function leave(data) {
  this.leave(data.room);
  if (data.room in rooms) {
    var index = rooms[data.room].indexOf(data.user);
    if (index > -1) {
      rooms[data.room].splice(index, 1);
    }
  }
  console.log('Request to leave room ' + data.room + ' received from ' + data.user);
  delete users[data.user];
  delete requests['chat'][data.user];
  delete requests['video'][data.user];
  io.sockets.in(data.room).emit('leave_user', {user: data.user});
}

function startChat(u1, u2) {
  console.log('Starting chat for ' + u1 + ' and ' + u2);
  var u1Room = Object.keys(io.sockets.manager.roomClients[users[u1].id])[0];
  var u2Room = Object.keys(io.sockets.manager.roomClients[users[u2].id])[0];
  delete requests['chat'][u2];
  users[u1].join({room: u1 + u2, user: u1});
  users[u2].join({room: u1 + u2, user: u2});
  users[u1].emit('new_room', {room: u1 + u2, user: u2});
  users[u2].emit('new_room', {room: u1 + u2, user: u1});
}

function startVideo(u1, u2) {
  console.log('Starting video for ' + u1 + ' and ' + u2); 
}
