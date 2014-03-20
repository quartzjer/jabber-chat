var crypto = require("crypto");
var jstream = require("JSONStream");
var es = require("event-stream")
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
  chat.log = {};
  chat.connected = {};
  chat.roster = {};
  chat.joins = {};

  // app-defined event callbacks
  chat.onMessage = function(){};
  chat.onJoin = function(){};
  chat.onError = function(){};

  chat.setID = function(uri)
  {
    if(typeof uri == "string") uri = self.uriparse(uri);
    chat.hashname = uri.hostname;
    chat.base = uri.path;
    var parts = uri.path.split("/");
    chat.type = parts[1];
    chat.id = parts[2];
    chat.uri = uri.href;
    self.chats[chat.uri] = chat;
    self.thtp.match(chat.base,function(req,cbRes){
      var parts = req.path.split("/");
      if(parts[3] == "roster") return cbRes({json:chat.roster});
      if(parts[3] == "id" && chat.log[parts[4]]) return cbRes({json:chat.log[parts[4]]});
      if(parts[3] == "id" && chat.joins[parts[4]]) return cbRes({json:chat.joins[parts[4]]});
      cbRes({status:404,body:"not found"});
    });
  }
  
  chat.sync = function()
  {
    // fetch updated roster
    self.thtp.request({hashname:chat.hashname,path:chat.base+"/roster"},function(err){
      if(err) chat.onError(err);
    }).pipe(jstream.parse()).on("error",function(){}).pipe(es.map(function(roster){
      if(chat.type == "private" && !roster[self.hashname]) return chat.onError("not allowed");
      // refresh roster first
      Object.keys(roster).forEach(function(hn){
        chat.add(hn,roster[hn]);
      });
      // try to connect to any we're not
      Object.keys(roster).forEach(function(hn){
        if(chat.connected[hn]) return;
        var js = {chat:chat.uri,from:chat.joined.js.id,to:roster[hn],roster:chat.rosterHash};
        self.start(hn,"chat",{bare:true,js:js},function(err,packet,chan,cbChat){
          console.log("CHATBACK",err,packet&&packet.js);
          if(err) return chat.onError(err);
          chan.chat = chat;
          chan.wrap("message");
          if(chat.joins[roster[hn]]) chat.onJoin(hn, chat.joins[roster[hn]]);
          cbChat();
        });
      });
    }));
    
  }

  function stamp()
  {
    var id = secret;
    for(var i = 0; i < chat.seq; i++) id = crypto.createHash("md5").update(id).digest();
    id = id.toString("hex")+","+chat.seq;
    chat.seq--;
    return id;
  }

  chat.add = function(hashname,id){
    chat.roster[hashname] = id||"invited";
    if(id && !chat.joins[id]) self.thtp.request({hashname:hashname,path:chat.base+"/id/"+id}).pipe(jstream.parse()).on("error",function(){}).pipe(es.map(function(msg){
      chat.joins[msg.id] = msg;
      if(chat.connected[hashname]) chat.onJoin(hashname,msg);
    }));
    var rollup = new Buffer(0);
    Object.keys(chat.roster).sort().forEach(function(id){
      rollup = crypto.createHash("md5").update(Buffer.concat([rollup,new Buffer(id+chat.roster[id])])).digest();
    })
    chat.rosterHash = rollup.toString("hex");    
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
  chat.joins[chat.joined.js.id] = chat.joined;
  chat.add(self.hashname,chat.joined.js.id);

  return chat;
}

function newChat(self, type, join)
{
  var chat = new blankChat(self,type,join);
  chat.setID("jabber:"+self.hashname+"/"+type+"/"+self.randomHEX(16));
  return chat;
}

function joinChat(self, uri, join)
{
  var parts = uri.path.split("/");
  var chat = new blankChat(self,parts[1],join);
  chat.setID(uri);
  chat.sync();
  return chat;
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
  self.chats = {};

  // base message for joins
  var join = {js:{}};
  self.setJoin = function(msg)
  {
    if(!msg) return;
    if(!msg.js) msg.js = {};
    msg.js.type = "join";
    join = msg;
  }

  self.wraps["message"] = function(chan)
  {
    var chat = chan.chat;
    chat.connected[chan.hashname] = chan;

    // handle messages, set up status callbacks
    var buf = new Buffer(0);
    chan.callback = function(err, packet, chan, cbChat)
    {
      console.log("MSG IN",err,packet&&packet.js);
      if(err)
      {
        if(chat.connected[packet.from.hashname] == chan) delete chat.connected[packet.from.hashname];
        return cbChat();
      }
      buf = Buffer.concat([buf,packet.body]);
      if(!packet.js.done) return cbChat();
      var msg = self.pdecode(buf);
      buf = new Buffer(0);
      if(!msg) return cbChat();
      chat.onMessage(packet.from.hashname,msg);
      cbChat();
    }

    // chunk out a message, TODO no backpressure yet
    chan.message = function(msg)
    {
      console.log("MSG OUT",msg.js);
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
    return chan;
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

    console.log("CHAT IN",packet.js);
    // ensure valid request
    var uri = self.uriparse(packet.js.chat);
    var type;
    if(!uri || uri.protocol != "jabber:" || !self.isHashname(uri.hostname) || !uri.path || !(type = uri.path.split("/")[1]) || chatTypes.indexOf(type) == -1) return chan.err("invalid");

    // no chat yet
    var chat = self.chats[packet.js.chat];
    // look for any waiting tokens from them of this type
    if(!chat) chat = waiting[packet.from.hashname+type];
    // new incoming chat, must be invited
    if(packet.js.to == "invite") chat = new blankChat(self, type);

    if(!chat) return chan.err("unknown");
    chan.send({js:{from:"yo"}});
    chan.chat = chat;
    chan.wrap("message");

    // check for updated roster
    if(packet.js.from == uri.hostname && packet.js.roster != chat.rosterHash) chat.sync();

    // send our last message
    chan.message(chat.last);
    
    cbChat();
  }

}