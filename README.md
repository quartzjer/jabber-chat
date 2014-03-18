Jabber Chat
===========

Jabber Chat implemented in javascript (node/browserify)

## Usage

```js
var jabber = require("jabber-chat").init();

// create a new chat
var chat = jabber.chat("private");
console.log(chat.uri);
chat.receive = function(message){};
chat.send(message);

// join an existing chat
var chat = jabber.chat("jabber:851042800434dd49c45299c6c3fc69ab427ec49862739b6449e1fcd77b27d3a6/private/8b945f90f08940c573c29352d767fee4");

```