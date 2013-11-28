var io = require('socket.io-client')
  , prompt = require('prompt')
  , readline = require('readline')
  , blessed = require('blessed');

var socket
  , username
  , users
  , room = process.argv[2]
  , screen
  , box
  , input;

if (!(!!room)) {
  console.log('Please specify a room to join or create as the first argument.');
  process.exit();
}
start();

function start() {
  prompt.message = "";
  prompt.delimiter = "";
  prompt.start();
  prompt.get({
    properties: {
      name: {
        description: "Welcome! Please enter a username:".magenta
      }
    }
  }, function (err, result) {
    username = result.name;
    getRoom();
  });
}

function getRoom() {
  socket = io.connect('http://localhost:8000/');
  socket.on('connect', function(data) {
    socket.emit('connection');
    socket.emit('join', {room: room, user: username});
    socket.on('user_list', function(data) {
      users = data.users;
      newUser(socket);
      leaveUser(socket);
      getMessages(socket);
      getUserInput();
    });
  });
}

function newUser(socket) {
  socket.on('new_user', function(data) {
    writeMessage(data.user + ' has joined the room.\n');
  });
}

function leaveUser(socket) {
  socket.on('leave_user', function(data) {
    writeMessage(data.user + ' has left the room.\n');
  });
}

function getMessages(socket) {
  socket.on('new_message', function(data) {
    writeMessage(data.user + ': ' + data.msg + '\n');
  });
}

function getUserInput() {
  screen = blessed.screen();
  box = blessed.box({
    left: 'center',
    width: '100%',
    height: '90%',
    tags: true,
    scrollable: true,
    border: {
      type: 'line'
    }
  });
  input = blessed.textbox({
    left: 'center',
    width: '100%',
    height: '10%',
    top: '90%',
    tags: true,
    mouse: true,
    inputOnFocus: true,
    border: {
      type: 'line'
    }
  });

  screen.append(box);
  screen.append(input);
  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });
  input.setValue('> ');
  input.focus();
  input.on('submit', sendMessage);
  screen.render();
}

function writeMessage(contents, color) {
  if (box) {
    box.setContent(box.getContent() + contents);
  }
  if (screen) {
    screen.render();
  }
  input.focus();
}

function sendMessage(value) {
  var words = value.split(' ');
  value = words.slice(1, words.length).join(' ');
  if (!value) {
    return;
  }
  input.setValue('> ');
  socket.emit('message', {room: room, user: username, msg: value});
}

process.on('exit', function() {
  socket.emit('leave', {room: room, user: username})
});

/* Utility */
function filterUsers(users) {
  var user_dict = {};
  var filtered = [];
  for (var i = 0; i < users.length; i++) {
    if (!(users[i] in user_dict)) {
      user_dict[users[i]] = users[i];
      filtered.push(users[i]);
    }
  }
  return filtered;
}
