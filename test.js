var path = require("path");
var jchat = require("./index.js");
var id = process.argv[2]||process.exit(1);
var to = process.argv[3]||process.exit(1);
jchat.init({id:path.resolve(id+".json"),seeds:path.resolve("seeds.json")},function(err){
  if(err) return console.log(err);
  jchat.setJoin({js:{text:id}});
  var chat = jchat.chat(to);
  console.log(chat.uri);
  chat.error = function(err){console.log("ERR",err)};
  chat.joined = function(from){console.log("JOIN",from)};
  chat.received = function(msg){console.log("MSG",msg)};
});
