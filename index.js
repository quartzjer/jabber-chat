exports.telehash = require("telehash");

var self;
exports.init = function(args, cb)
{
  self = exports.telehash.init(args, cb);
  exports.install(self);
  return self;
}

var chatTypes = ["private","public","open","closed"];

exports.chat = function(arg)
{
  if(chatTypes.indexOf(arg) >= 0) return newChat(arg);
  var uri = self.uriparse(arg);
  if(uri.protocol == "jabber:") return joinChat(arg);
  if(uri.protocol == "chat:") return joinToken(arg);
  return false;
}

function newChat(type)
{
  // create a new id
}

function joinChat(uri)
{
  // attempt to connect to the master
  // fetch roster and stuff
}

function joinToken(uri)
{
  // dispense token, wait for incoming
}

exports.install = function(self)
{
  var chats = {};

  self.rels["chat"] = function(err, packet, chan)
  {
    if(err) return;

    // ensure valid request
    var url = self.uriparse(packet.js.chat);
    if(uri.protocol != "jabber:" || !self.isHashname(uri.hostname) || !uri.path || chatTypes.indexOf(uri.path.split("/")[1]) == -1) return chan.err("invalid");

    // look for existing chat

    // look for any waiting tokens from them of this type
    
  }

}