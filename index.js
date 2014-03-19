var crypto = require("crypto");
exports.telehash = require("telehash");

var selfDefault;
exports.init = function(args, cb)
{
  selfDefault = exports.telehash.init(args, cb);
  exports.install(selfDefault);
  return selfDefault;
}

// convenience wrappers
exports.chat = function(arg)
{
  if(!selfDefault) return false;
  return selfDefault.chat(arg);
}
exports.setJoin = function(join)
{
  if(!selfDefault) return false;
  return selfDefault.setJoin(join);
}


var chatTypes = ["private","public","open","closed"];

function blankChat(self, type, join)
{
  console.log("BLANK",type,join)
  var chat = this;
  chat.type = type;
  chat.joined = join;
  chat.joined.js.at = Math.floor(Date.now()/1000);
  var secret = crypto.randomBytes(16);
  chat.seq = 1000;

  // app-defined event callbacks
  chat.receive = function(){};
  chat.join = function(){};

  function stamp()
  {
    var id = secret;
    for(var i = 0; i < chat.seq; i++) id = crypto.createHash("md5").update(id).digest();
    id = id.toString("hex")+","+chat.seq;
    chat.seq--;
    return id;
  }

  chat.log = {};
  chat.connected = {};
  chat.roster = {};

  function roster()
  {
    var rollup = new Buffer(0);
    Object.keys(chat.roster).sort().forEach(function(id){
      rollup = crypto.createHash("md5").update(Buffer.concat([rollup,new Buffer(id+chat.roster[id])])).digest();
    })
    chat.rosterHash = rollup.toString("hex");
  }

  chat.add = function(hashname){
    if(!chat.roster[hashname]) chat.roster[hashname] = "invited";
    roster();
  }

  chat.send = function(msg)
  {
    msg.js.id = stamp();
    chat.log[msg.js.id] = chat.last = msg;

    // deliver to anyone connected
    Object.keys(chat.connected).forEach(function(to){
      chat.connected[to].message(msg);
    });
  }

  chat.joining = function(from,join,cbJoined)
  {
    // check type, check allowed
    // check if it's in the roster, add/update if not
    // fire join(), if private check return value and error
    if(chat.roster[packet.js.from] == "invited" && msg.js.type == "join")
    {
      chat.roster[packet.js.from] = msg.js.id;
      roster();
    }
    cbJoined();
  }

  chat.token = function()
  {
    // return self.token(function(from){ chat.add(), open chat to them })
  }

  // stamp and log the join message
  chat.send(chat.joined);
  chat.roster[self.hashname] = chat.joined.js.id;

  return chat;
}

function newChat(self, type, join)
{
  var chat = new blankChat(self,type,join);
  chat.id = self.randomHEX(16);
  chat.uri = "jabber:"+self.hashname+"/"+type+"/"+chat.id;
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

  // base message for joins
  var join = {js:{}};
  self.setJoin = function(msg)
  {
    if(!msg) return;
    if(!msg.js) msg.js = {};
    msg.js.type = "join";
    join = msg;
  }

  self.chat = function(arg)
  {
    if(chatTypes.indexOf(arg) >= 0) return newChat(self,arg,join);
    var uri = self.uriparse(arg);
    if(uri.protocol == "jabber:") return joinChat(self,uri,join);
    if(uri.protocol == "chat:") return joinToken(self,arg,join);
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