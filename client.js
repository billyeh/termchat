function client() {

  var io = require('socket.io-client')
    , prompt = require('prompt')
    , blessed = require('blessed')
    , pixelr = require('pixelr')
    , execute = require('child_process').exec;

  var socket
    , username
    , other
    , room = ''
    , win
    , box
    , input
    , video
    , videoInterval
    , scrollLock = false;

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

  function getName() {
    prompt.message = "";
    prompt.delimiter = "";
    prompt.start();
    prompt.get(
    {
      properties: {
        name: {
          description: 'Welcome! Enter a username (e.g. e-mail if you want '.magenta +
                       'to connect with people you know):'.magenta
        }
      }
    }, checkName);
  }

  function checkName(err, result) {
    if (!err) {
      username = result.name;
      socket.emit('check_name', {name: result.name});
    }
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
      writeMessage('{bold}' + data.user + '{/bold}: ' + data.msg + '\n', false);
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
    socket.on('new_room', function(data) {
      clearInterval(videoInterval);
      room = data.room;
      writeMessage('You\'ve entered a chat room with ' + data.user + '!\n');
    });
    socket.on('send_video', function(data) {
      receiveVideo();
      sendVideo(data);
    });
  }

  function getUserInput() {
    win = blessed.screen();
    win.on('keypress', function() {
      input.focus();
    });
    
    box = blessed.scrollablebox({
      left: '0',
      width: '100%',
      height: '90%',
      content: 'Type /help at any time to see valid commands.\n',
      tags: true,
      mouse: true,
      scrollable: true,
      label: 'tskype',
      border: {
        type: 'line'
      }
    });
    input = blessed.textbox({
      left: '0',
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

  function writeMessage(contents, useColor) {
    var scrollHeight, setHeight;
    if (scrollLock) {
      scrollHeight = box.getScrollPerc();
    }
    if (!(useColor === false)) {
      contents = '{blue-fg}' + contents + '{/blue-fg}';
    }
    input.setValue('> ');
    box.setContent(box.getContent() + contents + scrollHeight);
    if (box.getContent().split('\n').length > win.height) {
      setHeight = scrollLock ? scrollHeight : 100;
      box.setScrollPerc(setHeight);
    }
    win.render();
  }

  function sendMessage(value) {
    value = value.trim();
    if (value.substring(0, 1) === '>') {
      value = value.substring(1).trim();
    }
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
                '/y: accept the last chat or video request you received\n' + 
                '/scroll: toggle scroll lock\n';
      case 'users':
        socket.emit('get_users', {room: room});
        return '';
      case 'chat':
        if (!args.split(' ')[0]) {
          return 'Enter a username to chat with after the /chat command.\n';
        }
        if (args.split(' ')[0] === username) {
          return 'You can\'t chat with yourself, sorry!\n';
        }
        socket.emit('chat_request', {user: username, other: args.split(' ')[0]});
        return 'Requesting to chat with ' + args.split(' ')[0] + '...\n';
      case 'video':
        if (!args.split(' ')[0]) {
          return 'Enter a username to video chat with after the /video command.\n';
        }
        if (args.split(' ')[0] === username) {
          return 'You can\'t chat with yourself, sorry!\n';
        }
        socket.emit('video_request', {user: username, other: args.split(' ')[0]});
        return 'Requesting video call with ' + args.split(' ')[0] + '...\n';
      case 'y':
        if (!(!!other)) {
          return 'There is no request you can accept right now.\n';
        }
        socket.emit('accept', {user: username, other: other});
        return '';
      case 'scroll':
        scrollLock = !scrollLock;
        return 'Scroll lock is now ' + scrollLock + '\n';
      default:
        return 'Command \'' + command + '\' not recognized. Enter /help for commands.\n';
    }
  }

  function receiveVideo() {
    if (win.height < 39 || win.width < 150) {
      writeMessage('You need your terminal to be at least 150 characters wide ' +
                   'and 39 characters tall to display video\n');
    }
    else {
      box.width = '50%';
      input.width = '50%';
      video = blessed.box({
        left: '50%',
        width: '50%',
        height: '100%',
        tags: true,
        border: {
          type: 'line'
        }
      });
      win.append(video);
      win.render();
    }
    socket.on('receive_frame', function(data) {
      video.setContent(video.getContent() + data.pixels);
      win.render();
    });
  }

  function sendVideo(data) {
    videoInterval = setInterval(function() {
      execute('streamer -o image.jpeg', function(error, stdout, stderr) {
        if (error) {
          writeMessage('Error capturing video: ' + stderr);
          return;
        }
        try {
          pixelr.read('image.jpeg', 'jpeg', function(image) {
            socket.emit('send_frame', {user: username, other: data.other, pixels: asciize(image)});
          });
        }
        catch(err) {
          writeMessage('Error reading video: ' + err);
        }
      });
    }, 150);
  }

  process.on('exit', function() {
    clearInterval(videoInterval);
    socket.emit('leave', {room: room, user: username});
    socket.emit('leave', {room: '', user: username});
  });

}

client();
