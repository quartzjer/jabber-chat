var crypto = require("crypto");
var jstream = require("JSONStream");
var es = require("event-stream");
var mmh = require("murmurhash3");
exports.telehash = require("telehash");

exports.init = function(args, cb)
{
  var self = exports.telehash.init(args, cb);
  exports.install(self);
  exports.chat = self.chat;
  exports.join = self.join;
  exports.setJoin = self.setJoin;
  exports.setInvite = self.setInvite;
  return self;
}

// mmh lib is dumb
function mhash(buf)
{
  return new Buffer(mmh.murmur32HexSync(buf.toString("binary")),"hex");
}

exports.install = function(self)
{
  self.chats = {};

  // overwrite-able callback for invites
  self.onInivte = function(chat){};

  // create/join a new chat id can be false (auto-generate), an endpoint, or an endpoint@originator
  self.chat = function(id, cbReady)
  {
    if(!id) id = self.randomHEX(16);
    var parts = id.split("@");
    if(!parts[1]) id = [parts[0],self.hashname].join("@");
    var parts = id.split("@");

    var chat = {};
    chat.id = id;
    self.chats[chat.id] = chat;
    chat.endpoint = parts[0];
    chat.originator = parts[1];
    chat.log = {};
    chat.connected = {};
    chat.connecting = {};
    chat.roster = {};
    chat.joins = {};
    chat.ready = false;
    chat.joined = false;

    // app-defined event callbacks
    chat.onMessage = function(){};
    chat.onJoin = function(){};
    chat.onError = function(){};

    // serve the thtp requests for this chat
    chat.base = "/chat/"+mhash(chat.id).toString("hex")+"/";
    self.thtp.match(chat.base,function(req,cbRes){
      var parts = req.path.split("/");
      if(parts[3] == "roster") return cbRes({json:chat.roster});
      if(parts[3] == "id" && chat.log[parts[4]]) return cbRes({body:self.pencode(chat.log[parts[4]])});
      cbRes({status:404,body:"not found"});
    });

    // internal chat id generator
    function stamp()
    {
      var id = chat.secret;
      for(var i = 0; i < chat.seq; i++) id = mhash(id);
      id = id.toString("hex")+","+chat.seq;
      chat.seq--;
      return id;
    }

    chat.sync = function()
    {
      // we are the master
      if(chat.originator == self.hashname) return;
      // fetch updated roster
      self.thtp.request({hashname:chat.originator,path:chat.base+"roster"},function(err){
        if(err) error(err);
      }).pipe(jstream.parse()).on("error",function(){}).pipe(es.map(function(roster){
//        console.log("ROSTER",roster);

        // refresh roster first
        Object.keys(roster).forEach(function(hn){
          chat.add(hn,roster[hn]);
        });

        if(!chat.joined) return;

        // try to connect to any we're not
        var js = {to:chat.id};
        if(chat.from) js.from = chat.from;
        if(chat.rosterHash) js.roster = chat.rosterHash;
        if(chat.last) js.last = chat.last;
        Object.keys(roster).forEach(function(hn){
          if(hn == "*") return;
          if(hn == self.hashname || chat.connected[hn] || chat.connecting[hn]) return;
//          console.log("CHAT OUT",js);
          chat.connecting[hn] = true;
          self.start(hn,"chat",{bare:true,js:js},function(err,packet,chan,cbChat){
            delete chat.connecting[hn];
            if(err) return error(err);
//            console.log("CHAT IN",packet.js);
            chat.connect(chan,packet.js.from);
            cbChat();
          });
        });
      }));
    
    }
  
    chat.connect = function(chan,joinid,reply)
    {
      chat.connected[chan.hashname] = chan;
      chat.add(chan.hashname,joinid);

      // waiting for answer yet
      if(reply)
      {
        var js = {from:chat.from,roster:chat.rosterHash};
        if(chat.last) js.last = chat.last;
//        console.log("CHAT IN OUT",js);
        chan.send({js:js});
      }

      chan.chat = chat;
      chan.wrap("message");
      return chan;
    }

    chat.add = function(hashname,id){
      id = id||"invited";

      // update roster hash
      if(id) chat.roster[hashname] = id;
      else delete chat.roster[hashname];
      chat.rosterHash = mhash(Object.keys(chat.roster).sort().map(function(key){ return key+chat.roster[key]; }).join("")).toString("hex");

      if(!id) return setJoin(hashname,{js:{text:"removed"}});

      // not an actual message yet
      if(id.indexOf(",") == -1) return setJoin(hashname,{js:{text:id}});
    
      // already have it
      if(chat.joins[hashname] && chat.joins[hashname].js.id == id) return setJoin(hashname,chat.joins[hashname]);

      // fetch join message from originator unless it's us
      var errd;
      var to = (chat.originator != self.hashname) ? chat.originator : hashname;
      self.thtp.request({hashname:to,path:chat.base+"id/"+id},function(err){
        if(!err) return;
        setJoin(hashname,{js:{text:err}});
        errd = true;
      }).pipe(es.join()).pipe(es.map(function(packet){
        if(errd) return;
        var msg = self.pdecode(packet);
        if(!msg) return setJoin(hashname,{js:{text:"bad join"}});
        setJoin(hashname,msg);
      }));
    }

    chat.send = function(msg)
    {
      if(!msg.js.type) msg.js.type = "chat";
      if(!msg.js.id) msg.js.id = stamp();
      var packet = self.pencode(msg.js,msg.body);

      if(msg.js.type == "chat")
      {
        chat.log[msg.js.id] = packet;
        chat.last = msg.js.id;
      }

      // deliver to anyone connected
      Object.keys(chat.connected).forEach(function(to){
        chat.connected[to].message(packet);
      });
    }
  
    chat.receive = function(from,msg)
    {
      if(msg.js.type == "chat") chat.onMessage(from,msg);
      // TODO statuses
    }

    chat.join = function(join)
    {
      chat.joined = true;
      if(join)
      {
        chat.secret = crypto.randomBytes(4);
        chat.seq = 1000;
        join.js.type = "join";
        chat.from = join.js.id = stamp();
        join.js.at = Math.floor(Date.now()/1000);
        chat.joins[self.hashname] = join;
        chat.add(self.hashname,chat.from);
        chat.onJoin(self.hashname,join);
        if(chat.invited)
        {
          chat.connect(chat.invited,chan.cfrom);
          delete chat.invited;
        }
      }
      chat.sync();
    }

    function setJoin(hashname,join)
    {
//      console.log("SETJOIN",hashname,join.js);
      chat.joins[hashname] = join;
      if(join.js.id) chat.log[join.js.id] = join;
      // only ready when all roster entries have a join
      if(Object.keys(chat.joins).length >= Object.keys(chat.roster).length) readyUp();
      // fire joined event if connected
      if(chat.connected[hashname])
      {
        if(!chat.connected[hashname].cjoin || chat.connected[hashname].cjoin.js.id != join.js.id) chat.onJoin(hashname,join);
        chat.connected[hashname].cjoin = join;
      }
    }
    
    function error(err)
    {
      chat.err = err;
      readyUp();
      chat.onError(err);
    }

    function readyUp()
    {
      if(chat.ready) return;
      chat.ready = true;
      if(cbReady) cbReady(chat.err,chat);
    }

    // if we created it, we're ready immediately, otherwise sync
    if(chat.originator == self.hashname) readyUp();
    else chat.sync();

    return chat;
  }

  self.wraps["message"] = function(chan)
  {
    var chat = chan.chat;
    chat.connected[chan.hashname] = chan;

    // handle messages, set up status callbacks
    var buf = new Buffer(0);
    chan.callback = function(err, packet, chan, cbChat)
    {
      if(err)
      {
        if(chat.connected[packet.from.hashname] == chan) delete chat.connected[packet.from.hashname];
        return cbChat();
      }
//      console.log("CHAT MSG IN",packet.js,packet.body.toString("utf8"))
      buf = Buffer.concat([buf,packet.body]);
      if(!packet.js.done) return cbChat();
      var msg = self.pdecode(buf);
      buf = new Buffer(0);
      if(!msg) return cbChat();
      chat.receive(packet.from.hashname,msg);
      cbChat();
    }

    // chunk out a message, TODO no backpressure yet
    chan.message = function(buf)
    {
      do {
        var body = buf.slice(0,1000);
        buf = buf.slice(1000);
        var js = (!buf.length)?{done:true}:{};
//        console.log("CHAT MSG OUT",js,body.toString("utf8"))
        chan.send({js:js,body:body});
      }while(buf.length > 1000);
    }
    return chan;
  }

  self.rels["chat"] = function(err, packet, chan, cbChat)
  {
    if(err) return;
    cbChat();

    // ensure valid request
    var parts = (typeof packet.js.to == "string") && packet.js.to.split("@");
    if(!parts || !parts[0] || !parts[1] || parts[0].length > 32 || !self.isHashname(parts[1])) return chan.err("invalid");

    var chat = self.chats[packet.js.to];

//    console.log("CHAT REQUEST",packet.js,chat&&chat.id);

    // auto-accept incoming existing
    if(chat)
    {
      var state = chat.roster[packet.from.hashname];
      if(!state) state = chat.roster["*"];
      if(!(state == "invited" || state == packet.js.from)) return chan.err("denied");
      // add in
      chat.connect(chan,packet.js.from,true);
      // check for updated roster
      if(packet.js.roster != chat.rosterHash) chat.sync();
      return;
    }

    // new invited-to chat from originator
    if(!packet.js.from || parts[1] != packet.from.hashname) return chan.err("invalid");
    self.chat(packet.js.to,function(err,chat){
      if(err) return chan.err("failed");
      chat.invited = chan;
      chan.cfrom = packet.js.from;
      self.onInvite(chat);
    });
  }

}