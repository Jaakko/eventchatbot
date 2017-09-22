'use strict';

var VERIFY_TOKEN = "YOUR_TOKEN_HERE";
var https = require('https');
var PAGE_ACCESS_TOKEN = "YOUR_PAGE_ACCESS_TOKEN_HERE";

exports.handler = (event, context, callback) => {
  // process GET request
  if(event.queryStringParameters){
    var queryParams = event.queryStringParameters;
 
    var rVerifyToken = queryParams['hub.verify_token']
 
    if (rVerifyToken === VERIFY_TOKEN) {
      var challenge = queryParams['hub.challenge']
      
      var response = {
        'body': parseInt(challenge),
        'statusCode': 200
      };
      
      callback(null, response);
    } else{
      var response = {
        'body': 'Error, wrong validation token',
        'statusCode': 422
      };
      
      callback(null, response);
    }
  
  // process POST request
  } else{
    var data = JSON.parse(event.body);
     
    // Make sure this is a page subscription
    if (data.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
        var pageID = entry.id;
        var timeOfEvent = entry.time;
        // Iterate over each messaging event
        entry.messaging.forEach(function(msg) {
          if (msg.message) {
            receivedMessage(msg);
          } if (msg.postback) { 
            receivedPostback(msg);
          } else {
            console.log("Webhook received unknown event: ", event);
          }
        });
    });
    
    }
    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    var response = {
      'body': "ok",
      'statusCode': 200
    };
      
    callback(null, response);
  }
}

function sendMusicInfo(recipientId, index){
    var url = 'https://api.hel.fi/linkedevents/v1/event/?end=today&format=json&start=today&keyword=yso:p11185';
    handleRequest(recipientId, index, 0, url);
} 

function sendTheaterInfo(recipientId, index){
    var url = 'https://api.hel.fi/linkedevents/v1/event/?end=today&format=json&start=today&keyword=yso:p2625';
    handleRequest(recipientId, index, 1, url);
}

var chatbotEvents = ["Gigs", "Theater plays"];
var chatbotEventHandlers = [sendMusicInfo, sendTheaterInfo];

function receivedMessage(event) {
  console.log("MESSAGE");
  console.log(JSON.stringify(event));
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var messageId = message.mid;
  var messageText = message.text;
  var quick_reply = message.quick_reply;
  var payload = messageText;
  if (quick_reply) payload = quick_reply.payload;
  var messageAttachments = message.attachments;
  if (payload) {
    switch (payload) {
        case chatbotEvents[0]:
            chatbotEventHandlers[0](senderID, 0);
            break;
        case chatbotEvents[1]:
            chatbotEventHandlers[1](senderID, 0);
            break;    
        default:
            sendTextMessageWithReplies(senderID, "Want to know what's happening in Helsinki?")
    }
  }  else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  } else {
      sendTextMessageWithReplies(senderID, "Want to know what's happening in Helsinki?")
  }
}
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(messageData);
}
function sendTextMessageWithReplies(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
        text: messageText,
        quick_replies:[
        ]
    }
	};
	var len = chatbotEvents.length;
	for (var i = 0; i < len; ++i) {
        var item = {
			content_type:"text",
            title:chatbotEvents[i],
            payload:chatbotEvents[i]
		};          
		messageData.message.quick_replies.push(item);
	}
  callSendAPI(messageData);
}
function receivedPostback(event) {
  console.log("POSTBACK");
  console.log(JSON.stringify(event));
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var postback = event.postback;
  var payload = postback.payload;

  if (payload) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    var res = payload.split(":");
    switch (res[0]) {
      case chatbotEvents[0]:
        chatbotEventHandlers[0](senderID, parseInt(res[1]));
        break;
      case chatbotEvents[1]:
        chatbotEventHandlers[1](senderID, parseInt(res[1]));
        break;        
      default:
        sendTextMessageWithReplies(senderID, "Unfortunately I don't know. Try gigs or plays?")

        
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function handleRequest(recipientId, index, eventIndex, url){
    var eventsResponse;
    
    https.get(url, function(res){
        var body = '';

        res.on('data', function(chunk){
            body += chunk;
        });

        res.on('end', function(){
            eventsResponse = JSON.parse(body);
            var messageData = {
                recipient: {
                    id: recipientId
                },
                message: {
                    attachment: {
                        type: "template",
                        payload: {
                        template_type: "list",
                        top_element_style: "compact",
                        elements: [
                        ]
                    }
                }
                }
            };

            var len = eventsResponse.data.length;
            if (index + 4 < len) len = index + 4;
            else len = eventsResponse.data.length;
            var i;
            for (i = index; index < len; ++index) {
                var item = {
                        title: eventsResponse.data[index].name.fi,
                        subtitle: eventsResponse.data[index].description.fi
                };
                
                if (eventsResponse.data[index].info_url.fi) {
                    console.log("adding url: ", index);
                    item.default_action = { 
                        type : "web_url",
                        url : eventsResponse.data[index].info_url.fi
                    };
                }
                
                //var itemStr = JSON.stringify(item);
                //console.log("itemStr: ", itemStr);
                messageData.message.attachment.payload.elements.push(item);
            }
            if (index < eventsResponse.data.length){
                messageData.message.attachment.payload.buttons= 
                    [{
                        title: "View More",
                        type: "postback",
                        payload: chatbotEvents[eventIndex] + ':' + index            
                    }] ;
            }
            console.log("Got a response: ", body);
            callSendAPI(messageData);

        });
    }).on('error', function(e){
        console.log("Got an error: ", e);
    });
}
function callSendAPI(messageData) {
  var body = JSON.stringify(messageData);
  console.log("callSendAPI: ", body);
  var path = '/v2.6/me/messages?access_token=' + PAGE_ACCESS_TOKEN;
  var options = {
    host: "graph.facebook.com",
    path: path,
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  };
  var callback = function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });
    response.on('end', function () {
 
    });
  }
  var req = https.request(options, callback);
  req.on('error', function(e) {
    console.log('problem with request: '+ e);
  });
 
  req.write(body);
  req.end();
}
function sendGreeting() {
    var messageData = {
        "greeting":[
            {
            "locale":"default",
            "text":"Wazzup!"
            }, {
            "locale":"en_US",
            "text":"Find what to do in Helsinki!"
            }
        ] 
    }
    callSendAPI(messageData);
}
