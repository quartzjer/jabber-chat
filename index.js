var crypto = require("crypto");
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

// create a new join profile message
exports.join = function(msg)
{
  if(!msg) msg = {};
  if(!msg.js) msg.js = {};
  msg.js.type = "join";
  msg.js.at = Math.floor(Date.now()/1000);
  var join = {message:msg};
  var secret = crypto.randomBytes(16);
  join.seq = 1000;
  join.stamp = function(m)
  {
    var id = secret;
    for(var i = 0; i < join.seq; i++) id = crypto.createHash("md5").update(id).digest();
    id = id.toString("hex")+","+join.seq;
    join.seq--;
    if(m) m.js.id = id;
    return id;
  }
  join.id = join.stamp(msg);
  return join;
}

var chatTypes = ["private","public","open","closed"];

function rHash(chat)
{
  var rollup = new Buffer(0);
  Object.keys(chat.roster).sort().forEach(function(id){
    rollup = crypto.createHash("md5").update(Buffer.concat([rollup,new Buffer(id+chat.roster[id])])).digest();
  })
  chat.rosterHash = rollup.toString("hex");
}

function blankChat(self, type)
{
  this.type = type;
  this.log = {};
  this.connected = {};
  this.roster = {};
  this.add = function(hashname){
    if(!this.roster[hashname]) this.roster[hashname] = "invited";
    rHash(this);
  }
  // app-defined event callbacks
  this.receive = function(){};
  this.join = function(){};
  this.send = function(message)
  {
    // store in messages and log
    // walk roster, ping any connected
  }
  this.joining = function(from,join,cbJoined)
  {
    // check type, check allowed
    // check if it's in the roster, add/update if not
    // fire join(), if private check return value and error
    if(chat.roster[packet.js.from] == "invited" && msg.js.type == "join")
    {
      chat.roster[packet.js.from] = msg.js.id;
      rHash(chat);
      chat.join
    }
    cbJoined();
  }
  this.token = function()
  {
    // return self.token(function(from){ this.add(), open chat to them })
  }
  return this;
}

function newChat(self, type, join)
{
  var chat = new blankChat(type);
  chat.id = self.randomHEX(32);
  chat.uri = "jabber:"+self.hashname+"/"+type+"/"+chat.id;
  chat.join = join;
  chat.log[join.id] = chat.last = join.message;
  chat.roster[self.hashname] = join.id;
  return chat;
}

function joinChat(self, uri, join)
{
  // attempt to connect to the master
  // fetch roster and stuff
}

var waiting = {};
function joinToken(self, token, join)
{
  var uri = self.uriparse(token);
  var type = uri.path.substr(1);
  if(chatTypes.indexOf(type) == -1) return false;
  // dispense token, wait for incoming
  // waiting[hn+type] = chat;
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

  self.rels["chat"] = function(err, packet, chan, cbChat)
  {
    if(err) return;

    // ensure valid request
    var url = self.uriparse(packet.js.chat);
    var type;
    if(uri.protocol != "jabber:" || !self.isHashname(uri.hostname) || !uri.path || !(type = uri.path.split("/")[1]) || chatTypes.indexOf(type) == -1) return chan.err("invalid");

    // no chat yet
    var chat = chats[packet.js.chat];
    // look for any waiting tokens from them of this type
    if(!chat) chat = waiting[packet.from.hashname+type];
    // new incoming chat, must be invited
    if(packet.js.to == "invite") chat = new blankChat(self, type);

    if(!chat) return chan.err("unknown");

    // check for updated roster
    if(packet.js.from == uri.hostname && packet.js.roster != chat.rosterHash) packet.from.request({path:"/ROSTER",json:true},function(res,roster){
      
    });

    // fetch their join first if we don't have it (true w/ all new chats)
    if(!packet.js.from)
    {
      
    }else{
      // send our last message
    }

    // handle messages, set up status callbacks
    var buf = new Buffer(0);
    chan.callback = function(err, packet, chan, cbChat)
    {
      if(err)
      {
        if(chan.connected[packet.from.hashname] == chan) delete chan.connected[packet.from.hashname];
        return cbChat();
      }
      buf = Buffer.concat([buf,packet.body]);
      if(!packet.js.done) return cbChat();
      var msg = self.pdecode(buf);
      buf = new Buffer(0);
      if(!msg) return cbChat();
      if(msg.js.type == "join") return chat.joining(packet.from, msg, cbChat);
      chat.receive(packet.from,msg);
    }

    // chunk out a message, TODO no backpressure yet
    chan.message = function(msg)
    {
      var buf = self.pencode(msg.js,msg.body);
      var js = {size:buf.length};
      do {
        var body = buf.slice(0,1000);
        buf = buf.slice(1000);
        if(!buf.length) js.done = true;
        chan.send({js:js,body:body});
        js = {};
      }while(buf.length > 1000);
    }
    
    cbChat();
  }

}