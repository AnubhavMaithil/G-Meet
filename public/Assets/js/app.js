var AppProcess = (function () {

    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var serverProcess;
    var local_div;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var rtp_vid_senders = [];
    var video_states = {
        None: 0,
        Camera: 1,
        ScreenShare: 2
    };
    var video_st = video_states.None;
    var videoCamTrack;

    async function _init(SDP_function, my_connId) {
        serverProcess = SDP_function;
        my_connection_id = my_connId;
        eventProcess();
        local_div = document.getElementById("localVideoPlayer");
    }
    function eventProcess() {
        $("#miceMuteUnmute").on("click", async function () {
            if (!audio) {
                await loadAudio();
            }
            if (!audio) {
                alert("Audio permission denied");
                return;
            }

            if (isAudioMute) {
                audio.enabled = true;
                $(this).html("<span class= 'material-icons' style='width: 100%;'>mic</span>");
                updateMediaSenders(audio, rtp_aud_senders);
            } else {
                audio.enabled = false;
                $(this).html("<span class= 'material-icons' style='width: 100%;'> mic_off</span>");
                removeMediaSenders(rtp_aud_senders);
            }
            isAudioMute = !isAudioMute;
        });

        $("#videoCamOnOff").on("click", async function () {
            if (video_st === video_states.Camera) {
                await videoProcess(video_states.None);
            } else {
                await videoProcess(video_states.Camera);
            }
        });

        $("#ScreenShareOnOf").on("click", async function () {
            if (video_st === video_states.ScreenShare) {
                await videoProcess(video_states.None);
            } else {
                await videoProcess(video_states.ScreenShare);
            }
        });
    }

    async function loadAudio() {
        try {
            var astream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {'echoCancellation': true, 'noiseSuppression': true}
            })
            audio = astream.getAudioTracks()[0];
            audio.enabled = false;
        } catch (errorAudio) {
            console.log(errorAudio);
        }
    }

    function getConnectedDevices(type, callback) {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const filtered = devices.filter(device => device.kind === type);
                callback(filtered);
            });
    }

    getConnectedDevices('videoinput', cameras => {
        // console.log(cameras[0].label)
        updateCameraList(cameras);
    });

    getConnectedDevices('audioinput', microphones => {
        // console.log(microphones[0].label)
        updateMicrophoneList(microphones);
    });

    getConnectedDevices('audiooutput', speakers => {
        // console.log(speakers[0].label)
        updateSpeakerList(speakers);
    });

    // // Updates the select element with the provided set of cameras
    const updateCameraList = (cameras) => {
        const listElement = document.getElementById('camera');
        listElement.innerHTML = '';
        cameras.forEach(camera => {
            const cameraOption = document.createElement('option');
            cameraOption.label = camera.label;
            cameraOption.value = camera.deviceId;
            listElement.appendChild(cameraOption);
        });
        console.log(listElement);
    }

    const updateMicrophoneList = (microphones) => {
        const listElement = document.getElementById('microphone');
        listElement.innerHTML = '';
        microphones.forEach(microphone => {
            const microphoneOption = document.createElement('option');
            microphoneOption.label = microphone.label;
            microphoneOption.value = microphone.deviceId;
            listElement.appendChild(microphoneOption);
        });
        console.log(listElement);
    }

    const updateSpeakerList = (speakers) => {
        const listElement = document.getElementById('speaker');
        listElement.innerHTML = '';
        speakers.forEach(speaker => {
            const speakerOption = document.createElement('option');
            speakerOption.label = speaker.label;
            speakerOption.value = speaker.deviceId;
            listElement.appendChild(speakerOption);
        });
        console.log(listElement);
    }


    // // Listen for changes to media devices and update the list accordingly
    navigator.mediaDevices.addEventListener('devicechange', event => {
        const newCameraList = getConnectedDevices('video');
        updateCameraList(newCameraList);
    });


    function connection_status(connection) {
        if (connection &&
            (connection.connectionState == "new" ||
                connection.connectionState == "connecting" ||
                connection.connectionState == "connected")
        ) {
            return true;
        } else {
            return false;
        }
    }


    async function updateMediaSenders(track, rtp_senders) {
        for (var con_id in peers_connection_ids) {
            if (connection_status(peers_connection[con_id])) {
                if (rtp_senders[con_id] && rtp_senders[con_id].track) {
                    rtp_senders[con_id].replaceTrack(track);
                    console.log("replaced");
                } else {
                    rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
                    // console.log(track)
                }
            }
        }
    }

    function removeMediaSenders(rtp_senders) {
        for (var con_id in peers_connection_ids) {
            if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
                peers_connection[con_id].removeTrack(rtp_senders[con_id]);
                console.log(peers_connection[con_id]);
                rtp_senders[con_id] = null;
            }
        }
    }
    function removeVideoStream(rtp_vid_senders) {
        if (videoCamTrack) {
            videoCamTrack.stop();
            videoCamTrack = null;
            local_div.srcObject = null;
            console.log("rtp senders", rtp_vid_senders);
            removeMediaSenders(rtp_vid_senders);
        }
    }
    async function videoProcess(newVideoState) {
        if (newVideoState == video_states.None) {
            $("#videoCamOnOff").html("<span class= 'material-icons' style='width: 100%;'>videocam_off</span>");
            video_st = newVideoState;

            $("#ScreenShareOnOf").html("<span class='material-icons'> present_to_all</span> <div>Present Now</div>")
            removeVideoStream(rtp_vid_senders);
            return;
        }
        if (newVideoState == video_states.Camera) {
            $("#videoCamOnOff").html("<span class= 'material-icons' style='width: 100%;'>videocam_on</span>");
        }
        try {
            var vstream = null;
            if (newVideoState === video_states.Camera) {
                vstream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: true
                });
            } else if (newVideoState === video_states.ScreenShare) {
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: true
                });
                vstream.oninactive = (e) => {
                    $("#ScreenShareOnOf").html("<span class='material-icons'>present_to_all</span> <div>Present Now</div>");
                    removeVideoStream(rtp_vid_senders);
                }
            }
            if (vstream && vstream.getVideoTracks().length > 0) {
                videoCamTrack = vstream.getVideoTracks()[0];
                if (videoCamTrack) {
                    local_div.srcObject = new MediaStream([videoCamTrack]);
                    // alert("video cam found");
                    updateMediaSenders(videoCamTrack, rtp_vid_senders);
                }
            }
        } catch (e) {
            console.log(e);
            return;
        }
        video_st = newVideoState;

        if (newVideoState == video_states.Camera) {
            $("#videoCamOnOff").html('<span class="material-icons">videocam</span>');
            $("#ScreenShareOnOf").html("<span class='material-icons'>present_to_all</span> <div>Present Now</div>")
        } else if (newVideoState == video_states.ScreenShare) {
            $("#ScreenShareOnOf").html("<span class='material-icons text-success'> present_to_all</span> <div class='text-success'>Stop ScreenShare</div>")
            $("#videoCamOnOff").html('<span class="material-icons">videocam_off</span>');
        }
    }

    var iceConfiguration = {
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    }

    async function setConnection(connId) {
        var connection = new RTCPeerConnection(iceConfiguration);
        connection.onnegotiationneeded = async function (event) {
            await setOffer(connId);
        }
        connection.onicecandidate = function (event) {
            if (event.candidate) {
                serverProcess(JSON.stringify({ icecandidate: event.candidate }), connId);
            }
        };
        connection.ontrack = function (event) {
            if (!remote_vid_stream[connId]) {
                remote_vid_stream[connId] = new MediaStream();
            }
            if (!remote_aud_stream[connId]) {
                remote_aud_stream[connId] = new MediaStream();
            }
            console.log(remote_vid_stream);
            if (event.track.kind == "video") {
                console.log(remote_vid_stream[connId]);
                remote_vid_stream[connId]
                    .getVideoTracks()
                    .forEach((t) => remote_vid_stream[connId].removeTrack(t))
                remote_vid_stream[connId].addTrack(event.track);

                var remoteVideoPlayer = document.getElementById("v_" + connId);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connId];
                remoteVideoPlayer.load();
            } else if (event.track.kind == "audio") {
                remote_aud_stream[connId]
                    .getAudioTracks()
                    .forEach((t) => remote_aud_stream[connId].removeTrack(t))
                remote_aud_stream[connId].addTrack(event.track);

                var remoteAudioPlayer = document.getElementById("a_" + connId);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connId];
                remoteAudioPlayer.load();
            }
        }

        peers_connection_ids[connId] = connId;
        peers_connection[connId] = connection;

        if (video_st == video_states.Camera || video_st == video_states.ScreenShare) {
            if (videoCamTrack) {
                updateMediaSenders(videoCamTrack, rtp_vid_senders);
            }
        }
        return connection;
    }

    async function setOffer(connId) {
        var connection = await peers_connection[connId];
        var offer = await connection.createOffer();

        await connection.setLocalDescription(offer);

        serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }), connId);
    }

    async function SDPProcess(message, from_connid) {
        message = JSON.parse(message);
        if (message.answer) {
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.offer) {
            if (!peers_connection[from_connid]) {
                await setConnection(from_connid);
            }
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.offer));
            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(JSON.stringify({
                answer: answer,
            }), from_connid);
        } else if (message.icecandidate) {
            // await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(''));
            if (!peers_connection[from_connid]) {
                await setConnection(from_connid);
            }
            try {
                const pc = await peers_connection[from_connid];
                // console.log(peers_connection[from_connid])
                pc.addIceCandidate(message.icecandidate);
            } catch (e) {
                console.log(e);
            }
        }
    }

    async function closeConnection(connId) {
        peers_connection_ids[connId] = null;
        if (peers_connection[connId]) {
            peers_connection[connId].close();
            peers_connection[connId] = null;
        }
        if (remote_aud_stream[connId]) {
            remote_aud_stream[connId].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            })
            remote_aud_stream[connId] = null;
        }
        if (remote_vid_stream[connId]) {
            remote_vid_stream[connId].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            })
            remote_vid_stream[connId] = null;
        }
    }


    return {
        setNewConnection: async function (connId) {
            await setConnection(connId);
        },
        init: async function (SDP_function, my_connId) {
            await _init(SDP_function, my_connId);
        },
        processClientFunc: async function (data, from_connid) {
            await SDPProcess(data, from_connid);
        },
        closeConnectionCall: async function (connId) {
            await closeConnection(connId);
        }

    }
})();

var MyApp = (function () {
    var socket = null;
    var user_id = "";
    var meeting_id = "";
    function init(uid, mid) {
        user_id = uid;
        meeting_id = mid;

        $("#meetingContainer").show();
        $("#me h2").text(user_id + "(Me)");
        document.title = (user_id + " joined " + meeting_id);
        event_process_for_signaling_server();
        eventHandeling();
    }
    function event_process_for_signaling_server() {
        socket = io.connect();

        var SDP_function = function (data, to_connid) {
            // console.log("harsh")
            // console.log(data);
            socket.emit("SDPProcess", {
                message: data,
                to_connid: to_connid
            })
        }

        socket.on("connect", () => {
            // alert("socket connected to client side");
            if (socket.connected) {
                AppProcess.init(SDP_function, socket.id);
                if (user_id != "" && meeting_id != "") {
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meetingId: meeting_id
                    })
                }
            }
        });

        socket.on("inform_other_about_disconnected_user", function (data) {
            $("#" + data.connId).remove();
            $(".participant-count").text(data.uNumber);
            $("#participant_" + data.connId + "").remove();
            AppProcess.closeConnectionCall(data.connId);
        });

        socket.on("inform_others_about_me", function (data) {
            addUser(data.other_user_id, data.connId, data.userNumber);
            AppProcess.setNewConnection(data.connId);
        });
        socket.on("inform_me_about_other_user", function (other_users) {
            var userNumber = other_users.length;
            var userNumb = userNumber + 1;
            if (other_users) {
                for (var i = 0; i < other_users.length; i++) {
                    addUser(other_users[i].user_id, other_users[i].connectionID, userNumb);
                    AppProcess.setNewConnection(other_users[i].connectionID);
                }
            }
        });

        socket.on("showFileMessage", function (data) {
            var time = new Date();
            var lTime = time.toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var attachFileAreaForOther = document.querySelector(".show-attach-file");
            attachFileAreaForOther.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'> <img src='public/assets/images/other.jpg' style='height: 40px; width: 40px;' class='caller-image circle'> <div style='font-weight: 600; margin: 0 5px;'>" + data.username + "</div>:<div><a style='color: #007bff' href='" + data.FilePath + "' download>" + data.FileName + "</a></div></div><br>";
        })

        socket.on("SDPProcess", async function (data) {
            await AppProcess.processClientFunc(data.message, data.from_connid);
        });

        socket.on("showChatMessage", function (data) {
            var time = new Date();
            var lTime = time.toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $("<div>").html("<span class='font-weight-bold mr-3 chat-sender' style='color: black; font-size: 15px; text-transform: capitalize;'>" + data.from + "</span> <small class='text-muted'> " + lTime + "</small> <br>" + data.message);
            $("#messages").append(div);
        });
    }

    function eventHandeling() {
        $("#btnsend").on("click", function () {
            var msgData = $("#msgbox").val();
            socket.emit("sendMessage", msgData);

            var time = new Date();
            var lTime = time.toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $("<div>").html("<span class='font-weight-bold mr-3' style='color: black'>" + user_id + "</span> <small class='text-muted'> " + lTime + "</small> <br>" + msgData);
            $("#messages").append(div);

            $("#msgbox").val("");
        });

        var url = window.location.href;
        $(".meeting_url").text(url);

        $("#divUsers").on("dblclick", "video", function () {
            // console.log("clicked");
            this.requestFullscreen();
        })

    }



    function addUser(other_user_id, connId, userNum) {
        var newDivId = $("#otherTemplate").clone();
        newDivId = newDivId.attr("id", connId).addClass("other");
        newDivId.find("h2").text(other_user_id);
        newDivId.find("video").attr("id", "v_" + connId);
        newDivId.find("audio").attr("id", "a_" + connId);
        // newDivId.find(".icon").attr("id", connId);
        newDivId.show();
        $("#divUsers").append(newDivId);

        if(other_user_id == "Sheryians Coding School" || other_user_id == "sheryians coding school"){
            other_user_id = "Sheryians Coding School";
        }else if(other_user_id.length>10){
            other_user_id = other_user_id.substring(0,10)+"...";
        }else{
            other_user_id = other_user_id;
        }

        $(".in-call-wrap-up").append('<div class="in-call-wrap justify-content-between align-items-center mb-3" id="participant_' + connId + '" style="display: flex;"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/other.jpg" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name m-2">' + other_user_id + '</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons"> more_vert </span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons pin-video ' + connId + ' " id=' + connId + '> push_pin </span> </div> </div> </div>');

        $(".participant-count").text(userNum);
    }

    let flagPin = 0;
    $(document).on("click", ".pin-video", function (dets) {
        // console.log(dets.target.id);
        // $("v_"+dets.target.id).requestFullscreen();
        // $("#v_" + dets.target.id)[0].requestFullscreen();
        if(flagPin === 0){
            $("#" + dets.target.id)[0].style.width = "100%";
            $("#" + dets.target.id)[0].style.height = "100%";
            $("#" + dets.target.id)[0].style.position = "absolute";
            $("#" + dets.target.id)[0].style.top = "50%";
            $("#" + dets.target.id)[0].style.left = "50%";
            $("#" + dets.target.id)[0].style.transform = "translate(-50%,-50%)";
            $("#" + dets.target.id)[0].style.backgroundColor = "black";
            $("#" + dets.target.id)[0].style.zIndex = "2";
            $("#v_" + dets.target.id)[0].style.width = "80vw"; 
            console.log($("." + dets.target.id)[0]); 
            flagPin = 1;
        }else if(flagPin === 1){
            $("#" + dets.target.id)[0].style.width = "initial";
            $("#" + dets.target.id)[0].style.height = "initial";
            $("#" + dets.target.id)[0].style.position = "initial";
            $("#" + dets.target.id)[0].style.top = "initial";
            $("#" + dets.target.id)[0].style.left = "initial";
            $("#" + dets.target.id)[0].style.transform = "initial";
            $("#" + dets.target.id)[0].style.backgroundColor = "initial";
            $("#" + dets.target.id)[0].style.zIndex = "initial";
            $("#v_" + dets.target.id)[0].style.width = "30vw"; 
            flagPin = 0;
        }
    });

    // $(document).on("input", "#search_participant", function(){
    //     console.log($("#search_participant").val());
    // })

    $(document).on("keypress", ".chat-message-sent-input-field", function(event){
        if(event.key === "Enter"){
            if($(".chat-message-sent-input-field").val().trim() === ""){
                event.preventDefault();
            }else{
                event.preventDefault();
                $(".chat-message-sent-action").click();
            }
        }
    });
    

    $(document).on("click", ".people-heading", function () {
        $(".chat-show-wrap").hide(300);
        $("#msgbox").focus();
        $(".in-call-wrap-up").show(300);
        $(this).addClass("active");
        $(".chat-heading").removeClass("active");
    });
    $(document).on("click", ".chat-heading", function () {
        $(".chat-show-wrap").show(300);
        $(".in-call-wrap-up").hide(300);
        $(this).addClass("active");
        $(".people-heading").removeClass("active");
    });
    $(document).on("click", ".meeting-heading-cross", function () {
        $(".g-right-details-wrap").hide(300);
    });
    $(document).on("click", ".top-left-participant-wrap", function () {
        $(".people-heading").addClass("active");
        $(".chat-heading").removeClass("active");
        $(".g-right-details-wrap").show(300);
        $(".in-call-wrap-up").show(300);
        $(".chat-show-wrap").hide(300);
    });
    $(document).on("click", ".top-left-chat-wrap", function () {
        $(".people-heading").removeClass("active");
        $(".chat-heading").addClass("active");
        $(".g-right-details-wrap").show(300);
        $(".in-call-wrap-up").hide(300);
        $(".chat-show-wrap").show(300);
    });

    $(document).on("click", ".end-call-wrap", function () {
        $(".top-box-show").css({
            "display": "block"
        }).html('<div class="top-box align-vertical-middle profile-dialouge-show"> <h4 class="mt-2" style="text-align: center; color: white;">Leave Meating</h4> <hr> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100" style="gap: 30px;"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-5">Leave</button></a> <button class="call-cancel-action btn btn-secondary">Cancel</button> </div> </div>')
    });

    $(document).mouseup(function (e) {
        var container = new Array();
        container.push($(".top-box-show"));
        $.each(container, function (key, value) {
            if (!$(value).is(e.target) && $(value).has(e.target).length === 0) {
                $(value).empty();
            }
        })
    });


    $(document).on("click", ".call-cancel-action", function () {
        $(".top-box-show").html('');
    })

    $(document).on("click", ".copy_info", function () {
        var $temp = $("<input>");
        $("body").append($temp);

        $temp.val($(".meeting_url").text()).select();
        document.execCommand("copy");
        $temp.remove();
        $(".link-conf").show();
        setTimeout(() => {
            $(".link-conf").hide();
        }, 3000);
    });

    //  DETAILS DIV
    $(document).on("click", ".meeting-details-button", function () {
        $(".g-details").slideToggle(300);
    });
    // var detsFlag = 0;
    // $(document).on("click", ".meeting-details-button", function(){
    //     if(detsFlag ===0){
    //         $(".g-details").show(300);
    //         detsFlag=1;
    //     }else if(detsFlag ===1){
    //         $(".g-details").hide(300);
    //         detsFlag = 0;
    //     }
    // });

    // $(document).on("click", ".g-details-heading-attachment", function(){
    //     $(".g-details-heading-show").hide(200);
    //     $(".g-details-heading-show-attachment").show(200);
    //     $(this).addClass("active");
    //     $(".g-details-heading-detail").removeClass("active");
    // });

    $(document).on("click", ".g-details-heading-detail", function () {
        $(".g-details-heading-show").show(200);
        $(".g-details-heading-show-attachment").hide(200);
        $(this).addClass("active");
        $(".g-details-heading-attachment").removeClass("active");
    });


    $(document).on("click", ".option-icon", function () {
        $(".camera-settings").toggle(300);
    });
    $(document).on("click", ".camera-settings", function () {
        $(".camera-settings-options").toggle(300);
        $(".camera-settings").toggle(300);
    });
    
    $(document).on("click", ".camera-settings-options-heading-close", function () {
        $(".camera-settings-options").hide(300);
    });
    

    return {
        _init: function (uid, mid) {
            init(uid, mid);
        }
    }
})();