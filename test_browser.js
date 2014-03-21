var tele = require("telehash");
var jchat = require("./index.js");
var $ = require("jquery-browserify");
require("./jquery.tmpl.min.js");
tele.debug(function(){console.log.apply(console,arguments)});

var nick = window.prompt("nickname?");
var args = {id:"test_chat"};
//args.seeds = require("./seeds.json");
$(document).ready(function() {
  log("connecting");
  var self = tele.init(args, init);
  jchat.install(self);
});

var chat;
function chatUp()
{
  chat.nicks = {};
  chat.onError = function(err){
    console.log(err,new Error().stack);
    log("error",err);
  };
  chat.onJoin = function(from,join){
    chat.nicks[from] = join.js.text||"unknown";
    log(chat.nicks[from],"joined");
    $("#userTemplate").tmpl({user: chat.nicks[from]}).appendTo("#users");
  };
  chat.onChat = function(from,msg){
    $("#chatMessageTemplate").tmpl({sender:chat.nicks[from],message:msg.js.text}).appendTo("#messages");
    $("#messages").scrollTop($("#messages").prop("scrollHeight") - $("#messages").height());
  };
}

function log(a,b,c,d,e,f){
  var message = [a,b,c,d,e,f].join(" ");
  $("#systemMessageTemplate").tmpl({message: message}).appendTo("#messages");
  $("#messages").scrollTop($("#messages").prop("scrollHeight") - $("#messages").height());
}

function init(err, self)
{
  if(!self)
  {
    $("#error").html = err||"something went wrong";
    $("#error").show();
    return;
  }
  self.setJoin({js:{text:nick}});
  chat = self.chat("open");
  console.log("CHAT",chat);
  log("new chat",chat.uri);
  chatUp();

  $("#message-input").focus();
  $("#message-form").submit(function(ev) {
      ev.preventDefault();
      var message = $("#message-input").val();
      $("#message-input").val("");
      if(message.indexOf("jabber:") == 0)
      {
        log("joining",message);
        chat = jchat.chat(message);
        chatUp();
        return;
      }
      chat.send({js:{text:message}});
      $("#chatMessageTemplate").tmpl({sender:nick,message:message}).appendTo("#messages");
      $("#messages").scrollTop($("#messages").prop("scrollHeight") - $("#messages").height());
  });
}
