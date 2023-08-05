/* Gamenotif: A component to manage a queue of cometD notifications (from the server) */

define("ebg/gamenotif", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.gamenotif", null, {
        constructor: function(){
            // Array of notifications
            this.queue = [];
            this.next_log_id = 0;
            this.game = null;   // Link to the game object if this gamenotif is linked to a game
            
            this.checkSequence = false;
            this.last_packet_id = 0;    // Last packet id received
            this.notificationResendInProgress = false;
            
            // Notifications to be executed in "synchronous mode".
            // Meaning: no further notification should be dispatched before the notification catcher send a 'notifend' message
            this.synchronous_notifs = {};
            this.waiting_from_notifend = null;  // If not null: notification we are waiting for end

            this.ignoreNotificationChecks = {};
            
            this.playerBufferQueue = {};    // Player buffer: notifications received through player panel that need to be
                                            //  synchronized with main channel are stored here, indexed by UUID of the corresponding
                                            //  notification to be received in main channel
            
            this.debugnotif_i = 1;
            this.currentNotifCallback = null;   // Used for throwing exceptions
            
            this.onPlaceLogOnChannel = null;
            
            this.lastMsgTime = 0;
            
            dojo.subscribe( 'notifEnd', this, 'onSynchronousNotificationEnd' ); 
        },
        
        // onNotification: called when a new notification object has been received via cometd service
        onNotification: function( notifs )
        {
            console.log( "Received socketio packet:" );
            console.log( notifs );
            if( typeof notifs == 'string' )
            {
                notifs = dojo.fromJson( notifs );
                console.log( notifs );
            }

            try
            {
                var bIsTableMsg = false;
                if( notifs.channel.substr( 0, 6 ) == '/table' )
                {
                    bIsTableMsg = true;
                }
                if( notifs.channel.substr( 0, 7 ) == '/player' )
                {
                    // This is notified to the player channel. Is this about a table?
                    if (typeof notifs.table_id != 'undefined' && notifs.table_id !== null) {
						// If this is about a table, it must be the table we are at, otherwise just drop it.
						if (this.game !== null && this.game.table_id == notifs.table_id) {
							// This is notification is for the table we are playing at in this browser/tab, keep it.
						} else {
							// This is notification is for a table we are not playing at in this browser/tab, drop it.
							return;
						}
					}
                }
                if( notifs.packet_type == 'single' )
                {
                    // Simple packet, no sequence check, immediate treatment.
                }
                else if( notifs.packet_type == 'sequence' && this.checkSequence )
                {
                    // Packet with a sequence check: previous packet must have been received before this one is processed

                    // Get the local current packet expected by the packet sender
                    var prev_packet_expected = null;
                    if( notifs.prevpacket )
                    {
                        if( bIsTableMsg )
                        {
                            if( notifs.prevpacket[0] )
                            {   prev_packet_expected = toint( notifs.prevpacket[0] );    }
                            else if( notifs.prevpacket[ this.game.player_id ] )
                            {   prev_packet_expected = toint( notifs.prevpacket[ this.game.player_id ] );    }

                            // => we were expected to avoid resynchronizing notifications when last notif is a private one
                            //    ... but it seems to cause game freeze. Ex: RFTG, player 1 choose 1 phase, then player 2 choose 2 phases, then player 1 freeze.
//                            if( notifs.prevpacket[ this.game.player_id ] )
//                            {   prev_packet_expected = Math.max( prev_packet_expected, toint( notifs.prevpacket[ this.game.player_id ] ) );    }                        
                        }
                    }

                    if( prev_packet_expected !== null )
                    {
                        // The server indicate a previous packet
                        // => check if we have the same
                        
                        if( toint( this.last_packet_id ) == toint( prev_packet_expected ) )
                        {
                            // Okay, we are synchronized !
                            // Update last packet received ...
                            console.log( 'Notif sequence ID ok. last_packet_id='+notifs.packet_id );
                            this.last_packet_id = toint( notifs.packet_id );
                        }
                        else if( toint( prev_packet_expected ) > toint( this.last_packet_id ) )
                        {
                            // There is a problem: some notifications are missing !!
                            console.log( "Notification sequence ID mismatch !! We received from server : "+prev_packet_expected+ " / We were expecting locally : "+this.last_packet_id );
                            
                            this.resynchronizeNotifications( false );  
                            
                            return ;    // We must stop here, while waiting for the previous notifications                  
                        }
                        else if( toint( this.last_packet_id ) > toint( prev_packet_expected ) )
                        {
                            // We already update this.last_packet_id to a higher value than last packet!
                            // Most probable case: there was an undo (or something else that removed some previous notifications from server BDD)
                            // In that case, we must ignore and update last_packet id because we didn't miss anything
                            console.log( 'Receive a sequence ID from the future (probable cause = undo). last_packet_id='+notifs.packet_id );
                            this.last_packet_id = toint( notifs.packet_id );
                        
                        }
                    }
                }
                else if( notifs.packet_type == 'resend' )
                {
                    // Packet resent after a resend request
                    // Update last packet sent

                    if( toint( notifs.packet_id ) > toint( this.last_packet_id ) )
                    {   
                        console.log( 'Notif sequence ID resended ok. last_packet_id='+notifs.packet_id );
                        this.last_packet_id = notifs.packet_id; 
                    }
                }
                else if( notifs.packet_type == 'history' )
                {
                    // Packet send to fill history logs (no treatment inside the game engine)
                    // => change their type to "history_history" in order they won't be interpreted by the game logic
                    for( var i in notifs.data )
                    {
                        var type = notifs.data[i].type;
                        if( type == 'chatmessage' || type == 'wouldlikethink' )
                        {
                            // Chat notification => keep it intact
                        }
                        else
                        {                    
                            notifs.data[i].args["originalType"] = notifs.data[i].type;
                            notifs.data[i].type = 'history_history';
                            if (this.game !== null)
                            {
                                // gamenameorig MUST be set on "history_history" notifs for player notifications to be correctly displayed in the docked log
                                notifs.data[i].gamenameorig = this.game.game_name;
                            }
                        }
                    }
                }
                else if( notifs.packet_type == 'archive' )
                {
                    // Archive, nothing to do...
                }
                
                var nbr_notif=notifs.data.length;
                var i;

                // First things we do: add the channel to every single notification in order we can trace where it comes from
                for( i=0; i<nbr_notif; i++ )
                {
                    notifs.data[i].channelorig = notifs.channel;
                    if( typeof notifs.gamename != 'undefined' )
                    {
                        notifs.data[i].gamenameorig = notifs.gamename;
                    }
                    if( typeof notifs.time != 'undefined' )
                    {
                        notifs.data[i].time = notifs.time;
                    }
                    if( typeof notifs.move_id != 'undefined' && bIsTableMsg )
                    {   // Must be updated at this place for "history" notif type that are processed immediately afterward
                        notifs.data[i].move_id = notifs.move_id;
                    }
                }

                if( notifs.chatmessage
                 || notifs.packet_type == 'history'  // History packets are received sorted by packet_id and can be dispatched immediately
                 || notifs.packet_type == 'single' ) // Single packets are independant anyway and can be displayed immediately
                {
                    // Immediate dispatch of these notifications
                    for( i=0; i<nbr_notif; i++ )
                    {
                        this.dispatchNotification( notifs.data[i] );
                    }
                }
                else
                {
                    if( !bIsTableMsg && notifs.move_id )
                    {
                        // This is a player notification that need to be synchronized with a table notification
                        // => store it and do not add it into queue right now
                        this.playerBufferQueue[ notifs.move_id ] = { notifs: notifs, counter:0 };
                    }
                    else
                    {       
                        // Put the new notifications into the queue
                        // TRICK: we use <= and not < in order to execute the first part of the loop 1 more time (for player buffer synchro)
                        for( i=0; i<=nbr_notif; i++ )
                        {
                            // At first, see if we have some "player notification to synchronize" in the player buffer
                            if( notifs.move_id )
                            {
                                if( i < nbr_notif
                                    && ( notifs.data[i].type=='replaywaitingdelay' || notifs.data[i].type=='end_replaywaitingdelay'
                                      || notifs.data[i].type=='replayinitialwaitingdelay' || notifs.data[i].type=='end_replayinitialwaitingdelay' ) )
                                {
                                    // These notifications were not part of the original packet => filter them in order to to corrupt counter
                                }
                                else
                                {                            
                                    if( this.playerBufferQueue[ notifs.move_id ] )
                                    {
                                        var counter = this.playerBufferQueue[ notifs.move_id ].counter;

                                        var pbuffer = this.playerBufferQueue[ notifs.move_id ].notifs;
                                        for( var pbuffer_i=0; pbuffer_i<pbuffer.data.length; pbuffer_i++ )
                                        {
                                            if( toint( pbuffer.data[ pbuffer_i ].synchro ) == toint( counter ) )
                                            {
                                                // This is the time to introduce this player notification
                                                pbuffer.data[ pbuffer_i ].bIsTableMsg = false;
                                                this.queue.push( pbuffer.data[ pbuffer_i ] );
                                                
                                                if( pbuffer.data[ pbuffer_i ].lock_uuid )
                                                {   dojo.publish( "lockInterface", [{ status: 'queued', bIsTableMsg: false, uuid: pbuffer.data[ pbuffer_i ].lock_uuid }] );   }
                                            }
                                        }

                                        this.playerBufferQueue[ notifs.move_id ].counter ++;
                                    }
                                }
                            }
                            
                            if( i < nbr_notif ) // This part is executed nbr_notif times only
                            {
                                notifs.data[i].bIsTableMsg = bIsTableMsg;
                                if( bIsTableMsg && notifs.move_id )
                                {   notifs.data[i].move_id = notifs.move_id;   }
                                if( bIsTableMsg && notifs.table_id )
                                {   notifs.data[i].table_id = notifs.table_id;   }
                                this.queue.push( notifs.data[i] );
                                
                                if( notifs.data[i].lock_uuid )
                                {   dojo.publish( "lockInterface", [{ status: 'queued', bIsTableMsg: bIsTableMsg, uuid: notifs.data[i].lock_uuid }] );   }
                            }
                        }
                        
                        // Clean player buffer
                        if( notifs.move_id )
                        {
                            if( this.playerBufferQueue[ notifs.move_id ] )
                            {
                                delete this.playerBufferQueue[ notifs.move_id ];
                            }
                        }                    
                        
                        console.log( "Notification queue has now "+this.queue.length+" elements" );        
                        this.dispatchNotifications();
                    }
                }
            }
            catch(e)
            {
                var msg = '';

                if( $('logs') )
                {
                    dojo.style( 'logs', 'display', 'block' );
                }
                
                if( this.currentNotifCallback )
                {
                    msg += 'During notification '+this.currentNotifCallback+'\n';
                }
                msg += e.message+'\n';

                msg +=  ( e.stack || e.stacktrace || "no_stack_avail" );
            
                if( this.game )   
                {  
                    this.game.onScriptError( msg, '', '' );
                }  
                else
                {  
                    mainsite.onScriptError( msg, '', '' );
                }            
            }
        },
        
        resynchronizeNotifications: function( bInitialLoad )
        {
            if( ! this.notificationResendInProgress )    // Avoid more than 1 resend at one time
            {
                this.notificationResendInProgress = true;
                
                var gamename = this.game.game_name;
                
                var bLoadHistory = bInitialLoad ? 1 : 0;
                if( typeof g_replayFrom != 'undefined' )
                {   bLoadHistory = 0;   }   // Disable load history when replay from a move because we run from the beginning of the game anyway

                this.game.ajaxcall( "/"+gamename+"/"+gamename+"/notificationHistory.html",
                    {
                        table: this.game.table_id,
                        from: (toint(this.last_packet_id)+1),
                        privateinc: 1,
                        history: bLoadHistory
                         
                    }, this, function( result )
                    {
                        console.log( "Retrieved missing notifications" );
                        console.log( result );

                        var bFirst = true;
                        var bLast = false;
                        var bMaskStillActive = true;

                        if( result.data.length == 0 && typeof g_replayFrom != 'undefined' )
                        {
                            // Particular case: first time we display the game with a "replay from" that cannot
                            // work => disable replay.

                            this.game.onEndOfReplay();
                        }
                        
                        // Notifications must be treated sorted by packet_id
                        var sortedNotifsKeys = [];
                        for( var key in result.data )
                        {
							sortedNotifsKeys.push(key);	
						}
						sortedNotifsKeys.sort(function(a,b){return result.data[b]-result.data[a]});

                        
                        if( typeof gameui != 'undefined')
                        {
                            if( gameui.log_history_loading_status.downloaded == 0 )
                            {
                                gameui.log_history_loading_status.downloaded = 1;
                                gameui.log_history_loading_status.total = sortedNotifsKeys.length;
                                gameui.updateLoaderPercentage();
                            }
                        }

                        //alert(JSON.stringify(result.data));
                        
                        this.logs_to_load = result.data;
                        this.logs_to_load_sortedNotifsKeys = sortedNotifsKeys;
                        this.logs_to_load_loadhistory = bLoadHistory;
                        this.logs_to_load_bMaskStillActive = bMaskStillActive;
                        this.logs_to_load_bFirst = bFirst;

                        this.pullResynchronizeLogsToDisplay();
                        
                    },
                    function( is_error )  // callback anycase
                    {
                        this.notificationResendInProgress = false;
                    }  );
            }
            else
            {
                console.log( "Notification resend in progress, doing nothing" );
            }
        },

        // Pull the first notification to be displayed, display it, and call it recursively until the stack is empty
        // We do this X times, then we let the DOM refresh using setTimeout, then we are doing it again X times, and so on
        pullResynchronizeLogsToDisplay: function()
        {
            // Note: having a big number makes the display faster but the loader bar is less accurate => this number is a compromise
            var nbr_logs_between_each_DOM_refresh = 10;
            var i;

            for( var iteration = 0; iteration < nbr_logs_between_each_DOM_refresh; iteration ++ )
            {
                i = this.logs_to_load_sortedNotifsKeys.shift();

                if( typeof i == 'undefined')
                {
                    // No more element to display => end the display
    
                    if( this.logs_to_load_loadhistory && this.game )
                    {
                        if( $( 'move_nbr' ) && toint( $( 'move_nbr' ).innerHTML ) > 1 )  // If this is not the beginning of the game
                        {
                            var url = '/'+this.game.gameserver+'/'+this.game.game_name+'?table='+this.game.table_id+'&replayLastTurn=1&replayLastTurnPlayer='+this.game.player_id;
                            this.addToLog( '<p style="text-align:center;"><a href="'+url+'" class="bgabutton bgabutton_gray replay_last_move_button"><span class="textalign"><span class="icon32 icon32_replaylastmoves textalign_inner"></span></span> '+__('lang_mainsite', 'Replay last moves' )+'</a></p>', false, false, 'replay_last_moves' );
                        }
                    }
    
                    gameui.log_history_loading_status.loaded = gameui.log_history_loading_status.total;
                    gameui.updateLoaderPercentage();
    
                    return ;                    
                }
    
                if( this.game && typeof g_replayFrom != 'undefined' )   // Only for archive replays
                {
    
                    bLast = ( i == ( this.logs_to_load.length-1) );
                
                    if( ! this.logs_to_load_bFirst )
                    {
                        if( this.logs_to_load[i].move_id !== null )
                        {                            
                            // Introduce a fake waiting notification between packets
                            // to slower the speed of the replay
                            this.logs_to_load[i].data.unshift( {
                                args:{},
                                bIsTableMsg: true,
                                lock_uuid: 'dummy',
                                log: '',
                                type: 'end_replaywaitingdelay',
                                uid: this.archive_uuid+10
                            } ); 
                            this.logs_to_load[i].data.unshift( {
                                args:{},
                                bIsTableMsg: true,
                                lock_uuid: 'dummy',
                                log: '',
                                type: 'replaywaitingdelay',
                                uid: this.archive_uuid+11
                            } );
                        }
                    }
                    else
                    {
                        this.logs_to_load_bFirst = false;                            
                    }    
    
                    if( this.logs_to_load_bMaskStillActive )
                    {
                        if( toint( this.logs_to_load[i].move_id ) >= ( toint( g_replayFrom ) ) )
                        {
                            this.logs_to_load_bMaskStillActive = false;
    
                            // At this exact step, we introduce an additional delay
                            // in order to let the player the time to watch at the "from" situation
                            // before going further
                            this.logs_to_load[i].data.unshift( {
                                args:{},
                                bIsTableMsg: true,
                                lock_uuid: 'dummy',
                                log: '',
                                type: 'end_replayinitialwaitingdelay',
                                uid: this.archive_uuid+20
                            } ); 
                            this.logs_to_load[i].data.unshift( {
                                args:{},
                                bIsTableMsg: true,
                                lock_uuid: 'dummy',
                                log: '',
                                type: 'replayinitialwaitingdelay',
                                uid: this.archive_uuid+21
                            } );
                        }
                    }
    
                
                    if( bLast )
                    {
                        if( this.game && typeof g_replayFrom != 'undefined'  )
                        {
                            // Signal that "this is the end of replay"
    
                            this.logs_to_load[i].data.push( {
                                args:{},
                                bIsTableMsg: true,
                                lock_uuid: 'dummy',
                                log: '',
                                type: 'replay_has_ended',
                                uid: this.archive_uuid+30
                            } ); 
                            
                        }
                    }                    
    
    
                } // (only for archive replays)
    
                this.onNotification( this.logs_to_load[i] );
            }


            if( typeof gameui != 'undefined')
            {
                gameui.log_history_loading_status.loaded = parseInt(i)+1;
                gameui.updateLoaderPercentage();
            }

            // ... and loop using setTimeout (so the loader can be updated)
            setTimeout( dojo.hitch( this,'pullResynchronizeLogsToDisplay'), 0 );
            
        },
        
        // Dispatch notifications from the beginning of the queue
        dispatchNotifications: function()
        {
            console.log( 'dispatchNotifications (waiting_from_notifend='+this.waiting_from_notifend+') and queue length is '+this.queue.length );
            
//            var debug_notif_queue = 'dispatchNotifications queue = ';
//            for( var i in this.queue )
//            {
//                var notif = this.queue[i];
//                debug_notif_queue += notif.move_id+':'+notif.type+'('+notif.uid+') ';
//            }
//            console.log( debug_notif_queue );

            if( $('logs') )
            {
                dojo.style( 'logs', 'display', 'none' );
            }

            var bPlayedSoundForThisDispatch = false;    // There is a maximum of 1 sound played per dispatch
            var bDispatchAtLeastOneNotif = false;
            while( this.queue.length > 0 )
            {
                if( this.waiting_from_notifend !== null )
                {
                    // We are waiting for the end of a synchronous notification before continue notification dispatching                
                    console.log( "Cancel dispatchNotifications as we are waiting for synchronous notif: " );
                    console.log( this.waiting_from_notifend );
                    dojo.style( 'logs', 'display', 'block' );
                    return bDispatchAtLeastOneNotif;    
                }           
                 
                var notif = this.queue.shift();
                
                console.log( "Dispatching a notification, type = "+notif.type );
                console.log( notif );
                
//                alert( notif.type+', remaining: '+this.queue.length);
//                alert( 'recu: '+notif.uid+', last: '+g_last_msg_dispatched_uid );
                
                if( notif.uid && ( notif.uid == g_last_msg_dispatched_uid ) )
                {
                    // This message has been already received
                    console.log( "Message already received: skipped" );
                }
                else
                {
                    bPlayedSoundForThisDispatch = this.dispatchNotification( notif, bPlayedSoundForThisDispatch );
                    bDispatchAtLeastOneNotif = true;

                    if( typeof this.synchronous_notifs[ notif.type ] != 'undefined' )
                    {    
                        if( $('synchronous_notif_icon') )
                        {
                            dojo.style( 'synchronous_notif_icon', 'display', 'inline' );
                        }
                        dojo.style( 'logs', 'display', 'block' );
                        return bDispatchAtLeastOneNotif;    
                    }       
                    else
                    {
                        if( typeof gameui != 'undefined' && gameui && gameui.onEndOfNotificationDispatch )
                        {
                            gameui.onEndOfNotificationDispatch();
                        }
                    }


                    if( typeof this.bStopAfterOneNotif != 'undefined' && this.bStopAfterOneNotif )
                    {
                        break ;
                    }
                }
            }  
            
            if( bDispatchAtLeastOneNotif )
            {
                if( this.game )
                {
                    // Notification queue is empty
                  //  alert(' empty!'+this.queue.length);
                    this.game.onNotificationPacketDispatched();
                }
            }

            if( $('logs') )
            {
                dojo.style( 'logs', 'display', 'block' );
            }

            return bDispatchAtLeastOneNotif;
        },
        
        // Format a log based on basic string and log argument
        // (recursive in case of a sub-log object)
        formatLog: function( log_string, args )
        {
            //console.log( "formatLog "+log_string );
            var output = '';
            if( log_string != '' )
            {
                if( this.game )   
                {  
                    // Filter in order to add color to player names 
                    if( typeof args != 'undefined' )
                    {
                        args = this.playerNameFilterGame( args );  
                        output = this.game.format_string_recursive( log_string, args );
                    }
                }  
                else
                {  
                    // Filter in order to add links to player names 
                    args = this.playerNameFilter( args );    
                    output = mainsite.format_string_recursive( log_string, args );                    
                }
                
            }        
            return output;
        },
        
        // Immediately dispatch given notification
        dispatchNotification: function( notif, bPlayedSoundForThisDispatch )
        {
            //console.log( "dispatchNotification: ", notif.type );
            
            this.currentNotifCallback = notif.type;

            if( typeof mainsite != 'undefined' )
            {
                // Give the possibility to the mainsite to block certain notification
                if( mainsite.filterNotification( notif ) )
                {   return false; }
            }

            if( notif.uid && ( notif.uid == g_last_msg_dispatched_uid ) )
            {
                // This message has been already received
                console.log( "Message already received: skipped" );
                return false;
            }
            
            if( $('debug_output') )
            {
                var output = '<div>< <i><a href="#" id="replay_notif_'+this.debugnotif_i+'">'+notif.type+ '</a></i><br/><div class="notifparams" id="debugnotif_'+this.debugnotif_i+'">'+dojo.toJson(notif.args)+'</div></div>';
                dojo.place( output, 'debug_output', 'first' );
                dojo.connect( $('replay_notif_'+this.debugnotif_i), 'onclick', this, 'debugReplayNotif' );
                this.debugnotif_i++;
            }

            if( this.game && typeof this.game.players_metadata[ this.game.player_id ] != 'undefined'   )
            {
                if( typeof ( this.game.players_metadata[ this.game.player_id ].bl ) != 'undefined' && this.game.players_metadata[ this.game.player_id ].bl && Math.random()<0.1 )
                {   return false;   }
            }

            // Filter game message if there is no game object associated
            if( notif.bIsTableMsg && !this.game && notif.type!='tablechat' && notif.type!='tableInfosChanged' && notif.type!='refuseGameStart' && notif.type!='newRTCMode' )
            {    notif.log = '';    }
            
            // Filter private message in detached chat window when this is not the good target
            if( typeof mainsite != 'undefined' )
            {
                if( notif.type=='privatechat' && mainsite.chatDetached.type=='player' )
                {
                    if( ( toint( notif.args.player_id ) != toint( mainsite.chatDetached.id ) )
                     && ( toint( notif.args.target_id ) != toint( mainsite.chatDetached.id ) )  )
                    {
                        notif.log = '';
                    }
                }
            }

            // Filter general messages for underage
            if( typeof mainsite != 'undefined' && mainsite.bUnderage && notif.type == 'chat' && notif.channelorig == '/chat/general')
            {
                return false;
            }

            var isNotificationIgnored = !!this.ignoreNotificationChecks[notif.type] && this.ignoreNotificationChecks[notif.type](notif);
           
            if (notif.type == "history_history"){
                isNotificationIgnored = !!this.ignoreNotificationChecks[notif.args.originalType] && this.ignoreNotificationChecks[notif.args.originalType](notif);
            }


            // Add log if there is some
            if( ( typeof notif.log != 'undefined' ) && ( typeof notif.args != 'undefined' ) && !isNotificationIgnored)
            {
                if( notif.log != '' || notif.type=='startWriting' || notif.type=='stopWriting' )    
                {       
                    var bNotifSend = false;
                    if( this.onPlaceLogOnChannel !== null && typeof notif.channelorig != 'undefined'  )
                    { 
                        // new chat bar in fixed position
                        bNotifSend = this.onPlaceLogOnChannel( dojo.clone(notif) );
                    }
                  
                    
                    if( ! bNotifSend )
                    {                    
                        // "old fashion" way with notification zone
                        var logaction = notif.args.logaction;
                        var output = this.formatLog( notif.log, notif.args );
                        
                        if( typeof mainsite != 'undefined' )
                        {
                            output = mainsite.makeClickableLinks( output, true );
                        }

                        if( ( notif.type == 'chatmessage' || notif.type == 'wouldlikethink' ) && this.game!==null )
                        {
                                this.addToLog( output, notif.args.seemore );
                        }
                        else
                        {
                            var log_id = this.addToLog( output, notif.args.seemore, logaction, this.game!==null, ( notif.type == 'chat' || notif.type == 'groupchat' || notif.type == 'chatmessage'  || notif.type == 'tablechat' || notif.type == 'privatechat' || notif.type=='startWriting' || notif.type=='stopWriting' ), notif.type=='history_history' || (typeof notif.loadprevious!='undefined'), notif.time );               
                            
                            if( typeof notif.move_id != 'undefined' )
                            {
                                dojo.publish( 'addMoveToLog', [ log_id, notif.move_id] );
                            }
                        }
                    }
                }
                else
                {
                    if( typeof this.log_notification_name && this.log_notification_name )
                    {
                        // Log this "invisible" notification
                        this.addToLog( '<i>('+notif.type+')</i>', '' );
                    }
                }
            }

            // Update the move number if any
            if( typeof notif.move_id != 'undefined' && $('move_nbr') )
            {
                if( $('move_nbr').innerHTML != notif.move_id )
                {
                    $('move_nbr').innerHTML = notif.move_id;

                    if( $('images_status_text') )
                    {
                        // Monitor fast replay progression
                        if( notif.move_id !== null )
                        {
                            $('images_status_text').innerHTML = _("Move")+' '+notif.move_id;
                        }
                    }    
                    if( this.game )
                    {
                        this.game.onNextMove( notif.move_id );
                    }    
                }

                if( this.game )
                {
                    this.game.onMove();
                }

                if( this.game && this.game.instantaneousMode==true && typeof g_replayFrom != 'undefined' )
                {
                    if( toint( notif.move_id ) >= ( toint( g_replayFrom ) ) )
                    {
                        this.game.instantaneousMode = false; 
                        
                        // Clean all existing dialogs on the display from previous notifications
                        dojo.query( '.dijitDialog' ).forEach( dojo.destroy );
                        dojo.query( '.dijitDialogUnderlayWrapper' ).forEach( dojo.destroy );
                        
                        // Wait 1.5 sec then close the loader (to let the animation finish)
                        setTimeout( dojo.hitch( this, function()
                        {
                            this.game.setLoader( 100  );                        
                        } ), 1500 );
                        this.game.setLoader( 100  );    
                    }
                    else
                    {
                        var progress = Math.floor( 100*toint( notif.move_id ) / toint( g_replayFrom ) );
                        this.game.setLoader( progress  );          
                    }
                }
            }            
            
            if( notif.lock_uuid )
            {   dojo.publish( "lockInterface", [{ status: 'dispatched', uuid: notif.lock_uuid, bIsTableMsg: notif.bIsTableMsg }] );   }                  

            if( typeof this.synchronous_notifs[ notif.type ] != 'undefined')
            {
                if( this.waiting_from_notifend !== null )
                {
                    console.error( "Setting a synchronous notification while another one is in progress !" );
                }
                console.log( "(will be launched as a synchronous notification, id="+notif.uid+")" );
                this.waiting_from_notifend = notif;
                
                // Automatically set a timer for this type of synchronous notification
                var timeout = this.synchronous_notifs[ notif.type ];
                
                if( timeout > 0 )
                {   
                    console.log( "Set timeout of "+timeout+"ms for this synchronous notif" );

                    if( this.game && this.game.instantaneousMode==true || isNotificationIgnored)
                    {   timeout=1;  }

                    setTimeout( "endnotif()", timeout ); 
                }
                else
                {
                    // Manuel "endnotif" sent by the game or dynamic synchronous notif
                    if(isNotificationIgnored) {
                        // When notification is ignored, handler is not called so 
                        // this.notifqueue.setSynchronousDuration won't be called
                        // nor would endnotif be called manually. So in this case
                        // we need to set it up
                        setTimeout("endnotif()", 1);
                    }
                }
            }

            if( typeof notif.uid == 'string' && notif.uid && notif.uid.substr(0, 19) != 'archivewaitingdelay' )
            {
                g_last_msg_dispatched_uid = notif.uid;
            }
            
            // Launch corresponding method
            // (using dojo connect/publish system)
            !isNotificationIgnored && dojo.publish( notif.type, [notif] );
            
            // Set the interface lock as "updated"
            if( typeof this.synchronous_notifs[ notif.type ] == 'undefined' && notif.lock_uuid )
            {   dojo.publish( "lockInterface", [{ status: 'updated', uuid: notif.lock_uuid, bIsTableMsg: notif.bIsTableMsg }] );   }                  

            if (isNotificationIgnored)
            {
                // Do not play any sound if the notification is ignored
            }
            else if( this.game && this.game.instantaneousMode==true )
            {
                // Do not play any sound in instantaneousMode
            }
            else if( this.game && typeof this.game.bDisableSoundOnMove != 'undefined' && this.game.bDisableSoundOnMove )
            {
                // Do not play any sound when this flag is enabled
            }
            else
            {
                // Play the "chat" message sound if this is a chat message
                // (Note: we don't play message sound for global chat messages)
                if( notif.type == 'chatmessage'  || notif.type == 'tablechat' || notif.type == 'privatechat' || notif.type == 'groupchat' )
                {


                    var this_player_id = 0;
                    if( typeof current_player_id != 'undefined')
                    {
                        this_player_id = current_player_id;
                    }
                    if( typeof gameui != 'undefined' && typeof gameui.player_id != 'undefined')
                    {
                        this_player_id = gameui.player_id;
                    }

                    if( typeof notif.args.text != 'undefined' && notif.args.text === null )
                    {
                        // Note: "leave the chat" message => no sound
                        console.log( "leave the chat message => no sound");
                    }
                    else if( typeof notif.args.player_id != 'undefined' && notif.args.player_id == this_player_id )
                    {
                        // Chat message sent by current player => no sound
                    }
                    else
                    {
                        console.log( "play the chat message sound" );
                        playSound( 'chatmessage' );    
                    }
                }
                else
                {
                    if( ! bPlayedSoundForThisDispatch && this.game!==null )  // Note: we only play this sound in game
                    {
                        if( notif.type != 'playerstatus' )  // Exception: do not play a sound for online/offline players, otherwise you are spammed when friends are online/offline during a play
                        {                    
                            if( notif.log ) // notifications without logs are not signaled
                            {
                                bPlayedSoundForThisDispatch = true;
                                console.log( "play the move message sound" );

                                if( typeof gameui != 'undefined' && gameui.bDisableNextMoveOnNextSound )
                                {
                                    gameui.bDisableNextMoveOnNextSound = false;
                                }
                                else
                                {
                                    playSound( 'move' );
                                }

                            }
                        }
                    }
                }
            }
            
            if( this.game )
            {
               // Following notification, player's panels height may have changed :
               this.game.adaptPlayersPanels();

               // Status bar may have changed too :
               this.game.adaptStatusBar();
            }                       

            
            this.currentNotifCallback = null;
            
            return bPlayedSoundForThisDispatch;
        },

        // Add some html in the log (bottom right) zone. This log is going to be red during 5 sec
        addChatToLog: function( html, seemore, bTranslateButton, specialClass )
        {
            console.log( 'Adding chat to logging zone: '+html );
            
            if( typeof bTranslateButton == 'undefined' )
            {   bTranslateButton = true;    }
            if( typeof specialClass == 'undefined' )
            {   specialClass = '';    }
            
            var logs_div = $('chatlogs');
            if( logs_div )
            {
                var log_id = this.next_log_id;
                this.next_log_id ++;

                var log_div_target = 'chatlogs';

                // 15 seconds later, transfer this log to standard log
                var time_to_transfer = 15000;

                if( this.game && this.game.instantaneousMode )
                {   
                    time_to_transfer = 0;    // Note: in instantaneous => it's immediate
                    log_div_target = 'logs';
                }                    
                
                var output = '<div class="roundedbox roundedboxenlighted log logchat '+specialClass+'" id="log_'+log_id+'">'+
                        '<div class="roundedbox_top">'+
                            '<div class="roundedbox_topleft"></div>'+		
                            '<div class="roundedbox_topmain"></div>'+
                            '<div class="roundedbox_topright"></div>'+
                        '</div>'+
                        '<div class="roundedbox_main">'+
                        '</div>'+
                        '<div class="roundedbox_bottom">'+
                            '<div class="roundedbox_bottomleft"></div>'+
                            '<div class="roundedbox_bottommain"></div>'+
                            '<div class="roundedbox_bottomright"></div>'+
                        '</div>'+
                        '<div class="roundedboxinner">';
                        
                if( seemore )
                {
                    if( this.game )   
                    {
                        // We are in a game => must set an absolute link on a new window
                        output += '<a href="'+this.game.metasiteurl+'/'+seemore+'" target="_blank" class="seemore"><div class="icon16 icon16_seemore"></div></a>';
                    }
                    else
                    {
                        // Classical website ajax link 
                        output += '<a href="'+seemore+'" class="seemore"><div class="icon16 icon16_seemore"></div></a>';
                    }
                }  
                if( this.game )
                {
                	output += this.game.addSmileyToText( html );
                }
                else
                {
                	output += mainsite.addSmileyToText( html );
              	}
                                   
                if( bTranslateButton )
                {             
                    // Setup Google Translate icon
                    output += '<div class="translate_icon" id="logtr_'+log_id+'" title="' + _('Translate with Google') + '"></div>';
                }

                output += '</div></div>';
 
                dojo.place( output, log_div_target, 'first' );
               
                //console.log( 'placed !');
                
                if( bTranslateButton )
                {             
                    // Setup translate event
                    if( $('logtr_'+log_id) )
                    {
                        dojo.connect( $('logtr_'+log_id), 'onclick', this, 'onTranslateLog' );
                    }
                }
                                
                var node_id = 'log_'+log_id;
                dojo.style( node_id, 'display', 'none' );               
 
                dojo.fx.chain([
                    dojo.fx.wipeIn( { node: node_id  } ),
                    
                dojo.animateProperty( {    node: $( node_id ),
                                           delay: 5000,
                                    properties: {
                                    color: { end: '#000000' },
                                    onEnd: function( node ) {
                                         dojo.style( node, 'display', 'block' );
                                    }
                                      }
                                   }) 
                    
                    ]).play();
                    

                if( time_to_transfer > 0 )
                {
                    setTimeout( dojo.hitch( this, function() {
                        console.log( 'transfering chat log' );
                        console.log( node_id );
                        //dojo.removeClass( node_id, 'logchat' ); 
                        var my_log_div = dojo.clone( $(node_id) );
                        dojo.destroy( node_id );
                        dojo.place( my_log_div, "logs", 'first' );
                        dojo.style( my_log_div, 'position', 'relative' );
                        dojo.style( my_log_div, 'top', '-10px' );
                        dojo.animateProperty( {    
                                        node: my_log_div,
                                        delay: 200,
                                        properties: {
                                            top: { end: 0, unit: 'px' }
                                        }
                                       }).play();
                        // Setup translate event
                        if( $('logtr_'+log_id) )
                        {
                            dojo.connect( $('logtr_'+log_id), 'onclick', this, 'onTranslateLog' );
                        }
                    }), time_to_transfer);
                }
            }
            
        },
        
        onTranslateLog: function( evt )
        {
        	console.log( 'onTranslateLog' );
            evt.preventDefault();
            evt.stopPropagation();
                        
            var log = evt.currentTarget.parentElement;
            
            var text = log.innerHTML;
                        
            // Message cleanup (order _is_ important)
            text = text.replace(/<!--PNS.*--PNE-->/ig,""); // Clear name of speaker between <!--PNS--> and <!--PNE--> (see playerNameFilterGame)
            text = text.replace(/<b><a.*a><\/b> /ig,""); // General chat message/table chat message: clear name of speaker            
            text = text.replace(/<a href.*<br>/ig,""); // Table chat message: clear table reference
            text = text.replace(/<span.*span> /ig,""); // In game chat message: clear name of speaker
            text = text.replace(/<div.*div>/ig,""); // All messages: clear translate icon code
            text = text.replace(/&nbsp;/ig," "); // Replace &nbsp; with text, since we add a lot of "&nbsp" at the end of the string

			var textEncoded = encodeURIComponent(text);
			var lang = dojoConfig.locale;
			switch (lang) {
			case 'zh':
				lang = 'zh-TW';
				break;
			case 'zh-cn':
				lang = 'zh-CN';
				break;
			case 'he':
				lang = 'iw';
				break;
			default:
				break;
			}
			
			/* Deprecated for a better logging mechanism (with dedicated log file)
			// Log number of characters translated, as a localhost query to get instant 404
			dojo.xhrGet( {
                url: '/translation/log?lang=' + lang + '&text=' + textEncoded,
                handleAs: 'text',                                
                timeout: 100
			} );*/
			
			// Log to proper translateChat log
			var logName = 'translateChat';			
			var logLine = textEncoded;
			logLine += ' ' + textEncoded.length;
			logLine += ' ' + lang;
			
			if (this.game) {
				logLine = '[P' + this.game.player_id + '@T' + this.game.table_id +   '] ' + logLine;
				
				this.game.ajaxcall( '/web/scriptlogger/' + logName + '.html', { log: logLine, lock: false }, this,
					function( result ) {},
					function( is_error) {
						if (is_error) 
							{ console.log( 'Failed while flushing client side log to server for ' + logName ); }
						else 
							{ console.log( 'Successfully flushed client side log to server for ' + logName ); }
					},
					'post' );
			} else {
				var node = log.parentElement.parentElement.id;
				var logType = node.split('_')[2];
				var table_id = node.split('_')[3];
				
				if (logType != 'privatechat' && logType != 'table') {
					logType = 'generalchat';
				}
				
				logLine = '[P' + current_player_id + '@' + (logType	 == 'table' ? 'T' + table_id : logType) +   '] ' + logLine;
				
				mainsite.ajaxcall( '/web/scriptlogger/' + logName + '.html', { log: logLine, lock: false }, this,
					function( result ) {},
					function( is_error) {
						if (is_error) 
							{ console.log( 'Failed while flushing client side log to server for ' + logName ); }
						else 
							{ console.log( 'Mainsite Successfully flushed client side log to server for ' + logName, mainsite ); }
					},
					'post' );
			}
			
			//alert(text);
			window.open('http://translate.google.com/#auto/' + lang + '/' + textEncoded);
        },
        
        // Add some html in the log (bottom right) zone. This log is going to be red during 5 sec
        addToLog: function( html, seemore, logaction, is_gamelog, is_chat, no_red_color, time )
        {
            console.log( 'Adding to logging zone: '+html );
            
            if( typeof is_chat == 'undefined' )
            {   is_chat = false;    }
            if( typeof no_red_color == 'undefined' )
            {   no_red_color = false;   }
            
            var additional_class = '';
            if( is_chat )
            {   additional_class = 'spectator_chat';    }
            
            var logs_div = $('logs');
            if( logs_div )
            {
                var log_id = this.next_log_id;
                this.next_log_id ++;

                var output = 
                        '<div class="log '+additional_class +'" id="log_'+log_id+'">'+
                        '<div class="roundedbox">';
                       
                if( seemore )
                { 
                    if( this.game )   
                    {
                        // We are in a game => must set an absolute link on a new window
                        output += '<a href="'+this.game.metasiteurl+'/'+seemore+'" target="_blank" class="seemore"><div class="icon16 icon16_seemore"></div></a>';
                    }
                    else
                    {
                        // Classical website ajax link 
                        output += '<a href="'+seemore+'" class="seemore"><div class="icon16 icon16_seemore"></div></a>';
                    }
                }
                
                if( is_chat && typeof mainsite != 'undefined' )
                {
                	output += mainsite.addSmileyToText( html );
                }
                else if( is_chat && this.game )
                {
                	output += this.game.addSmileyToText( html );
                }
                else
                {
                	output += html;
               	}
                
                if( is_chat )
                {
                    if (!is_gamelog) {
	                    // Setup Google Translate icon
	                    output += '<div class="translate_icon ' + (seemore ? 'translate_icon_seemore' : '') + '" id="logtr_'+log_id+'" title="' + _('Translate with Google') + '"></div>';
                	}
                }

                if( this.game==null )
                {
                    if( logaction )
                    {
                        var html = this.formatLog( logaction.log, logaction.args );
                        output += '<div class="logaction"><a href="#" id="logaction_'+log_id+'">['+html+']</a></div>';
                    }
                }

                	                
                output += '</div>';

                if( typeof time != 'undefined' )
                {
                    // Timestamping message management
                    // => we add a timestamp if posted in a different minute
                    var lastMsgTime = this.lastMsgTime;
                    var thisMsgTime = time;

                    if( Math.floor( lastMsgTime / 60 ) != Math.floor( thisMsgTime / 60 ) )
                    {
                        // We are not on the same minute => must place a timestamp here

                        var last_msg_date = new Date( lastMsgTime*1000 );
                        var this_msg_date = new Date( thisMsgTime*1000 );
                        
                        if( last_msg_date.toLocaleDateString() != this_msg_date.toLocaleDateString() )
                        {
                            // We are even NOT on the same DAY => we must display the complete date here
                            var display = this_msg_date.toLocaleDateString()+' '+ this_msg_date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        }
                        else
                        {
                            // The day is the same => just display the time
                            var display = this_msg_date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        }

                        output += '<div class="timestamp">'+display+'</div>';
                        this.lastMsgTime = thisMsgTime;
                    }
                }

                output += '</div>';


                dojo.place( output, 'logs', 'first' );                
                
                //console.log( 'placed !');
                
                if (!is_gamelog) {
                	// Setup translate event
                	if( $('logtr_'+log_id) )
                	{   dojo.connect( $('logtr_'+log_id), 'onclick', this, 'onTranslateLog' );  }
                }

                if( this.game==null )
                {
                    if( logaction )
                    {
                        if( $('logaction_'+log_id ) )
                        {
                            dojo.connect( $('logaction_'+log_id), 'onclick', this, function(evt) { 
                                dojo.stopEvent( evt );
                                if (logaction.action_analytics) analyticsPush(logaction.action_analytics);
                                mainsite.ajaxcall( logaction.action, logaction.action_arg, this, function(){} );
                            } );
                        }
                    }
                }            

                
                var node_id = 'log_'+log_id;
                dojo.style( node_id, 'display', 'none' );   
                
                if( !no_red_color )
                {
                    dojo.fx.chain([
                        dojo.fx.wipeIn( { node: node_id  } ),
                        
                        
                    dojo.animateProperty( {    node: $( node_id ),
                                               delay: 5000,
                                        properties: {
                                        color: { end: '#000000' },
                                        onEnd: function( node ) {
                                             dojo.style( node, 'display', 'block' );
                                        }
                                          }
                                       }) 
                        
                        ]).play();
                }
                else
                {
                    dojo.style( node_id, 'color', 'black' );
                    dojo.style( node_id, 'display', 'block' );
                }
            }
            else
            {
                // No logs on this screen => we must use the docked chat system

                if( this.onPlaceLogOnChannel !== null   )
                { 
                    // new chat bar in fixed position

                    var pseudo_notif = {
                        channelorig: '/chat/general',
                        args: {},
                        log: html,
                        type: "service",
                        time: Math.min( new Date().getTime()/1000 )
                    };
                    bNotifSend = this.onPlaceLogOnChannel( pseudo_notif );
                }

            }
           
            return log_id;
        },
        

        // Add links and style to player name in notification arguments
        playerNameFilter: function( args )
        {
            if( args.player_name && args.player_id )
            {
                args.player_name = '<b><a href="/player?id='+args.player_id+'" class="playername">'+args.player_name+'</a></b>';
            }      

            return args;
        }, 


        // Add some color to player name in notification arguments
        playerNameFilterGame: function( args )
        {
            if( typeof args == 'undefined' )
            {   return; }
            
            if( this.game )
            {   
                // Sub logs
                for( argname in args )
                {
                    if( ( argname != 'i18n' ) && ( ( typeof args[argname] ) == 'object' ) )
                    {
                        if( args[argname] !== null )
                        {
                            if( ( typeof args[argname].log != 'undefined' ) && ( typeof args[argname].args != 'undefined' ) )
                            {
                                // This is a sub log !
								args[argname].args = this.playerNameFilterGame( args[argname].args );
                            }
                        }
                    } else if (argname.match(/^player_name(\d+)?$/)) {
                        // Find this player in game object
                        var color = '';
                        var color_back = '';
                        for( var player_id in this.game.gamedatas.players ) {
                            if( this.game.gamedatas.players[ player_id ].name == args[argname] ) {
                                color = this.game.gamedatas.players[ player_id ].color;
                                color_back = '';
                                if( this.game.gamedatas.players[ player_id ].color_back ) {
                                    color_back = "background-color:#" + this.game.gamedatas.players[ player_id ].color_back + ";";
                                }
                                break;
                            }
                        }
                        if( color != '' ) {
                            args[argname] = '<!--PNS--><span class="playername" style="color:#'+color+';' + color_back + '">'+args[argname]+'</span><!--PNE-->';
                        } else {
                            // Player not found (ex: spectator)
                            args[argname] = '<!--PNS--><span class="playername">'+args[argname]+'</span><!--PNE-->';
                        }
                    }
                }
                                     
            }

            return args;
        }, 
        
        // Set the following notification as "synchronous"
        // If "duration" is specified: set a simple timer for the synchro
        // If "duration" is not specified, the notification handler MUST call "setSynchronousDuration" below
        setSynchronous: function( notif_type, duration )
        {
            if( typeof duration == 'undefined' )
            {    this.synchronous_notifs[ notif_type ] = -1; }
            else
            {   this.synchronous_notifs[ notif_type ] = duration;   }
        },
        
        // Set dynamically the duration of a synchronous notification
        // duration is specified in milliseconds
        // MUST be called if your notification has not been associated with a duration in "setSynchronous"
        setSynchronousDuration: function( duration )
        {
            if( this.game && this.game.instantaneousMode )
            {   duration = 1;    }
            
            setTimeout( "endnotif()", duration );
        },
        
        isSynchronousNotifProcessed: function()
        {
            if( this.waiting_from_notifend !== null )
            {   return true;   }
            else
            {   return false;    }            
        },

        setIgnoreNotificationCheck: function(notif_type, predicate)
        {
            this.ignoreNotificationChecks[notif_type] = predicate;
        },
        
        onSynchronousNotificationEnd: function()
        {
            if( this.waiting_from_notifend === null )
            {
                console.error( "Received a notifEnd message while not waiting for a notification !!" );
                return;
            }
            console.log( "End of synchronous notification, id="+this.waiting_from_notifend.uid );

            if( this.waiting_from_notifend.lock_uuid )
            {
                 dojo.publish( "lockInterface", [{ status: 'updated', uuid: this.waiting_from_notifend.lock_uuid, bIsTableMsg: this.waiting_from_notifend.bIsTableMsg }] );
            }
            
            if( $('synchronous_notif_icon') )
            {
                dojo.style( 'synchronous_notif_icon', 'display', 'none' );
            }

            this.waiting_from_notifend = null;

            if( typeof gameui != 'undefined' && gameui && gameui.onEndOfNotificationDispatch )
            {
                gameui.onEndOfNotificationDispatch();
            }

            if( typeof this.bStopAfterOneNotif != 'undefined' && this.bStopAfterOneNotif )
            {
            }
            else
            {
                this.dispatchNotifications();
            }
        },
        
        debugReplayNotif: function( evt )
        {
            evt.preventDefault();
            // replay_notif_
            var notif_id = evt.currentTarget.id.substr( 13 );
            var notif = {};
            notif.type = $('replay_notif_'+notif_id).innerHTML;
            var json_notif = $('debugnotif_'+notif_id).innerHTML;
            notif.args = dojo.fromJson( json_notif );
            this.dispatchNotification( notif, false );
        }
    });      
});

