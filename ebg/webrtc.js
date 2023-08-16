/* Webrtc

BGA implementation of a webrtc helper for video chat functionnality.
Inspired from https://code.google.com/p/webrtc/source/browse/#svn%2Ftrunk%2Fsamples%2Fjs%2Fapprtc

*/

define(
  "ebg/webrtc", [
    'dojo', 'dojo/_base/declare',
    'ebg/peerconnect',
    'ebg/scriptlogger'
  ],
  function (dojo, declare) {
    return declare('ebg.webrtc', null, {
      constructor: function (
        player_id,
        room,
        pcConfig,
        pcConstraints,
        mediaConstraints,
        stereo,
        ajaxcall_callback,
        getUserMediaSuccess_callback,
        getUserMediaError_callback,
        onJoinRoom_callback,
        onLeaveRoom_callback
      ) {

        // Player whose browser is executing this code
        this.player_id = player_id;

        // Room
        this.room = room;
        this.in_room = [];

        // Logger
        this.logger = new ebg.scriptlogger(
          'webrtc',
          ajaxcall_callback,
          '[P' + this.player_id + '@' + this.room + ']'
        );
        this.logger.log('(ebg.webrtc)      ' + 'WebRTC object created for player ' + this.player_id + ' and room ' + this.room);

        // Connections with other players
        this.connections = [];

        // Config & constraints
        this.pcConfig = pcConfig;
        this.pcConstraints = pcConstraints;
        this.mediaConstraints = mediaConstraints;
        this.stereo = false;

        // Callbacks
        this.ajaxcall_callback = ajaxcall_callback;
        this.getUserMediaSuccess_callback = getUserMediaSuccess_callback;
        this.getUserMediaError_callback = getUserMediaError_callback;
        this.onJoinRoom_callback = onJoinRoom_callback;
        this.onLeaveRoom_callback = onLeaveRoom_callback;

        this.localVideo = null;
        this.localStream = null;
        this.isAudioMuted = false;
        this.isVideoMuted = false;

        g_sitecore.recordMediaStats(this.player_id, 'start');

        // Set up audio and video regardless of what devices are present.
        this.sdpConstraints = {
          'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true
          }
        };
      },

      ///////////////////////////
      // Local room view handling
      isInRoom: function (player_id) {
        for (var i = 0; i < this.in_room.length; i++) {
          if (player_id == this.in_room[i]) {
            this.logger.log('(ebg.webrtc)      ' + 'Player ' + player_id + ' is in the room');
            return true;
          }
        }

        this.logger.log('(ebg.webrtc)      ' + 'Player ' + player_id + ' is not in the room');
        return false;
      },

      addToRoom: function (player_id) {
        this.logger.log('(ebg.webrtc)      ' + 'Player ' + player_id + ' is added to the room');
        this.in_room.push(player_id);
      },

      removeFromRoom: function (player_id) {
        this.logger.log('(ebg.webrtc)      ' + 'Player ' + player_id + ' is removed from the room');

        for (var i = 0; i < this.in_room.length; i++) {
          if (player_id == this.in_room[i]) {
            this.in_room.splice(i);
            return true;
          }
        }

        return false;
      },

      //////////////////////////////////////////////////////////////////////
      // Init local feed

      setMediaConstraints: function (mediaConstraints) {
        this.logger.log('(ebg.webrtc)      ' + 'Setting the following media constraints ' + JSON.stringify(
          mediaConstraints));

        this.mediaConstraints = mediaConstraints;
      },

      setLocalFeed: function (videoNode) {
        this.logger.log('(ebg.webrtc)      ' + 'Setting the local feed with the following HTML video node: ' + videoNode.id);

        this.localVideo = videoNode;

        this.doGetUserMedia();
      },

      doGetUserMedia: function () {
        if (this.mediaConstraints.video === false && this.mediaConstraints.audio === false) {
          this.logger.log('(ebg.webrtc)      ' + 'According to media constraints, no media to get: aborting getUserMedia');
          return;
        }

        // Call into getUserMedia via the polyfill (webrtcadapter.js).
        try {
          navigator.getUserMedia(
            this.mediaConstraints,
            dojo.hitch(this, 'onUserMediaSuccess'),
            dojo.hitch(this, 'onUserMediaError')
          );

          this.logger.log('(ebg.webrtc)      ' + 'Requested access to local media with mediaConstraints: ' + JSON.stringify(
            this.mediaConstraints));
        } catch (e) {
          this.logger.log('(ebg.webrtc)      ' + 'getUserMedia() call failed with exception ' + JSON.stringify(
            e));
          this.logger.flush();

          // Callback on error
          this.getUserMediaError_callback();
        }
      },

      onUserMediaSuccess: function (stream) {
        this.logger.log('(ebg.webrtc)      ' + 'User has granted access to local media');

        // Attach the media stream to this element.
        this.localVideo.srcObject = stream;

        // re-add the stop function for Chrome (removed in Chrome 47)
        if (!stream.stop && stream.getTracks) {
          stream.stop = function () {
            this.getTracks().forEach(function (track) {
              track.stop();
            });
          };
        }

        this.localStream = stream;

        /* We don't use turn for now (as we would need to pay for server and bandwidth, and around 85% of connections should work with direct or stun)
        // Get turn server if needed
        if (location.hostname != "localhost") {
          requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
        }*/

        // Callback on success
        this.getUserMediaSuccess_callback();
      },

      onUserMediaError: function (error) {
        this.logger.log('(ebg.webrtc)      ' + 'Failed to get access to local media with error: ' + JSON.stringify(
          error));
        this.logger.flush();

        // Callback on error
        this.getUserMediaError_callback();
      },

      //////////////////////////////////////////////////////////////////////
      // Connect

      maybeConnect: function (player_id, signalingStarted) {
        if (typeof this.connections[player_id] == 'undefined') {
          // Create connection with this player
          this.connections[player_id] = new ebg.peerconnect(
            player_id,
            this.pcConfig,
            this.pcConstraints,
            this.mediaConstraints,
            this.stereo,
            this.localStream,
            this.logger,
            dojo.hitch(this, 'sendPlayerMessage')
          );
        }

        // If players have not yet started signaling to each other, start the exchange
        if (signalingStarted === false) {
          // The older player on BGA will be the one calling (arbitrary criteria to enforce only one connection between peers)
          if (this.player_id > player_id) {
            this.connections[player_id].doCall();
          }
          // The younger player on BGA will request a call (arbitrary criteria to enforce only one connection between peers)
          if (this.player_id < player_id) {
            this.connections[player_id].requestCall();
          }
        }
      },

      //////////////////////////////////////////////////////////////////////
      // Disconnect
      //////////////////////////////////////////////////////////////////////

      hangup: function () {
        this.logger.log('(ebg.webrtc)      ' + 'Hanging up & closing all connections');

        // Local stop
        if (this.localStream != null) {
          this.localStream.stop();
          this.localStream = null;
        }

        // Close all connections
        for (var i = 0; i < this.in_room.length; i++) {
          var player_id = this.in_room[i];

          if (typeof this.connections[player_id] != 'undefined') {
            this.logger.log('(ebg.webrtc)      ' + 'Closing connection with player ' + player_id);
            g_sitecore.recordMediaStats(player_id, 'stop');
            this.connections[player_id].stop();
            this.connections.splice(player_id);
          } else {
            this.logger.log('(ebg.webrtc)      ' + 'No current connection with player ' + player_id);
          }
        }

        g_sitecore.recordMediaStats(this.player_id, 'stop');

        // Signal other players that we hanged up so that they can do the same
        this.sendRoomMessage('bye');

        // Flushing the log for the session
        this.logger.flush();
      },

      handleRemoteHangup: function (player_id) {
        this.logger.log('(ebg.webrtc)      ' + 'Player ' + player_id + ' signaled remote hang up on his end');

        if (typeof this.connections[player_id] != 'undefined') {
          this.logger.log('(ebg.webrtc)      ' + 'Closing connection with player ' + player_id);
          this.connections[player_id].stop();
          this.connections.splice(player_id);
        } else {
          this.logger.log('(ebg.webrtc)      ' + 'No current connection with player ' + player_id);
        }

        g_sitecore.recordMediaStats(player_id, 'stop');
        this.onLeaveRoom_callback(player_id);
      },

      toggleVideoMute: function (player_id) {
        var stream = null;

        if (player_id == this.player_id) {
          stream = this.localStream;
        } else if (typeof this.connections[player_id] != 'undefined') {
          stream = this.connections[player_id].remoteStream;
        }

        if (stream == null) {
          this.logger.log('(ebg.webrtc)      ' + 'No video stream to mute for player ' + player_id + ': aborting');
          return true;
        }

        // Call the getVideoTracks method via webrtcadapter.js
        var videoTracks = stream.getVideoTracks();

        if (videoTracks.length === 0) {
          this.logger.log('(ebg.webrtc)      ' + 'No local video available: aborting');
          return true;
        }

        if (this.isVideoMuted) {
          for (i = 0; i < videoTracks.length; i++) {
            videoTracks[i].enabled = true;
          }
          this.logger.log('(ebg.webrtc)      ' + 'Video unmuted');
        } else {
          for (i = 0; i < videoTracks.length; i++) {
            videoTracks[i].enabled = false;
          }
          this.logger.log('(ebg.webrtc)      ' + 'Video muted');
        }

        this.isVideoMuted = !this.isVideoMuted;

        return this.isVideoMuted;
      },

      toggleAudioMute: function (player_id) {
        var stream = null;

        if (player_id == this.player_id) {
          stream = this.localStream;
        } else if (typeof this.connections[player_id] != 'undefined') {
          stream = this.connections[player_id].remoteStream;
        }

        if (stream == null) {
          this.logger.log('(ebg.webrtc)      ' + 'No audio stream to mute for player ' + player_id + ': aborting');
          return true;
        }

        // Call the getAudioTracks method via webrtcadapter.js.
        var audioTracks = stream.getAudioTracks();

        if (audioTracks.length === 0) {
          this.logger.log('(ebg.webrtc)      ' + 'No local audio available: aborting');
          return true;
        }

        if (this.isAudioMuted) {
          for (i = 0; i < audioTracks.length; i++) {
            audioTracks[i].enabled = true;
          }
          this.logger.log('(ebg.webrtc)      ' + 'Audio unmuted');
        } else {
          for (i = 0; i < audioTracks.length; i++) {
            audioTracks[i].enabled = false;
          }
          this.logger.log('(ebg.webrtc)      ' + 'Audio muted');
        }

        this.isAudioMuted = !this.isAudioMuted;

        return this.isAudioMuted;
      },

      //////////////////////////////////////////////////////////////////////
      // Signal management
      //////////////////////////////////////////////////////////////////////

      // Send a message to a specific player in the room
      sendPlayerMessage: function (player_id, message) {
        this.logger.log('(ebg.webrtc)      ' + 'Client sending player message ' + JSON.stringify(
          message));
        message = JSON.stringify(message);
        this.ajaxcall_callback(
          '/videochat/videochat/relayPlayerMessage.html',
          {
            player_id: player_id,
            room: this.room,
            message: message,
            lock: false
          },
          this,
          function (result) {},
          function (is_error) {},
          'post'
        );
      },

      // Send a message to all other players in the room
      sendRoomMessage: function (message) {
        this.logger.log('(ebg.webrtc)      ' + 'Client sending room message ' + JSON.stringify(
          message));
        message = JSON.stringify(message);
        this.ajaxcall_callback(
          '/videochat/videochat/relayRoomMessage.html',
          { room: this.room, message: message, lock: false },
          this,
          function (result) {},
          function (is_error) {}
        );
      },

      // React to messages received from other clients
      onMessageReceived: function (notif, isReplay) {
        if (this.localStream == null) {
          // Drop the ball, as we can't handle it.
          this.logger.log('(ebg.webrtc)      ' + 'Received message dropped (no localStream)');
          return;
        }

        if (this.player_id != notif.to) {
          // Should never happen, but just in case
          this.logger.log('(ebg.webrtc)      ' + 'Received message dropped (destined to another player' + notif.to + ')');
          return;
        }

        var player_id = notif.from;
        var message = JSON.parse(notif.message);
        this.logger.log('(ebg.webrtc)      ' + 'Client received message from player ' + player_id + ': ' + JSON.stringify(
          message));

        if (!this.isInRoom(player_id) && message != 'bye') {
          // New player has joined the room and is announcing himself (calling or requesting a call)
          this.onJoinRoom_callback(player_id, true);
        }

        if (typeof this.connections[player_id] != 'undefined') {
          if (message == 'bye') {
            // This client signaled end of transmission: closing up nicely
            this.handleRemoteHangup(player_id);
          } else {
            // Handle message
            this.connections[player_id].handleMessage(message);
          }
        } else {
          this.logger.log('(ebg.webrtc)      ' + 'Message received but no connection with player ' + player_id + ' (should never happen)');
        }
      }
    });
  }
);
