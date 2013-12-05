var io = require('socket.io-client')
  , prompt = require('prompt')
  , blessed = require('blessed')
  , pixelr = require('pixelr');

var socket
  , username
  , other
  , room = ''
  , win
  , box
  , input;

main();

function main() {
  getName();
  socket = io.connect('http://safe-eyrie-8054.herokuapp.com/');
  socket.on('connect', function(data) {
    socket.emit('connection');
  });
  socket.on('validation', function(data) {
    if (data.valid === 'valid') {
      listen();
      getUserInput();
    }
    else {
      console.log('Sorry, that name is not available.');
      getName();
    }
  });
}

function getName() {
  prompt.message = "";
  prompt.delimiter = "";
  prompt.start();
  prompt.get(
  {
    properties: {
      name: {
        description: 'Welcome! Enter a username (e.g. e-mail if you want ' + 
                     'to connect with people you know):'.magenta
      }
    }
  }, checkName);
}

function checkName(err, result) {
  username = result.name;
  socket.emit('check_name', {name: result.name});
}

function listen() {
  socket.emit('join', {room: room, user: username});
  socket.on('user_list', function(data) {
    writeMessage('Current users: ' + JSON.stringify(data.users) + '\n');
  });
  socket.on('new_user', function(data) {
    writeMessage(data.user + ' has joined the room.\n');
  });
  socket.on('leave_user', function(data) {
    writeMessage(data.user + ' has left the room.\n');
  });
  socket.on('new_message', function(data) {
    writeMessage(data.user + ': ' + data.msg + '\n');
  });
  socket.on('chat?', function(data) {
    other = data.user;
    writeMessage(data.user + ' would like to chat with you.\n' +
                 'Type /y to accept their request.\n');
  });
  socket.on('video?', function(data) {
    other = data.user;
    writeMessage(data.user + ' would like to video chat with you.\n' +
                 'Type /y to accept their request.\n');
  });
  socket.on('no_user', function(data) {
    writeMessage('Tried chatting with ' + data.user + ', but they are not on termchat.\n' + 
                 'Type /users to see who\'s on termchat right now.\n');
  });
  socket.on('no_request', function(data) {
    writeMessage('There are no chat requests to accept right now.\n');
  });
  socket.on('new_room', function(data) {
    room = data.room;
    writeMessage('You\'ve entered a chat room with ' + data.user + '!\n');
  });
}

function getUserInput() {
  win = blessed.screen();
  win.on('keypress', function() {
    input.focus();
  });
  box = blessed.scrollablebox({
    left: 'center',
    width: '100%',
    height: '90%',
    content: 'Welcome! Type /help at any time to see valid commands. Happy chatting!\n',
    tags: true,
    mouse: true,
    scrollable: true,
    label: 'tskype',
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

  win.append(box);
  win.append(input);
  input.key(['escape', 'C-c'], function(ch, key) {
    return process.exit(0);
  });
  input.setValue('> ');
  input.on('submit', sendMessage);
  input.focus();
  win.render();
}

function writeMessage(contents, color) {
  input.setValue('> ');
  box.setContent(box.getContent() + contents);
  box.setScrollPerc(100);
  win.render();
}

function sendMessage(value) {
  var words = value.split(' ');
  if (value[0] === '>') { value = words.slice(1, words.length).join(' '); }
  if (!(!!value)) { return; }
  if (value.substring(0, 1) === '/' && value.substring(1, 2) !== '/') {
    var command = value.split(' ')[0].substring(1, value.split(' ')[0].length);
    var args = value.split(' ').slice(1, value.split(' ').length).join(' ');
    writeMessage(parseHelp(command, args));
  }
  else if (value.substring(0, 1) === '/') {
    socket.emit('message', {room: room, user: username, msg: value.substring(1, value.length)});
  }
  else {
    socket.emit('message', {room: room, user: username, msg: value});
  }
}

function parseHelp(command, args) {
  switch(command) {
    case 'help':
      return 'To send a message starting with \'/\', ' + 
              'type \'//\'.\nA list of valid commands:\n' +
              '/help: display this help message\n' +
              '/users: display a list of users in the room\n' +
              '/chat {username}: enter a chatroom with someone\n' +
              '/video {username}: enter a video call with someone\n' + 
              '/y: accept the last chat or video request you received\n';
    case 'users':
      socket.emit('get_users', {room: room});
      return '';
    case 'chat':
      if (!args.split(' ')[0]) {
        return 'Enter a username to chat with after the /chat command.\n';
      }
      socket.emit('chat_request', {user: username, other: args.split(' ')[0]});
      return 'Requesting to chat with ' + args.split(' ')[0] + '...\n';
    case 'video':
      if (!args.split(' ')[0]) {
        return 'Enter a username to video chat with after the /video command.\n';
      }
      socket.emit('video_request', {user: username, other: args.split(' ')[0]});
      return 'Requesting video call with ' + args.split(' ')[0] + '...\n';
    case 'y':
      if (!(!!other)) {
        return 'There is no request you can accept right now.\n';
      }
      socket.emit('accept', {user: username, other: other});
      return '';
    default:
      return 'Command \'' + command + '\' not recognized. Enter /help for commands.\n';
  }
}

process.on('exit', function() {
  if (socket) {
    socket.emit('leave', {room: room, user: username});
  }
});
