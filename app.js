var app = require('express')()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(8000);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

room_dict = {};
user_dict = {};

io.sockets.on('connection', function (socket) {
  socket.on('join', function (data) {
    socket.join(data.room);
    if (data.room in room_dict) {
      room_dict[data.room].push(data.user);
    } else {
      room_dict[data.room] = [data.user];
    }
    console.log('Request to join room ' + data.room + ' received from ' + data.user);
    user_dict[data.user] = socket;
    io.sockets.in(data.room).emit('new_user', {user: data.user});
  });

  socket.on('leave', function (data) {
    socket.leave(data.room);
    if (data.room in room_dict) {
      var index = room_dict[data.room].indexOf(data.user);
      if (index > -1) {
        room_dict[data.room].splice(index, 1);
      }
    }
    console.log('Request to leave room ' + data.room + ' received from ' + data.user);
    delete user_dict[data.user];
    io.sockets.in(data.room).emit('leave_user', {user: data.user});
  });

  socket.on('message', function(data) {
    console.log('Message ' + data.msg + ' received from ' + data.user);
    io.sockets.in(data.room).emit('new_message', {user: data.user, msg: data.msg});
  });

  socket.on('get_users', function(data) {
    console.log('User list request for room ' + data.room + ' received');
    socket.emit('user_list', {users: room_dict[data.room]});
  });

  socket.on('video_request', function(data) {
    console.log('Request to video chat ' + data.other + ' from ' + data.user);
  });

  socket.on('chat_request', function(data) {
    console.log('Request to video chat ' + data.other + ' from ' + data.user);
  });
});
