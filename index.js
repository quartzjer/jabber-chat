exports.telehash = require("telehash");

var selfDefault;
exports.init = function(args, cb)
{
  selfDefault = exports.telehash.init(args, cb);
  exports.install(selfDefault);
  return selfDefault;
}

// convenience
exports.chat = function(arg)
{
  if(!selfDefault) return false;
  return selfDefault.chat(arg);
}

var chatTypes = ["private","public","open","closed"];

function blankChat(self, type)
{
  this.type = type;
  this.log = [];
  this.messages = {};
  this.roster = {};
  this.allowed = {}
  this.allow = function(hashname){this.allowed[hashname]=true};
  // app-defined event callbacks
  this.receive = function(){};
  this.joined = function(){};
  this.send = function(message)
  {
    // walk roster, send to any connected
    // store in messages and log
  }
  this.join = function(from,join)
  {
    // check type, check allowed
    // check if it's in the roster, add/update if not
    // fire joined
  }
  this.token = function()
  {
    // return self.token(function(from){ add in allowed, open chat to them })
  }
  return this;
}

function newChat(self, type, join)
{
  var chat = new blankChat(type);
  chat.id = self.randomHEX(32);
  chat.uri = "jabber:"+self.hashname+"/"+type+"/"+chat.id;
  chat.allow(self.hashname);
  return chat;
}

function joinChat(self, uri)
{
  // attempt to connect to the master
  // fetch roster and stuff
}

var waiting = {};
function joinToken(self, token)
{
  var uri = self.uriparse(token);
  var type = uri.path.substr(1);
  if(chatTypes.indexOf(type) == -1) return false;
  // dispense token, wait for incoming
}

exports.install = function(self)
{
  var chats = {};

  self.chat = function(arg)
  {
    if(chatTypes.indexOf(arg) >= 0) return newChat(self,arg);
    var uri = self.uriparse(arg);
    if(uri.protocol == "jabber:") return joinChat(self,uri);
    if(uri.protocol == "chat:") return joinToken(self,arg);
    return false;    
  }

  self.rels["chat"] = function(err, packet, chan)
  {
    if(err) return;

    // ensure valid request
    var url = self.uriparse(packet.js.chat);
    if(uri.protocol != "jabber:" || !self.isHashname(uri.hostname) || !uri.path || chatTypes.indexOf(uri.path.split("/")[1]) == -1) return chan.err("invalid");

    // look for existing chat

    // look for any waiting tokens from them of this type
    
    // handle messages, set up status callbacks
    
  }

}