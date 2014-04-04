var path = require("path");
var jchat = require("./index.js");
//jchat.telehash.debug(console.log);
var id = process.argv[2]||process.exit(1);
var to = process.argv[3]||process.exit(1);
var chat;
jchat.init({id:path.resolve(id+".json"),seeds:path.resolve("seeds.json")},function(err){
//jchat.init({id:path.resolve(id+".json")},function(err){
  if(err) return console.log(err);
  jchat.chat(to,function(err,c){
    if(err) return log("failed",err);
    chat = c;
    log(chat.id);
    chat.add("*","invited");
    chat.join({js:{text:id}});
    chat.nicks = {};
    chat.onError = function(err){
      log("error",err,new Error().stack);
    };
    chat.onJoin = function(from,join){
      chat.nicks[from] = join.js.text||"unknown";
      log(chat.nicks[from],"joined");
    };
    chat.onMessage = function(from,msg){
      log(chat.nicks[from]+">",msg.js.text);
    };
  });
});

rl = require("readline").createInterface(process.stdin, process.stdout, null);
rl.setPrompt(id+"> ");
rl.prompt();

function log(){
  // hacks!
  rl.output.write("\x1b[2K\r");
  var args = arguments;
  args = Object.keys(arguments).map(function(k){return args[k]});
  console.log(args.join(" "));
  rl._refreshLine()
}
process.stdin.on("keypress", function(s, key){
  if(key && key.ctrl && key.name == "c") process.exit(0);
  if(key && key.ctrl && key.name == "d") process.exit(0);
})

// our chat handler
rl.on('line', function(line) {
  if(!chat) log("offline");
  if(!line || line == "")
  {
    var list = [];
    Object.keys(chat.connected).forEach(function(hn){
      list.push(chat.nicks[hn]);
    });
    if(list.length) log("online:",list.join(", "));
  }
  else chat.send({js:{text:line}});
  rl.prompt();
});
