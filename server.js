const express = require('express');
const fs = require('fs');
const fileUpload = require("express-fileupload");
const app = express();
const path = require('path');

var server = app.listen( process.env.PORT || 3000, function () {
    console.log('Listening on port 3000');
});
var bodyParser = require('body-parser');
const { fstat } = require('fs');

const io = require("socket.io")(server, {
    allowEI03: true
});



app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(express.static(path.join(__dirname, "public")));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "")));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.send('action');
});


var userConnections = [];

io.on("connection", (socket) => {
    console.log("socketID is ", socket.id);
    socket.on("userconnect", (data) => {
        console.log("userConnected ", data.displayName, " with meet id ",data.meetingId);

        var other_users = userConnections.filter((p) => p.meetingId == data.meetingId);
        userConnections.push({
            connectionID: socket.id,
            user_id: data.displayName,
            meetingId: data.meetingId
        });
        // console.log(other_users)
        var userCount = userConnections.length;
        console.log(userCount);

        other_users.forEach((v) => {
            socket.to(v.connectionID).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount,
            });
        });
        socket.emit("inform_me_about_other_user", other_users);

        socket.on("SDPProcess", (data) => {
            socket.to(data.to_connid).emit("SDPProcess", {
                message: data.message,
                from_connid: socket.id,
            });
        });

        socket.on("sendMessage", (msg) => {
            // console.log(msg);
            var mUser = userConnections.find( (p) => p.connectionID == socket.id)
            if(mUser){
                var meetingid = mUser.meetingId;
                var from = mUser.user_id;
                var list = userConnections.filter( (p) => p.meetingId == meetingid)

                list.forEach((v) => {
                    socket.to(v.connectionID).emit('showChatMessage', {
                        from: from,
                        message: msg
                    });
                });  
            }
        });

        
        socket.on("disconnect", function(){
            console.log("User got disconnected");
            var disUser = userConnections.find( (p) => p.connectionID == socket.id);
            if(disUser){
                // console.log(disUser);
                var meetingId = disUser.meetingId;
                userConnections = userConnections.filter( (p) => p.connectionID != socket.id );
                // console.log(userConnections);
                var list = userConnections.filter( (p) => other_users.meetingId = meetingId);
                // console.log(list);
                list.forEach( (v) => {
                    var userNumberAfterUserLeave = userConnections.length;
                    // console.log(userNumberAfterUserLeave);
                    socket.to(v.connectionID).emit("inform_other_about_disconnected_user", {
                        connId: socket.id,
                        uNumber: userNumberAfterUserLeave
                    });
                });
            }
        });
    });

});

