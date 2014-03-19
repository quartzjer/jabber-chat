var path = require("path");
var jchat = require("./index.js");
var id = process.argv[2]||process.exit(1);
jchat.init({id:path.resolve(id+".json"),seeds:path.resolve("seeds.json")},function(err){
  if(err) return console.log(err);
  jchat.setJoin({js:{text:id}});
  var chat = jchat.chat("open");
  console.log(chat.uri,chat);
});
