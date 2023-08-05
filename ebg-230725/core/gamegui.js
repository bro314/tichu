//
//  Game generic scripts
//

define("ebg/core/gamegui", [
    "dojo", "dojo/_base/declare",
    "dojo/query",
    "dijit/DialogUnderlay",
    "dijit/TooltipDialog",
    "ebg/core/sitecore",
    "ebg/gamenotif",
    "ebg/chatinput",
    "dijit/Dialog",
    "ebg/playerlocation",
    "ebg/pageheader",
    "ebg/draggable",
    "ebg/tableresults",
    "ebg/paymentbuttons"
], function( dojo, declare, query )
{

    dojo.extend(dijit.DialogUnderlay, {
	    layout: function(){
		    // summary:
		    //		Sets the background to the size of the game area
		    //
		    // description:
		    //		Sets the background to the size of the game area only
		    //		Overrides default which is to cover the whole viewport
		    // tags:
		    //		private

		    var is = this.node.style,
			    os = this.domNode.style;

		    // hide the background temporarily, so that the background itself isn't
		    // causing scrollbars to appear (might happen when user shrinks browser
		    // window and then we are called to resize)
		    os.display = "none";

		    // then resize and show
		    var viewport = dojo.position('left-side', true),
				header = dojo.position('overall-header', true);
		    os.top = (viewport.y + header.h) + "px";
		    os.left = viewport.x + "px";
		    is.width = viewport.w + "px";
		    is.height = (viewport.h - header.h) + "px";
		    os.display = "block";

	    }
    });

    dojo.extend(dijit.Dialog, {
	    _position: function(){
	    	// We don't want the popup to get the focus automatically, in order to be able to use the chat.
	    	this.autofocus = false;

		    // summary:
		    //		Position modal dialog in the viewport. If no relative offset
		    //		in the viewport has been determined (by dragging, for instance),
		    //		center the node. Otherwise, use the Dialog's stored relative offset,
		    //		and position the node to top: left: values based on the viewport.
		    // tags:
		    //		private
		    if(!dojo.hasClass(dojo.body(),"dojoMove")){
			    var node = this.domNode,
				    viewport = dojo.window.getBox(),
				    gamearea = dojo.position('left-side', true),
				    topbar = dojo.position('topbar', true),
				    p = this._relativePosition,
				    bb = p ? null : dojo.position(node),
				    l = Math.floor(gamearea.x + (p ? p.x : (gamearea.w - bb.w) / 2)),
				    t = Math.floor(viewport.t + (p ? p.y : (viewport.h - bb.h) / 2));
			    if (viewport.t <= topbar.h && !p) { 													// Unless we have scrolled beyond the topbar or are using relative position
					t = Math.floor(topbar.h + (viewport.h - (topbar.h - viewport.t) - bb.h) / 2); 		// The visible game area is the reference (popup must be below the topbar)
				}
			    dojo.style(node,{
				    left: l + "px",
				    top: t + "px"
			    });
		    }
	    }
    });


    return declare("ebg.core.gamegui", ebg.core.sitecore, {
        constructor: function(){
                console.log('ebg.core.gamegui constructor');
                this.game_name = '';
                this.game_name_displayed = '';
                this.gamedatas=null;
                this.channel=null;
                this.privatechannel = null;
                this.player_id = null;
                this.table_id = null;
                this.scoreCtrl = [];
                this.currentPlayerReflexionTime = {positive:true,mn:0,s:0};
                //this.currentPlayerReflexionTimeThisMove = {positive:true,mn:0,s:0};
                this.activePlayerReflexionTime = {positive:true,mn:0,s:0};
                //this.activePlayerReflexionTimeThisMove = {positive:true,mn:0,s:0};
                this.clock_timeout = null;
                this.clock_opponent_timeout = null;
                this.wakeup_timeout = null;
                this.wakupchek_timeout = null;
                this.forceTestUser = null;
                this.next_private_args = null;

                this.next_archive_index = 0;
                this.archive_playmode = 'stop'; // stop / nextturn / play / goto
                this.archive_gotomove = null;
                this.archive_previous_player = null;
                this.archive_uuid = 999999;
                this.archiveCommentNew = null;
                this.archiveCommentNewAnchor = '';
                this.archiveCommentNo = 0;
                this.archiveCommentNbrFromStart=0;
                this.archiveCommentLastDisplayedNo=0;
                this.archiveCommentLastDisplayedId=0;
                this.archiveCommentMobile = {id:0,anchor:'',bCenter:false,lastX:0,lastY:0};
                this.archiveCommentPosition = ['below', 'above', 'after', 'before'];
                this.bJumpToNextArchiveOnUnlock = false;
                this.archiveCommentAlreadyDisplayed = {};
                this.tuto_pointers_types_nbr = 20;
                this.tuto_textarea_maxlength = 400;

                this.last_server_state = null;
                this.on_client_state = false;

                this.tablechat = null;

                this.mediaRatingParams = '';

                this.quitDlg = null;

                this.isSpectator = true;
                this.log_mode = 'normal';
                this.nextPubbanner = null;

                // Interface locking
                this.interface_locked_by_id = null;
                this.interface_status = 'updated';
                this.interface_locking_type = null; // null / 'table' / 'player'

                this.isNotifWindow = false; // DEPRECATED (now : chatDetached)

                this.lastWouldLikeThinkBlinking = null;

                this.gamepreferences_control = {}

                this.blinkid=null;  // Id of buy link

                this.developermode = false;

                this.last_visitorlist = {};

                // Player details tooltip
                this.jstpl_player_tooltip = '<div class="active_player_iconinfos">'+
                                                '<div class="emblemwrap_xxl"><img class="emblem" src="${avatarurl}"></img></div>'+
								                '<div class="active_player_small_infos_block">'+
								                    '<p><div class="bga-flag" data-country="${flag}" id="flag_${player_id}"></div> ${country} ${city}</p>'+
								                    '<p><div class="fa fa-comment-o languages_spoken" id="ttspeak_${player_id}"></div> <span id="speak_${player_id}">${languages}</span></p>'+
								                    '<p><div class="fa ${genderclass}" id="gender_${player_id}"></div></p> '+
								                '</div>'+
                                                    '<div id="reputationbar_${player_id}" class="progressbar progressbar_reputation reputation_${karma_class}" style="display:${progressbardisplay}">'+
                                                       '<div class="progressbar_label"><span class="symbol">☯</span><span class="value">${karma}%</span></div>'+
                                                       '<div class="progressbar_bar">'+
                                                           '<span class="progressbar_valuename">${karma_label}</span>'+
                                                           '<div class="progressbar_content" style="width:${karma}%">'+
                                                               '<span class="progressbar_valuename">${karma_label}</span>'+
                                                           '</div>'+
                                                       '</div>'+
                                                    '</div>'+
								            '</div>';

                this.playerlocation = null;

				this.log_to_move_id = {};
				this.tutorialItem = {};

				this.current_player_was_active = false;
				this.current_player_is_active = false;

		        this.showOpponentCursorMouveOver = null;
		        this.showOpponentCursorClickHook = null;
                this.showOpponentCursorClickCounter = 0;
                this.showOpponentCursorClickCooldown = null;
                this.showOpponentCursorClickNumberSinceCooldown = 0;
                
		        this.ebgControls = [];
                this.bThisGameSupportFastReplay = false;

                this.images_loading_status = {};
                this.log_history_loading_status = {
                    downloaded: 0,
                    total: 0,
                    loaded:0
                };

                this.is_sandbox = false;

          /*      this.jstpl_player_ranking = '<div class="player">'+
                        '<div class="rank">${rank}</div>'+
                        '<div class="flag" id="flag_${id}" style="display:${flagdisplay};background-position: -${flagx}px -${flagy}px"></div>'+
                        '<div class="playername"><a href="${link}">${name}</a></div>'+
                        '<div class="ranking">${ranking}</div>'+
                    '</div>';*/

                this.jstpl_player_ranking = '<div class="player_in_list player_in_list_withbaseline player_in_list_fullwidth player_in_list_rank ${add_class}">\
                    <div class="rank">${rank}</div>\
                    <div class="emblemwrap ${premium}">\
                        <img class="pl_avatar emblem" src="${avatar}"/>\
                        <div class="emblempremium"></div>\
                        <i class="fa fa-${device} playerstatus status_${status}"></i>\
                    </div>\
                    <a href="/player?id=${id}" class="playername">${name}</a>\
                    <div class="player_baseline"><div class="bga-flag" data-country="${flag}" id="flag_${id}" style="display:${flagdisplay}"></div></div>\
                    <div class="ranking ${additional_ranking}">${ranking}</div>\
                </div>';



                this.jstpl_hotseat_interface = '<iframe src="${url}" frameborder="0"  class="hotseat_iframe" id="hotseat_iframe_${player_id}"></iframe>';

                this.gameinterface_zoomFactor = 1;  // May be <1 for small screens to make the whole game interface fit in the screen.

                // 3D
			    this.control3dxaxis=40;
			    this.control3dzaxis=10;
			    this.control3dxpos=-25;
			    this.control3dypos=0;
			    this.control3dscale=1.4;
			    this.control3dmode3d=false;


			    // Generic game preferences IDs
			    this.GAMEPREFERENCE_DISPLAYTOOLTIPS = 200;
        },

        // Initial setup
        completesetup: function( game_name, game_name_displayed, table_id, player_id, cometd_credential, private_channel, cometd_service, gamedatas, players_metadata, cometd_service_url, cometd_service_path ) {
            var bGameDatasLimitedSetup = ( cometd_service == 'keep_existing_gamedatas_limited' );
            this.gamedatas = gamedatas;

            if( dojo.hasClass( 'ebd-body','new_gameux' ) )
            {
                // TPL adaptations
                dojo.place( $('upperrightmenu'), 'page-title' );
                dojo.place( $('reflexiontime_value'), 'page-title' );
                dojo.place( $('ingame_menu_content'), 'page-title' );

            }

            // Build gamestate from gamestate ID
            var stateVariablesToBuild = [this.gamedatas.gamestate];
            if (this.gamedatas.gamestate.private_state) {
                stateVariablesToBuild.push(this.gamedatas.gamestate.private_state);
            }

            stateVariablesToBuild.forEach( function( stateVariable ) {
                if( typeof stateVariable.id != 'undefined' )
                {
                    if( typeof this.gamedatas.gamestates[ stateVariable.id ] == 'undefined' )
                    {
                        console.error( "Unknow gamestate: "+stateVariable.id );
                    }
    
                    if( typeof this.gamedatas.gamestates[ stateVariable.id ].args != 'undefined' )
                    {   delete this.gamedatas.gamestates[ stateVariable.id ].args;   }   // This was, it will not erase our args
                    if( typeof this.gamedatas.gamestates[ stateVariable.id ].updateGameProgression != 'undefined' )
                    {   delete this.gamedatas.gamestates[ stateVariable.id ].updateGameProgression;   }   // This was, it will not erase our updateGameProgression
    
                    for( var key in this.gamedatas.gamestates[ stateVariable.id ] )
                    {
                        stateVariable[ key ] = this.gamedatas.gamestates[ stateVariable.id ][ key ];
                    }
                }
            }.bind(this));

            if( ! bGameDatasLimitedSetup )
            {   // Note: this block is NOT executed in case of a reset following an UNDO

                this.game_name = game_name;
                this.game_name_displayed = game_name_displayed;
                this.player_id = player_id;
                this.table_id = table_id;

                this.original_game_area_html = $('game_play_area').innerHTML;

                this.setLoader(10, 10);

                for( var pid in gamedatas.players )
                {
                    if( this.player_id==pid )
                    {   this.isSpectator = false;   }
                }

                if( $('debug_output') )
                {   this.developermode=true;    }

                if( $('notifwindow_beacon') )
                {   this.isNotifWindow = true;  }

                if( dojo.query( '.expressswitch').length > 0 )
                {
                    if( ! g_archive_mode )
                    {
                        // Force a test user in all ajax requests
                        // Note : disable in archive mode cause you are not sending request in archive mode
                        this.forceTestUser = player_id;
                    }
                }


                if( this.discussblock && this.isSpectator )
                {
                    // Blocked by a player and spectator of this game => cannot see the game

                    this.showMessage( __('lang_mainsite',"A player at thie table blocked you."), 'error' );

                    setTimeout( dojo.hitch( this, function() {
                        window.location.href = this.metasiteurl+'/table?table='+this.table_id;
                    } ), 2000 );

                    return ;
                }

                // Load translation bundle
                console.log( "Loading translation bundle" );
                g_i18n.jsbundlesversion = this.jsbundlesversion;
                g_i18n.loadBundle( 'lang_mainsite' );
                g_i18n.loadBundle( 'lang_'+game_name );
                g_i18n.setActiveBundle( 'lang_'+game_name );
                this.translate_client_targets( { you:__('lang_mainsite','You')}, 'lang_'+game_name );

                this.init_core();

                this.setupCoreNotifications();


                // Translate strings that need to be translated on client side
                this.applyTranslationsOnLoad();

                // "Jump to move" function
                if( typeof g_replayFrom != 'undefined' )
                {
                    // Must jump to given move => set interface as "accelerated"
                    this.lockInterface('replayFrom');
                    this.instantaneousMode = true;
                    if( $('current_header_infos_wrap' ) )
                    {
                        dojo.style( 'current_header_infos_wrap', 'display', 'none' );
                        dojo.style( 'previously_on', 'display', 'block' );
                    }

                    if( this.gameUpgraded )
                    {
                        // Game have been upgraded since the beginning of the game
                        dojo.addClass( 'loader_skip', 'loader_skip_warning' );
                        $('loader_skip').innerHTML = '<div class="icon20 icon20_warning"></div> '+__('lang_mainsite',"This game has been updated since game start: thus the replay is EXPERIMENTAL.")+'<br/>'+$('loader_skip').innerHTML;

                        dojo.style( 'gameUpdated', 'display', 'block' );
                    }
                }

                this.onGameUiWidthChange();
            } else {
                // Translate strings that need to be translated on client side
                this.applyTranslationsOnLoad();
            }

            // Neutralized game
            if( this.gamedatas.game_result_neutralized > 0 )
            {
                this.showNeutralizedGamePanel( this.gamedatas.game_result_neutralized, this.gamedatas.neutralized_player_id );
            }

            if( ! this.isNotifWindow )
            {
                // Game specific initialization
                this.setup( gamedatas, bGameDatasLimitedSetup );
                console.log( "successfully initialize game specific datas" );
            }

            // Init score controls
            for( pid in gamedatas.players )
            {
                var player = gamedatas.players[pid];

                // Add score control
                if( typeof this.scoreCtrl[ pid ] == 'undefined' )
                {
                    $('player_score_'+pid).innerHTML = player.score;
                    this.scoreCtrl[ pid ] = new ebg.counter();
                    this.scoreCtrl[ pid ].create( $( 'player_score_'+pid ) );
                }

                if( typeof player.score != 'undefined' )
                {
                    if( !this.is_sandbox )
                    {
                        this.scoreCtrl[ pid ].setValue( player.score );
                        if( player.score === null )
                        {       this.scoreCtrl[ pid ].disable();    }
                    }
                }
                else
                {   this.scoreCtrl[ pid ].disable();    }

                if( ! bGameDatasLimitedSetup )
                {
                    // init player.ack value to true (we suppose that active player has ack its turn at page load time)
                    this.gamedatas.players[ pid ].ack = 'ack';
                }
            }

            // Add player details from the metasite (game independent)
            if( ! bGameDatasLimitedSetup )
            {
                this.players_metadata = players_metadata;
                console.log('Metadata:', players_metadata);
                for( pid in players_metadata )
                {
                	var player = players_metadata[pid];
                	var tooltip = this.getPlayerTooltip(player);

                    this.addTooltipHtml( 'player_name_'+pid, tooltip );
                    this.addTooltipHtml( 'avatar_'+pid, tooltip );

                    if( players_metadata[pid].is_premium==1 )
                    {
                        dojo.addClass( 'avatarwrap_'+pid, 'is_premium' );
                    }

                    if (player.gender !== null && player.gender == 0 && typeof gamedatas.players[pid] != 'undefined') {
						this.gameFemininePlayers.push(gamedatas.players[pid]['name']);
					} else if (player.gender !== null && player.gender == 1 && typeof gamedatas.players[pid] != 'undefined') {
						this.gameMasculinePlayers.push(gamedatas.players[pid]['name']);
					} else {
						this.gameNeutralPlayers.push(gamedatas.players[pid]['name']);
					}
                }
                //console.log('Feminine players:', this.gameFemininePlayers);
                //console.log('Masculine players:', this.gameMasculinePlayers);
                //console.log('Neutral players:', this.gameNeutralPlayers);

                //// RTC chat setup
                if (typeof this.gamedatas.players[ player_id ] != 'undefined' && this.gamedatas.players[ player_id ].zombie != 1 && this.rtc_mode > 0 && this.rtc_room !== null) {
						if (this.rtc_room.indexOf('T') >= 0) {
							// There is an active table video/audio session
							this.setNewRTCMode( this.table_id, null, this.rtc_mode );
						} else if (this.rtc_room.indexOf('P') >= 0) {
							// There is an active privatechat video/audio session (for example after refresh)
							var rtc_players = this.rtc_room.substr(1).split('_');
							var other_player_id = rtc_players[0] == player_id ? rtc_players[1] : rtc_players[0];

							// We must open the chat window and expand it
							this.createChatBarWindow( {
										type: 'privatechat',
										id: other_player_id,
										label: '',
										game_name: '',
										url: '',
										channel: '/player/p'+other_player_id,
										window_id: 'privatechat_'+other_player_id,
										subscribe: false,
										start: 'expanded'
									}, false );

							// Focus on chat & expand
							this.expandChatWindow( 'privatechat_'+other_player_id );

							// Then start the session
							this.setNewRTCMode( null, other_player_id, this.rtc_mode );
						}
				}

                this.notifqueue.game = this;

                // Reduced / normal header depending on there are annoucements or not
                //if( dojo.query( '.publisherannounce' ).length > 0 )
                //{   dojo.removeClass( 'topbar', 'reducedheader' );    }
            }


            // Generic game state setup: active player & game state
            this.last_server_state = dojo.clone( this.gamedatas.gamestate );
            if( this.updateActivePlayerAnimation() )
            {   // If current player is active, we have to ACK the game state change
                console.log( "ack your turn event" );
                this.sendWakeUpSignal();
            }
            this.updatePageTitle();

            this.gamedatas.decision = this.decision;
            this.updateDecisionPanel( this.gamedatas.decision );

            if( gamedatas.gamestate.name == 'gameEnd' )
            {
                this.onGameEnd();
            }
            else if( gamedatas.gamestate.name == 'tutorialStart' && this.isCurrentPlayerActive() )
            {
                this.showTutorialActivationDlg();
            }

            dojo.addClass( 'overall-content', 'gamestate_'+gamedatas.gamestate.name );
            this.onEnteringState( gamedatas.gamestate.name, gamedatas.gamestate );
            if (gamedatas.gamestate.private_state != null) {
                this.updatePageTitle( gamedatas.gamestate.private_state );
                this.onEnteringState( gamedatas.gamestate.private_state.name, gamedatas.gamestate.private_state );
            }

            if( gamedatas.gamestate.name == 'gameSetup' && !g_archive_mode )
            {
                this.paymentbuttons = new ebg.paymentbuttons();
                this.paymentbuttons.create( this );

                this.lockScreenCounter();
            }

            $('pr_gameprogression').innerHTML = gamedatas.gamestate.updateGameProgression;

            if( ! bGameDatasLimitedSetup )
            {
                this.addTooltip( 'game_progression_bar', __('lang_mainsite', 'Current game progression'), '' );


                // Init global game action buttons
                this.addTooltip( 'toggleSound', '', __('lang_mainsite', 'Switch the sound on/off') );
                this.addTooltip( 'globalaction_pause', '', __('lang_mainsite', 'Signals you want to pause the game') );
                this.addTooltip( 'globalaction_fullscreen', '', __('lang_mainsite', 'Fullscreen mode') );
                this.addTooltip( 'globalaction_help', '', __('lang_mainsite', 'Help about this game') );
                this.addTooltip( 'globalaction_preferences', '', __('lang_mainsite', 'Change your preferences for this game') );
                this.addTooltip( 'globalaction_quit', '', __('lang_mainsite', 'Quit current game') );

                dojo.connect( $('globalaction_fullscreen'), 'onclick', this, 'onGlobalActionFullscreen' );
                dojo.connect( $('globalaction_zoom_wrap'), 'onclick', this, 'onZoomToggle' );

                dojo.connect( $('ingame_menu_quit'), 'onclick', this, 'onGlobalActionQuit' );
                dojo.connect( $('ingame_menu_back'), 'onclick', this, 'onGlobalActionBack' );
                //dojo.query( '.expelPlayer' ).connect( 'onclick', this, 'onWouldFirePlayer' );
                dojo.connect( $('skip_player_turn'), 'onclick', this, 'onWouldFirePlayer' );
                if( g_archive_mode )
                {
                    this.setLoader(100, 100); // Note: no loading screen for archive mode: it may prevent us to access the archive!
                    dojo.style( 'connect_status', 'display', 'none' );
                    dojo.style( 'connect_gs_status', 'display', 'none' );
                    dojo.style( 'chatbar', 'display', 'none' );

                    if( $('gotonexttable_wrap' ) )
                    {
                        dojo.destroy( 'gotonexttable_wrap' );
                    }

                    if( dojo.hasClass( 'archivecontrol', 'demomode') )
                    {
                        dojo.style( 'archivecontrol', 'display', 'none' );
                        if( $('demomode_registration_ok') )
                        {
                            dojo.connect( $('demomode_registration_email'), 'onfocus', this, function() {
                                $('demomode_registration_email').value='';
                            } );

                            dojo.connect( $('demomode_registration_ok'), 'onclick', this, function(evt) {
                                dojo.stopEvent( evt );

                                this.ajaxcall( "/archive/archive/fastRegistration.html", {
                                    email:  $('demomode_registration_email').value
                                }, this, function( result ){} );


                            } );
                        }
                    }

                    if( g_tutorialwritten.mode == 'edit' )
                    {
                        var tutorial_label = __('lang_mainsite',"Publish as tutorial");
                        var tutorial_button_class = 'bgabutton_blue';

                        if( g_tutorialwritten.top_game )
                        {
                            dojo.place( '<div class="whiteblock"><p><i class="fa fa-warning"></i> '+__('lang_mainsite','This game is one of the most played: admins may be particularly demanding and picky about tutorials written for this game.')+'</div>', 'logs_wrap','before' );
                        }
                        if( g_tutorialwritten.old_game )
                        {
                            dojo.place( '<div class="whiteblock"><p><i class="fa fa-warning"></i> '+__('lang_mainsite','This replay is quite old and you may not benefit from the most recent tutorial creation tool features: we suggest you to choose a more recent one.')+'</div>', 'logs_wrap','before' );
                        }

                        if( this.game_status=='private')
                        {
                            // This game is in Alpha => cannot publish tutorial
                            dojo.place( '<div class="whiteblock"><p><i class="fa fa-info-circle"></i> '+__('lang_mainsite',"You cannot publish a tutorial for a game in Alpha")+'<p>', 'logs_wrap','before' );
                        }
                        else if( this.game_name == 'terramystica' )
                        {
                            // For this specific game => no tutorial
                            dojo.place( '<div class="whiteblock"><p><i class="fa fa-info-circle"></i> '+__('lang_mainsite',"Sorry, but for legal reasons we cannot propose tutorial for this game on BGA.")+'<p>', 'logs_wrap','before' );
                        }
                        else if( g_tutorialwritten.status !== null )
                        {
                            // We are editing an existing tutorial

                            tutorial_label = __('lang_mainsite',"Update tutorial");

                            var tuto_url = window.location.href + '&tutorial';
                            tuto_url = tuto_url.replace( '#&tutorial', '&tutorial' ); // In case there is a hash, we must remove it

                            if( g_tutorialwritten.status == 'public' )
                            {
                                dojo.place( '<div class="whiteblock"><p>'+__('lang_mainsite','Your tutorial is now available to everyone on BGA.')+'<p><a href="'+tuto_url+'" target="_blank">'+__('lang_mainsite',"Preview tutorial")+'</a></p></div>', 'logs_wrap','before' );
                                dojo.place( '<div class="whiteblock"><p><i class="fa fa-warning"></i> '+__('lang_mainsite','Any update you make is immediately applied to the published tutorial.')+'</div>', 'logs_wrap','before' );
                            }
                            else if( g_tutorialwritten.status == 'rejected' )
                            {
                                dojo.place( '<div class="whiteblock"><p>'+__('lang_mainsite','Your tutorial has unfortunately be rejected :(')+'<p><a href="'+tuto_url+'" target="_blank">'+__('lang_mainsite',"Preview tutorial")+'</a></p></div>', 'logs_wrap','before' );
                            }
                            else if( g_tutorialwritten.status == 'beta' )
                            {
                                dojo.place( '<div class="whiteblock"><p>'+__('lang_mainsite','BETA: Your tutorial is now being tested with some random players on BGA.')+'<p><a href="'+tuto_url+'" target="_blank">'+__('lang_mainsite',"Preview tutorial")+'</a></p></div>', 'logs_wrap','before' );
                                dojo.place( '<div class="whiteblock"><p><i class="fa fa-warning"></i> '+__('lang_mainsite','Any update you make is immediately applied to the published tutorial.')+'</div>', 'logs_wrap','before' );
                            }
                            else if( g_tutorialwritten.status == 'alpha' )
                            {
                                dojo.place( '<div class="whiteblock"><p>'+__('lang_mainsite','ALPHA: Your tutorial is being reviewed by some expert players.')+'<p><p style="word-wrap: break-word;"><a href="'+tuto_url+'" target="_blank">'+tuto_url+'</a></p></div>', 'logs_wrap','before' );
                                dojo.place( '<div class="whiteblock"><p><i class="fa fa-warning"></i> '+__('lang_mainsite','Any update you make is immediately applied to the published tutorial.')+'</div>', 'logs_wrap','before' );
                            }

                        }
                        else
                        {
                            // This is a new tutorial that can be published
                            dojo.place( '<p style="text-align:center;display:none;" id="publishtutorial_block" style="display:none;"><a id="publishtutorial" class="bgabutton '+tutorial_button_class+'">'+tutorial_label+'</a><p>', 'logs_wrap','before' );
                        }

                        dojo.place( '<p style="text-align:center;display:block;"><a id="howto_tutorial" class="bgabutton bgabutton_gray"><i class="fa fa-exclamation-circle" aria-hidden="true"></i> '+__('lang_mainsite',"How to build a tutorial?")+'</a><p>', 'logs_wrap','before' );

                        var tuto_pointers_choice_html = '<div id="tuto_pointers_choice">';
                        for( var i=1; i<=this.tuto_pointers_types_nbr; i++ )
                        {
                            var backx = ( ( (i-1)%10 )*42 );
                            var backy = ( ( Math.floor((i-1)/10) )*42 );
                            tuto_pointers_choice_html += '<div id="tuto_pointer_'+i+'" class="tuto_pointer tuto_pointer_'+i+'" style="background-position: -'+backx+'px -'+backy+'px"></div>';
                        }
                        tuto_pointers_choice_html += '</div>';
                        dojo.place( tuto_pointers_choice_html, 'logs_wrap','before' );
                        dojo.query( '.tuto_pointer').connect( 'onclick', this, 'onTutoPointerClick' );
                        dojo.addClass( 'tuto_pointer_1', 'selected');


                        dojo.connect( $('howto_tutorial'), 'onclick', this, 'onHowToTutorial' );
                        if( $('publishtutorial') )
                        {
                            dojo.connect( $('publishtutorial'), 'onclick', this, 'onPublishTutorial' );
                        }

                        if( $('publishtutorial_block'))
                        {
                            dojo.style( 'publishtutorial_block', 'display', ( dojo.query( '.archiveComment' ).length > 0 ) ? 'block' : 'none' );
                        }

                        dojo.style('archivecontrol_editmode', 'display', 'block' );
                        dojo.style('archivecontrol_viewmode', 'display', 'none' );
                    }
                    else
                    {
                        if( g_tutorialwritten.author == g_tutorialwritten.viewer_id )
                        {
                            if( $('bga_release_id') )
                            {   var bga_release_id = $('bga_release_id').innerHTML;     }
                            else
                            {
                                // Note: legacy
                                var parts = g_themeurl.split('/');
                                parts.pop();
                                var bga_release_id =  parts.pop();
                            }
                            var url = "/archive/replay/"+bga_release_id+"/?table="+this.table_id+"&player="+this.player_id+"&comments="+g_tutorialwritten.author+";";
                            dojo.place( '<p style="text-align:center;display:block;"><a href="'+url+'" class="bgabutton bgabutton_gray"><i class="fa fa-pencil" aria-hidden="true"></i> '+__('lang_mainsite',"Edit tutorial")+'</a><p>', 'logs_wrap','before' )
                        }

                        dojo.addClass( 'ebd-body', 'game_tutorial_mode');

                        dojo.style('archivecontrol_editmode', 'display', 'none' );
                        dojo.style('archivecontrol_viewmode', 'display', 'block' );

                        dojo.style( 'ingame_menu', 'display', 'none'); // Hiding main menu because it is not translated
                        dojo.style( 'maingameview_menufooter', 'display', 'none');
                        dojo.style( 'overall-footer', 'display', 'none');
                        dojo.style( 'tableinfos', 'display', 'none');
                        dojo.query( '.player_board_inner .emblempremium').style( 'display','none');
                        dojo.query( '.player_board_inner .timeToThink').style( 'display','none');
                        dojo.query( '.player_board_inner .player_status').style( 'display','none');
                        dojo.query( '.player_board_inner .bga-flag').style( 'display','none');
                        dojo.query( '.player_board_inner .player_elo_wrap').style( 'display','none');
                        dojo.query( '.player_board_inner .doubletime_infos').style( 'display','none');

                        if( $('quitTutorialTop' ) )
                        {
                            dojo.connect( $('quitTutorialTop'), 'onclick', this, 'onQuitTutorial' );
                            dojo.connect( $('logoicon'), 'onclick', this, 'onQuitTutorial' );
                        }

                        // By default, 1 second between packets on tutorial
                        this.notifqueue.setSynchronous( 'archivewaitingdelay', 1000 );

                        dojo.place( '<p style="text-align:center;display:block;"><a id="restart_tutorial" class="bgabutton bgabutton_gray" href="javascript:window.location.href=window.location.href"><i class="fa fa-undo" aria-hidden="true"></i> '+__('lang_mainsite',"Restart tutorial?")+'</a><p>', 'logs_wrap','before' );


                        dojo.connect( $('ebd-body'), 'onkeyup', this, 'onKeyUpTutorial');
                        dojo.connect( $('ebd-body'), 'onkeypress', this, 'onKeyPressTutorial');
                    }


                    dojo.connect( $('archive_next'), 'onclick', this, 'onArchiveNext' );
                    dojo.connect( $('archive_next_turn'), 'onclick', this, 'onArchiveNextTurn' );
                    dojo.connect( $('archive_end_game'), 'onclick', this, 'onArchiveGoTo' );
                    dojo.connect( $('archive_go_to_nextComment'), 'onclick', this, 'onNewArchiveCommentNext' );

                    dojo.connect( $('archive_history'), 'onclick', this, 'onArchiveHistory' );
                    dojo.connect( $('archive_nextlog'), 'onclick', this, 'onArchiveNextLog' );


                    dojo.connect( $('archive_addcomment'), 'onclick', this, 'onArchiveAddComment' );
                    this.addTooltip( 'archive_addcomment', '', __('lang_mainsite','Add some public comment') );



                    this.addTooltip( 'archive_history', '', __('lang_mainsite','Show game history') );
                    this.addTooltip( 'archive_nextlog', '', __('lang_mainsite','Next visible change') );
                    this.addTooltip( 'archive_restart', '', __('lang_mainsite','Go back to first move') );

                    this.addTooltip( 'archive_next', '', __('lang_mainsite','Next move') );
                    this.addTooltip( 'archive_next_turn', '', __('lang_mainsite','Next turn') );
                    this.addTooltip( 'archive_end_game', '', __('lang_mainsite','Go to game end') );

                    dojo.place( '<div id="archiveCommentMinimized"><div id="archiveCommentMinimizedIcon"><i class="fa fa-graduation-cap fa-2x"></i></div></div>', 'maintitlebar_content' );
                    dojo.connect( $('archiveCommentMinimizedIcon'), 'onclick', this, 'onArchiveCommentMaximize' );

                    // 2019 update on replay buttons layout
                    dojo.style( 'archive_history', 'display', 'none' );
                    dojo.style( 'archive_next_turn', 'display', 'none' );
                    dojo.style( 'archive_nextlog', 'display', 'none' );
                    dojo.style( 'archive_go_to_move_wrap', 'display', 'none' );
                    dojo.style( 'archive_go_to_move', 'display', 'none' )

                    dojo.connect( $('advanced_replay_features'), 'onclick', this, function( evt ) {
                        dojo.stopEvent( evt );

                        dojo.style( 'archive_history', 'display', 'inline' );
                        dojo.style( 'archive_nextlog', 'display', 'inline' );
                        dojo.style( 'advanced_replay_features', 'display', 'none' );
                        dojo.style( 'archive_go_to_move_wrap', 'display', 'block' );
                        this.bEnabledArchiveAdvancedFeatures = true;

                        // If it is displayed, destroy the go to menu as it has changed
                        if( typeof this.archiveGotoMenu != 'undefined' )
                        {
                            dijit.popup.close( this.archiveGotoMenu );
                            this.archiveGotoMenu.destroy();
                            delete this.archiveGotoMenu;
                        }

                    } );

                }


                dojo.connect( $('not_playing_help'), 'onclick', this, 'onNotPlayingHelp' );
                dojo.connect( $('ai_not_playing'), 'onclick', this, 'onAiNotPlaying' );
                dojo.connect( $('wouldlikethink_button'), 'onclick', this, 'onWouldLikeToThink' );

                // Player table decisions
                dojo.connect( $('decision_yes'), 'onclick', this, 'onPlayerDecide' );
                dojo.connect( $('decision_no'), 'onclick', this, 'onPlayerDecide' );


                // Zombieback
                dojo.connect( $('zombieBack_button'), 'onclick', this, 'onZombieBack' );
            }

            if( !this.isSpectator && !g_archive_mode && gamedatas.players[ this.player_id ].zombie == 1 )
            {
            	this.displayZombieBack();
            }

           if( !bGameDatasLimitedSetup )
            {
                // Interface locking events
                dojo.subscribe( "lockInterface", this, 'onLockInterface' );

                // Init cometd subscription
                this.channel = '/table/t'+this.table_id;
                this.tablechannelSpectators = '/table/ts' + this.table_id;
                this.privatechannel = '/player/p'+private_channel; // Note: deprecated, keep for compatibility

                this.notifqueue.checkSequence = true;
                if( gamedatas.notifications.table_next_notification_no )
                {   this.notifqueue.last_packet_id = gamedatas.notifications.table_next_notification_no;    } // for compatibility (archives)
                else
                {   this.notifqueue.last_packet_id = gamedatas.notifications.last_packet_id; }
                dojo.connect( this.notifqueue, 'addToLog', this, 'onNewLog' );
                dojo.subscribe( 'addMoveToLog', this, 'addMoveToLog' );
            }

            if( $('move_nbr') )
            {   $('move_nbr').innerHTML = gamedatas.notifications.move_nbr; }

            if( $('menu_option_value_206' ) )
            {
                $('menu_option_value_206' ).innerHTML = this.playingHoursToLocal( $('menu_option_value_206' ).innerHTML );

                var th = $('menu_option_value_206' ).innerHTML;

                if( th.indexOf(':') == -1 )
                {
                    // No playing hours
                    this.playingHours = { 0:true,1:true,2:true,3:true,4:true,5:true,6:true,7:true,8:true,9:true,
                                         10:true,11:true,12:true,13:true,14:true,15:true,16:true,17:true,18:true,19:true,
                                         20:true,21:true,22:true,23:true};

                }
                else
                {
                    var day_start = toint( th.substr(0, th.indexOf(':')) );

                    this.playingHours = { 0:false,1:false,2:false,3:false,4:false,5:false,6:false,7:false,8:false,9:false,
                                         10:false,11:false,12:false,13:false,14:false,15:false,16:false,17:false,18:false,19:false,
                                         20:false,21:false,22:false,23:false};

                    for( var d=0; d<12; d++ )
                    {
                        this.playingHours[ ( day_start+d )%24 ] = true;
                    }
                }
            }
            if( $('footer_option_value_206' ) )
            {   $('footer_option_value_206' ).innerHTML = this.playingHoursToLocal( $('footer_option_value_206' ).innerHTML );          }

            if( !bGameDatasLimitedSetup )
            {
                if( ! g_archive_mode )
                {
                    this.cometd_service = cometd_service;

                    var auth = {user: this.player_id,name:this.current_player_name,credentials: cometd_credential};

                    this.socket = io( cometd_service_url, {query: dojo.objectToQuery( auth ), path: '/'+cometd_service_path }  );

                    this.socket.on('bgamsg', dojo.hitch( this.notifqueue, 'onNotification' ));

                    // These events are emitted directly by the Socket instance
                    this.socket.on( 'connect', dojo.hitch( this, function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'connect' );
                    } ) );
                    this.socket.on( 'connect_error', dojo.hitch( this, function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'connect_error', msg );
                    } ) );
                    this.socket.on( 'connect_timeout', dojo.hitch( this,  function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'connect_timeout' );
                    } ) );
                    // These events have to be listened to on the Manager (".io") instance (since Socket.IO v3)
                    this.socket.io.on( 'reconnect', dojo.hitch( this, function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'reconnect', msg );
                    } ) );
                    this.socket.io.on( 'reconnect_attempt', dojo.hitch( this, function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'reconnect_attempt' );
                    } ) );
                    this.socket.io.on( 'reconnect_error', dojo.hitch( this,  function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'reconnect_error', msg );
                    } ) );
                    this.socket.io.on( 'reconnect_failed', dojo.hitch( this, function( msg ) {
                        this.onSocketIoConnectionStatusChanged( 'reconnect_failed' );
                    } ) );

                    // Global emergency channel
                    this.subscribeCometdChannel( '/general/emergency', this.notifqueue, "onNotification" );

                    // This game channel
                    this.subscribeCometdChannel( this.channel, this.notifqueue, "onNotification" );
                    this.subscribeCometdChannel( this.tablechannelSpectators, this.notifqueue, "onNotification" );

                    // Player's channel for the whole site
                    this.subscribeCometdChannel( '/player/p'+this.player_id, this.notifqueue, "onNotification" );

                    this.notifqueue.cometd_service = this.cometd_service;


                    // GS socketio service (for the moves)
                    if( this.gs_socketio_url != '' )
                    {
                        var auth = {user: this.player_id,name:this.current_player_name,credentials: cometd_credential};

                        this.gs_socket = io( this.gs_socketio_url, {query: dojo.objectToQuery( auth ), path: '/'+this.gs_socketio_path }  );

                        this.gs_socket.on('bgamsg', dojo.hitch( this.notifqueue, 'onNotification' ));

                        // These events are emitted directly by the Socket instance
                        this.gs_socket.on( 'connect', dojo.hitch( this, function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'connect' );
                        } ) );
                        this.gs_socket.on( 'connect_error', dojo.hitch( this, function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'connect_error', msg );
                        } ) );
                        this.gs_socket.on( 'connect_timeout', dojo.hitch( this,  function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'connect_timeout' );
                        } ) );
                        // These events have to be listened to on the Manager (".io") instance (since Socket.IO v3)
                        this.gs_socket.io.on( 'reconnect', dojo.hitch( this, function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'reconnect', msg );
                        } ) );
                        this.gs_socket.io.on( 'reconnect_attempt', dojo.hitch( this, function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'reconnect_attempt' );
                        } ) );
                        this.gs_socket.io.on( 'reconnect_error', dojo.hitch( this,  function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'reconnect_error', msg );
                        } ) );
                        this.gs_socket.io.on( 'reconnect_failed', dojo.hitch( this, function( msg ) {
                            this.onGsSocketIoConnectionStatusChanged( 'reconnect_failed' );
                        } ) );

                        // Setup subscriptions to this game channels
                        this.gs_socket.emit('join', this.channel );
                        this.gs_socket.emit('join', this.tablechannelSpectators );
                        this.gs_socket.emit('join', '/player/p'+this.player_id );
                    }
                    else
                    {
                        dojo.style('connect_gs_status', 'display', 'none');
                        this.gs_socket = this.socket;
                    }
                }
                else
                {
                    // Archive mode
                   // this.lockInterface();

                    // Tutorial mode We replace local ajaxcall by archiveajaxcall
                    // DEPRECATED : now we overwrite the method
                    //this.ajaxcall = dojo.hitch( this, 'archiveAjaxCall' );

                    this.initArchiveIndex();
                    this.notifqueue.checkSequence = false;
                    this.initCommentsForMove( $('move_nbr').innerHTML );
                    this.checkIfArchiveCommentMustBeDisplayed();
                }
            }

            if( !bGameDatasLimitedSetup )
            {
                if( this.dockedChat )
                {
                    // Make sure table chat window is visible
                    // Disabled: should better display it when clicking on a button...
                    var args = {
                            type: 'table',
                            game_name: this.game_name,
                            id: this.table_id,
                            label: __('lang_mainsite','Discuss at this table'),
                            url: null,
                            channel: '/table/t'+this.table_id,
                            window_id: 'table_'+this.table_id,
                            start: 'collapsed',
                            notifymethod: 'title',
                            autoShowOnKeyPress: true
                        };

                    this.createChatBarWindow( args, false );

                    dojo.connect( this.chatbarWindows['table_'+this.table_id].input, 'callbackBeforeChat', this, 'onBeforeChatInput' );
                    dojo.connect( $('chatbarinput_table_'+this.table_id+'_input'), 'onblur', this, 'onChatInputBlur' );
                    dojo.connect( document, 'onkeydown', this, 'onChatKeyDown' );
                    dojo.connect( $('chatbarinput_table_'+this.table_id+'_input'), 'onkeydown', this, 'onChatKeyDown' );

                    this.loadPreviousMessage( 'table', this.table_id );
                }
                else
                {
                    // Init chatroom
                    this.tablechat = new ebg.chatinput();
                    this.tablechat.detachType = 'playtable';
                    this.tablechat.detachTypeGame=this.game_name;
                    this.tablechat.detachId=this.table_id;

                    this.tablechat.create( this, 'chatinput', '/table/table/say.html', __('lang_mainsite','Discuss at this table') );

                    this.tablechat.baseparams = { table: this.table_id };
                    this.tablechat.callbackBeforeChat = dojo.hitch( this, 'onBeforeChatInput' );
                }


                // Set initial players ordering
                this.updatePlayerOrdering();

                // Show initial log message
                var did_you_know = [
                    __('lang_mainsite','If the game seems blocked or buggy, please <b>refresh</b> the webpage or <b>press F5</b>.'),
                    __('lang_mainsite','Insults and aggressive behaviours are stricly forbidden in this chatroom. Please report us any incident: we take an immediate action againt all problematic players.'),
                    __('lang_mainsite','You can mute sound by clicking on:')+' <div class="icon20 icon20_mute"></div>',
                    __('lang_mainsite','To play in fullscreen, click on:')+' <div class="icon20 icon20_fullscreen"></div>',
                    __('lang_mainsite','You have a wide screen ? You can choose in preferences to display players information and game logs in 2 columns:')+' <div class="icon20 icon20_config"></div>',
                    __('lang_mainsite','You find a bug ? Please report it in BGA bug reporting system, a description and if possible a screenshot. Thank you.'),
                    __('lang_mainsite','If some player is not playing, just wait until he run out reflexion time, then kick him out the game.')
                ];

                var dyk_number = did_you_know.length;
                var dyk_to_display = Math.floor( (Math.random()*dyk_number) )%dyk_number;

                if( ! g_archive_mode )
                {
                    this.notifqueue.addToLog( '<b>'+__('lang_mainsite','Did you know ?')+'</b><br/>'+did_you_know[ dyk_to_display ] );
                }


                // Game generic preferences
                for( var pref_id in { "logsSecondColumn": {}/*, "showOpponentCursor":{}*/ } )
                {
                    dojo.connect( $('preference_global_control_'+pref_id ), 'onchange', this, 'onChangePreference' );
                    dojo.connect( $('preference_global_fontrol_'+pref_id ), 'onchange', this, 'onChangePreference' );
                }
                if( (!g_archive_mode) && $( 'preference_global_control_logsSecondColumn' ).value == '1' )
                {   this.switchLogModeTo( 1 );  }

                dojo.query( '.reftime_format' ).forEach( dojo.hitch( this, function( node ) {
                    node.innerHTML = this.formatReflexionTime( node.innerHTML ).string;
                } ) );

                // Game specific preferences
                for( var pref_id in this.prefs )
                {
                    var pref = this.prefs[ pref_id ];
                    if( pref['values'][ pref['value'] ]['cssPref'] )
                    {
                        // This is a CSS preference => make it visible
                        dojo.addClass( dojo.doc.documentElement, pref['values'][ pref['value'] ]['cssPref'] );
                    }
                }

                dojo.query('.game_preference_control').connect( 'onchange', this, function( evt ) {

                    // preference_control_<id>
                    var pref_id = evt.currentTarget.id.substr( 19 );
                    var value = evt.currentTarget.value;

                    this.ajaxcall( "/table/table/changePreference.html", {
                        id: pref_id, value: value, game: this.game_name
                    }, this, function( result ){
                        if( result.status == 'reload' )
                        {
                            this.showMessage("Done, reload in progress...",'info');
                            location.hash = '';
                            window.location.reload();
                        } else {
							// Manage generic game preferences value change
							if (result.pref_id == this.GAMEPREFERENCE_DISPLAYTOOLTIPS) {
								this.switchDisplayTooltips( result.value );
							}
						}
                    } );
                } );

                // Manage generic game preferences initial value
                if( $( 'preference_control_' + this.GAMEPREFERENCE_DISPLAYTOOLTIPS ).value == '1' )
                {   this.switchDisplayTooltips( 1 );  }


                dojo.query('.preference_control').style( 'display', 'block' );

                // Ingame menu
                dojo.connect( $('ingame_menu_concede'), 'onclick',
                            dojo.hitch( this, function( evt ) {
                                    evt.preventDefault();

                                    this.confirmationDialog( __('lang_mainsite',"You are about to concede this game. Are you sure?"), dojo.hitch( this, function() {

                                        this.ajaxcall( "/table/table/concede.html?src=menu",
                                         { table: this.table_id }, this, function( obj, result )   {});

                                    } ) );
                                   } ) );

                dojo.connect( $('ingame_menu_abandon'), 'onclick',
                            dojo.hitch( this, function( evt ) {
                                    evt.preventDefault();

                                    this.ajaxcall( "/table/table/decide.html?src=menu",
                                     { type:'abandon', decision:1,'table':this.table_id }, this, function( obj, result )   {});
                                   } ) );

                if( this.bRealtime )
                {
                    dojo.connect( $('ingame_menu_switch_tb'), 'onclick',
                                dojo.hitch( this, function( evt ) {
                                        evt.preventDefault();

                                        this.ajaxcall( "/table/table/decide.html?src=menu",
                                         { type:'switch_tb', decision:1,'table':this.table_id }, this, function( obj, result )   {});
                                       } ) );
                }
                else
                {
                    dojo.style( 'ingame_menu_switch_tb', 'display', 'none' );
                }


                if( dojo.query( '.expressswitch').length > 0 )
                {
                    dojo.style( 'ingame_menu_expresstop', 'display', 'block' );
                    dojo.connect( $('ingame_menu_expresstop'), 'onclick',
                                                dojo.hitch( this, function( evt ) {
                                                        evt.preventDefault();

                                                        this.ajaxcall( "/table/table/expressGameStopTable.html",
                                                         { table: this.table_id }, this, dojo.hitch( this, function( obj, result )   {
                                                            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                                                                this.prepareMediaRatingParams();
										                        this.doLeaveRoom( dojo.hitch(this, function() { this.redirectToTablePage(); } ) );
                                                            } else {
                                                                this.redirectToTablePage();
                                                            }
                                                         } ) );
                                                       } ) );
                }

                if( !this.bRealtime && ! this.isSpectator )
                {
                    dojo.style( 'ingame_menu_notes_wrap', 'display', 'block' );
                    dojo.connect( $('ingame_menu_notes'), 'onclick', this, 'toggleTurnBasedNotes' );
                }

                dojo.connect( $('ingame_menu'), 'onclick', this, 'toggleIngameMenu' );
            //    dojo.connect( $('ingame_menu'), 'onmouseenter', this, 'showIngameMenu' );
              //  dojo.connect( $('upperrightmenu'), 'onmouseleave', this, 'hideIngameMenu' );
              //  dojo.connect( $('ingame_menu_content'), 'onmouseenter', this, 'showIngameMenu' );
              //  dojo.connect( $('ingame_menu_content'), 'onmouseleave', this, 'hideIngameMenu' );
                dojo.connect( $('ingame_menu_content'), 'onclick', this, 'hideIngameMenu' );
                dojo.connect( document, 'onclick', this, 'hideIngameMenu' );
                dojo.query('.preference_control' ).connect( 'onclick', this, function( evt ) {  dojo.stopEvent(evt);    } );

                this.updatePubBanner();

                if( this.isSpectator )
                {
                    dojo.addClass( "overall-content", "spectatorMode" );
                }

                // Show cursor
                dojo.query( '.chatbarbelowinput_item_showcursor' ).connect( 'onclick', this, 'onShowMyCursor' );
                dojo.query( '.player_hidecursor' ).connect( 'onclick', this, 'onHideCursor' );
				this.addTooltipToClass( 'chatbarbelowinput_item_showcursor', "", __('lang_mainsite','Show your mouse cursor to opponents') );

                // Debugging
                dojo.query( '.debug_save' ).connect( 'onclick', this, 'onSaveState' );
                dojo.query( '.debug_load' ).connect( 'onclick', this, 'onLoadState' );
                if( ! g_archive_mode )
                {
                    this.notifqueue.resynchronizeNotifications( true );
                    dojo.connect( this, 'reconnectAllSubscriptions', this, 'onReconnect' );
                }
                this.ensureImageLoading();

                // Back to top button
                dojo.connect( $('overall_footer_topbutton'), 'onclick', function() {
                    window.scroll( 0, 0 );
                } );

                // Turn based notes
                if( this.turnBasedNotes != '' )
                {
                    this.openTurnBasedNotes( this.turnBasedNotes );
                    //this.closeTurnBasedNotes();
                }

                // Get initial spectator list
                if( ! g_archive_mode )
                {
                    // Get spectator list from cometd server
                    this.socket.emit( 'requestSpectators', this.table_id );
                }

                // Premium emblem
                this.updatePremiumEmblemLinks();


                // Alternative abandon / concede buttons
                dojo.connect( $('abandon_alternate_button'), 'onclick',
                        dojo.hitch( this, function( evt ) {
                                evt.preventDefault();
                                this.ajaxcall( "/table/table/decide.html",
                                 { type:'abandon', decision:1,'table':this.table_id }, this, function( obj, result )   {});
                               } ) );


                dojo.connect( $('concede_alternate_button'), 'onclick',
                    dojo.hitch( this, function( evt ) {
                            evt.preventDefault();

                            this.confirmationDialog( __('lang_mainsite','Are you sure?'), dojo.hitch( this, function() {
                                            this.ajaxcall( "/table/table/concede.html?src=alt", { table: this.table_id }, this, function( result ){
//                                            window.location.href = this.metasiteurl+"/"+this.mslobby;
                                            } );
                                        } ) );
                           } ) );

                if( g_archive_mode )
                {
                    // Demo mode
                    if( dojo.hasClass( 'archivecontrol', 'demomode') )
                    {
                        //this.notifqueue.setSynchronous( 'archivewaitingdelay', 2000 );  // Slower
                    }

                    // Autoplay
                    if( dojo.hasClass( 'archivecontrol', 'autoplay') )
                    {
                        // Autoplay the game archive "until the end"
                        this.archive_playmode = 'play'; // Play until the end
                        this.bDisableSoundOnMove = true;
                        this.sendNextArchive();
                        if( !this.instantaneousMode )
                        {
                            this.notifqueue.setSynchronous( 'archivewaitingdelay', 1000 );  // Little bit slower
                        }
                    }
                }

                if( this.is_solo )
                {
                    dojo.addClass('ebd-body', 'solo_game' );
                }

                if( ! g_archive_mode )
                {
                    if( this.bTutorial )
                    {
                        this.showTutorial();
                    }
                }

                // Specific to initial Can't stop tutorial : add some exit button
                if( this.game_name == 'cantstop' && this.is_solo )
                {
                    dojo.style( 'its_your_turn', 'display', 'none' );
                    dojo.place( '<a href="#" id="quitFirstTutorialTop" class="bgabutton bgabutton_gray bgabutton_always_big" style="text-decoration:none;top:-9px;position:relative;">'+__('lang_mainsite',"Quit tutorial")+'</a> ', 'reflexiontimevalues' );

                    dojo.connect( $('quitFirstTutorialTop'), 'onclick', this, dojo.hitch( this, function( evt ) {
                        dojo.stopEvent( evt );
                        dojo.style( 'quitFirstTutorialTop', 'display', 'none' );
                        this.ajaxcall( "/table/table/concede.html?src=top", { table: this.table_id }, this, function( result ){
                            window.location.href = this.metasiteurl+"/"+this.mslobby;
                            dojo.style( 'quitFirstTutorialTop', 'display', 'block' );
                        } );
                    } ) );
                }

                // Judge decision
                dojo.query( '.judgegivevictory' ).connect( 'onclick', this, 'onJudgeDecision' );

                // Emergency messages display
                var uuid = 1;
                for( var i in this.emergencymsg )
                {
                    var datas = this.emergencymsg[i];

                    if( datas.type == 'emergency' )
                    {
                        var emergency_notif = {
                            channel: '/general/emergency',
                            packet_type: 'single',
                            data: []
                        };
                        emergency_notif.data.push({
                            args: datas,
                            bIsTableMsg: false,
                            lock_uuid: 'dummy',
                            log: '${player_name} ${text}',
                            type: 'chat',
                            time: datas.time,
                            loadprevious: true,
                            uid: uuid++
                        });

                        this.notifqueue.onNotification( emergency_notif );
                    }
                }

                // Responsive design features ///////////////////////////

                this.onGameUiWidthChange();

                dojo.connect(window, "scroll", this, dojo.hitch( this, 'adaptStatusBar' ));
                dojo.connect(window, "orientationchange", this, dojo.hitch( this, 'onGameUiWidthChange' ));
                dojo.connect(window, "onresize", this, dojo.hitch( this, 'onGameUiWidthChange' ));

                if( $('go_to_next_table_active_player') )
                {
                    dojo.connect( $('go_to_next_table_active_player'), 'onclick', dojo.hitch( this, function( evt ) {
                        dojo.stopEvent( evt );
                        this.confirmationDialog( __('lang_mainsite','This is your turn. Do you really want to go to your next table?'), function() {
                            document.location.href = $('go_to_next_table_active_player').href;
                        } );
                    } ) );

                    this.addTooltip( 'go_to_next_table_active_player', '', __('lang_mainsite','Go to next table (play later on this one)') );
                }


                // Game view menu setup
                var sections = [
                    {   btn: 'pageheader_gameresult', section:'pagesection_gameresult', onShow: dojo.hitch( this, 'onShowGameResults') },
                    {   btn: 'pageheader_gameview', section:'pagesection_gameview', defaults: true },
                ];
                this.pageheader = new ebg.pageheader();
                this.pageheader.create( this, 'maingameview_menuheader', sections, false );

    //            if( this.gamedatas.gamestate.name == 'gameEnd' )
    //            {
    //                this.pageheader.showSectionFromButton( 'pageheader_gameresult' );
    //            }

                // Footer menu
                var sections = [
                    {   btn: 'pageheader_howtoplay', section:'pagesection_howtoplay', onShow:dojo.hitch( this, 'onShowGameHelp' ) },
                    {   btn: 'pageheader_competition', section:'pagesection_competition', defaults: true },
                    {   btn: 'pageheader_tournament', section:'pagesection_tournament' },
                    {   btn: 'pageheader_strategytips', section:'pagesection_strategytips', onShow:dojo.hitch( this, 'onShowStrategyHelp' ) },
                    {   btn: 'pageheader_options', section:'pagesection_options' },
                    {   btn: 'pageheader_credits', section:'pagesection_credits' },
                    {   btn: 'pageheader_music', section:'pagesection_music', onShow:dojo.hitch( this, 'playMusic' ) },
                ];
                this.pageheaderfooter = new ebg.pageheader();
                this.pageheaderfooter.create( this, 'maingameview_menufooter', sections, false );


                dojo.query( '.seemore').connect( 'onclick', this, 'onSeeMoreLink' );
                this.addTooltipToClass( 'thumbuplink', '', __('lang_mainsite',"Thumb up this item") );
                dojo.query( '.thumbuplink' ).connect( 'onclick', this, 'onThumbUpLink' );


                this.getRanking();
                dojo.connect( $("seemore_rankings"), "onclick", this, "onSeeMoreRanking" );

                // Ranking menu
                dojo.query( '.sectiontitle_dropdown_command' ).connect( 'onclick', this, function( evt ) {
                    dojo.stopEvent( evt );
                    var dropdown = evt.currentTarget. parentNode.id;
                    dojo.query( '#'+dropdown+' .sectiontitle_dropdown_menu' ).toggleClass( 'sectiontitle_dropdown_menu_visible' );
                } );
                this.closeRankMenu = dojo.connect( $('overall-content'), 'onclick', this,function( evt ) {
                    dojo.query( '.sectiontitle_dropdown_menu_visible' ).removeClass( 'sectiontitle_dropdown_menu_visible' );
                } );
                dojo.query( '.rank_season' ).connect( 'onclick', this, 'onChangeRankMode' );


                // Add tooltips to trophies
                dojo.query( '.trophytooltip' ).forEach( dojo.hitch( this, function(node) {
                    var trophy_id = node.id.substr(14);
                    var content = $('trophytooltip_'+trophy_id).innerHTML;
                    this.addTooltipHtml( 'awardimg_'+trophy_id, '<div class="trophytooltip_displayed">'+ content+'</div>' );
                } ) );

                this.playerawardsCollapsedAlignement();

                // We display "how to play" by default to beginners
                if( ! this.isSpectator )
                {
                    if( this.gamedatas.players[ this.player_id ].beginner )
                    {
                        this.pageheaderfooter.showSectionFromButton( 'pageheader_howtoplay' );
                    }
                }
                if( dojo.hasClass('ebd-body', 'training_mode'))
                {
                    // Training mode: also show "how to play"
                    this.pageheaderfooter.showSectionFromButton( 'pageheader_howtoplay' );
                }

                if( typeof this.tournament_id != 'undefined' && this.tournament_id != null  )
                {
                    // Tournament game => by default => tournament tab
                    $('tournament_frame').src = this.metasiteurl+"/tournament/tournament/results.html?id="+this.tournament_id;
                    this.pageheaderfooter.showSectionFromButton( 'pageheader_tournament' );
                }

                if( g_archive_mode  )
                {
                    if( g_tutorialwritten.mode != 'view' )
                    {

                        // Adapting footer menu to game archive : transforming "strategy tips" into "Replay log"
                        var replayNodeLog = this.getReplayLogNode();
                        if( $('pageheader_strategytips') && replayNodeLog !== null )
                        {
                            $( 'pageheader_strategytips').innerHTML = __('lang_mainsite',"Replay log")+'<div class="pageheader_menuitembar">';
                            this.pageheaderfooter.showSectionFromButton( 'pageheader_strategytips' );

                            this.loadReplayLogs();
                        }
                    }
                }

                if( dojo.hasClass( 'ebd-body','new_gameux' ) )
                {
                    this.pageheaderfooter.hideAllSections();
                }

            }

            if( this.gamedatas.gamestate.name == 'gameSetup' && g_archive_mode )
            {
                // Skip lock screen for archives
                this.sendNextArchive();
            }


            if( g_archive_mode )
            {
                if( $('archive_go_to_move_nbr').value != '' )
                {
                    this.archive_gotomove = toint( $('archive_go_to_move_nbr').value );
                    this.archive_playmode = 'goto';
                    this.setModeInstataneous();
                    this.sendNextArchive();
                }
            }

            if( g_archive_mode &&  g_tutorialwritten.mode == 'view' )
            {
                // Default tab = always how to play
                this.pageheaderfooter.hideAllSections();// Note: because it is not translated
                if( $('table_ref_item_table_id') )
                {
                    $('table_ref_item_table_id').innerHTML = dojo.string.substitute( __('lang_mainsite',"Tutorial #${id}"), {id:g_tutorialwritten.id} );
                }

                // Launching tutorial !

                if( $('newArchiveComment') )
                {   // Okay, stay there
                }
                else
                {
                    // No comment on the next move => go to first comment
                    this.archive_playmode = 'nextcomment';
                    this.sendNextArchive();
                }
            }

            if( ! bGameDatasLimitedSetup )
            {
                this.init3d();
            }

            if( gamedatas.gamestate.name == 'gameEnd' )
            {
                this.updateResultPage();
            }

            if( ! bGameDatasLimitedSetup )
            {
                this.initHotseat();
            }

            // At the end, trigger a "onresize" to make sure all objects that resize themselves (ex: Stock) are up to date
            this.sendResizeEvent();
         },

         disableNextMoveSound: function()
         {
            this.bDisableNextMoveOnNextSound = true;
         },


         sendResizeEvent: function()
         {
            if(document.createEventObject) {
                window.fireEvent("resize");
            } else {
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent("resize", false, true);
                window.dispatchEvent(evt);
            }
         },

         onReconnect: function()
         {
            this.notifqueue.resynchronizeNotifications( false );
         },

         onGsSocketIoConnectionStatusChanged: function( status, arg )
         {
             // Note: copied from onSocketIoConnectionStatusChanged + applied to GS socket
             console.log( 'onGsSocketIoConnectionStatusChanged: '+status );

             if( this.page_is_unloading )
             {
                 // During page unload, cometD connection is unstable => mask the status
                 dojo.style( 'connect_gs_status', 'display', 'none' );
             }
             else
             {
                if( status == 'connect' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'none' );
                }
                else if( status == 'connect_error' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'block' );
                     $('connect_gs_status_text').innerHTML = __('lang_mainsite','Disconnected from your game!');
                     console.error( 'Disconnected from game server : '+arg );
                     g_sitecore.notifqueue.addToLog(  $('connect_gs_status_text').innerHTML );
                }
                else if( status == 'connect_timeout' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'block' );
                     $('connect_gs_status_text').innerHTML = __('lang_mainsite','Disconnected from your game!');
                     $('connect_gs_status_text').innerHTML += ' (timeout)';
                     g_sitecore.notifqueue.addToLog(  $('connect_gs_status_text').innerHTML );
                }
                else if( status == 'reconnect' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'none' );
                     g_sitecore.notifqueue.addToLog(  __('lang_mainsite','You are connected again.') );

                     // Reconnecting subscriptions to this game channels
                     this.gs_socket.emit('join', this.channel );
                     this.gs_socket.emit('join', this.tablechannelSpectators );
                     this.gs_socket.emit('join', '/player/p'+this.player_id );
                }
                else if( status == 'reconnect_error' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'block' );
                     $('connect_gs_status_text').innerHTML = __('lang_mainsite','Disconnected from your game!');
                     console.error( 'Disconnected from game server : '+arg );
                     g_sitecore.notifqueue.addToLog(  $('connect_gs_status_text').innerHTML );
                }
                else if( status == 'reconnect_failed' )
                {
                     dojo.style( 'connect_gs_status', 'display', 'block' );
                     $('connect_gs_status_text').innerHTML = __('lang_mainsite','Disconnected from your game!');
                     $('connect_gs_status_text').innerHTML += ' (reconnect failed)';
                     g_sitecore.notifqueue.addToLog(  $('connect_gs_status_text').innerHTML );
                }

             }
         },

         getReplayLogNode : function()
         {
            if($('strategytips_content') )
            {   return $('strategytips_content');   }
            else
            {
                var list = dojo.query( '#pagesection_strategytips .pagesection' );
                if( list.length > 0 )
                {   return list[0]  ;   }
            }
         },

         updatePremiumEmblemLinks: function()
         {
            this.addTooltipToClass( 'emblempremium', __('lang_mainsite',"Premium member: this player helps us to develop this service :)"), __('lang_mainsite','Support Board Game Arena: go Premium!') );
            dojo.query( '.emblempremium' ).connect( 'onclick', this, function() {
                    window.open( this.metasiteurl+"/premium?src=emblempremium", '_blank' );
            } );
            dojo.query( '.masqued_rank' ).connect( 'onclick', this, function() {
                    window.open( this.metasiteurl+"/premium?src=emblempremium", '_blank' );
            } );
         },


         /// Must be called each time the game UI interface is changing.
         //  1°) check if we must switch to "mobile_version" or "desktop_version"
         //  2°) check player's panel are correctly placed with the correct width
         //  3°) check the status bar is correctly placed with the correct width
         onGameUiWidthChange: function()
         {
            if( this.chatDetached )
            {   return ; }

            // Make sure we have a 980px view port in landscape mode
            // => it allows us to make sure that every devide in landscape mode does NOT use the mobile design
            //    (note : with landscape screen, this is always better to have the players panel on the right than on the top)

            if( typeof this.default_viewport == 'undefined' )
            {
                var viewport = dojo.query('meta[name="viewport"]');
                if( typeof viewport[0] != 'undefined' )
                {
                    this.default_viewport = viewport[0].content;
                }
            }

            var bForceMobileVersion = false;

            if( typeof window.orientation != 'undefined' )
            {
                var viewport = dojo.query('meta[name="viewport"]');
                if( typeof viewport[0] != 'undefined' )
                {
                    if( window.orientation !== 0 )
                    {
                        // On landscape mode, the user wants to have the largest possible width. Consequently we set to 980
                        // (Note: 980 => makes sure the right column is displayed)
                        viewport[0].content = 'width=980';
                        //alert('switch to landscape');
                    }
                    else
                    {
                        // This is portrait mode
                        if( this.isTouchDevice )
                        {
                            // Portrait + touch device = forcing mobile_version because it is way more usable
                            bForceMobileVersion = true;
                        }

                        if( this.default_viewport !== null )
                        {
                            viewport[0].content = this.default_viewport;
                            //alert('switch to default viewport '+this.default_viewport);
                        }
                    }
                }
            }

            // Choose between mobile_version and desktop_version

            var screen = dojo.position( 'ebd-body' );
            var right_column_width = 240;
            if( this.log_mode == '2cols' )
            {   right_column_width = 240+250;   }

            var screen_min_width = this.interface_min_width + right_column_width;

            // At first : if we are in 2 columns mode, switch back to 1 colomn before doing anything else
            if( this.log_mode == '2cols' && (screen.w < screen_min_width || this.currentZoom < 1) )
            {
                // Must switch back to 1 column log mode, before anything else (maybe this is enough)
                // Note: switchLogModeTo is calling back onGameUiWidthChange as the width changes => we will be back in the same method.
                this.switchLogModeTo( 0 );
                return ;
            }

            if( ! dojo.hasClass( 'ebd-body', 'mobile_version' ) )
            {
                if( screen.w < screen_min_width || this.currentZoom < 1 || bForceMobileVersion )
                {
                   //alert( "Screen width is "+screen.w+" and game requires an interface of "+screen_min_width+" => switch to mobile mode" );

                    // => must switch to mobile version
                   dojo.removeClass( 'ebd-body', 'desktop_version' );
                   dojo.addClass( 'ebd-body', 'mobile_version' );
                   this.adaptChatbarDock();
                }
            }
            else
            {
                if( screen.w >= screen_min_width && this.currentZoom == 1 && ! bForceMobileVersion )
                {
                   // alert( "Screen width is "+screen.w+", larger than the required interface for this game ("+screen_min_width+") => switch to desktop mode" );

                   // => must switch to desktop version
                   dojo.removeClass( 'ebd-body', 'mobile_version' );
                   dojo.addClass( 'ebd-body', 'desktop_version' );
                   this.adaptChatbarDock();
                }
            }

            var zoomFactor = 1;
            var interfaceFactor = 1;
            if( screen.w < this.interface_min_width )
            {
                // This screen is really too small for this game interface, so we are applying a "zoom" factor.
                zoomFactor = screen.w/this.interface_min_width;
                interfaceFactor = zoomFactor;
            }

            if( zoomFactor < 0.9 && dojo.hasClass( 'globalaction_zoom_icon', 'fa-search-minus' ) )
            {
                // Zoomed out version
                zoomFactor = 1;
                dojo.style( 'pagesection_gameview', 'overflow', 'auto' );
                dojo.style( 'game_play_area', 'minWidth', this.interface_min_width+'px' );
            }
            else
            {
                if( typeof this.bForceMobileHorizontalScroll != 'undefined' && dojo.hasClass( 'ebd-body', 'mobile_version' ) && this.bForceMobileHorizontalScroll )
                {
                    // Exception: use bForceMobileHorizontalScroll=true to force horizontal scrolling mode on mobile
                    dojo.style( 'pagesection_gameview', 'overflow', 'auto' );
                }
                else
                {
                    // Standard case
                    dojo.style( 'pagesection_gameview', 'overflow', 'visible' );
                }
                dojo.style( 'game_play_area', 'minWidth', 0 );
            }

            if( zoomFactor != this.gameinterface_zoomFactor )
            {
                this.gameinterface_zoomFactor = zoomFactor;

                dojo.style('page-content', 'zoom', zoomFactor );
                dojo.style('right-side-first-part', 'zoom', zoomFactor );
                dojo.style('page-title', 'zoom', zoomFactor );

            }

            if( interfaceFactor < 0.9 )
            {
                dojo.style( 'globalaction_zoom_wrap', 'display', 'inline-block' );
                dojo.style( 'toggleSound', 'display', 'none' ); // Note : on very small screen, we can remove volume control because sounds are not supported anyway :/
            }
            else
            {
                dojo.style( 'globalaction_zoom_wrap', 'display', 'none' );
                dojo.style( 'toggleSound', 'display', 'inline-block' );
            }


            // Trigger the other adaptations needed when width changes
            this.adaptPlayersPanels( );
            this.adaptStatusBar();

            this.onScreenWidthChange();
         },

         onZoomToggle: function( evt )
         {
            dojo.stopEvent( evt );

            var zoomBefore = this.gameinterface_zoomFactor;
            var player_board_height_before = dojo.style( 'left-side', 'marginTop' );

            if( dojo.hasClass( 'globalaction_zoom_icon', 'fa-search-plus' ) )
            {
                // Zoom in!
                dojo.removeClass(  'globalaction_zoom_icon', 'fa-search-plus'  );
                dojo.addClass(  'globalaction_zoom_icon', 'fa-search-minus'  );
            }
            else
            {
                // Zoom out!
                dojo.removeClass(  'globalaction_zoom_icon', 'fa-search-minus'  );
                dojo.addClass(  'globalaction_zoom_icon', 'fa-search-plus'  );

                this.savePlayAreaXScroll = $('pagesection_gameview').scrollLeft;
            }

            this.onGameUiWidthChange();

            var zoomAfter = this.gameinterface_zoomFactor;
            var player_board_height_after = dojo.style( 'left-side', 'marginTop' );

            var screen = dojo.window.getBox();
            var screen_height = screen.h;

            var scroll = window.scrollY //Modern Way (Chrome, Firefox)
             || window.pageYOffset //Modern IE, including IE11
             || document.documentElement.scrollTop //Old IE, 6,7,8);

            if( zoomAfter < zoomBefore )
            {
                // Zoom out
                var newScroll = ( scroll ) + ( player_board_height_after - player_board_height_before );
                newScroll *= ( zoomAfter / zoomBefore );

                newScroll -= ( screen_height * ( 1 - zoomAfter )/2 );
            }
            else
            {
                // Zoom in
                var newScroll = ( scroll * ( zoomAfter / zoomBefore ) ) + ( player_board_height_after - player_board_height_before );

                newScroll += ( screen_height * ( 1 - zoomBefore )/2 );

                $('pagesection_gameview').scrollLeft = this.savePlayAreaXScroll;
            }
            window.scroll( 0, newScroll );
         },

         onScreenWidthChange: function()
         {
            // To be overrided by games
         },

         // adaptStatusBar :
         //  Status bar is on "position:fixed" when you scroll the screen, and must get back to "position:static" when the screen scrolls to the top.
         adaptStatusBar: function()
         {
            var coords = dojo.position( 'after-page-title' );
            var pagetitle = dojo.position( 'page-title' );
            var zoomFactor = dojo.style( 'page-title', 'zoom' );
            if (typeof zoomFactor == 'undefined')
				zoomFactor = 1;

            var pagetitle_visibleheight = pagetitle.h * zoomFactor;

            var screen = dojo.window.getBox();
            var screen_height = screen.h;
            var fixed_page_title_max_height = screen_height / 10;   // Note : we limit the size of a "position:fixed page title" to 10% of the total height of the screen.

            if( ! dojo.hasClass( 'page-title', 'fixed-page-title' ) && coords.y < 0 && pagetitle_visibleheight < fixed_page_title_max_height )  // Note: when page title is too big (height > 200px), we don't do this
            {
                dojo.addClass( 'page-title', 'fixed-page-title' );
            }
            else if( dojo.hasClass( 'page-title', 'fixed-page-title' ) && ( coords.y >= 0 || pagetitle_visibleheight >= fixed_page_title_max_height )  )
            {
                dojo.removeClass( 'page-title', 'fixed-page-title' );
                dojo.style( 'page-title', 'width', 'auto' );
                dojo.style( 'after-page-title', 'height', '0px' );
            }

            if( dojo.hasClass( 'page-title', 'fixed-page-title' ) )
            {
                // Make sure the width is okay
                dojo.style( 'page-title', 'width', ( ( coords.w - 10 )/zoomFactor )+'px' );

                dojo.style( 'after-page-title', 'height', pagetitle.h+'px' );
            }

            if( $('archive_history_backtotop') )
            {
                var history = dojo.position( 'maingameview_menufooter' );


                if( history.y != 0 )    // Note: maingameview_menufooter is HIDDEN in tutorial view mode so we cannot count on it
                {
                    if( history.y < 200  )
                    {   dojo.style( 'archive_history_backtotop', 'display', 'block');   }
                    else
                    {   dojo.style( 'archive_history_backtotop', 'display', 'none');   }
                }

            }
         },

         // adaptPlayersPanels :
         //  player's panel are displayed at the top of the page on mobile style view.
         //  this method make all the needed adaptation to display the player's panel at the right place, give them the correct width, and eventually
         //  set them back to their "normal" place on the right if needed (desktop mode).
         adaptPlayersPanels: function( )
         {
            var margin_between_panels = 3;
            var panels_horizontal_padding = 6;
            var panels_min_width = 240;

            if( dojo.hasClass( 'ebd-body', 'mobile_version' ) )
            {
                // Mobile version //////////////////////////////////////////////////////////////

                var right_coords = dojo.position( 'right-side-first-part' );

                // Get the available width for players panels
                var available_width = right_coords.w;

                // Each players panel has a minimum width of 240px + 3 pixels margin = 243px
                var max_possible_players_panel_per_line = Math.floor( available_width / ( panels_min_width + margin_between_panels ) );

                // Count number of players
                var player_boards = dojo.query( '#player_boards .player-board' );
                var nb_players = player_boards.length;

                // Compute number of lines (in fact : "there must be at least THIS number of lines")
                var nb_lines = Math.ceil( nb_players / max_possible_players_panel_per_line );

                // Number of panels per line
                var nb_players_panel_per_line = Math.ceil( nb_players / nb_lines );

                // Compute players panel width
                var player_panel_width = Math.floor( available_width / nb_players_panel_per_line ) - margin_between_panels;
                var player_panel_css_width = player_panel_width - panels_horizontal_padding;

                // Make sure all panels on the same line get the same height
                var no=0;
                var max_height = 0;
                var node_on_same_line = query.NodeList();
                player_boards.style( 'height', 'auto' );
                for( var i in player_boards )
                {
                    if( typeof player_boards[i].id !== 'undefined' )
                    {
                        max_height = Math.max( dojo.style( player_boards[i], 'height'), max_height );
                        node_on_same_line.push( player_boards[i] );
                        no++;

                        if( no % nb_players_panel_per_line == 0 || no >= nb_players )
                        {
                            // Last item on this line
                            node_on_same_line.style( 'height', max_height+'px' );
                            var max_height = 0;
                            var node_on_same_line = query.NodeList();
                        }
                    }
                }



                // Apply width to all panels
                player_boards.style( 'width', player_panel_css_width+'px' );



                // Adapt main view top margin to player's panel height
                var right_coords = dojo.position( 'right-side' );
                var h = right_coords.h;
                dojo.style( 'left-side', 'marginTop', h+'px' );
            }
            else
            {
                // No more mobile version //////////////////////////////////////////////////////

                // => restore the original
                dojo.query( '#player_boards .player-board' ).style( 'width', (panels_min_width - panels_horizontal_padding)+'px' );
                dojo.query( '#player_boards .player-board' ).style( 'height', 'auto' );
                dojo.style( 'left-side', 'marginTop', '0px' );
            }
         },

         activeShowOpponentCursor: function()
         {
            if( this.showOpponentCursorMouveOver == null )
            {
                this.showOpponentCursorLastEvent = null;
                this.showOpponentCursorLastInfosSendMark = null;
                this.showOpponentCursorMouveOver = dojo.connect( $('ebd-body'), "onmousemove", this, "onShowOpponentCursorMouseOver" );
                this.showOpponentCursorSendInfos( );
                dojo.query( '.chatbarbelowinput_item_showcursor' ).addClass( 'audiovideo_active' );

                this.showMessage( __('lang_mainsite',"Your mouse cursor is now visible by other players."), 'info' );


                var eventCount = 0;
                var eventProperty = [];

                this.showOpponentCursorClickHook = dojo.connect( document, 'onmousedown', this, 'showOpponentCursorClick' );
            }
         },

         showOpponentCursorClick: function (evt) {

                if( evt.type == 'mousedown' )
                {
                    // Cooldown, do not allow more than 10 clicks every 5 seconds (avoid some players bombing the screen / crashing the interface or creating deadlocks)
                    if (this.showOpponentCursorClickCooldown === null) {
                        this.showOpponentCursorClickCooldown = Date.now();
                    }
                    
                    this.showOpponentCursorClickNumberSinceCooldown++;
                    
                    var time_since_cooldown = Math.round((Date.now() - this.showOpponentCursorClickCooldown) / 1000);
                    if (time_since_cooldown < 5 && this.showOpponentCursorClickNumberSinceCooldown >= 10) {
                        this.showMessage( __('lang_mainsite',"We know this feature is fun, but please slow down! Don't bomb the screen with your clicks please ;)"), 'info' );
                        return;
                    } else {
                        this.showOpponentCursorClickCounter++;

                        if (this.showOpponentCursorClickCounter % 10 == 1) {
                            this.showOpponentCursorClickCooldown = Date.now();
                            this.showOpponentCursorClickNumberSinceCooldown = 0;
                        }
                    }

                    this.onShowOpponentCursorMouseOver( evt );
                    var cursorInfosToSent = this.getCursorInfos( true );

                    this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/showCursorClick.html", {path:dojo.toJson( cursorInfosToSent )}, this, function( result ){} );

                    //alert("Element id: " + evt.toElement.id + ", X: " + x + ", Y: " + y + "\n");
                }
         },


         unactiveShowOpponentCursor: function()
         {
            if( this.showOpponentCursorMouveOver !== null )
            {
                dojo.disconnect( this.showOpponentCursorMouveOver );
                dojo.disconnect( this.showOpponentCursorClickHook );
                clearTimeout( this.showOpponentCursorTimeout );
                this.showOpponentCursorMouveOver = null;
                this.showOpponentCursorClickHook = null;
                this.showOpponentCursorTimeout = null;
                dojo.query( '.chatbarbelowinput_item_showcursor' ).removeClass( 'audiovideo_active' );

                this.gs_socket.emit( 'oppCursor', {
                    table_id: this.table_id,
                    path: null
                } );
            }

         },

         onShowMyCursor: function( evt )
         {
            dojo.stopEvent( evt );

            if( this.isSpectator )
            {
                this.showMessage( __('lang_mainsite',"You cannot do this as a spectator."), 'error' );
                return;
            }

            if( this.showOpponentCursorMouveOver == null )
            {
                this.activeShowOpponentCursor();
            }
            else
            {
                this.unactiveShowOpponentCursor();
            }
         },

         onHideCursor: function( evt )
         {
            // player_hidecursor_<id>
            var player_id = evt.currentTarget.id.substr( 18 );

            dojo.style( 'player_showcursor_'+player_id, 'display', 'none' );

            if( $('opponent_cursor_'+player_id) )
            {
                dojo.destroy( 'opponent_cursor_'+player_id );
            }

         },

         getCursorInfos: function( bEvenIfNotMoved )
         {
            // Gather needed infos

            var evt = this.showOpponentCursorLastEvent;

            var first_parent_with_id = evt.target;
            while( ! first_parent_with_id.id )
            {
                first_parent_with_id = first_parent_with_id.parentNode;
            }

            var cursorInfosToSent = [];

            var output = '';

            var x  = (evt.offsetX || evt.layerX);
            var y  = (evt.offsetY || evt.layerY);

            var bNoMoveSinceLastTime = false;

            if( this.showOpponentCursorLastInfosSendMark === null )
            {
                // First time => set mark
                this.showOpponentCursorLastInfosSendMark = first_parent_with_id.id+' '+x+','+y;
            }
            else if( this.showOpponentCursorLastInfosSendMark == ( first_parent_with_id.id+' '+x+','+y ) )
            {
                // No move since last time !
                var bNoMoveSinceLastTime = true;
            }
            else
            {
                // Normal case
                this.showOpponentCursorLastInfosSendMark = first_parent_with_id.id+' '+x+','+y;
            }

            //document.title = 'sent: '+( first_parent_with_id.id+' '+x+','+y );

            if( ! bNoMoveSinceLastTime || bEvenIfNotMoved )
            {
                if( typeof evt.path == 'undefined' )
                {
                    var path = [];
                    var currentElem = first_parent_with_id;
                    while (currentElem) {
                      path.push(currentElem);
                      currentElem = currentElem.parentElement;
                    }
                    if (path.indexOf(window) === -1 && path.indexOf(document) === -1)
                      path.push(document);
                    if (path.indexOf(window) === -1)
                      path.push(window);

                    evt.path = path;
                }


                for( var i in evt.path )
                {
                    output += '<br/>';
                    var elem = evt.path[i];
                    output += elem.id + ' : '+x+','+y;

                    if( elem.id )
                    {
                        cursorInfosToSent.push( {
                            id: elem.id,
                            x: x,
                            y: y
                        } );
                    }

                    var childPos = elem.getBoundingClientRect();
                    var parentPos = elem.parentNode.getBoundingClientRect();
                    var childOffset = {
                        top: childPos.top - parentPos.top,
                        left: childPos.left - parentPos.left
                    }

                    x += childOffset.left;
                    y += childOffset.top;

                    if( elem.id == 'game_play_area' )   // We know the opponent will find this one
                    {   break;  }
                    if( elem.id == 'ebd-body' )   // We know the opponent will find this one
                    {   break;  }
                }

                return cursorInfosToSent;
            }
            else
            {
                return null;
            }

         },

         // Send to opponent infos about current cursor move (if any)
         showOpponentCursorSendInfos: function( )
         {
             if( this.showOpponentCursorLastEvent !== null )
             {
                var cursorInfosToSent = this.getCursorInfos( false );

                if( cursorInfosToSent === null )
                {

                }
                else
                {
                    // For debug
                    //console.log( output );
                    //$('output').innerHTML = output;


                    // Send infos
                    this.gs_socket.emit( 'oppCursor', {
                        table_id: this.table_id,
                        path: cursorInfosToSent
                    } );
                }
             }

             // In any case, resend info in 1 sec

            this.showOpponentCursorTimeout = setTimeout( dojo.hitch( this, "showOpponentCursorSendInfos" ), 500 );
         },


         onShowOpponentCursorMouseOver: function( evt )
         {
            // Record last move cursor
            this.showOpponentCursorLastEvent = evt;
         },



        // Setup the whole game GUI with datas from the game
        setup: function( gamedatas ){
            // (to be override)
        },

        // Practical methods to send&catch client side state (which can be more extensive than game state)
        onEnteringState: function( stateName, args )
        {
            // To be override
        },
        onLeavingState: function( stateName )
        {
            // To be override
        },

        getGameStandardUrl: function()
        {
            return "/"+this.gameserver+'/'+this.game_name+"?table="+this.table_id;
        },

        showIngameMenu: function()
        {
            dojo.style( 'ingame_menu_content', 'display', 'block' );
            dojo.addClass( 'ingame_menu', 'menu_open' );
        },
        hideIngameMenu: function()
        {
            dojo.style( 'ingame_menu_content', 'display', 'none' );
            dojo.removeClass( 'ingame_menu', 'menu_open' );
        },
        toggleIngameMenu: function( evt )
        {
            dojo.stopEvent( evt );

            if( dojo.style( 'ingame_menu_content', 'display' ) == 'none' )
            {   this.showIngameMenu();  }
            else
            {   this.hideIngameMenu();  }
        },

        // Build player tooltip
        getPlayerTooltip: function( player ){
            // Languages spoken
            var languages = '';
            for( var level=1;level>=0; level-- )
            {
                for( var lang_id in player.languages )
                {
                    if( player.languages[ lang_id ].level == level )
                    {
                        var lang_code = lang_id;
                        if( toint( player.languages[ lang_id ].level ) === 1 )
                        {   lang_code = '<b>'+lang_id+'</b>';  }
                        var html = '<span id="lang_'+player.user_id+'_'+lang_id+'">'+lang_code+'</span> ';
                        languages += html;
                    }
                }
            }

            // Accounttype
            var accounttype = 'free';
            if( player.is_beginner == true )
            {   accounttype = 'beginner';   }
            else if( player.is_premium == true )
            {   accounttype = 'premium';    }

            var avatarurl = $('avatar_'+player.user_id).src
            if (avatarurl.match(/\/default-\d+_32.jpg$/)) {
                // Default avatars for size 184 have no suffix
                avatarurl = avatarurl.replace( '_32.jpg', '.jpg' );
            } else {
                avatarurl = avatarurl.replace( '_32.jpg', '_184.jpg' );
            }

            if( typeof player.karma == 'undefined' )
            {
                // Note: for compatibility
                player.karma = 100;
            }

            var karma_infos = this.getKarmaLabel( player.karma );

            var progressbardisplay = 'block';

        	var args = {
        			player_id: player.user_id,
                    genderclass: (player.gender===null) ? 'gender_not_specified' : ( player.gender==1 ? 'fa-mars male' : 'fa-venus female' ) ,
                    flag: player.country_infos.code,
                    country: player.country_infos.name,
                    city: (player.city===null || player.city=='') ? '' : '('+player.city+')',
                    languages: languages,
                    accounttype: accounttype,
                    avatarurl:avatarurl,
                    karma:player.karma,
                    karma_label: karma_infos.label,
                    karma_class: karma_infos.css,
                    progressbardisplay: progressbardisplay
            };

            return this.format_string( this.jstpl_player_tooltip, args );
        },

        // Client state is an override of a real server game state, useful in some situations where several steps
        // must be done on client side without any server interraction.
        // Client state acts like a server game state. Real current server game state can be restored with "restoreServerGameState" method
        setClientState: function( stateName, args )
        {
            console.log( "setClientState: "+stateName );

            // Lock screen specific
            if( stateName == 'gameSetup' )
            {
                if( typeof this.lockScreenTimeout != 'undefined' )
                {
                    clearTimeout( this.lockScreenTimeout );
                }
            }

            // Leave current state
            dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );
            this.onLeavingState( this.gamedatas.gamestate.name );

            // Write new "client" state
            this.on_client_state = true;
            this.gamedatas.gamestate.name = stateName;
            for( var arg in args )
            {
                this.gamedatas.gamestate[ arg ] = args[ arg ];
            }

            // Enter on this state as it is a real game state
            this.updatePageTitle();

            dojo.addClass( 'overall-content', 'gamestate_'+stateName );
            this.onEnteringState( stateName, this.gamedatas.gamestate );
        },
        restoreServerGameState: function()
        {
            console.log( "restoreServerGameState" );
            // Leave current state
            dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );
            this.onLeavingState( this.gamedatas.gamestate.name );

            console.log( "last server state:" );
            console.log( this.last_server_state );

            var current_reflexion_state = dojo.clone( this.gamedatas.gamestate.reflexion );

            this.gamedatas.gamestate = dojo.clone( this.last_server_state );
            this.on_client_state = false;

            // Restoring old reflexion time status
            this.gamedatas.gamestate.reflexion = current_reflexion_state;

            console.log( "new state:" );
            console.log( this.gamedatas.gamestate );

            // Enter on this state as it is a real game state
            this.updatePageTitle();
            dojo.addClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );
            this.onEnteringState( this.gamedatas.gamestate.name, this.gamedatas.gamestate );
        },


        // Table administrator requested to start the game
        onStartGame: function()
        {
            console.log( 'onStartGame' );
            this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/startgame.html", {}, this, function( result ){} );
        },

        // Called when a complete packet of notification has been dispatched
        onNotificationPacketDispatched: function()
        {
            if( !this.current_player_was_active && this.current_player_is_active )
            {
                // We must play "its your turn" sound
                if( this.instantaneousMode || typeof g_replayFrom != 'undefined' )
                {
                    // Do not play any sound
                }
                else
                {
                    // Plays a sound to warn this player it is its turn
                    console.log( "play the warning sound" );
                    stopSound( 'move' );
                    playSound( 'yourturn' );

                }
            }

            // In any case, save the current state
            this.current_player_was_active = this.current_player_is_active;
        },

        // Update/Change the animation that signal current player according to game state
        updateActivePlayerAnimation: function()
        {
            console.log( 'updateActivePlayerAnimation' );
            var active_player;
//            console.log( this.gamedatas.gamestate );

            // Restore emblems for all players and get the list of previous active players
            var previous_active_players = {};
            var was_active_before = false;
            var is_active_after = false;

//            console.log( "Removing active players" );
            for( var player_id in this.gamedatas.players )
            {
             //   console.log( "is player "+player_id+" active ?" );

                if( dojo.style( "avatarwrap_" + player_id, "display" ) == 'none' )
                {
                    console.log( "restoring emblem of player "+player_id );

                    dojo.style( "avatarwrap_" + player_id, "display", "block" );
                    dojo.style( "avatar_active_wrap_" + player_id, "display", "none" );

                    previous_active_players[ player_id ] = 1;

                    if( player_id == this.player_id )
                    {    was_active_before = true;      }
                }

                if( $('player_table_status_'+player_id) )
                {
                    var player_status = '';

                    if( this.gamedatas.players[ player_id ].beginner && this.player_id != player_id )
                    {
                        if( dojo.hasClass( 'ebd-body', 'no_time_limit' ))
                        {
                            player_status += '<p class="boardblock doubletime_infos">';
                            player_status += __('lang_mainsite',"This is my first game.")+'<br/>';
                            player_status += __('lang_mainsite',"Thanks for helping me!")
                            player_status += '</p>';
                        }
                        else
                        {
                            player_status += '<p class="boardblock doubletime_infos">';
                            player_status += __('lang_mainsite',"This is my first game : my time is doubled")+'<br/>';
                            player_status += __('lang_mainsite',"Thanks for helping me!")
                            player_status += '</p>';
                        }
                    }
                    if( this.gamedatas.players[ player_id ].is_ai == 1 )
                    {
                        player_status += '<p class="boardblock">';
                        player_status += __('lang_mainsite',"This player is an artificial intelligence");
                        player_status += '</p>';
                    }
                   /* if( this.players_metadata[ player_id ].grade == 6 && player_id != 426 ) // Exclude Een (426). Doesn't like to be singled out, around a game table all players are equal.
                    {
                        if( player_status != '' )
                        {   player_status += '<br/>';   }
                        player_status += __('lang_mainsite',"This player is a BGA administrator");
                    }
                    if( this.players_metadata[ player_id ].grade == 4 || this.players_metadata[ player_id ].grade == 5 )
                    {
                        if( player_status != '' )
                        {   player_status += '<br/>';   }
                        player_status += __('lang_mainsite',"This player is a BGA moderator");
                    }*/
                    if( this.gamedatas.players[ player_id ].zombie == 1 )
                    {
                        player_status += '<p class="boardblock">';
                        player_status += __('lang_mainsite',"The turns of this player are skipped (this player left the game or was out of time)");
                        player_status += '</p>';
                    }
                    if( this.gamedatas.players[ player_id ].eliminated == 1 )
                    {
                        player_status += '<p class="boardblock">';
                        player_status += __('lang_mainsite',"This player has been eliminated from the game");
                        player_status += '</p>';
                    }

                    if( typeof this.hotseatplayers[ player_id ] != 'undefined' && this.player_id != player_id )
                    {
                        player_status += '<p class="boardblock">';
                        player_status += __('lang_mainsite',"This player is playing from the same seat than another (`hotseat`)");
                        player_status += '</p>';
                    }

                    if( player_status != '' )
                    {
                        $('player_table_status_'+player_id).innerHTML = player_status;
                        dojo.style( 'player_table_status_'+player_id, 'display', 'block' );
                    }
                    else
                    {
                        dojo.style( 'player_table_status_'+player_id, 'display', 'none' );
                    }
                }
            }

            if( ! g_archive_mode )
            {
				// RTC video active player effect reset
				dojo.query('.rtc_video_pulsating').removeClass( 'rtc_video_pulsating' );

                // Depending on state type, active zero, one or more players
                if( this.gamedatas.gamestate.type == 'activeplayer' )
                {
                    console.log( "gamestate type is classic 1 active player with player "+this.gamedatas.gamestate.active_player );
                    active_player = this.gamedatas.gamestate.active_player;

                    if( this.gamedatas.players[ active_player ] )
                    {
                    //    console.log( this.gamedatas.players[ active_player ] );
                        if( this.gamedatas.players[ active_player ].ack != 'unavail' )
                        {
                            if( ! this.shouldDisplayClockAlert( active_player ) )
                            {   $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player.gif');   }
                            else
                            {   $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player_clockalert.gif');   }

                            // RTC video active player effect
							if ( $( 'videofeed_' + active_player + '_pulse' ) ) {
								dojo.addClass( 'videofeed_' + active_player + '_pulse', 'rtc_video_pulsating' );
							}
                        }
                        else
                        {    $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player_nonack.gif');   }

                        dojo.style( "avatarwrap_" + active_player, "display", "none" );
                        dojo.style( "avatar_active_wrap_" + active_player, "display", "block" );

                        if( active_player == this.player_id )
                        {    is_active_after = true;        }

                    }
                    else
                    {
                        this.showMessage( 'Error: there is no more active player!', 'error' );
                    }

                }
                else if( this.gamedatas.gamestate.type == 'multipleactiveplayer' )
                {
                    console.log( "gamestate type is multi active player" );

                    for( var i in this.gamedatas.gamestate.multiactive )
                    {
                        active_player = this.gamedatas.gamestate.multiactive[i];
                        console.log( this.gamedatas.players[ active_player ] );
                        if( this.gamedatas.players[ active_player ].ack != 'unavail' )
                        {
                            if( ! this.shouldDisplayClockAlert( active_player ) )
                            {   $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player.gif');   }
                            else
                            {   $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player_clockalert.gif');   }

                            // RTC video active player effect
							if ( $( 'videofeed_' + active_player + '_pulse' ) ) {
								dojo.addClass( 'videofeed_' + active_player + '_pulse', 'rtc_video_pulsating' );
							}
                        }
                        else
                        {    $("avatar_active_" + active_player).src = getStaticAssetUrl('img/layout/active_player_nonack.gif');   }

                        dojo.style( "avatarwrap_" + active_player, "display", "none" );
                        dojo.style( "avatar_active_wrap_" + active_player, "display", "block" );

                        if( active_player == this.player_id )
                        {
                            is_active_after = true;
                        }
                    }
                }

                if( was_active_before && ! is_active_after )
                {
                    // Display next publisher annouce
                    this.updatePubBanner();
                }
            }

            // Display hourglass on statusbar
            if( is_active_after )
            {
                if( ! this.shouldDisplayClockAlert( this.player_id ) )
                {   $('active_player_statusbar_icon').src = getStaticAssetUrl('img/layout/active_player.gif');   }
                else
                {   $('active_player_statusbar_icon').src = getStaticAssetUrl('img/layout/active_player_clockalert.gif');   }

                dojo.style( 'active_player_statusbar', 'display', 'inline-block' );
                dojo.addClass( 'ebd-body', 'current_player_is_active' );
            }
            else
            {
                dojo.style( 'active_player_statusbar', 'display', 'none' );
                dojo.removeClass( 'ebd-body', 'current_player_is_active' );
            }



            if( this.game_name == 'cantstop' && this.is_solo )
            {
                // Can't stop tutorial => do not skare anything
            }
            else
            {
                if( is_active_after )
                {
                    if( was_active_before )
                    {
                        // Was active before => just a nice "remember it's still your turn"
//                        dojo.addClass( 'reflexiontimevalues', 'short_yourturn_animation' );

//                        setTimeout( dojo.hitch( this, function() {
//                            dojo.removeClass( 'reflexiontimevalues', 'short_yourturn_animation' );
//                        } ), 400 );
                    }
                    else
                    {
                        // Was not active before => most violent animation

                        // Note: disabled for turn-based, because on turn based you are supposed to know when it's your turn
                        if( this.bRealtime )
                        {
                            dojo.addClass( 'reflexiontimevalues', 'yourturn_animation' );

                            setTimeout( dojo.hitch( this, function() {
                                dojo.removeClass( 'reflexiontimevalues', 'yourturn_animation' );
                            } ), 800 );
                        }
                    }
                }
            }

            this.addTooltipToClass( 'tt_timemove_time_bar',     __('lang_mainsite', 'Remaining time to think for this move. When the bar is all red, you can expel inactive active players.'), '' );
            this.addTooltip( 'reflexiontime_value', __('lang_mainsite', 'Remaining time to think for this game'), '' );
            this.addTooltip( 'current_player_reflexion_time', __('lang_mainsite', 'Remaining time to think for this game'), '' );
            this.addTooltipToClass( 'timeToThink', __('lang_mainsite', 'Remaining time to think for this game'), '' );

            this.updateReflexionTimeDisplay();
            this.updateFirePlayerLink();

            this.current_player_is_active = is_active_after;

            // Hotseat mode:
            // Current player is no more active
            // => check if we must give the hotseat focus to another player
            this.checkHotseatFocus();

            return is_active_after;
        },

        // Return true if current player is active
        isCurrentPlayerActive: function()
        {
            return this.isPlayerActive( this.player_id );
        },

        // Return true if specified player is active
        isPlayerActive: function( player_id )
        {
            if( this.gamedatas.gamestate.type == 'activeplayer' )
            {
                if( this.gamedatas.gamestate.active_player == player_id )
                {    return true;       }
            }
            else if( this.gamedatas.gamestate.type == 'multipleactiveplayer' )
            {
                for( var i in this.gamedatas.gamestate.multiactive )
                {
                    if( this.gamedatas.gamestate.multiactive[i] == player_id )
                    {    return true;       }
                }
            }

            return false;
        },

        // Get the list of current active players ids
        getActivePlayers: function()
        {
            if( this.gamedatas.gamestate.type == 'activeplayer' )
            {
                return [ this.gamedatas.gamestate.active_player ];
            }
            else if( this.gamedatas.gamestate.type == 'multipleactiveplayer' )
            {
                var res = [];
                for( var i in this.gamedatas.gamestate.multiactive )
                {
                    res.push( this.gamedatas.gamestate.multiactive[i] );
                }
                return res;
            }

            return [];
        },

        getActivePlayerId: function()
        {
            if( this.gamedatas.gamestate.type == 'activeplayer' )
            {
                return this.gamedatas.gamestate.active_player;
            }
            else
            {   return null;    }
        },

        // Update current page title according to game state
        updatePageTitle: function(state = null)
        {
            if (state === null) {
                state = this.gamedatas.gamestate;
            }

            var tpl = dojo.clone( state.args );
            if( tpl === null || typeof tpl === 'undefined' )
            {   tpl = {};   }

            var actPlayers = this.getActivePlayers();
            if( actPlayers.length == 1 )
            {
                var active_player = actPlayers.pop();
            }
            else
            {
                var active_player = null;

            }
//            var active_player = toint( state.active_player );
            var pagetitle = state.description;

            if( typeof pagetitle == 'undefined' )
            {
                pagetitle = '';
            }

            // Lock screen specific
            if( state.name == 'gameSetup' )
            {
                if( this.lockts <= 0 )
                {
                    pagetitle = dojo.string.substitute( __('lang_mainsite','Your ${game_name} game is about to start ...'), {
                        game_name: this.game_name_displayed
                    } );
                }
                else
                {
                    pagetitle = dojo.string.substitute( __('lang_mainsite','Your ${game_name} game will start in ${s} seconds'), {
                        game_name: this.game_name_displayed,
                        s: '<span class="locking_time">'+this.lockts+'</span>'
                    } );
                }
            }

            console.log( "(updatePageTitle) active_player=" + active_player );
            console.log( state );
            console.log( pagetitle );
            var color;
            var color_back = '';

            if( typeof active_player != 'undefined' && active_player !== 0 && active_player !== null )
            {
                color = this.gamedatas.players[ active_player ].color;
                if( this.gamedatas.players[ active_player ].color_back )
                {   color_back = "background-color:#" + this.gamedatas.players[ active_player ].color_back + ";";      }

                var toto = ( '<span style="font-weight:bold;color:#'+color+';' + color_back + '">'+this.gamedatas.players[ active_player ].name+'</span>' );

                tpl.actplayer = ( '<span style="font-weight:bold;color:#'+color+';' + color_back + '">'+this.gamedatas.players[ active_player ].name+'</span>' );
            }
            else
            {
                tpl.actplayer = '';
            }

            if( this.isCurrentPlayerActive() && state.descriptionmyturn!==null )
            {
                color = this.gamedatas.players[ this.player_id ].color;
                color_back = '';
                if( this.gamedatas.players[ this.player_id ].color_back )
                {   color_back = "background-color:#" + this.gamedatas.players[ this.player_id ].color_back + ";";    }
                tpl.you = '<span style="font-weight:bold;color:#'+color+';' + color_back + '">'+__('lang_mainsite','You')+'</span>';
                pagetitle = state.descriptionmyturn;
            }

            // Color the name of otherplayer thanks to otherplayer_id; (Example: used in Dominion for the Swindler card)
            if( tpl.otherplayer )
            {
                color = this.gamedatas.players[ tpl.otherplayer_id ].color;
                color_back = '';
                if( this.gamedatas.players[ tpl.otherplayer_id ].color_back )
                {   color_back = "background-color:#" + this.gamedatas.players[ tpl.otherplayer_id ].color_back + ";";    }
                tpl.otherplayer = '<span style="font-weight:bold;color:#'+color+';' + color_back + '">'+tpl.otherplayer+'</span>';
            }

            pagetitle = _( pagetitle );

            for( var i=1; i<=5; i++ )
            {
                tpl[ 'titlearg'+i] = "<span id='titlearg"+i+"'>N</span>";
            }

            pagetitle = this.format_string_recursive( pagetitle, tpl );

            if( pagetitle == '' )
            {
                $('pagemaintitletext').innerHTML = '&nbsp;';
            }
            else
            {
                $('pagemaintitletext').innerHTML = pagetitle;
            }
            dojo.empty( 'generalactions' );

            if( this.instantaneousMode )
            {
                // Don't change page title
            }
            else
            {
                document.title = this.strip_tags( pagetitle ) + ' \u2022 ' + this.game_name_displayed + ' \u2022 '+$('websitename').innerHTML;
            }

            this.onUpdateActionButtons( state.name, state.args );

            // Go to next table
            if( $('gotonexttable_wrap' ) )
            {
                if( ! this.isCurrentPlayerActive() && ! this.bRealtime && !this.isSpectator )
                {
                    dojo.style( 'gotonexttable_wrap', 'display', 'inline' );
                    dojo.style( 'go_to_next_table_inactive_player', 'display', 'inline' );
                    dojo.style( 'go_to_next_table_active_player', 'display', 'none' );

                    // Adapt "go to new table" label to the effective number of table where it's your turn to play
                    if( typeof this.number_of_tb_table_its_your_turn != 'undefined' && this.number_of_tb_table_its_your_turn != '-' )
                    {
                        if( this.number_of_tb_table_its_your_turn == 1 )
                        {
                            $('go_to_next_player_label').innerHTML = dojo.string.substitute( __('lang_mainsite',"1 table is waiting for you"), {nbr: this.number_of_tb_table_its_your_turn} );
                        }
                        else if( this.number_of_tb_table_its_your_turn > 0 )
                        {
                            $('go_to_next_player_label').innerHTML = dojo.string.substitute( __('lang_mainsite',"${nbr} tables are waiting for you"), {nbr: this.number_of_tb_table_its_your_turn} );
                        }
                        else
                        {
                            // No more tables are waiting for you: display only an arrow
                            $('go_to_next_player_label').innerHTML = __('lang_mainsite',"Get back to tables list");
                        }
                    }
                    else
                    {
                        // We don't know => default display
                        $('go_to_next_player_label').innerHTML = __('lang_mainsite',"Go to next table");
                    }

                    // If the player did not write any turn based note yet, propose him to.
                    if( dojo.hasClass( 'ingame_menu_notes', 'icon32_notes' ) )
                    {
                        if( typeof this.turnBasedNotesPopupIncent == 'undefined' &&  !dojo.hasClass( 'ebd-body', 'mobile_version' )  ) // Note : we disabled this tooltip on mobile because it is too heavy and its position is strange.
                        {
                            var html = '<div id="turnBasedNotesPopupIncentContent">'+__('lang_mainsite','You may note something for the next time...')+'</div>';
                            var anchor = 'ingame_menu_notes_wrap';
                            dojo.style( 'ingame_menu_notes_wrap', 'display', 'block' );

                            this.turnBasedNotesPopupIncent = new dijit.TooltipDialog({
                                id: 'turnBasedNotesIncent',
                                content: html,
                                closable: true
                            });

                            dijit.popup.open({
                                popup: this.turnBasedNotesPopupIncent,
                                around: anchor,
                                orient: [ "below", "below-alt", "above", "above-alt" ]
                            });

                            dojo.connect( $('turnBasedNotesPopupIncentContent'), 'onclick', function() {
                                dijit.popup.close( this.turnBasedNotesPopupIncent );
                            } );

                            setTimeout( dojo.hitch( this, function() {
                                if( this.turnBasedNotesPopupIncent )
                                {
                                    dijit.popup.close( this.turnBasedNotesPopupIncent );
                                }
                            } ), 2500 );

                        }

                    }
                }
                else if( ! this.bRealtime && !this.isSpectator )
                {
                    dojo.style( 'gotonexttable_wrap', 'display', 'inline' );
                    dojo.style( 'go_to_next_table_inactive_player', 'display', 'none' );
                    dojo.style( 'go_to_next_table_active_player', 'display', 'inline' );
                }
            }
         },

         onUpdateActionButtons: function()
         {
            // To be override
            //
         },


         addActionButton: function( id, label, method, dest, bHighlight, color )
         {
            console.log( "Add action button "+label );

            if( typeof bHighlight == 'undefined' )
            {   bHighlight=false;   }

            if( typeof color == 'undefined' )
            {   color = 'blue';   }

            tpl = {};
            tpl.id=id;
            tpl.label=label;

            tpl.addclass = 'bgabutton ';
            if( color == 'gray' )
            {   tpl.addclass += 'bgabutton_gray';    }
            else if( color == 'red' )
            {   tpl.addclass += 'bgabutton_red';     }
            else if( color == 'none' )
            {   tpl.addclass = '';    }
            else
            {   tpl.addclass += 'bgabutton_blue';      }

            if( bHighlight )
            {
                tpl.addclass+=' blinking';
            }

            if (!dest) { dest = "generalactions"; }
            dojo.place( this.format_block( 'jstpl_action_button', tpl ), dest );
            dojo.connect( $( id ), 'onclick', this, method );
         },

         // Remove all action buttons
         removeActionButtons: function()
         {
            dojo.empty( 'generalactions' );
         },

        updateVisitors: function( visitors )
        {
            var output = '';
            var bFirst = true;

            this.last_visitorlist = visitors;

            for( var player_id in visitors )
            {
                var pname = visitors[ player_id ];

                // Filter this table players
                if( this.gamedatas.players[ player_id ] && this.gamedatas.gamestate.name != 'gameEnd' )
                {
                    // filter ...
                }
                else
                {
                    if( !bFirst )
                    {   output += ' '; }
                    else
                    {   bFirst = false; }
                    if( this.gamedatas.players[ player_id ] )
                    {
                        var player = '<span style="white-space: nowrap"><span id="visitor_player_'+player_id+'" class="visitor_player">'+pname+'</span></span>';
                    }
                    else
                    {
                        // Spectator
                        var player = '<span style="white-space: nowrap"><span id="visitor_player_'+player_id+'" class="visitor_player">'+pname+'</span> <a href="#" style="display:none" id="ban_spectator_'+player_id+'" class="ban_spectator"><i class="fa fa-times" aria-hidden="true"></i></a></span>';
                    }
                    output += player;
                }
            }

            if( !bFirst )
            {
               dojo.place( '<span>'+__('lang_mainsite','Spectators:')+' '+output+'</span>', 'spectatorlist', 'only' );
               dojo.style( $('spectatorbox'), 'display', 'block' );

               dojo.query( '.ban_spectator' ).connect( 'onclick', this, 'onBanSpectator' );
            }
            else
            {
                dojo.style( $('spectatorbox'), 'display', 'none' );
            }
        },

        onBanSpectator: function( evt )
        {
            dojo.stopEvent( evt );

            // ban_spectator_<id>
            var to_ban = evt.currentTarget.id.substr( 14 );

            if( to_ban == this.player_id )
            {
                return ;    // Cannot ban yourself
            }

            this.showMessage( __('lang_mainsite',"You can give this player a red thumb, so he won't be able to chat again at your table."), 'info' );

            // Create a fake "thumb" and use it
            var newThumb = new ebg.thumb();
            newThumb.create( this, 'ban_spectator_'+to_ban, to_ban, 0 );

            dojo.style( 'ban_spectator_'+to_ban, 'display', 'none' );

            newThumb.bForceThumbDown=true;
            newThumb.onGiveThumbDown( evt );

        },

        switchToGameResults: function()
        {
            // Is there some dialog visible right now?
            // Note : if there is some visible dialog, we don't display game results to allow player to see this dialog along with the game end
            countVisibleDialog = 0;
            dojo.query( '.dijitDialog' ).forEach( function(node) {
                if( dojo.style( node, 'display' ) != 'none' )
                {
                    // This dialog is visible!
                    countVisibleDialog ++;
                }
            } );
            dojo.query( '.standard_popin' ).forEach( function(node) {
                if( dojo.style( node, 'display' ) != 'none' )
                {
                    // This dialog is visible!
                    countVisibleDialog ++;
                }
            } );

            // Do not display gameresult before the real end of game
            var current_timestamp = Math.floor(Date.now() / 1000);
            var do_not_display_before = current_timestamp - 1000;

            var bEndOfGameHasBeenDisplayed = false;
            if( typeof this.end_of_game_timestamp != 'undefined' )
            {
                bEndOfGameHasBeenDisplayed = true;
                do_not_display_before = this.end_of_game_timestamp + 3; // We do not display end of game before "end of game + 3 seconds", to avoid a "jump"
            }

            if( countVisibleDialog == 0 && bEndOfGameHasBeenDisplayed && current_timestamp >= do_not_display_before )
            {
                this.pageheader.showSectionFromButton( 'pageheader_gameresult' );

                if( dojo.hasClass( 'ebd-body', 'arena_mode') )
                {
                    // Do not animate ELO in case of Arena mode
                }
                else
                {
                    this.eloEndOfGameAnimation();
                }

                // Trophies
                var result = this.tableresults_datas;

                var bMustCheckSplashNotifs = false;
                var this_player_trophies = {};
                if( dojo.hasClass( 'ebd-body', 'arena_mode') )
                {
                    bMustCheckSplashNotifs = true;  // In arena mode, there is almost always a splash notif for the Arena points
                }
                else if( typeof result.result.trophies != 'undefined' && typeof result.result.trophies[ this.player_id ] != 'undefined')
                {
                    if( typeof result.result.trophies[ this.player_id ] != 'undefined' )
                    {
                        // There are some trophies associated to this player
                        bMustCheckSplashNotifs = true;
                    }
                }

                if( bMustCheckSplashNotifs )
                {
                    if( typeof result.result.trophies != 'undefined' && typeof result.result.trophies[ this.player_id ] != 'undefined')
                    {
                        if( typeof result.result.trophies[ this.player_id ] != 'undefined' )
                        {
                            this_player_trophies = result.result.trophies[ this.player_id ];
                        }
                    }

                    setTimeout( dojo.hitch( this, function() {
                        this.loadTrophyToSplash( this_player_trophies );
                    } ), 2000 );

                }

                if( this.gameeval )
                {
                    // Player must evaluate the game adaptation quality
                    this.showGameRatingDialog();
                }

            }
            else
            {
                setTimeout( dojo.hitch( this, function(){
                    this.switchToGameResults();
                } ), 1000 );
            }
        },

        eloEndOfGameAnimation: function()
        {
            this.eloEndOfGameAnimationDatas = {};
            var bAtLeastOne = false;

            dojo.query( '#pagesection_gameresult .newrank .gamerank_value' ).forEach( dojo.hitch( this, function( node ){

                var new_rank = node.innerHTML;

                if( new_rank != '' )
                {
                    // Which player? newrank_<player_id>
                    var player_id = node.parentNode.parentNode.id.substr(8);

                    // Current ELO
                    if( $('player_elo_'+player_id) )
                    {
                        var current_elo = $('player_elo_'+player_id).innerHTML;

                        this.eloEndOfGameAnimationDatas[ player_id ] = {
                            player_id: player_id,
                            from: toint( current_elo ),
                            to: toint( new_rank ),
                            current: toint( current_elo )
                        };

                        bAtLeastOne = true;
                    }
                }

            } ) );

            if( bAtLeastOne )
            {
                this.eloEndOfGameAnimationFrameCurrentDuration = 0;
                this.eloEndOfGameAnimationWorker();

                playSound( 'elochange' );
            }

        },

        eloEndOfGameAnimationWorker: function()
        {
            var animation_total_duration = 1000;
            var animation_frame_duration = 50;


            for( var player_id in this.eloEndOfGameAnimationDatas )
            {
                var datas = this.eloEndOfGameAnimationDatas[ player_id ];

                var new_value = Math.round( datas.from + (   ( this.eloEndOfGameAnimationFrameCurrentDuration / animation_total_duration ) * ( datas.to - datas.from ) ) );

                if( new_value != datas.current )
                {
                    if( new_value > datas.current && player_id == this.player_id )
                    {
                        // Animation to gain ELO
                        var html = '<div style="z-index:10000" class="icon20 icon20_rankwb"></div>';
                        var anim = this.slideTemporaryObject( html, 'page-content', 'winpoints_value_'+player_id, 'player_elo_'+player_id, 1000 );

                        var this_new_value = new_value;

                        dojo.connect( anim, 'onEnd', dojo.hitch( this, function() {

                            $('player_elo_'+this.player_id).innerHTML = this_new_value;

                            var color = this.getColorFromElo( this_new_value + 1300 );
                            dojo.style( $('player_elo_'+this.player_id).parentNode, 'backgroundColor', color );

                            var item_to_bump = dojo.query( '#player_board_'+this.player_id+' .gamerank');
                            dojo.removeClass( item_to_bump[0], 'rankbounce' );
                            item_to_bump[0].offsetWidth;  // Trick: see https://css-tricks.com/restart-css-animation/
                            dojo.addClass( item_to_bump[0], 'rankbounce' );

                        } ) );
                    }
                    else if( new_value < datas.current && player_id == this.player_id )
                    {
                        // Animation to lose ELO
                        var html = '<div style="z-index:10000" class="icon20 icon20_rankwb"></div>';
                        var anim = this.slideTemporaryObject( html, 'page-content', 'player_elo_'+player_id, 'winpoints_value_'+player_id, 1000 );

                        var this_new_value = new_value;

                        $('player_elo_'+this.player_id).innerHTML = this_new_value;

                        var color = this.getColorFromElo( this_new_value + 1300 );
                        dojo.style( $('player_elo_'+this.player_id).parentNode, 'backgroundColor', color );

                        var item_to_bump = dojo.query( '#player_board_'+this.player_id+' .gamerank');
                        dojo.removeClass( item_to_bump[0], 'rankbounce' );
                        item_to_bump[0].offsetWidth; // Trick: see https://css-tricks.com/restart-css-animation/
                        dojo.addClass( item_to_bump[0], 'rankbounce' );
                    }
                    else
                    {
                        // Immediate set

                        $('player_elo_'+player_id).innerHTML = new_value;

                        var color = this.getColorFromElo( new_value + 1300 );
                        dojo.style( $('player_elo_'+player_id).parentNode, 'backgroundColor', color );
                    }

                    this.eloEndOfGameAnimationDatas[ player_id ].current = new_value;
                }
            }

            if( this.eloEndOfGameAnimationFrameCurrentDuration >= animation_total_duration )
            {
                // End of the animation
            }
            else
            {
                this.eloEndOfGameAnimationFrameCurrentDuration += animation_frame_duration;
                setTimeout( dojo.hitch( this, 'eloEndOfGameAnimationWorker' ), animation_frame_duration );
            }

        },

		updateResultPage: function()
		{
            // Get scores infos from metasite
            this.ajaxcall( "/table/table/tableinfos.html", { id:this.table_id,nosuggest:true }, this, function( result ){
                console.log( '-------------------------------------------' );
                console.log( result );

                if( result.status != 'finished' && result.status != 'archive' )
                {
                    // Game has not been processed by MS yet
                }
                else
                {
                    this.tableresults = new ebg.tableresults();
                    this.tableresults.create( this, 'game_result_panel','statistics_content', result, this.pma );
                    this.tableresults_datas = result;

                    // Hide statistics if not relevant
                    dojo.style( 'statistics', 'display', 'none' );

                    if( result.result.endgame_reason === 'normal_end'
                          || result.result.endgame_reason === 'normal_concede_end'
                          || result.result.endgame_reason === 'neutralized_after_skipturn'
                          || result.result.endgame_reason === 'neutralized_after_skipturn_error' )
                    {
                        dojo.style( 'statistics', 'display', 'block' );
                    }


                    // Facebook widgets
                    if( typeof FB != 'undefined' && typeof FB.XFBML != 'undefined' )
                    {
                        this.onFBReady();
                    } else {
                        // Subscribe to the dojo topic 'Facebook ready'
                        dojo.subscribe("FBReady", this, "onFBReady" );
                    }
                }
            } );

            // Finally, switched to results page
            this.switchToGameResults();
        },

        // Load trophy to splash from Metasite and display them
        // this_table_trophies: list of trophies associated to this player at this table. This is useful as the ajaxcall to MS we are using
        // is going to return ALL possible trophies to report, and we only want to display those associated to this table.
        loadTrophyToSplash: function( this_table_trophies )
        {
            var trophies_from_this_table = {};
            for( var i in this_table_trophies )
            {
                trophies_from_this_table[ this_table_trophies[i].id ] = true;
            }

            this.ajaxcall( "/playernotif/playernotif/getNotificationsToBeSplashDisplayed.html", {  }, this, function( result ){

                console.log( "Here is the list of trophies to be displayed:");
                console.log( result );

                var filtered_trophy = [];

                // First display arena points awarding
                for( var i in result )
                {
                    if( result[i].news_type == 28 ) // Arena points to get
                    {
                        filtered_trophy.push( result[i] );
                    }
                }

                // Then display trophies
                for( var i in result )
                {
                    if( typeof trophies_from_this_table[ result[i].jargs.award_id_id ] != 'undefined' )
                    {
                        filtered_trophy.push( result[i] );
                    }
                }

                console.log( 'filtered:');
                console.log( filtered_trophy);

                this.showSplashedPlayerNotifications( filtered_trophy );

            } );
        },


         displayScores: function()
         {
            console.log( 'Display scores' );

            // Show game view menu
            dojo.style( 'maingameview_menuheader', 'display', 'block' );

                    // Switch to "game result" after 3 sec

//                    setTimeout( dojo.hitch( this, function(){
//                        this.switchToGameResults();
//                    } ), 3000 );


            var scores = this.gamedatas.gamestate.args.result;
            console.log( scores );

            var resultAnalysis = this.buildScoreDlgHtmlContent( scores );

            if( resultAnalysis.title !== null )
            {
                $('pagemaintitletext').innerHTML +=' : '+resultAnalysis.title;
                $('game_result_label').innerHTML = ' : '+resultAnalysis.title;
            }
            else
            {
                $('pagemaintitletext').innerHTML +=' : '+dojo.string.substitute( __('lang_mainsite', '${winner} wins'), { winner: scores[0].name } );
                $('game_result_label').innerHTML = ' : '+dojo.string.substitute( __('lang_mainsite', '${winner} wins'), { winner: scores[0].name } );
            }

            if( typeof this.bGameEndJustHappened != 'undefined' && this.bGameEndJustHappened )
            {
                if( g_archive_mode )
                {
                    // Do not play any mode
                }
                else
                {
                    if( resultAnalysis.result_for_current_player == 'victory' )
                    {
                        playSound( 'victory' );
                    }
                    else if( resultAnalysis.result_for_current_player == 'lose' )
                    {
                        playSound( 'lose' );
                    }
                    else
                    {
                        playSound( 'tie' );
                    }
                }

            }

            var url = this.metasiteurl + '/gamereview?table='+this.table_id;
            this.notifqueue.addToLog( '<p style="text-align:center;"><a href="'+url+'" class="bgabutton bgabutton_gray replay_last_move_button"><span class="textalign"><span class="icon32 icon32_replaylastmoves textalign_inner"></span></span> '+__('lang_mainsite', 'Replay game' )+'</a></p>', false, false );
         },

         buildScoreDlgHtmlContent:function( scores )
         {
            console.log( scores );

            var html = '';
            var previous_score = null;
            var tied_scores = [];
            var index=0;
            var bFirstPlayerAreTie = false;
            var bAtLeastOnePositiveScore = false;
            var title = null;

            // Has this game been abandonned?
            var bGameHasBeenAbandonned = true;
            var bGameHasBeenTournamentTimeout = true;
            var bGameHasBeenSandboxDisagreement = true;
            var bGameHasBeenAbandonnedArenaSeasonEnd = true;
            for( var i in scores )
            {
                var score = scores[ i ];
                if( toint( score.score ) != 0 || toint( score.score_aux ) != -4242 )
                {   bGameHasBeenAbandonned = false;  }   // Note: game has been marked as "abandonned" if ALL players has score=0 and score_aux=-4242

                if( toint( score.score_aux ) != -4243 )
                {   bGameHasBeenTournamentTimeout = false;  }

                if( toint( score.score_aux ) != -4244 )
                {   bGameHasBeenSandboxDisagreement = false;  }

                if( toint( score.score_aux ) != -4245 )
                {   bGameHasBeenAbandonnedArenaSeasonEnd = false;  }
            }

            var current_player_rank = null;
            var last_player_rank = null;

            for( var i in scores )
            {
                var score = scores[ i ];

                // Transform rank into something readable

                rank = toint( score.rank );
                var rankstr = this.getRankString( rank );

                var score_entry = 'jstpl_score_entry';
                if( typeof( jstpl_score_entry_specific ) != 'undefined' )
                {    score_entry = 'jstpl_score_entry_specific';    }

                var color_back = '';
                if( score.color_back )
                { color_back = "background-color: #" + score.color_back + ";"; }

                if( previous_score !== null && previous_score==score.score && score.score_aux!==null )
                {
                    tied_scores.push( score.score );

                    if( rank == 1 )
                    {   bFirstPlayerAreTie=true;    }
                }
                previous_score = score.score;

                if( score.player == this.player_id )
                {
                    current_player_rank = rank;
                }
                last_player_rank = rank;

                if( ! bGameHasBeenAbandonned )
                {
                    if( typeof score.player == 'undefined' )
                    {   score.player=0; }

                    html += this.format_block( score_entry, { rank: rankstr,
                        name:score.name,
                        color:score.color,
                        color_back:color_back,
                        score:score.score,
                        score_aux:score.score_aux,
                        index: index ,
                        id: score.player
                    } );
                }

                if( toint( score.score ) > 0 )
                {   bAtLeastOnePositiveScore=true;  }

                index++;
            }
            html += "<br class='clear' /><br/>";
            html += "<div style='text-align: center'>";

            var result_for_current_player = 'neutral';

            // If current player is #1 and there is at least one player not #1
            if( current_player_rank !== null && current_player_rank==1 && last_player_rank > 1 )
            {   result_for_current_player = 'victory';  }

            // If current player is #last and not #1
            if( current_player_rank !== null && current_player_rank==last_player_rank && last_player_rank > 1 )
            {   result_for_current_player = 'lose';  }


            if( bFirstPlayerAreTie )
            {   title = __('lang_mainsite','End of game (tie)');    }

            if( this.losers_not_ranked )
            {
                // In this case, the best things to display is player own situation (victory or defeat)
                if( this.isSpectator )
                {
                    title = __('lang_mainsite','End of game');
                }
                else if( result_for_current_player == 'victory')
                {
                    title = __('lang_mainsite','End of game (victory)');
                }
                else if( result_for_current_player == 'neutral' && bFirstPlayerAreTie ) // Tie is displayed only if tied for the first place, otherwise it's just a defeat
                {
                    title = __('lang_mainsite','End of game (tie)');
                }
                else
                {
                    title = __('lang_mainsite','End of game (defeat)');
                }
            }

            if( bGameHasBeenAbandonned )
            {   title = __('lang_mainsite','End of game (abandon)');    }

            if( bGameHasBeenTournamentTimeout )
            {   title = __('lang_mainsite','End of game (tournament maximum time reached)');    }

            if( bGameHasBeenSandboxDisagreement )
            {   title = __('lang_mainsite','End of game (players disagree on the game results)');    }

            if( bGameHasBeenAbandonnedArenaSeasonEnd )
            {   title = __('lang_mainsite','End of game (Arena season has ended)');    }

            if( this.is_coop || this.is_solo )
            {
                if( this.isSpectator )
                {
                    title = __('lang_mainsite','End of game');
                }
                else if( bAtLeastOnePositiveScore )
                {
                    title = __('lang_mainsite','End of game (victory)');
                    result_for_current_player = 'victory';
                }
                else
                {
                    title = __('lang_mainsite','End of game (defeat)');
                    result_for_current_player = 'lose';
                }
            }


            if( dojo.style( 'neutralized_game_panel','display' ) == 'block' || this.gamedatas.game_result_neutralized > 0 )
            {
                html += $('neutralized_explanation').innerHTML;
                title = __('lang_mainsite','End of game (game results neutralized)');
                this.tiebreaker = '';   // .. and do not display tie breaker
            }

            if( tied_scores.length > 0 && this.tiebreaker!='' && !bGameHasBeenAbandonned )
            {
                html += "<div class='smalltext'>(<i class='fa fa-star tiebreaker'></i>: "+ __('lang_mainsite',"Tie breaker")+': '+ _( this.tiebreaker )+")</div><br/>";
            }

            if( bGameHasBeenTournamentTimeout )
            {
                html += "<div>("+__('lang_mainsite', "Game has been abandonned automatically because players did not managed to finish it before the next round of the tournament. The player with the most remaining reflexion time wins the game.")+")</div><br/>";
            }

            if( bGameHasBeenSandboxDisagreement )
            {
                html += "<div>("+__('lang_mainsite', "Game has been abandonned automatically because players did not managed to agree on a game result.")+")</div><br/>";
            }

            if( ! bGameHasBeenAbandonned )
            {
                html += '<div class="fb-share-button" data-href="https://boardgamearena.com/table?table='+this.table_id+'table?table='+this.table_id+'" data-layout="button" data-size="large"></div>';
            }

            return {
                html :  html,
                title : title,
                result_for_current_player: result_for_current_player,
                tied_scores:tied_scores
            };
         },


         onFBReady: function()
         {
            dojo.query( '.publishresult' ).style( 'display', 'inline-block' );

            // Render XFBML
         //   FB.XFBML.parse(); // > only do it when the gameresults are shown, otherwise FB button may not be visible see https://stackoverflow.com/questions/12291017/facebook-like-buttons-not-displaying-when-loaded-hidden

            // Manage translations
            dojo.forEach(
                dojo.query('.fb_button_text'),
                function(selectTag) {
                    selectTag.innerHTML = __('lang_mainsite','Publish on my Facebook profile');
                }
            );
         },

         onShowGameResults: function()
         {
            // Render XFBML
            //FB.XFBML.parse();
            //Now do it only when clicking on Share button
         },

         // Entering game state "game end"
         onGameEnd: function()
         {
            this.displayScores();

           // this.addActionButton( "displayScores_btn", __('lang_mainsite', 'Show scores' ), "displayScores" );
            $('pagemaintitletext').innerHTML+='<br/>';
            this.addActionButton( "backMetasite_btn", __('lang_mainsite', 'Return to main site'), "onBackToMetasite" );
            this.addActionButton( "createNew_btn", __('lang_mainsite', 'Play again'), "onCreateNewTable" );
            if( !this.isSpectator )
            {
                this.addActionButton( "revenge_btn", __('lang_mainsite', 'Propose a rematch'), "onProposeRematch" );
            }

            if( this.blinkid != '' )
            {
           //     this.addActionButton( "buygame_btn", this.blinkdomain, "onBuyThisGame" );
            }

            if( dojo.hasClass( 'archivecontrol', 'demomode') )
            {
                // In few seconds, refresh the top page with a new game
                setTimeout( dojo.hitch( this, function(){
                    parent.location.reload();
                } ), 1000 );
            }
            else if( dojo.hasClass( 'archivecontrol', 'loop' ) )
            {
                // In few seconds, refresh page to restart the same game
                setTimeout( dojo.hitch( this, function(){
                    window.location.reload();
                } ), 1000 );
            }

            if( this.quickGameEndUrl != '' )
            {
                // Redirect automatically to this URL
                setTimeout( dojo.hitch( this, function(){
                    document.location.href = this.quickGameEndUrl+'?table='+this.table_id;
                } ), 1000 );
            }

            this.updateVisitors( this.last_visitorlist );  // Update visitors to show remaining players at table after game end
         },

         prepareMediaRatingParams: function( )
         {
            this.mediaRatingParams = '';
             
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled ) {
                if (this.mediaChatRating && this.rtc_mode != 0 && this.room !== null) {
                    this.mediaRatingParams = 'media_rating=' + (this.rtc_mode == 2 ? 'video' : 'audio') + '&room=' + this.room;
                }
			}
         },

         getMediaRatingParams: function( isFirstParam )
         {
            if (typeof isFirstParam == 'undefined') {
                 isFirstParam = false;
            }
             
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled ) {
                if (this.mediaChatRating && this.mediaRatingParams != '') {
                    return (isFirstParam ? '?' + this.mediaRatingParams : '&' + this.mediaRatingParams);
                }
			}
            
            return '';
         },

         redirectToTablePage: function() {
            document.location.href = this.metasiteurl+"/table?table="+this.table_id+this.getMediaRatingParams( false );
         },

         redirectToTournamentPage: function() {
            document.location.href = this.metasiteurl+"/tournament?id="+this.tournament_id+this.getMediaRatingParams( false );
         },

         redirectToLobby: function() {
            document.location.href = this.metasiteurl+"/"+this.mslobby+this.getMediaRatingParams( true );
         },

         redirectToMainsite: function() {
            document.location.href = this.metasiteurl+'/'+this.getMediaRatingParams( true );
         },

         redirectToGamePage: function() {
            document.location.href = this.metasiteurl+"/gamepanel?game="+this.game_name+this.getMediaRatingParams( false );
         },

         doRedirectToMetasite: function() {
            let lobbyType = localStorage.getItem( 'bga-lobby-type' );
            if ( lobbyType === 'new' ) {
                // If player last used new lobby, redirect to game page
                this.redirectToGamePage();
            }
            else if( !this.quickGameEnd )
            {
                if( this.tournament_id != null )
                {
                    this.redirectToTournamentPage();
                }
                else
                {
                    this.redirectToLobby();
                }
            }
            else
            {
                if( this.quickGameEndUrl != '' )
                {
                    this.redirectToTablePage();
                }
                else
                {
                    this.redirectToMainsite();
                }
            }
         },

         onBackToMetasite: function()
         {
			// Leave live chat room
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null) {
                this.prepareMediaRatingParams();
                this.doLeaveRoom( dojo.hitch(this, this.doRedirectToMetasite) );
			} else {
                this.doRedirectToMetasite();
            }
         },

         onCreateNewTable: function()
         {
			// Leave live chat room
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                this.prepareMediaRatingParams();
                this.doLeaveRoom(); // Ok not to have a callback as there is one behind, so this will correctly execute without being blocked by the browser because of a redirection too quickly after
			}

            document.location.href = this.metasiteurl + "/gamepanel?game=" + this.game_name
         },

         onProposeRematch: function()
         {
            // Leave live chat room
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                this.prepareMediaRatingParams();
                this.doLeaveRoom();  // Ok not to have a callback as there is one behind, so this will correctly execute without being blocked by the browser because of a redirection too quickly after
			}

            this.ajaxcall(  "/table/table/createnew.html", {game: this.game_id, rematch: this.table_id,src:'R'}, this, function( result )
            {
                console.log( "Table created: #"+result.table );
                var table_id = result.table;

                // Redirect to new table
                // Note : we "acceptinvit' because if we are redirected to a rematch table already created by another player, we must accept immediately
                document.location.href = this.metasiteurl+"/table?table="+table_id+'&acceptinvit'+this.getMediaRatingParams( false );
            });
         },

         onBuyThisGame: function()
         {
            document.location.href = this.blinkid;
         },

        ///////////////////////////////////////////////////
        //// Ajaxcall for games

        ajaxcall: function( )
        {
            var url = arguments[0];
            var game_action = '/'+this.game_name+'/'+this.game_name+'/';

            // We must check the url
            if( g_archive_mode )
            {
                var params = arguments[1];
                var obj_callback = arguments[2];
                var callback = arguments[3];
                var callback_anycase = arguments[4];
                if( url.indexOf( game_action ) == 0 )
                {
                    var action = url.substr( game_action.length );
                    action = action.replace( '.html', '' );
                    delete params.lock;
                    params['__action__'] = action;
                    params['__move_id__'] = toint( $('move_nbr').innerHTML )+1;
                    params['__player_id__'] = this.player_id;
                    params['table'] = this.table_id;

                    // Let's find the hash of the next action.
                    params['h'] = g_gamelogs[ this.next_archive_index ].data[0].h;  // Note: this is the default if we couldn't find it in the queue below

                    // For that we are looking in the queue
                    if( this.notifqueue.queue.length > 0 )
                    {
                        for( var i in this.notifqueue.queue )
                        {
                            if( typeof this.notifqueue.queue[i].h != 'undefined' )
                            {
                                // Found!
                                params['h'] = this.notifqueue.queue[i].h;
                                break;
                            }
                        }
                    }

                    if( g_tutorialwritten.mode == 'view' )
                    {
                        if( $('do_action_to_continue') )
                        {
                            // Okay, we must do this action
                        }
                        else
                        {
                            // We are in tutorial mode, with a "continue" button, but the player is trying to play ! No way!
                            this.showMessage( __('lang_mainsite','You must use Continue button to continue the tutorial'), 'error');
                            return ;
                        }
                    }

                    // 1 player action = 1 move = a series of notifications
                    // So if the next notif has the same move id than the previous one, we are in the middle of a move with multiple notifications
                    // In that case we should display an explicit error so that the player knows they need to use the next move button instead of trying to play with the game interface (as it can't work)
                    var next_notif_move = null;
                    if( this.notifqueue.queue.length > 0 && typeof this.notifqueue.queue[0].move_id != 'undefined' )
                    {
                        next_notif_move = toint( this.notifqueue.queue[0].move_id );
                    }
                    if (params['__move_id__'] === next_notif_move)
                    {
                        this.showMessage( __('lang_mainsite','You are in the middle of reviewing a move, so you cannot play: use the "Next move" button to go to the end of this move'), 'error' );
                        return;
                    }
                    
                    return ebg.core.sitecore.prototype.ajaxcall.call(this, '/table/table/checkNextMove.html', params, this, function(result) {
                        if( result == 'ok' )
                        {
                            // Note : we must JUMP to comment on NEXT MOVE because we have to MOVE the interface
                            //        so the player can see the result of his action. There should be NO comments after this one for the same move, otherwise it will be skipped!
                            this.archive_playmode = 'nextcomment';
                            dojo.style( 'archiveCommentMinimizedIcon', 'display', 'none' );
                            this.doNewArchiveCommentNext();
                        }
                    },
                    function( result )
                    {
                        // This is the "callback anycase"
                        // (so we should call it, anycase)
                        if( (typeof callback_anycase != 'undefined') )
                        {    
                            dojo.hitch(  obj_callback, callback_anycase )( true, result, 0 );           
                        }

                    }, 'post');
                }
            }
            else
            {
                // All URLs on the GS must be RELATIVE so it keeps the original GS ID in URL path (ex: https://boardgamearena.com/3/....)
                // (during the real game, not during archive replay)
                if( url.charAt(0) == '/' )
                {
                    var game_ajaxcall_prefix = "/"+this.game_name+"/"+this.game_name;

                    if( url.substr(0,game_ajaxcall_prefix.length) == game_ajaxcall_prefix )
                    {
                        // Should be relative URL
                        arguments[0] = url.substr( 1 );
                    }
                    else
                    {
                        // Not related to current game => should it the MS
                    }
                }

            }

            // Otherwise, Call parent method (no change)
            arguments[1].table = this.table_id; // table argument is mandatory now
            arguments[1].noerrortracking = true; // we don't track in-game errors for site analytics

            if( this.forceTestUser !== null )
            {
                arguments[1].testuser = this.forceTestUser;
            }

            // If we should play to another table, write it
            if( dojo.hasClass( 'ebd-body','arena_cannot_play') )
            {
                if( url.indexOf( game_action ) == 0 )
                {                
                    var params = arguments[1];
                    console.error( params );
                    if( params.lock ) // <= this is a game action
                    {
                        this.showMessage( _("You must play first on another table"), 'error' );
                        return ;
                    }
                }
            }

            return this.inherited( arguments );
        },



        onGlobalActionPause: function(evt)
        {
            console.log( 'onGlobalActionPause' );
            evt.preventDefault();

        },
        onGlobalActionFullscreen: function( evt )
        {
            console.log( 'onGlobalActionFullscreen' );

            dojo.stopEvent( evt );

            // Use Fullscreen API
            var body = document.documentElement;

            if(body.requestFullScreen) {
                    // Official w3c method
                    body.requestFullScreen();
            } else if(body.webkitRequestFullScreen) {
                    // Chrome method
                    body.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            } else if(body.mozRequestFullScreen){
                    // Firefox method
                    body.mozRequestFullScreen();
            } else {
                // No fullscreen support => open a new window, fullscreen
                window.open("/"+this.gameserver+'/'+this.game_name+"?table="+this.table_id, "", "fullscreen=yes,scrollbars=yes" );
            }
            return false;
        },
        switchLogModeTo: function( mode )
        {
            console.log( 'switchLogModeTo' );
            if( mode != 0 && this.log_mode != '2cols' ) // Normal
            {
                this.log_mode = '2cols';
                dojo.addClass( 'ebd-body', 'logs_on_additional_column' );
                this.onGameUiWidthChange();
            }
            else if( mode == 0 && this.log_mode != 'normal' )
            {
                this.log_mode = 'normal';

                dojo.removeClass( 'ebd-body', 'logs_on_additional_column' );
                this.onGameUiWidthChange();
            }

        },
        onGlobalActionPreferences: function()
        {
            console.log( 'onGlobalActionPreferences' );
        },
        onGlobalActionHelp: function()
        {
            console.log( 'onGlobalActionHelp' );

        },
        onGlobalActionBack: function(evt)
        {
            console.log( 'onGlobalActionBack' );
            evt.preventDefault();

            // Redirect directly to /table?id=<table_id>
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                this.prepareMediaRatingParams();
                this.doLeaveRoom( dojo.hitch(this, function() { this.redirectToTablePage(); } ) );
            } else {
                this.redirectToTablePage();
            }
        },
        onGlobalActionQuit: function(evt)
        {
            console.log( 'onGlobalActionQuit' );
            evt.preventDefault();

            // Redirect directly to /table?id=<table_id> if game has ended (or in archive mode)
            if( this.gamedatas.gamestate.name == 'gameEnd' || g_archive_mode || this.isSpectator )
            {
                if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                    this.prepareMediaRatingParams();
					this.doLeaveRoom( dojo.hitch(this, function() { this.redirectToTablePage(); } ) );
				} else {
                    this.redirectToTablePage();
                }
            }
            else
            {
                this.leaveTable( this.table_id, dojo.hitch( this, function(){
                    if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                        this.prepareMediaRatingParams();
                        this.doLeaveRoom( dojo.hitch(this, function() { this.redirectToTablePage(); } ) );
                    } else {
                        this.redirectToTablePage();
                    }
                }));


        /*        // Has someone already left the game ?
                var bIsAZombie = false;
                for( var player_id in this.gamedatas.players )
                {
                    if( this.gamedatas.players[ player_id ].zombie == 1 )
                    {
                        bIsAZombie = true;
                    }
                }



                this.quitDlg = new ebg.popindialog();
                this.quitDlg.create( 'quitConfirmContent' );
                this.quitDlg.setTitle( __('lang_mainsite',"Quit game in progress") );


                var html = '<div id="quitConfirmContent">';

                html += __('lang_mainsite',"You are about to quit a game in progress.")+"<br/><br/>";

                if( ! bIsAZombie )
                {
                    html += __('lang_mainsite',"This will cost you some <img src='theme/img/common/rank.png' class='imgtext'/> for this game, and 1 <div class='icon20 icon20_penaltyleave'></div> for your reputation.<br/><br/>");
                    html += __('lang_mainsite',"Note: If you are forced to quit the game because some opponent is not playing, you should fire him from the game instead of quit the game.")+"<br/><br/>";
                }

                html += "<p><a id='quitgame_confirm' class='bgabutton bgabutton_blue' href='#'>"+__('lang_mainsite',"Quit game anyway")+"</a></p>";
                html += "<p><a id='quitgame_cancel' class='bgabutton bgabutton_blue' href='#'>"+__('lang_mainsite',"Cancel")+"</a></p>";

                if( dojo.query( '.expressswitch').length > 0 )
                {
                    // Express stop is allowed
                    html += "<hr/><p>>> <a id='express_game_stop' href='#' class='bgabutton bgabutton_blue'>Express game stop</a> <<</p>";
                }


                html += "</div>";

                this.quitDlg.setContent( html );
                this.quitDlg.show();

                dojo.connect( $('quitgame_confirm'), 'onclick',
                        dojo.hitch( this, function( evt ) {
                                this.quitDlg.destroy();

                                this.ajaxcall( "/table/table/quitgame.html?src=dlg", {table: this.table_id,s:'gamui_quitdlg'}, this, function( result ){
									if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled ) {
										this.doLeaveRoom();
									}
                                    window.location.href = this.metasiteurl+'/table?table='+this.table_id;
                                } );
                               } ) );


                dojo.connect( $('quitgame_cancel'), 'onclick',
                        dojo.hitch( this, function( evt ) {
                                evt.preventDefault();
                                this.quitDlg.destroy();
                               } ) );

                if( $('express_game_stop') )
                {
                    dojo.connect( $('express_game_stop'), 'onclick',
                            dojo.hitch( this, function( evt ) {
                                    evt.preventDefault();
                                    this.quitDlg.destroy();

                                    this.ajaxcall( "/table/table/expressGameStopTable.html",
                                     { table: this.table_id }, this, dojo.hitch( this, function( obj, result )   {
										if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled ) {
											this.doLeaveRoom();
										}
                                        window.location.href = this.metasiteurl+'/table?table='+this.table_id;
                                     } ) );
                                   } ) );
                }       */
            }
        },

        onNewLog: function( html, seemore )
        {
            // Can be override by some games
        },
        addMoveToLog: function( log_id, move_id )
        {
            // Create a tooltip "replay game from this point"
            this.addTooltip( 'log_'+log_id, '', __('lang_mainsite',"Replay game from this point") );
            dojo.addClass( 'log_'+log_id, 'log_replayable' );

            this.log_to_move_id[ log_id ] = move_id;

            dojo.connect( $('log_'+log_id), 'onclick', this, 'onReplayFromPoint' );
        },

        onChangeContentHeight: function()
        {
            console.log( "onChangeContentHeight" );
        },

        onReplayFromPoint: function( evt )
        {
            var target = evt.target || evt.srcElement;
            if( target.tagName == 'A' || target.tagName == 'a' )
            {
                // The user directly click on a link in the log : there is no replay here
                return ;
            }

            var log_id = evt.currentTarget.id.substr( 4 );

            // log_<log_id>

            if (dojo.hasClass('log_'+log_id, 'replay_move_added')) {
                // Already done!
                return;
            }

            var move_id = this.log_to_move_id[ log_id ];

            move_id = Math.max( 0, toint( move_id ) );

            var url = '/'+this.gameserver+'/'+this.game_name+'?table='+this.table_id+'&replayFrom='+move_id+(dojo.query( '.expressswitch').length > 0 ? '&testuser='+this.forceTestUser : '');
            dojo.place( '<p style="text-align:center;"><a href="'+url+'" class="bgabutton bgabutton_gray replay_last_move_button"><span class="textalign"><span class="icon32 icon32_replaylastmoves textalign_inner"></span></span> '+__('lang_mainsite', 'Replay from this move' )+'</a></p>', 'log_'+log_id );
            dojo.addClass('log_'+log_id, 'replay_move_added');

            //if( !this.bThisGameSupportFastReplay )
            {
                // No fast replay : replay with page reload
//                window.location.href = '/'+this.game_name+'?table='+this.table_id+'&replayFrom='+move_id;
            }

         /*   else
            {
                // Fast replay! Request a replay from this point ...
                this.ajaxcall( "/"+this.game_name+"/"+this.game_name+'/requestReplayFrom.html', { from: move_id }, this, function( obj, result )
                        {});
            }
*/
        },

        ///////////////////////////////////////////////////
        //// Table decisions


        // Update decision panel according to given status
        updateDecisionPanel: function( decision_status )
        {
            if( decision_status.decision_type == 'none' )
            {
                dojo.style( "table-decision", "display", "none" );
            }
            else
            {
                if( ( decision_status.decision_taken === true ) || ( decision_status.decision_taken == 'true' ) )
                {
                    dojo.style( "table-decision", "display", "none" );

                    if( decision_status.decision_type == 'abandon' )
                    {
                        // Decision has been taken to abandon/concede the game !
                        this.showMessage(
                            this.is_coop?
                                __('lang_mainsite', "The decision to CONCEDE this game has been taken by all players.")
                                : 
                                __('lang_mainsite', "The decision to ABANDON this game has been taken by all players"),
                            'info'
                        );
                        // this.notifqueue.addToLog( __('lang_mainsite',"The decision to ABANDON this game has been taken by all players.") ); // Note => now we are sending a notifyAllPlayers with this message instead

                        if( ! this.isSpectator )
                        {
                            if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] < 0 )
                            {
                                this.showMessage(
                                    this.is_coop?
                                        __('lang_mainsite', "You were OUT OF TIME, therefore you automatically accepted to concede this game.")
                                        : 
                                        __('lang_mainsite', "You were OUT OF TIME, therefore you automatically accepted to abandon this game."),
                                    'info'
                                );
                            }
                        }

                        // Leave real time chat room (if open)
                        // DEPRECIATED: now, a score dialog with "abandon" is displayed, with "view end game situation" / "leave game" options.
                  /*      if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled ) {
							this.doLeaveRoom();
						}
                        // => redirect to mainsite
                        if( !this.quickGameEnd )
                        {
                            setTimeout( dojo.hitch( this, function() {
                                window.location.href = this.metasiteurl+"/table?table="+this.table_id;
                            } ), 3000 );
                        }
                        else
                        {
                            setTimeout( dojo.hitch( this, function() {
                                window.location.href = this.metasiteurl+"/gamelobby";
                            } ), 3000 );
                        }*/
                    }
                }
                else if( ( decision_status.decision_refused === true ) || ( decision_status.decision_refused == 'true' ) )
                {
                    // Decision has been refused
                    dojo.style( "table-decision", "display", "none" );

                    this.notifqueue.addToLog( __('lang_mainsite',"Decision on table has been refused") );
                }
                else
                {
                    dojo.style( $("table-decision"), "display", "block" );

                    var i;
                    var player_id;

                    // Decision title
                    var title = '';
                    if( decision_status.decision_type == 'abandon' )
                    {
                        title =
                            this.is_coop?
                                __('lang_mainsite', "Would you like to concede this game? This effectively means losing the game (ELO points loss)")
                                : 
                                __('lang_mainsite', "Would you like to abandon this game (no points loss) ?");
                        
                    }
                    else if( decision_status.decision_type == 'switch_tb' )
                    {
                        title = __('lang_mainsite',"Would you like to transform this table in a Turn-based table ?");
                    }
                    $('decision-title').innerHTML = title;

                    // Player's decision
                    $('decision-players-0').innerHTML = '-';
                    $('decision-players-1').innerHTML = '-';
                    $('decision-players-undecided').innerHTML = '-';
                    for( player_id in decision_status.players )
                    {
                        var decision = decision_status.players[ player_id ];
                        var player_name = this.gamedatas.players[ player_id ].name;
                        var target_div = $('decision-players-'+decision);
                        if( target_div.innerHTML == '-' )
                        {
                            target_div.innerHTML = '<b>'+player_name+'</b>';
                        }
                        else
                        {
                            target_div.innerHTML += ', <b>'+player_name+'</b>';
                        }
                    }

                    if( !this.bRealtime )
                    {
                        // In turn based, display an additional warning otherwize players think this is not useful to continue to play (and opponents does not see the abandon panel)
                        target_div.innerHTML += '<br/><br/>'+'<b>'+__('lang_mainsite',"Important")+':</b> '+__('lang_mainsite',"Until all players agree you must continue to PLAY or you may get some penalties.");
                    }
                }
            }
        },

        onPlayerDecide: function( evt )
        {
            console.log( 'onPlayerDecide' );
            evt.preventDefault();

            var decision = 0;
            if( evt.currentTarget.id == 'decision_yes' )
            {   decision = 1;   }

            this.ajaxcall( "/table/table/decide.html",
                 { type:null, decision:decision, table:this.table_id }, this, function( obj, result )   {});

        },

        ///////////////////////////////////////////////////
        //// Reflexion time clock features

        // Do a full reset of all time display
        // Set all time values to corresponding this.gamedatas.gamestate
        // Start a new clock timer to update the display
        updateReflexionTimeDisplay: function()
        {
            console.log( "updateReflexionTimeDisplay" );

            if( g_archive_mode )
            {
                dojo.style( $('archivecontrol'), 'display', 'block' );

                if( dojo.hasClass( 'archivecontrol', 'demomode') )
                {
                    dojo.style( 'archivecontrol', 'display', 'none' );
                }

                return;
            }

            if( typeof g_replayFrom == 'undefined' )
            {
                for( var player_id in this.gamedatas.gamestate.reflexion.total )
                {
//                    this.gamedatas.gamestate.reflexion.total[ player_id ] --;
                    var ttt = this.formatReflexionTime( this.gamedatas.gamestate.reflexion.total[ player_id ] );
                    $('timeToThink_'+player_id).innerHTML = ttt.string;
                }
            }
            else
            {
                if( typeof this.updatedReflexionTime != 'undefined' )
                {
                    // We are in a replay
                    this.gamedatas.gamestate.reflexion = this.updatedReflexionTime;

                    for( var player_id in this.gamedatas.gamestate.reflexion.total )
                    {
                        var ttt = this.formatReflexionTime( this.gamedatas.gamestate.reflexion.total[ player_id ] );
                        $('timeToThink_'+player_id).innerHTML = ttt.string;
                    }
                }
            }

            // Display or not the remaining reflexion time
            if( this.isCurrentPlayerActive() || this.bTimerCommon )
            {
                // Display current player reflexion time
                if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] )
                {
                    dojo.style( $('inactiveplayerpanel'), 'display', 'none' );
                    dojo.style( $('wouldlikethink_button'), 'display', 'inline' );
                    dojo.style( $('not_playing_help'), 'display', 'none' );
                    dojo.style( $('ai_not_playing'), 'display', 'none' );
                    dojo.style( $('reflexiontime'), 'display', 'block' );
                    dojo.style( $('its_your_turn'), 'visibility', 'visible' );

                    var ttt = this.formatReflexionTime( this.gamedatas.gamestate.reflexion.total[ this.player_id ] );
                    $('reflexiontime_value').innerHTML = ttt.string;
                    this.currentPlayerReflexionStartAt = this.gamedatas.gamestate.reflexion.total[ this.player_id ];
                }

                if( this.bTimerCommon )
                {
                	if( ! this.isCurrentPlayerActive() )
                	{
	                    dojo.style( $('wouldlikethink_button'), 'display', 'none' );
	                    dojo.style( $('its_your_turn'), 'visibility', 'hidden' );
                	}
               	}
            }
            else
            {
                dojo.style( $('inactiveplayerpanel'), 'display', 'block' );
                dojo.style( $('wouldlikethink_button'), 'display', 'none' );
                dojo.style( $('ai_not_playing'), 'display', 'none' );
                dojo.style( $('not_playing_help'), 'display', 'none' );
                dojo.style( $('reflexiontime'), 'display', 'none' );
            }

            // Clear current timeout if any.
            if( this.clock_timeout )
            {
                clearTimeout( this.clock_timeout );
                this.clock_timeout = null;
            }

            this.updateReflexionTime( true );
        },



        // update reflexion time, each second
        updateReflexionTime: function( bFirstCall )
        {
            // Restart another one, 1sec later
            this.clock_timeout = setTimeout( dojo.hitch( this, 'updateReflexionTime' ), 1000 );

            // Decrease reflexion time of all active players
            var actPlayers = this.getActivePlayers();

            if( this.bTimerCommon )
            {
                // Take all players
                actPlayers = [];
                for( var i in this.gamedatas.players )
                {
                    actPlayers.push( i );
                }
            }

            var bAtLeastOneActiveIsAi = false;
            var bNight = false;
            for( var i in actPlayers )
            {
                var player_id = actPlayers[i];

                if( typeof this.gamedatas.gamestate.reflexion.total[ player_id ] == 'undefined' )
                {
                    console.error( "Try to active a player that is not around the table: "+player_id );
                }

                if( typeof bFirstCall != 'undefined' && bFirstCall )
                {
                    // Do not decrease on first call as we just instanciate the timer

                    // Instead of that, store the current number and the timestamp, so we can later compute the exact time to display

                    if( typeof this.gamedatas.gamestate.reflexion.initial == 'undefined' )
                    {
                        this.gamedatas.gamestate.reflexion.initial = {};
                        this.gamedatas.gamestate.reflexion.initial_ts = {};
                    }
                    this.gamedatas.gamestate.reflexion.initial[ player_id ] = this.gamedatas.gamestate.reflexion.total[ player_id ];
                    this.gamedatas.gamestate.reflexion.initial_ts[ player_id ] = new Date().getTime(); // Warning: timestamp in milliseconds here
                }
                else
                {
                    // We must decrease if we are on playing hours
                    var bDecrementCounter = true;

                    var now = new Date();

                    if( typeof this.playingHours != 'undefined' )
                    {
                        bDecrementCounter = this.playingHours[ now.getHours() ];
                    }

                    if( bDecrementCounter )
                    {
                        var time_since_initial = Math.floor( ( now.getTime() - this.gamedatas.gamestate.reflexion.initial_ts[ player_id ] ) / 1000 );
                        this.gamedatas.gamestate.reflexion.total[ player_id ] = this.gamedatas.gamestate.reflexion.initial[ player_id ] - time_since_initial;
                    }
                    else
                    {
                        bNight = true;
                    }
                }

                var ttt = this.formatReflexionTime( this.gamedatas.gamestate.reflexion.total[ player_id ] );

                if( typeof this.gamedatas.players[ player_id ].is_ai != 'undefined' && this.gamedatas.players[ player_id ].is_ai != 0 )
                {	bAtLeastOneActiveIsAi = true;	}

                if( ! $('timeToThink_'+player_id) )
                {
                    this.showMessage( 'Unknow active player: '+player_id, 'error' );
                }
                else
                {
                    if( bNight )
                    {
                        $('timeToThink_'+player_id).innerHTML = '<i class="fa fa-moon-o" aria-hidden="true"></i> '+ttt.string;
                    }
                    else
                    {
                        $('timeToThink_'+player_id).innerHTML = ttt.string;
                    }

                    if( ! ttt.positive )
                    {
                        dojo.style( $('timeToThink_'+player_id), 'color', 'red' );

                        if( this.bTimerCommon )
                        {
                            // When timer is common, do not display it below O (display 0 instead)
                            $('timeToThink_'+player_id).innerHTML = this.formatReflexionTime( 0 ).string;
                        }
                    }
                    else
                    {
                        dojo.style( $('timeToThink_'+player_id), 'color', 'inherit' );
                    }
                }
            }

            if( this.isCurrentPlayerActive() || this.bTimerCommon )
            {
                // Display current player reflexion time
                if( typeof this.gamedatas.gamestate.reflexion.total[ this.player_id ] != 'undefined' )
                {
                    var ttt = this.formatReflexionTime( this.gamedatas.gamestate.reflexion.total[ this.player_id ] );

                    if( bNight )
                    {
                        $('reflexiontime_value').innerHTML = '<div class="icon20 icon20_night this_is_night" style="top:1px"></div> '+ttt.string;
                    }
                    else
                    {
                        $('reflexiontime_value').innerHTML = ttt.string;
                    }

                    if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] < 0 )
                    {
				        // Make it "blink"
				        dojo.fx.chain( [
				            dojo.fadeOut( { node:"reflexiontime_value", duration:200 } ),
				            dojo.fadeIn( { node:"reflexiontime_value", duration:200 } )
				            ] ).play();

                        if( this.bTimerCommon )
                        {
                            // When timer is common, do not display it below O (display 0 instead)
                            $('reflexiontime_value').innerHTML = this.formatReflexionTime( 0 ).string;
                        }
                    }

                    if( this.bRealtime ) // Note: no time alarm on turn based
                    {
                        if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] == 10 )
                        {
                            // There is just remaining 10sec to play ! Hurry up !
                            playSound( 'time_alarm' );
                            this.notifqueue.addToLog( __('lang_mainsite',"Warning: Your clock has only 10 seconds remaining!") );
                        }
                        if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] == 0 )
                        {
                            // No more time to play ! Hurry up !
                            playSound( 'time_alarm' );
                            this.notifqueue.addToLog( __('lang_mainsite',"Warning: Your clock is negative: you should play now!") );
                        }

                        if( typeof this.currentPlayerReflexionStartAt != 'undefined' && this.currentPlayerReflexionStartAt < 0 )
                        {
                            // This player loaded this page or starts his turn with a negative clock
                            if( this.gamedatas.gamestate.reflexion.total[ this.player_id ] == ( this.currentPlayerReflexionStartAt-10 ) )
                            {
                                // ... and he didn't play since 10 sec
                                playSound( 'time_alarm' );
                                this.notifqueue.addToLog( __('lang_mainsite',"Warning: Your clock is negative: you should play now!") );
                            }
                        }
                    }
                }


               	// Page title animation
               	var current = document.title.substr( 0, 2 );
/*               	var animation_start = '- ';
               	var animation = {
               	    '- '  : '\\ ',
               	    '\\ ' : '| ',
               	    '| '  : '/ ',
               	    '/ '  : '- '
               	};

               	var animation_start = '. ';
               	var animation = {
               	    '. ' : 'o ',
               	    'o ' : 'O ',
               	    'O ' : '. ',
               	};

               	var animation_start = '◴ ';
               	var animation = {
               	    '◴ ' : '◷ ',
               	    '◷ ' : '◶ ',
               	    '◶ ' : '◵ ' ,
               	    '◵ ' : '◴ '
               	};
               	var animation = {
               	    '◴ ' : '  ',
               	    '  ' : '◴ ',
               	};

               	//. o O @
               	*/

                var animation_start = '◢ ';
               	var animation = {
               	    '◢ ' : '◣ ',
               	    '◣ ' : '◤ ',
               	    '◤ ' : '◥ ' ,
               	    '◥ ' : '◢ '
               	};

               	var next = 'new';
                if( animation[current] )
                {
                    next = animation[current];
                }

                if( next == 'new' )
                {   document.title = animation_start+document.title;   }
                else
                {   document.title = next + document.title.substr(2);   }

            }

            if( bNight )
            {
                dojo.addClass( 'ebd-body', 'night_mode' );
                this.addTooltipToClass( 'this_is_night', dojo.string.substitute( __('lang_mainsite',"Playing hours for this game are ${hours}: consequently, the timer is not decreasing at now."), {hours: $('menu_option_value_206').innerHTML} ), '' );
            }
            else
            {
                dojo.removeClass( 'ebd-body', 'night_mode' );
            }


            //this.gamedatas.gamestate.reflexion.move.value--;
            //var thismove_bar_width = Math.min( 200, Math.max( 0, 200-Math.round( 200 * toint( this.gamedatas.gamestate.reflexion.move.value) / toint( this.gamedatas.gamestate.reflexion.move.total ) ) ) );
            //dojo.style( $('thismove_time_bar_currentplayer_value'), 'width', thismove_bar_width+'px' );

            this.updateFirePlayerLink();

            // Manage "would like to think" blinking

            this.lastWouldLikeThinkBlinking++;
            var blinkEvery = 30;
            if( this.lastWouldLikeThinkBlinking > blinkEvery && actPlayers.length > 0 )
            {
                // Make it "blink"
                dojo.fx.chain( [
                    dojo.fadeOut( { node:"wouldlikethink_button", duration:200 } ),
                    dojo.fadeIn( { node:"wouldlikethink_button", duration:200 } )
                    ] ).play();

                // Make appear "what can I do with this played
                if( ! this.isCurrentPlayerActive() )
                {
                	if( bAtLeastOneActiveIsAi )
                	{
		                // If this is an AI (ie: all active players are ai
		                dojo.style( $('ai_not_playing'), 'display', 'inline' );
					}
					else
					{
		            	// If this is not an AI
		                dojo.style( $('not_playing_help'), 'display', 'inline' );
					}
                }
            }

            // Make blink all GUI element of class "blinking"
            dojo.query( '.blinking' ).forEach( function( node ) {
                dojo.fx.chain( [
                    dojo.fadeOut( { node:node, duration:200 } ),
                    dojo.fadeIn( { node:node, duration:200 } )
                    ] ).play();
            } );
        },



        // return true if we should display a clock alert for this player when he is active
        shouldDisplayClockAlert: function( player_id )
        {
            // _ a clock alert has been received ( players[ player_id ].clockalert == true )
            // _ reflexion time is negative
            //

            //console.log( 'shouldDisplayClockAlert' );

//            if( this.gamedatas.gamestate.reflexion.move.value <= 0 )  // No more time limit
//            {   return true;     }
            if( this.gamedatas.gamestate.reflexion.total[ player_id ] <= 0 )
            {   return true;     }

            return false;
        },


        // Make "fire player" links on player panels appear or disappear depending on current situation
        updateFirePlayerLink: function()
        {
            // Link appear as soon as:
            // _ player is active and:
            //      _ time is over

            dojo.style( 'skip_player_turn', 'display', 'none' );
            var actPlayers = this.getActivePlayers();
            for( var i in actPlayers )
            {
                var player_id = actPlayers[i];
                if( toint( player_id ) != toint( this.player_id ) )
                {
                    if( this.gamedatas.gamestate.reflexion.total[ player_id ] < 0 )
                    {
                        if( !this.isSpectator )
                        {
                            dojo.style( 'skip_player_turn', 'display', 'inline' );
                        }
                    }
                }
            }
        },

        // Current player would like to say that he need some time to think on this move
        onWouldLikeToThink: function( evt )
        {
            console.log( 'onWouldLikeToThink' );
            evt.preventDefault();
            this.ajaxcall( "/table/table/wouldlikethink.html",
                 {  }, this, function( obj, result )   {});
         },

        ////////////////////////////////////////////////////
        // Wake ups and wake up checks management

        sendWakeupInTenSeconds: function()
        {
            //console.log( "[wakeup] sendWakeupInTenSeconds" );
            this.cancelPlannedWakeUp();
            this.wakeup_timeout = setTimeout( dojo.hitch( this, 'sendWakeUpSignal' ), 10000 );
        },

        // Send a wakeup signal to server saying "I acknownledge this is my turn"
        sendWakeUpSignal: function()
        {
            //console.log( "[wakeup] sendWakeUpSignal" );
            this.cancelPlannedWakeUp();
            this.ajaxcall( "/"+this.game_name+"/"+this.game_name+'/wakeup.html', { myturnack: true, table: this.table_id }, this, function( obj, result )
                    {});
        },

        // Cancel next wakeup to be sent if any
        cancelPlannedWakeUp: function()
        {
            //console.log( "[wakeup] cancelPlannedWakeUp" );
            if( this.wakeup_timeout )
            {
                console.log( "[wakeup] cancelPlannedWakeUp: timeout cleared !" );
                clearTimeout( this.wakeup_timeout );
                this.wakeup_timeout = null;
            }
        },

        // Check up player's ACK (=wakeup signals) in 14 to 20 seconds
        // Note: the delay is random so not all players to not try to wake up the absent player at the same time
        checkWakupUpInFourteenSeconds: function()
        {
            //console.log( "[wakeup] checkWakupUpInFourteenSeconds" );
            this.cancelPlannedWakeUpCheck();
            var time_to_check = 14000 + ( 6000 * Math.random() );
            this.wakeupcheck_timeout = setTimeout( dojo.hitch( this, 'checkWakups' ), time_to_check );
        },

        // Check active players ACKs and show the unavailable icon if no ACK
        checkWakups: function()
        {
            console.log( "[wakeup] checkWakeups" );
            this.cancelPlannedWakeUpCheck();

            var bAtLeastOneToWakeup = false;

            // If some player's ack are still at "wait" => put them "unavail"
            var actPlayers = this.getActivePlayers();
            for( var i in actPlayers )
            {
                var player_id = actPlayers[i];
                if( this.gamedatas.players[ player_id ].ack == 'wait' )
                {
                    this.gamedatas.players[ player_id ].ack = 'unavail';
                    $("avatar_active_" + player_id).src = getStaticAssetUrl('img/layout/active_player_nonack.gif');

//                    this.notifqueue.addToLog( dojo.string.substitute(  _("It seems that ${player_name} does not know it's his/her turn to play ..."), { player_name:this.gamedatas.players[ player_id ].name } ) );

                    bAtLeastOneToWakeup = true;
                }

            }

            if( bAtLeastOneToWakeup )
            {
                if( this.isSpectator )
                {
                    // We do not want this for spectators
                }
                else
                {
                    this.ajaxcall( "/"+this.game_name+"/"+this.game_name+'/wakeupPlayers.html', {}, this, function( obj, result ) {} );
                }
            }
        },

        // Cancel next wakeup to be sent if any
        cancelPlannedWakeUpCheck: function()
        {
            //console.log( "[wakeup] cancelPlannedWakeUpCheck" );
            if( this.wakeupcheck_timeout )
            {
                //console.log( "[wakeup] cancelPlannedWakeUpCheck: timeout cleared !" );
                clearTimeout( this.wakeupcheck_timeout );
                this.wakeupcheck_timeout = null;
            }
        },

        ///////////////////////////////////////////////////
        //// Interface locking features

        // If the interface is locked, return true
        isInterfaceLocked: function()
        {
            return ( this.interface_locked_by_id !== null );
        },

        isInterfaceUnlocked: function()
        {
            return ( this.interface_locked_by_id === null );
        },

        // Lock the interface: all GUI elements protected will become unavailable
        lockInterface: function( uid )
        {
            if( this.isInterfaceLocked() )
            {
                console.error( "Try to lock interface while it is already locked !" );

                // Note: force unlock interface anyway
            }

            dojo.addClass( 'ebd-body', 'lockedInterface' );

            this.interface_locked_by_id = uid;
        },

        // Unlock the interface with given uid: restore access to protected GUI elements
        unlockInterface: function( uid )
        {
            if( this.isInterfaceLocked() )
            {
                if( this.interface_locked_by_id == uid )
                {
                    this.interface_locked_by_id = null;    // Okay, unlock interface.

                    dojo.removeClass( 'ebd-body', 'lockedInterface' );
                }
            }
        },

        // Interface locking event (received from ajaxcall & gamenotif)
        onLockInterface: function( lock )
        {
            console.log( "onLockInterface with status = "+lock.status+' lock.uuid='+lock.uuid+' and this.interface_locked_by_id='+this.interface_locked_by_id  );

            if( lock.status == 'outgoing' )
            {
                // Sending request to game server
                this.lockInterface( lock.uuid );
                this.interface_locking_type = null;
                if( lock.type )
                {   this.interface_locking_type = lock.type;    }

                dojo.style( 'pagemaintitle_wrap', 'display', 'none' );
                dojo.style( 'gameaction_status_wrap', 'display', 'block' );
                $('gameaction_status').innerHTML = __('lang_mainsite', "Sending move to server ..." );

                this.interface_status = 'outgoing';
                console.log( "Interface status is now: outgoing" );
            }
            else
            {
                if( lock.uuid == this.interface_locked_by_id )
                {
                    //console.log( "uuid match !" );

                    if( lock.status == 'recorded' )
                    {
                        // Game action has been recorder, waiting for the update
                        if( this.interface_status=='outgoing' )
                        {
                            // Meaning: we received a non-error answer from the game server. Our move is recorded.
                            $('gameaction_status').innerHTML = __('lang_mainsite', "Move recorded, waiting for update ..." );
                            this.interface_status = 'recorded';
                            console.log( "Interface status is now: recorded" );
                        }
                    }

                    if( this.interface_locking_type === null ||
                        ( this.interface_locking_type == 'table' && lock.bIsTableMsg ) ||
                        ( this.interface_locking_type == 'player' && ! lock.bIsTableMsg ) )
                    {
                        //console.log( "locking type match !" );

                        if( lock.status == 'queued' )
                        {
                            // Notification corresponding to game action has been received and queued in cometd notification queue
                            if( this.interface_status=='outgoing' || this.interface_status == 'recorded' )
                            {
                                // Meaning: we received a non-error answer from the game server. Our move is recorded.
                                $('gameaction_status').innerHTML = __('lang_mainsite', "Updating game situation ..." );
                                this.interface_status = 'queued';
                                console.log( "Interface status is now: queued" );
                            }

                        }
                        else if( lock.status == 'dispatched' )
                        {
                            // Notification corresponding to game action has been dispatched

                            if( this.interface_status=='queued' )
                            {
                                // Meaning: we received a non-error answer from the game server. Our move is recorded.
                                //$('gameaction_status').innerHTML = __('lang_mainsite', "Updating game situation ..." );
                                this.interface_status = 'dispatched';
                                console.log( "Interface status is now: dispatched." );

                                // Meaning: This is the last message for this request => hide the status panel
                                // DEPRECATED: we must keep the current "Updating game situation", because we are still processing the latest
                                //  synchronous notification. The normal panel will be shown when the lock status will be set to "updated"
                                //  If we don't do this, and send (for example) 3 synchronous notifications in a row, the last one will not
                                //  show a "Updating game situation..." in status bar during its execution.
//                                dojo.style( 'pagemaintitle_wrap', 'display', 'block' );
//                                dojo.style( 'gameaction_status_wrap', 'display', 'none' );
//                                dojo.style( 'synchronous_notif_icon', 'display', 'inline' );
                            }
                        }
                        else if( lock.status == 'updated' )
                        {
                            // Notification execution has ended
                            // (note: with asynchronous notification, updated is send right after dispatched)
                            // (note: for errors, updated status is sent immediately)

                            this.unlockInterface( lock.uuid );
                            this.interface_status = 'updated';
                            console.log( "Interface status is now: updated" );
                            dojo.style( 'pagemaintitle_wrap', 'display', 'block' );
                            dojo.style( 'gameaction_status_wrap', 'display', 'none' );
                            dojo.style( 'synchronous_notif_icon', 'display', 'none' );
                        }
                    }
                }
                else
                {
                    // We receive an unknow lock.
                    // The most probable reason is the following: we receive some cometd notification caused by some
                    // actions sent by another player.
                    // In the case our interface is not already locked, we must consider this notification as if it was
                    // one of "ours" (ie: lock/unlock interface, display status message)
                    if( lock.status == 'queued' )
                    {
                        if( this.isInterfaceUnlocked() )
                        {
                            this.lockInterface( lock.uuid );
                            this.interface_locking_type = null;
                            if( lock.type )
                            {   this.interface_locking_type = lock.type;    }

                            // Meaning: we received a non-error answer from the game server. Our move is recorded.
                            $('gameaction_status').innerHTML = __('lang_mainsite', "Updating game situation ..." );
                            this.interface_status = 'queued';
                            dojo.style( 'pagemaintitle_wrap', 'display', 'none' );
                            dojo.style( 'gameaction_status_wrap', 'display', 'block' );
                       }
                    }
                }
            }

        },

        // Check if interface is lock. Return false if interface is locked and display an error message
        checkLock: function( nomessage )
        {
            if( this.isInterfaceLocked() )
            {
                if( typeof nomessage == 'undefined' )
                {   this.showMessage( __('lang_mainsite', "Please wait, an action is already in progress" ), 'error' );  }
                return false;
            }

            return true;
        },

        // Check if player can do the specified action by taking into account:
        // _ current game state
        // _ interface locking
        //
        // return true if action is authorized
        // return false and display an error message if not (display no message if nomessage is specified)
        //
        checkAction: function( action, nomessage )
        {
            // Interface locking
            if( ! this.checkLock( nomessage ) )
            {
                if( typeof nomessage == 'undefined' && this.developermode )
                { this.showMessage( "(Generated by: checkAction/"+action+")", 'error' );       }
                return false;
            }

            // Player turn
            if( ! this.isCurrentPlayerActive() )
            {
                if( typeof nomessage == 'undefined' )
                {   this.showMessage( __('lang_mainsite', "This is not your turn" ), 'error' );  }
                return false;
            }

            // Checking game action
            if( this.checkPossibleActions( action ) )
            {   return true;    }

            if( typeof nomessage == 'undefined' )
            {
                this.showMoveUnauthorized();
                console.log( 'Move not authorized now : '+action );
            }

            return false;
        },

        // Return true or false depending if this action is possible or not at the current state
        // Note: do NOT check interface locking or current player activity
        checkPossibleActions: function( action )
        {
            var possibleActions = this.gamedatas.gamestate.possibleactions;
            
            if (this.gamedatas.gamestate.private_state && this.isCurrentPlayerActive()){
                possibleActions = this.gamedatas.gamestate.private_state.possibleactions;
            }
            
            // Checking game action
            for( var i in possibleActions )
            {
                if( possibleActions[i] == action )
                {    return true;       }
            }
            return false;
        },

        // Show "move not authorized" error message
        showMoveUnauthorized: function()
        {
            this.showMessage( __('lang_mainsite', "This move is not authorized now" ), 'error' );
        },

        ///////////////////////////////////////////////////
        //// Players panel disabling/enabling

        disablePlayerPanel: function( player_id )
        {
            console.log( "Disable panel of player "+player_id );
            dojo.addClass( 'overall_player_board_'+player_id, 'roundedboxdisabled' );
        },
        enablePlayerPanel: function( player_id )
        {
            console.log( "Enable panel of player "+player_id );
            dojo.removeClass( 'overall_player_board_'+player_id, 'roundedboxdisabled' );
        },
        enableAllPlayerPanels: function()
        {
             console.log( "enableAllPlayerPanels" );
             dojo.query( '.roundedboxdisabled' ).removeClass( 'roundedboxdisabled' );
        },

        ///////////////////////////////////////////////////
        //// Players panel ordering

        // Update player panel ordering
        updatePlayerOrdering: function()
        {
            console.log( "updatePlayerOrdering" );
            var place = 0;

            for( var i in this.gamedatas.playerorder )
            {
                var player_id = this.gamedatas.playerorder[i];
                dojo.place( 'overall_player_board_'+player_id, 'player_boards', place );
                place++;
            }
        },

        ///////////////////////////////////////////////////
        //// Table decisions (& player firing)

        onAiNotPlaying: function( evt )
        {
			dojo.stopEvent( evt );
			this.lastWouldLikeThinkBlinking = 0;
			dojo.style( $('ai_not_playing'), 'display', 'none' );
            this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/aiNotPlaying.html", {table:this.table_id}, this, function( result ){} );
        },

        // Display help about "player is not playing"
        onNotPlayingHelp: function( evt )
        {
            evt.preventDefault();

            var fireHelpDlg = new ebg.popindialog();
            fireHelpDlg.create( 'fireHelpContent' );
            fireHelpDlg.setTitle( __('lang_mainsite', "Some player is not playing ?") );



            var html = "<div id='fireHelpContent'>";
            html += __('lang_mainsite', "Some player is not playing ? Here is what you can do:" );
            html += "<ul>";
            html += "<li>"+__('lang_mainsite', "At first, remember that each player has the absolute right to think as long as he has some time left." )+"</li>";
            html += "<li>"+__('lang_mainsite', "Try to contact him with the chatroom." )+"</li>";
            html += "<li>"+__('lang_mainsite', "Maybe you are disconnected from the server and the other player is waiting for you: try to refresh the page (hit F5) to check." )+"</li>";
            html += "<li>"+__('lang_mainsite', "If the other player is definitely not there, you just have to wait until his time to think is over:" )+"</li>";
            html += "<li>"+__('lang_mainsite', "As soon as your opponent is out of time, you can make him skip his turn." )+"</li>";
            html += "<li>"+__('lang_mainsite', "DO NOT quit the game by yourself: you will get a leave penalty and not him." )+"</li>";
            html += "</ul></div>";

            fireHelpDlg.setContent( html );
            fireHelpDlg.show();

        },

        onSkipPlayersOutOfTime: function( evt )
        {
        	evt.preventDefault();

            this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/skipPlayersOutOfTime.html", {}, this, function( result ){} );
        },

        // Players would like to fire inactive players => show the firing dialog box
        onWouldFirePlayer: function( evt )
        {
            evt.preventDefault();

            this.fireDlg = new ebg.popindialog();
            this.fireDlg.create( 'fireDlgContent' );
            this.fireDlg.setTitle( __('lang_mainsite', 'Skip turn of players out of time') );

            this.fireDlg.telParentPage = this;

            var html = '<div id="fireDlgContent">';
            html += "<p>"+__('lang_mainsite', "Skipping a player`s turn is an important decision. This player will get a `leave` penalty and will lose ELO if he/she doesn't comme back." )+"</p>";
            html += "<p>"+dojo.string.substitute( __('lang_mainsite', "You (and eventually all other opponents) will be considered as winner(s) of this game, and you'll get ${percent}% of ELO points you would have get for a normal victory." ), {percent:$('pr_gameprogression').innerHTML} )+" </p>";

            if( this.bRealtime )
            {
                html += "<p>"+dojo.string.substitute(__('lang_mainsite', "A good option is to ${transform_to_tb}, so everyone can finish this game." ), {transform_to_tb: '<a href="#" id="transform_to_tb_from_dialog">'+__('lang_mainsite','switch this game to Turn-based mode')+'</a>'} )+" </p>";
            }

            if (this.is_coop) {
                html += "<p>"+dojo.string.substitute(__('lang_mainsite', "Note that you may alternatively propose to ${abandon_this_game} (ELO points loss but no leave penalty)." ), {abandon_this_game: '<a href="#" id="abandon_from_dialog">'+__('lang_mainsite','concede this game')+'</a>'} )+" </p>";
            } else {
                html += "<p>"+dojo.string.substitute(__('lang_mainsite', "Note that you may alternatively propose to ${abandon_this_game} (no penalty and no points for anyone)." ), {abandon_this_game: '<a href="#" id="abandon_from_dialog">'+__('lang_mainsite','abandon this game')+'</a>'} )+" </p>";
            }

            html += "<p>"+__('lang_mainsite', "Note that the best option for everyone is to finish the game normally. Are you really sure you want to neutralize this game and skip this player's turn?" )+" </p>";
            html += "<br/>";
            html +="<p><a class='bgabutton bgabutton_gray bgabutton_big' id='fireplayer_cancel'>"+__('lang_mainsite',"Continue waiting")+"</a> &nbsp; ";
            html += "<a class='bgabutton bgabutton_blue bgabutton_big' id='fireplayer_confirm'>"+__('lang_mainsite',"Confirm")+'</a></p>';
            html += "</div>";

            this.fireDlg.setContent( html );
            this.fireDlg.show();

            this.fireDlgStatus = 'confirm';

            dojo.connect( $('fireplayer_cancel'), 'onclick',
                    dojo.hitch( this.fireDlg, function() {
                            this.destroy();
                           } ) );

            dojo.connect( $('abandon_from_dialog'), 'onclick',
                    dojo.hitch( this, function() {
                            this.fireDlg.destroy();

                            this.ajaxcall( "/table/table/decide.html",
                             { type:'abandon', decision:1,'table':this.table_id }, this, function( obj, result )   {});


                           } ) );

            if( $('transform_to_tb_from_dialog') )
            {
                dojo.connect( $('transform_to_tb_from_dialog'), 'onclick',
                        dojo.hitch( this, function() {
                                this.fireDlg.destroy();

                                this.ajaxcall( "/table/table/decide.html",
                                 { type:'switch_tb', decision:1,'table':this.table_id }, this, function( obj, result )   {});


                               } ) );
            }


            if( $('fireplayer_confirm') )
            {
                dojo.connect( $('fireplayer_confirm'), 'onclick',
                        dojo.hitch( this.fireDlg, function() {

                                var bWarning = false;
                                if( this.telParentPage.bRealtime )
                                {
                                    if( this.telParentPage.fireDlgStatus == 'confirm' )
                                    {
                                        // First step (for realtime) : warning
                                        bWarning = true;
                                    }
                                    else if( this.telParentPage.fireDlgStatus == 'expel' )
                                    {
                                        bWarning = false;
                                    }
                                    else
                                    {
                                        // Timer is in progress
                                        return ;
                                    }
                                }

                                this.telParentPage.ajaxcall( "/"+this.telParentPage.game_name+"/"+this.telParentPage.game_name+"/skipPlayersOutOfTime.html",
                                     {
                                        warn: bWarning
                                     }, this, dojo.hitch( this, function( obj, result )   {

                                        if( bWarning )
                                        {
                                            this.telParentPage.list_of_players_to_expel = obj.data.names;
                                            this.telParentPage.onDecreaseExpelTime( obj.data.delay );
                                        }
                                        else
                                        {
                                            this.destroy();
                                        }
                                     } ));
                               } ) );
            }
        },

        onDecreaseExpelTime: function( delay )
        {

            var players_list = 'Players';

            if( typeof this.list_of_players_to_expel != 'undefined' )
            {
                players_list = this.list_of_players_to_expel.join( ', ' );
            }

            if( $('fireplayer_confirm' ) )
            {

                $('fireplayer_confirm').innerHTML = dojo.string.substitute( __('lang_mainsite', '${players} will be expelled in ${delay} seconds'), {
                    players: players_list,
                    delay:delay
                } );
                this.fireDlgStatus = 'timer';

                if( delay == 0 )
                {
                    $('fireplayer_confirm').innerHTML = dojo.string.substitute( __('lang_mainsite',"Expel ${players} now"), { players:players_list } );
                    this.fireDlgStatus = 'expel';
                }
                else
                {
                    setTimeout( dojo.hitch( this, function() { this.onDecreaseExpelTime( delay-1 ) } ), 1000 );
                }
            }
        },

        onMove: function()
        {// To be overrided
        },
        onNextMove: function( move_id )
        {
            if( g_archive_mode )
            {
                // Not to be overrided
                this.initCommentsForMove( move_id );
            }

            // If "fire player" dialog was open, remove it because the concerned player has played now
            if( this.fireDlg )
            {
                this.fireDlg.destroy();
            }
        },

        ///////////////////////////////////////////////////
        //// Archive management

        // Initialize archive index to the next archive notification to be sent
        initArchiveIndex: function()
        {
            console.log( g_gamelogs );
            if( typeof g_gamelogs == 'object' )
            {
                if( g_gamelogs.data )
                {
                    // New game log format => extract game logs
                    g_gamelogs = g_gamelogs.data.data;
                }
            }

            console.log( "initArchiveIndex with table next packet id "+this.notifqueue.last_packet_id );

            // Initialize this.next_archive_index accordingly to this.table_next_notification_no and this.player_next_notification_no
            // (index must correspond)
            var bContinue = true;

            while( bContinue )
            {
                console.log( "Start to analyse archive log index "+this.next_archive_index );
                if( g_gamelogs[ this.next_archive_index ] )
                {
                    if( toint( g_gamelogs[ this.next_archive_index ].packet_id ) > toint( this.notifqueue.last_packet_id ) )
                    {
                        console.log( "Game logs initialization successfully initialized at index "+this.next_archive_index );
                        bContinue = false;
                    }
                    else
                    {
                        this.next_archive_index ++;
                    }
                }
                else
                {
                    // No more logs => failed
                    console.error( "Can't find the initial logs" );
                    this.showMessage( "Error during game archive initialization", "error" );
                    bContinue = false;
                }

            }
        },

        sendNextArchive: function()
        {
            if( this.next_archive_index == -1 )
            {
                console.log( "Game has ended" );
                this.showMessage( __('lang_mainsite', 'End of game') ,'info');
                this.archive_playmode = 'stop';
                this.onLastArchivePlayed();
                return false;
            }
            else
            {
                // We do not need to process next archive when the current queue is not empty
                if( this.notifqueue.queue.length > 0 )
                {
                    this.notifqueue.dispatchNotifications();
                    return true;
                }


                var nextNotif = g_gamelogs[ this.next_archive_index ];
                if( nextNotif )
                {
                    console.log( "Processing archive notification "+this.next_archive_index );
                    console.log( nextNotif );

                    // Remove "switchToTurnbased" notification types
                    nextNotif.data = nextNotif.data.filter(d => d.type !== 'switchToTurnbased')

                    // Clean all existing dialogs on the display from previous notifications
                    dojo.query( '.dijitDialog' ).forEach( dojo.destroy );
                    dojo.query( '.dijitDialogUnderlayWrapper' ).forEach( dojo.destroy );
                    dojo.query( '.standard_popin' ).forEach( dojo.destroy );
                    dojo.query( '.standard_popin_underlay' ).forEach( dojo.destroy );

                    // If the notification is a "player buffer" notification, we must process it & send immediately the next one...
                    var bPlayerBufferNotif = false;
                    if( nextNotif.channel.substr( 0, 6 ) != '/table' )
                    {
                        // This is a private notification for a player

                        if( (nextNotif.channel == this.private_channel ) // Compatibility mode for old archives
                         || (nextNotif.channel == '/player/p'+this.player_id ) )
                        {
                            // This is a notification for our player !
                        }
                        else
                        {
                            // This is a notification from another player => skip it !
                            this.next_archive_index ++;
                            this.sendNextArchive();
                            return true;
                        }

                        if( nextNotif.move_id )
                        {   bPlayerBufferNotif = true;  }
                    }

                    if( ! bPlayerBufferNotif && this.archive_playmode != 'nextlog'  )
                    {
                        // Insert a "wait" notification: 1s between each move
                        nextNotif.data.push( {
                            args:{},
                            bIsTableMsg: true,
                            lock_uuid: 'dummy',
                            log: '',
                            type: 'archivewaitingdelay',
                            uid: 'archivewaitingdelay'+(this.archive_uuid)
                        } );
                        nextNotif.data.push( {
                            args:{},
                            bIsTableMsg: true,
                            lock_uuid: 'dummy',
                            log: '',
                            type: 'end_archivewaitingdelay',
                            uid: 'archivewaitingdelay'+(this.archive_uuid+1)
                        } );
                    }

                    var bGoToNextArchive = true;


                    var move_before = $('move_nbr').innerHTML;
                    this.notifqueue.onNotification( nextNotif );
                    this.next_archive_index ++;
                    this.archive_uuid += 2;

                    if( nextNotif.move_id )
                    {
                        if( $('replaylogs_progression_'+nextNotif.move_id ) )
                        {
                            this.slideToObjectPos( 'archivecursor',  'replaylogs_progression_'+nextNotif.move_id, -30, -23 ).play();
                        }

                        if( $('replaylogs_move_'+nextNotif.move_id) )
                        {
                            dojo.addClass( 'replaylogs_move_'+nextNotif.move_id, 'viewed' );
                        }
                    }

                    if( bPlayerBufferNotif )
                    {
                        this.sendNextArchive();
                    }

                    return true;
                }
                else
                {
                    console.log( "Game has ended" );
                    this.next_archive_index = -1;   // End of game
                    this.showMessage( __('lang_mainsite', 'End of game') ,'info');
                    this.archive_playmode = 'stop';
                    this.onLastArchivePlayed();
                    return false;
                }
            }
        },

        onArchiveNext: function( evt )
        {
            console.log( "onArchiveNext" );
            evt.preventDefault();
            this.notifqueue.bStopAfterOneNotif = false;
            this.clearArchiveCommentTooltip(); // To make sure that the current archive comment (if any) is destroyed

            if( $('move_nbr') )
            {
                if( toint( $('move_nbr').innerHTML ) > 0 )
                {
                    this.archive_gotomove = toint( $('move_nbr').innerHTML ) + 1;
                    this.archive_playmode = 'goto';
                    this.sendNextArchive();
                    return ;
                }
            }

            // Note: old format compatibility
            this.archive_playmode = 'stop'; // One move then stop
            this.sendNextArchive();
            return ;
        },

        onArchiveNextLog: function( evt )
        {
            console.log( "onArchiveNext" );
            evt.preventDefault();

            this.doArchiveNextLog();
        },

        doArchiveNextLog: function()
        {
            if( this.notifqueue.waiting_from_notifend !== null )
            {
                // TODO: may evolve to play several notif
                this.showMessage( _("A notification is still in progress"), 'error' );
                return ;
            }


            this.archive_playmode = 'nextlog'; // One log then stop

            this.notifqueue.bStopAfterOneNotif = true;
            this.notifqueue.log_notification_name = true;

            this.clearArchiveCommentTooltip(); // To make sure that the current archive comment (if any) is destroyed

            if( this.notifqueue.dispatchNotifications() )
            {
                // At least one notif has been dispatched => stop here!
            }
            else
            {
                // No notifications in stock => send the next archive
                this.sendNextArchive();
            }

            delete this.notifqueue.log_notification_name;

            return ;
        },

        onArchiveNextTurn: function( evt )
        {
            console.log( 'onArchiveNextTurn' );
            evt.preventDefault();

            this.notifqueue.bStopAfterOneNotif = false;
            this.clearArchiveCommentTooltip(); // To make sure that the current archive comment (if any) is destroyed

            this.archive_playmode = 'nextturn'; // One turn then stop
            this.archive_previous_player = this.gamedatas.gamestate.active_player;
            this.sendNextArchive();

        },

        onArchiveHistory: function( evt )
        {
            dojo.stopEvent( evt );

            var element_coords = dojo.position( 'archivecursor' );
            window.scrollBy({
                top: element_coords.y - 200
            });
        },


        setModeInstataneous: function()
        {
            if( this.instantaneousMode == false )
            {
                this.instantaneousMode = true;
                this.savedSynchronousNotif = dojo.clone( this.notifqueue.synchronous_notifs );

                dojo.style('leftright_page_wrapper', 'visibility', 'hidden');
                dojo.style( 'loader_mask', 'display', 'block' );
                dojo.style( 'loader_mask', 'opacity', 1 );

                for( var i in this.notifqueue.synchronous_notifs )
                {
                    if( this.notifqueue.synchronous_notifs[i] != -1 )
                    {
                        this.notifqueue.synchronous_notifs[i]=1;
                    }
                }
            }
        },

        unsetModeInstantaneous: function()
        {
            if( this.instantaneousMode )
            {
                this.instantaneousMode = false;

                dojo.style('leftright_page_wrapper', 'visibility', 'visible');
                dojo.style( 'loader_mask', 'display', 'none' );

                for( var i in this.notifqueue.synchronous_notifs )
                {
                    if( this.notifqueue.synchronous_notifs[i] != -1 )
                    {
                        this.notifqueue.synchronous_notifs[i]=this.savedSynchronousNotif[i];
                    }
                }
            }
        },

        onLastArchivePlayed: function()
        {
            this.unsetModeInstantaneous();
        },

        onArchiveToEnd: function( evt )
        {
            console.log( 'onArchiveToEnd' );
            evt.preventDefault();

            this.notifqueue.bStopAfterOneNotif = false;


            this.setModeInstataneous();

            this.archive_playmode = 'play'; // Play until the end
            this.sendNextArchive();
        },

        onArchiveToEndSlow: function( evt )
        {
            console.log( 'onArchiveToEndSlow' );
            evt.preventDefault();

            this.notifqueue.bStopAfterOneNotif = false;

            this.archive_playmode = 'play'; // Play until the end
            this.sendNextArchive();
        },

        onArchiveGoTo: function( evt )
        {
            console.log( 'onArchiveNextTurn' );
            evt.preventDefault();

            // Display a menu

            var html = '<div id="archive_goto_menu">';
            if( typeof this.bEnabledArchiveAdvancedFeatures != 'undefined' )
            {
                html += "<p><a href='#' id='go_to_game_end'>"+_("Go to end of game (fast)")+"</a></p><hr/>";
            }
            html += "<p><a href='#' id='go_to_game_end_slow'>"+_("Go to end of game")+"</a></p><hr/>";
            html += "<p><a href='#' id='go_to_new_turn'>"+_("Go to next player's turn")+"</a></p><hr/>";
            if( typeof this.bEnabledArchiveAdvancedFeatures != 'undefined' )
            {
                html += "<p><a href='#' id='go_to_specific_move'>"+_("Go to specific move (fast)")+"</a></p><hr/>";
            }
            html += "<p><a href='#' id='go_to_specific_move_slow'>"+_("Go to specific move")+"</a></p>";
            html += '</div>';

            if( typeof this.archiveGotoMenu == 'undefined' )
            {
                this.archiveGotoMenu = new dijit.TooltipDialog({
                    id: 'goto_menu',
                    content: html,
                    closable: true
                });

                dijit.popup.open({
                    popup: this.archiveGotoMenu,
                    around: $( 'archive_end_game' ),
                    orient: [ "below", "below-alt", "above", "above-alt" ]
                });
                dojo.query( '.dijitTooltipDialogPopup').style('zIndex', 1055 ); // Above top banner

                dojo.query( '#archive_goto_menu a' ).connect( 'onclick', this, function( evt) {
                    dijit.popup.close( this.archiveGotoMenu );
                    this.archiveGotoMenu.destroy();
                    delete this.archiveGotoMenu;
                });
                if( $('go_to_game_end'))
                {
                    dojo.connect( $('go_to_game_end'), 'onclick', this, 'onArchiveToEnd' );
                }
                dojo.connect( $('go_to_game_end_slow'), 'onclick', this, 'onArchiveToEndSlow' );
                dojo.connect( $('go_to_new_turn'), 'onclick', this, 'onArchiveNextTurn' );
                if( $('go_to_specific_move'))
                {
                    dojo.connect( $('go_to_specific_move'), 'onclick', this, dojo.hitch( this, function(evt) {

                        this.askForValueDialog( _("Enter the move you want to go to"), dojo.hitch( this, function( move_id ) {

                            if( move_id != '' )
                            {
                                this.archiveGoToMove( toint( move_id ), true );
                            }
                        } ) );

                    }) );
                }
                dojo.connect( $('go_to_specific_move_slow'), 'onclick', this, dojo.hitch( this, function(evt) {

                    this.askForValueDialog( _("Enter the move you want to go to"), dojo.hitch( this, function( move_id ) {

                        if( move_id != '' )
                        {
                            this.archiveGoToMove( move_id, false );
                        }
                    } ) );

                }) );

            }
            else
            {
                dijit.popup.close( this.archiveGotoMenu );
                this.archiveGotoMenu.destroy();
                delete this.archiveGotoMenu;
            }
        },

        onEndDisplayLastArchive: function()
        {
            console.log( 'onEndDisplayLastArchive' );

            switch( this.archive_playmode )
            {
            case 'stop':
                return; // Do nothing
            case 'nextturn':
                if( this.gamedatas.gamestate.active_player != this.archive_previous_player &&
                    this.gamedatas.gamestate.type == 'activeplayer' )
                {
                    // This is next turn
                    this.archive_playmode = 'stop';
                }
                else
                {
                    this.sendNextArchive();
                }
                break;
            case 'play':
                this.sendNextArchive();
                break;
            case 'goto':
                if( this.next_archive_index != -1 )
                {
                    var nextNotif = g_gamelogs[ this.next_archive_index ];
                    if( typeof nextNotif != 'undefined' )
                    {
                        if( nextNotif.move_id )
                        {
                            if( toint( nextNotif.move_id ) <= this.archive_gotomove )
                            {
                                this.sendNextArchive();
                            }

                            if( toint( nextNotif.move_id ) >= this.archive_gotomove )
                            {
                                this.unsetModeInstantaneous();
                            }
                        }
                        else
                        {
                            this.sendNextArchive();
                        }
                    }
                }
                break;
             case 'nextcomment':
                // Stop here if some comment exists for this move
                if( $('newArchiveComment') )
                {   // Okay, stay here
                }
                else
                {
                    // Check if there is at least one remaining comment ...

                    var commentNbr = dojo.query( '.archiveComment' ).length;
                    if( this.getCommentsViewedFromStart() >= commentNbr )
                    {
                        // No more comments
                        this.showMessage( __('lang_mainsite',"No more comments"), 'info' );
                    }
                    else
                    {
                        this.sendNextArchive();
                    }
                }
                break;
            }
        },

        onArchiveGoToMoveDisplay: function()
        {
            dojo.style( 'archive_go_to_move_control', 'display', 'inline-block' );
            dojo.style( 'archive_go_to_move', 'display', 'none' );
        },

        archiveGoToMove: function( move_nbr, bFast )
        {
            if( toint( move_nbr ) <= toint( $('move_nbr').innerHTML ) )
            {
                this.insertParamIntoCurrentURL( 'goto', toint( move_nbr ) );

             //   this.showMessage( __('lang_mainsite',"You must specify a move number not played yet"), 'error' );
            }
            else
            {
                this.notifqueue.bStopAfterOneNotif = false;

                this.archive_gotomove = toint( move_nbr );
                this.archive_playmode = 'goto';
                if( bFast )
                {
                    this.setModeInstataneous();
                }
                this.sendNextArchive();
            }
        },

        // Show archive comment tooltip dialog
        // Note: if comment_no is undefined, show tooltip on "new comment" mode
        // mode = "edit" (=new/modify comment), "display" (=display comment), "saved" (=last saved comment), "displayid" (=display comment by id)
        showArchiveComment: function( mode, comment_no )
        {
            if( this.archiveCommentNew !== null  && mode != 'do_not_show_only_infos' )
            {
                // Already created
                this.clearArchiveCommentTooltip();
            }

            if( mode == 'saved' )
            {
                comment_no=0;
            }

            if( mode == 'edit')
            {
                dojo.addClass( 'ebd-body', 'archivecommentmode_edit');
            }
            else
            {
                dojo.removeClass( 'ebd-body', 'archivecommentmode_edit');
            }

            var bInfosAvailable = false;
            if( typeof comment_no != 'undefined' )
            {
                // Get comment information (or return false if not found)

                var move_id = $('move_nbr').innerHTML;
                var comments = dojo.query( '.archiveComment_move'+move_id );

                if( mode == 'saved' )
                {
                    var comments = dojo.query( '.archiveComment' );
                }
                else if( mode == 'edit' || mode == 'displayid' )
                {
                    // In this case, comment_no is a comment_id, indeed
                    var comments = dojo.query( '#archiveComment_'+comment_no );
                    comment_no=0;
                }

                if( comments[ comment_no ] )
                {
                    var comment_divid = comments[ comment_no ].id;
                    var authors = dojo.query( '#'+comment_divid+' .archiveComment_author' );
                    if( authors[0] )
                    {
                        var anchors = dojo.query( '#'+comment_divid+' .archiveComment_anchor' );
                        if( anchors[0] )
                        {
                            var text = dojo.query( '#'+comment_divid+' .archiveComment_text' );
                            if( text[0] )
                            {
                                var notif_uid = dojo.query( '#'+comment_divid+' .archiveComment_uid' );
                                if( notif_uid[0] )
                                {
                                    var commentno = dojo.query( '#'+comment_divid+' .archiveComment_no' );
                                    if( commentno[0] )
                                    {
                                        // Okay, we have all information to display comment !

                                        if( mode == 'do_not_show_only_infos')
                                        {
                                            return {
                                                notif_uid: notif_uid[0].innerHTML
                                            };
                                        }

                                        bInfosAvailable = true;

                                        this.archiveCommentLastDisplayedNo=commentno[0].innerHTML;
                                        this.archiveCommentLastDisplayedId=comment_divid.substr(15);
                                    }
                                }
                                else
                                {   return false;   }
                            }
                        }
                        else
                        {   return false;   }
                    }
                    else
                    {   return false;   }
                }
                else
                {   return false;   }

                var continuemode = 0;
                var continuemodeNode = dojo.query( '#'+comment_divid+' .archiveComment_continuemode' );
                if( continuemodeNode[0] )
                {
                    continuemode = continuemodeNode[0].innerHTML;
                }

                var displaymode = 0;
                var displaymodeNode = dojo.query( '#'+comment_divid+' .archiveComment_displaymode' );
                if( displaymodeNode[0] )
                {
                    displaymode = displaymodeNode[0].innerHTML;
                }

                var pointers = '';
                var pointersNode = dojo.query( '#'+comment_divid+' .archiveComment_pointers' );
                if( pointersNode[0] )
                {
                    pointers = pointersNode[0].innerHTML;
                }
                pointers = pointers.split(' ');
                var elem_id = null;
                // Analysing pointers list (1 element ID is followed by pointer type, then by another element ID, then by pointer type, and so on ....)
                for( var i in pointers )
                {
                    if( elem_id === null )
                    {   elem_id = pointers[i];  }
                    else
                    {
                        var pointer_type = pointers[i];

                        if( $( elem_id ) )
                        {
                            if( !isNaN( pointer_type  ) )
                            {
                                // Add a pointer associated to the element
                                var html = '<div id="tuto_pointer_'+elem_id+'" class="archiveCommentPointed archiveCommentPointed'+pointer_type+'"><div class="archiveCommentPointed_inner"></div></div>';
                                dojo.place( html, $( elem_id ) );

                                // The target must be positioned for proper display
                                if (dojo.style(elem_id, 'position') == 'static') {
                                    dojo.style(elem_id, 'position', 'relative');
                                }
                                // The target must have visible overflow
                                if (dojo.style(elem_id, 'overflow') != 'visible') {
                                    dojo.style(elem_id, 'overflow', 'visible');
                                }
                            }
                            else
                            {
                                // Image associated witht the element
                                var split = pointer_type.split('/');
                                if( split.length == 3 )
                                {
                                    var image_url = atob( split[0] );
                                    var image_x = split[1];
                                    var image_y = split[2];

                                    $( elem_id ).setAttribute( 'datasrc', image_url );
                                    this.archiveCommentAttachImageToElement( $( elem_id ), image_x, image_y );

                                }
                            }
                        }
                        elem_id = null;
                    }
                }

                dojo.addClass( comment_divid, 'commentviewed' );
            }



            var commentText = bInfosAvailable ? text[0].innerHTML : '';
            commentText = commentText.replace( new RegExp('ARCHIVECOMMENT_', 'g'), '' );

            var author = bInfosAvailable ? authors[0].innerHTML : $('archiveViewerName').innerHTML;

            var bCurrentPlayerAuthor = false;
            if( bInfosAvailable )
            {
                bCurrentPlayerAuthor = ( $('archiveViewerName').innerHTML == authors[0].innerHTML );
            }

            var commentNbr = dojo.query( '.archiveComment' ).length;
            var archiveCommentNbrFromStart = this.getCommentsViewedFromStart();
            var comment_id = bInfosAvailable ? this.archiveCommentLastDisplayedId : 0;

            // GA-GTM analytics
            if (mode == 'display' && typeof comment_no != 'undefined' && commentNbr >= 2)
            {
                if (archiveCommentNbrFromStart == 2) // First is the intro
                    analyticsPush({
                        'game_name': this.game_name,
                        'event': 'tutorial_start'
                    });

                if (archiveCommentNbrFromStart == commentNbr)
                    analyticsPush({
                        'game_name': this.game_name,
                        'event': 'tutorial_complete'
                    });

                if (archiveCommentNbrFromStart >= 2) // First is the intro
                {
                    if ((archiveCommentNbrFromStart - 1) / (commentNbr - 1) >= 0.05 && (archiveCommentNbrFromStart - 2) / (commentNbr - 1) < 0.05)
                        analyticsPush({
                            'game_name': this.game_name,
                            'progress_level': '5%',
                            'event': 'tutorial_progress'
                        });
                    if ((archiveCommentNbrFromStart - 1) / (commentNbr - 1) >= 0.25 && (archiveCommentNbrFromStart - 2) / (commentNbr - 1) < 0.25)
                        analyticsPush({
                            'game_name': this.game_name,
                            'progress_level': '25%',
                            'event': 'tutorial_progress'
                        });
                    if ((archiveCommentNbrFromStart - 1) / (commentNbr - 1) >= 0.5 && (archiveCommentNbrFromStart - 2) / (commentNbr - 1) < 0.5)
                        analyticsPush({
                            'game_name': this.game_name,
                            'progress_level': '50%',
                            'event': 'tutorial_progress'
                        });
                    if ((archiveCommentNbrFromStart - 1) / (commentNbr - 1) >= 0.75 && (archiveCommentNbrFromStart - 2) / (commentNbr - 1) < 0.75)
                        analyticsPush({
                            'game_name': this.game_name,
                            'progress_level': '75%',
                            'event': 'tutorial_progress'
                        });
                }
            }

            var next_label = __('lang_mainsite','Next comment');

            if( g_tutorialwritten.mode == 'view' )
            {
                next_label = __('lang_mainsite',"Continue");

                if( comment_divid == 'archiveComment_intro' )
                {
                    next_label = __('lang_mainsite',"Start");
                }
            }

            var html = "<div id='newArchiveComment' class='newArchiveComment'>\
                            <div class='archiveAuthor' style='display:none'>"+author+":</div>\
                            <div class='archiveComment_before'><p class='archiveComment_before_inner'><i class='fa fa-graduation-cap'></i></p></div>\
                            <div id='newArchiveCommentMove' class='icon20 icon20_move'></div>\
                            <textarea id='newArchiveCommentText' maxlength='"+this.tuto_textarea_maxlength+"'>"+commentText+"</textarea>\
                            <div id='newArchiveCommentOptions'>\
                                <select id='newArchiveCommentContinueMode'>\
                                    <option value='0'>"+__('lang_mainsite',"Player must click on Continue button to continue.")+"</option>\
                                    <option value='1'>"+__('lang_mainsite',"Player must DO the next game action with the game interface to continue.")+"</option>\
                                </select><br/>\
                                <select id='newArchiveCommentDisplayMode'>\
                                    <option value='0'>"+__('lang_mainsite',"Display this comment with an arrow to the linked item.")+"</option>\
                                    <option value='1'>"+__('lang_mainsite',"Display this comment centered over the linked item.")+"</option>\
                                </select><br/>\
                                <a id='newArchiveCommentAdditionalImage' href='#'><i class='fa fa-picture-o fa-2x'></i></a> \
                                <a id='newArchiveCommentShowHelp' href='#'><i class='fa fa-info-circle fa-2x' ></i></a>\
                            </div>\
                            <div id='newArchiveCommentContinueModeWarning'><i class='fa fa-warning'></i> "+dojo.string.substitute( __('lang_mainsite','Do not forget to explain to the player which action to do in the text above. Note that the very next action in the replay MUST have been played by ${player}.'), {player: '<b>'+$('archiveViewerName').innerHTML+'</b>'} )+"</div>\
                            <div id='newArchiveCommentHelp'>"+
                                "<p>"+__('lang_mainsite',"Note : you can click on any game element to highlight it when this step is displayed.")+"</p>"+
                                "<p>"+__('lang_mainsite',"Available markup") + ' :<br/>'+ "&nbsp;*text in bold*<br/>&nbsp;[red]text in red[/red]<br/>&nbsp;[green]text in green[/green]<br/>&nbsp;[blue]text in blue[/blue]<br/>"+
                                    "&nbsp;!!! => <i class='fa fa-exclamation-triangle'></i><br/>"+
                                    "&nbsp;[tip] => <i class='fa fa-lightbulb-o'></i><br/>"+
                                    "&nbsp;[img]URL[/img] => Display an image. Tip: you may use <a href='https://snipboard.io/'>Snipboard.io</a> to upload an image, and then copy/paste the URL.<br/>"+
                                "</p>"+
                            "</div>\
                            <div id='newArchiveCommentTextDisplay'>"+this.applyArchiveCommentMarkup( commentText )+"</div>\
                            <div id='newArchiveCommentMoveHelp'>"+__('lang_mainsite', 'Place your mouse cursor on a game element to attach this comment')+":</div>\
                            <div id='newArchiveCommentControls' class='newArchiveCommentControls'>\
                                <a class='bgabutton bgabutton_gray' href='#' id='newArchiveCommentCancel'><span>"+__('lang_mainsite','Cancel')+"</span></a>\
                                <a class='bgabutton bgabutton_blue' href='#' id='newArchiveCommentSave'><span>"+__('lang_mainsite','Save')+"</span></a>\
                                <a class='bgabutton bgabutton_blue' href='#' id='newArchiveCommentSaveModify_"+comment_id+"'><span>"+__('lang_mainsite','Save')+"</span></a>\
                            </div>\
                            <div id='newArchiveCommentDisplayControls'>"+
                                "<a href='#' id='newArchiveCommentDelete' class='bgabutton bgabutton_gray'>"+__('lang_mainsite','Delete')+"</a> "+
                                "<a href='#' id='newArchiveCommentModify' class='bgabutton bgabutton_gray'>"+__('lang_mainsite','Modify')+"</a>&nbsp;&nbsp;"+
                                "<span class='newArchiveCommentNo'>"+archiveCommentNbrFromStart+"/"+commentNbr+"&nbsp;&nbsp; </span>"+
                                "<a href='#' id='newArchiveCommentNext' class='bgabutton bgabutton_blue'>"+next_label+"</a>"+
                            "</div>"+
                            "<a href='#' id='newArchiveCommentMinimize' class='standard_popin_closeicon'><i class='fa fa-minus-square-o fa-lg'></i></a>\
                        </div>";

            this.archiveCommentNew = new dijit.TooltipDialog({
                id: 'newArchiveComment',
                content: html,
                closable: true
            });

            var anchor = bInfosAvailable ?  anchors[0].innerHTML : 'page-title';
            var bCenter = false;
            var anchor_for_center = null;

            if( ! $(anchor) || anchor == 'page-title' || anchor == 'archivecontrol_editmode_centercomment' )
            {
                // Anchor does not exists
                // OR we choose an anchor that means "use centered mode"
                anchor = 'archivecontrol_editmode_centercomment';
                anchor_for_center = 'game_play_area';
                bCenter = true;
            }

            if( displaymode == 1 )
            {
                // Center it on the anchor
                bCenter = true;
                anchor_for_center = anchor;
            }

            if( ! bCenter )
            {
                dijit.popup.open({
                    popup: this.archiveCommentNew,
                    around: $(anchor),
                    orient: this.archiveCommentPosition
                });

                this.archiveCommentNewAnchor = 'page-title';

                var coords = dojo.position( anchor );
                this.archiveCommentMobile = {
                    id:comment_id,
                    anchor: anchor,
                    bCenter:bCenter,
                    lastX: coords.x,
                    lastY: coords.y
                };

                dojo.query( '.dijitTooltipConnector' ).style( 'display', 'block' );
            }
            else
            {
                var gamearena = dojo.position( anchor_for_center );

                if( anchor_for_center == 'game_play_area' )
                {
                    // Center on screen (default position, slightly on the left)
                    var centered_x = gamearena.w/2-( 430/2 );

                    dijit.popup.open({
                        popup: this.archiveCommentNew,
                        x: 50,
                        y: 180,
                        orient: this.archiveCommentPosition
                    });    
                }
                else
                {
                    // Centered on the given anchor element
                    var centered_x = gamearena.x+ gamearena.w/2-( 430/2 );
                    var centered_y = gamearena.y - gamearena.h/2;

                    dijit.popup.open({
                        popup: this.archiveCommentNew,
                        x: centered_x,
                        y: centered_y,
                        orient: 'above-centered'
                    });    

                }


                this.archiveCommentNewAnchor = 'archivecontrol_editmode_centercomment';

                this.archiveCommentMobile = {
                    id:comment_id,
                    anchor: anchor_for_center,
                    bCenter:bCenter,
                    lastX: centered_x,
                    lastY: 200
                };

                dojo.query( '.dijitTooltipConnector' ).style( 'display', 'none' );
            }

            // Animate
            dojo.query( '.dijitTooltipDialogPopup' ).addClass('scale-in-center');


            dojo.connect( $('newArchiveCommentContinueMode'), 'onchange', this, 'onArchiveCommentContinueModeChange' );
            dojo.connect( $('newArchiveCommentDisplayMode'), 'onchange', this, 'onArchiveCommentDisplayModeChange' );
            dojo.connect( $('newArchiveCommentMinimize'), 'onclick', this, 'onArchiveCommentMinimize' );
            if( continuemode == 1 )
            {
                $('newArchiveCommentContinueMode').value = 1;

                // Destroy "continue" button & replace with a warning
                dojo.place( '<span class="smalltext" id="do_action_to_continue">'+__('lang_mainsite',"Do the action to continue")+'</span>', 'newArchiveCommentNext', 'after' );
                dojo.destroy( 'newArchiveCommentNext' );
            }
            if( displaymode == 1 )
            {
                $('newArchiveCommentDisplayMode').value = 1;
            }


            this.archiveCommentMobile.timeout = setTimeout( dojo.hitch( this, 'onRepositionPopop' ), 10 );

            if( mode=='edit' )
            {
                this.addTooltip( 'newArchiveCommentMove', '', __('lang_mainsite', 'Attach this comment somewhere else' ) );
                this.addTooltip( 'newArchiveCommentAdditionalImage', '', __('lang_mainsite',"Add image on interface") );
                this.addTooltip( 'newArchiveCommentShowHelp', '', __('lang_mainsite',"Show tips") );

                dojo.style( 'newArchiveCommentMinimize', 'display', 'none' );
                dojo.style( 'newArchiveCommentDisplayControls', 'display', 'none' );
                dojo.style( 'newArchiveCommentTextDisplay', 'display', 'none' );
                dojo.style( 'newArchiveCommentShowHelp', 'display', 'inline' );
                dojo.style( 'newArchiveCommentAdditionalImage', 'display', 'inline' );
                dojo.style( 'newArchiveCommentHelp', 'display', 'none' );

                dojo.addClass(  'newArchiveComment', 'newArchiveCommentEdit' );
                dojo.connect( $('newArchiveCommentCancel'), 'onclick', this, 'onNewArchiveCommentCancel' );
                dojo.connect( $('newArchiveCommentMove'), 'onmousedown', this, 'onNewArchiveCommentStartDrag' );
                dojo.connect( $('newArchiveCommentShowHelp'), 'onclick', this, dojo.hitch( this, function( evt ) {
                    dojo.stopEvent( evt );
                    dojo.style( 'newArchiveCommentShowHelp', 'display', 'none' );
                    dojo.style( 'newArchiveCommentHelp', 'display', 'block' );
                } ) );

                dojo.connect( $('newArchiveCommentAdditionalImage'), 'onclick', this, dojo.hitch( this, function( evt ) {
                    dojo.stopEvent( evt );

                    // Add additional image, directly on the interface
                    // At first, get the link to the image

                    this.askForValueDialog( _('Please enter the URL of the image you want to add'), dojo.hitch( this, function( value ) {

                        if( this.validURL( value ))
                        {
                            this.archiveCommentImageToAnchor = value;
                            this.showMessage( _("Please click now on the game interface element where you want to anchor this image."), 'info' );
                        }
                        else
                        {
                            this.showMessage( _("Sorry this is not a valid image URL."), 'error' );
                        }

                    }), dojo.string.substitute( _("Tips: you may use ${url} to upload an image, and then copy/paste the URL."), {url:'<a href="https://snipboard.io/">Snipboard.io</a>'} ) );
                    dojo.style( 'popin_askforvalue_dialog','zIndex', 1001 );

                } ) );

                $('newArchiveCommentText').focus();

                // Adjust allowed number of characters to not take into account image URLs size changes after downloading for hosting by BGA that could prevent modification otherwise
                if ($('newArchiveCommentText').value != '') {
                    var tmpTxt = $('newArchiveCommentText').value;
                    var regexp = new RegExp("\\[img\\](http:|https:)\\/\\/.*?\\/data\\/tutorials\\/(.*?)\\[\\/img\\]","g");
                    tmpTxt = tmpTxt.replace( regexp, '[img]$2[/img]');
                    var delta = $('newArchiveCommentText').value.length - tmpTxt.length;
                    if (delta > 0) $('newArchiveCommentText').maxLength = this.tuto_textarea_maxlength + delta;
                }

                if( bInfosAvailable )
                {
                    dojo.style( 'newArchiveCommentSave', 'display', 'none' );
                    this.archiveCommentNewAnchor = anchors[0].innerHTML;
                    dojo.connect( $('newArchiveCommentSaveModify_'+comment_id), 'onclick', this, 'onNewArchiveCommentSaveModify' );
                }
                else
                {
                    dojo.style( 'newArchiveCommentSaveModify_'+comment_id, 'display', 'none' );
                    dojo.connect( $('newArchiveCommentSave'), 'onclick', this, 'onNewArchiveCommentSave' );
                }

                this.onArchiveCommentContinueModeChange();

                // Enabling game interface elements pointing
                this.archiveCommentPointElementMouseEnterEvt = dojo.connect( window, 'mouseover', this, 'onArchiveCommentPointElementOnMouseEnter' );


            }
            else if( mode == 'display' || mode == 'saved' || mode == 'displayid' )
            {
                dojo.addClass(  'newArchiveComment', 'newArchiveCommentDisplay' );

                dojo.style( 'newArchiveCommentControls', 'display', 'none' );
                dojo.style( 'newArchiveCommentMove', 'display', 'none' );
                dojo.style( 'newArchiveCommentMinimize', 'display', 'block' );
                dojo.style( 'newArchiveCommentText', 'display', 'none' );
                dojo.style( 'newArchiveCommentContinueMode', 'display', 'none' );
                dojo.style( 'newArchiveCommentDisplayMode', 'display', 'none' );
                dojo.style( 'newArchiveCommentOptions', 'display', 'none' );
                dojo.style( 'newArchiveCommentHelp', 'display', 'none' );
                dojo.style( 'newArchiveCommentShowHelp', 'display', 'none' );
                dojo.style( 'newArchiveCommentAdditionalImage', 'display', 'none' );


                if( !bCurrentPlayerAuthor ||  g_tutorialwritten.mode == 'view'  )
                {
                    dojo.style( 'newArchiveCommentDelete', 'display', 'none' );
                    dojo.style( 'newArchiveCommentModify', 'display', 'none' );
                }
                else
                {
                    dojo.connect( $('newArchiveCommentDelete'), 'onclick', this, 'onNewArchiveCommentDelete' );
                    dojo.connect( $('newArchiveCommentModify'), 'onclick', this, 'onNewArchiveCommentModify' );
                }

                if( $('newArchiveCommentNext' ) )
                {
                    dojo.connect( $('newArchiveCommentNext'), 'onclick', this, 'onNewArchiveCommentNext' );
                }
            }

            if( comment_id == 'conclusion' )
            {
                this.tutoratingDone = false;


                dojo.query( '.tuto_rating' ).style( 'cursor', 'pointer' );
                dojo.query( '.tuto_rating' ).connect( 'onmouseenter', this, 'onTutoRatingEnter' );
                dojo.query( '.tuto_rating' ).connect( 'onmouseleave', this, 'onTutoRatingLeave' );
                dojo.query( '.tuto_rating' ).connect( 'onclick', this, 'onTutoRatingClick' );
                dojo.style('newArchiveCommentMinimize', 'display', 'none' );
                dojo.style('newArchiveComment', 'textAlign', 'center');

                // Specific conclusion buttons
                //dojo.place( '<div id="quittutorial" class="bgabutton bgabutton_blue">'+__('lang_mainsite',"Quit tutorial")+'</div>', 'newArchiveCommentNext', 'after' );
                //dojo.connect( $('quittutorial'), 'onclick', this, 'onQuitTutorial' );
                dojo.destroy( 'newArchiveCommentNext' );
                dojo.style('newArchiveCommentDisplayControls', 'display', 'none');

                if( $('end_tutorial_play_now') )
                {
                    dojo.connect( $('newArchiveCommentTextDisplay'), 'onclick', this, function() {
                        window.location.href = $('end_tutorial_play_now').href;
                    });
                }


                if( dojo.query( '.tuto_rating').length > 0 )
                {
                    this.bTutorialRatingStep = true;
                }
            }

            if( g_tutorialwritten.mode == 'view' )
            {
                // In that case, the whole window is a "click to next comment"
                if( $('newArchiveCommentNext' ) )
                {
                    dojo.connect( $('newArchiveComment'), 'onclick', this, 'onNewArchiveCommentNext' );
                    dojo.addClass( 'newArchiveComment', 'archiveCommentClickable' );
                }
            }

            return true;
        },

        getCommentsViewedFromStart: function()
        {
            return dojo.query( '.archiveComment.commentviewed' ).length;
        },

        onArchiveCommentMinimize: function( evt )
        {
            dojo.stopEvent( evt );

            clearTimeout( this.archiveCommentMobile.timeout );

            dojo.style( 'archiveCommentMinimizedIcon', 'display', 'block' );
            this.placeOnObject( 'archiveCommentMinimizedIcon', 'newArchiveComment' );
            this.slideToObjectPos( 'archiveCommentMinimizedIcon', 'archiveCommentMinimized', 10, 0 ).play();

            dijit.popup.close( this.archiveCommentNew );

        },

        onArchiveCommentMaximize: function( evt )
        {
            dojo.stopEvent( evt );

            this.showArchiveComment( 'display', this.archiveCommentNo );
            dojo.style( 'archiveCommentMinimizedIcon', 'display', 'none' );
        },

        applyArchiveCommentMarkup: function( text )
        {
            text = this.addSmileyToText( text );

            text = this.applyCommentMarkup( text );
            text = this.nl2br( text, false );

            // + images jpg
            var regexp = new RegExp("\\[img\\]((http:|https:)\\/\\/.*?\\.jpg)\\[\\/img\\]","g")
            text = text.replace( regexp, '<img src="$1" style="max-width:100%;margin-top:10px;margin-bottom:10px;">');

            var regexp = new RegExp("\\[img\\]((http:|https:)\\/\\/.*?\\.jpeg)\\[\\/img\\]","g")
            text = text.replace( regexp, '<img src="$1" style="max-width:100%;margin-top:10px;margin-bottom:10px;">');

            // + images png
            var regexp = new RegExp("\\[img\\]((http:|https:)\\/\\/.*?\\.png)\\[\\/img\\]","g")
            text = text.replace( regexp, '<img src="$1" style="max-width:100%;margin-top:10px;margin-bottom:10px;">');

            // ... but block other images
            var regexp = new RegExp("\\[img\\]((http:|https:)\\/\\/.*?)\\[\\/img\\]","g")
            text = text.replace( regexp, '[img]Sorry we support only .jpg and .png images[/img]');

            return text;
        },

        // Must display a target on this element, with choices to colorize it
        onArchiveCommentPointElementOnMouseEnter: function( evt )
        {
            if (!evt.target || !evt.target.id || evt.target.id == 'archiveCommentElementPointerTarget'|| evt.target.id == 'archiveCommentElementPointerTargetInner' ) {
                return;
            }

            if( typeof this.archiveCommentDraggingInProgress != 'undefined' && this.archiveCommentDraggingInProgress )
            {
                // We are dragging archive comment => cannot do comment pointing at the same time
                return ;
            }

            // To be valid, current node must have a parent in the following list:
            // _ game_play_area
            // _ page-title
            // _ player_boards

            var bHasAValidParent = false;

            // If a parent is newArchiveComment => cannot be selected
            // ... or a topbar things
            var thisnode = evt.target;
            while( thisnode != null )
            {
                if( thisnode.id && thisnode.id == 'game_play_area' )
                {   bHasAValidParent = true; }

                if( thisnode.id && thisnode.id == 'page-title' )
                {   bHasAValidParent = true; }

                if( thisnode.id && thisnode.id == 'player_boards' )
                {   bHasAValidParent = true; }

                thisnode = thisnode.parentNode;
            }

            if( ! bHasAValidParent )
            {   return ;    }

            var dim = dojo.position( evt.target );
            if( dim.w >300 && dim.h > 300 )
            {
                // Too big to be highlighted
                return ;
            }

            if( ! $('archiveCommentElementPointerTarget' ) )
            {
                dojo.place( '<div id="archiveCommentElementPointerTarget"><div id="archiveCommentElementPointerTargetInner"></div></div>', 'page-content' );
            }

            dojo.style( 'archiveCommentElementPointerTargetInner', 'width', dim.w+'px' );
            dojo.style( 'archiveCommentElementPointerTargetInner', 'height', dim.h+'px' );

            // The target must be positioned for proper display
            if (dojo.style(evt.target, 'position') == 'static') {
                dojo.style(evt.target, 'position', 'relative');
            }
            // The target must have visible overflow
            if (dojo.style(evt.target, 'overflow') != 'visible') {
                dojo.style(evt.target, 'overflow', 'visible');
            }

            this.attachToNewParentNoReplace( 'archiveCommentElementPointerTarget', evt.target, 'first' );
            dojo.connect( $('archiveCommentElementPointerTargetInner'), 'onclick', this, 'onArchiveCommentPointElementClick' );
            this.addTooltip( 'archiveCommentElementPointerTargetInner', '', __('lang_mainsite','Click to highlight / unhighlight this element') );

            this.archiveCommentPointElementMouseEnterItem = evt.target.id;
        },

        // Remove all editing elements linked to Element pointing with archive comment
        removeArchiveCommentPointElement: function()
        {
            dojo.disconnect( this.archiveCommentPointElementMouseEnterEvt );
            this.archiveCommentPointElementMouseEnterEvt = null;
            dojo.destroy( 'archiveCommentElementPointerTarget' );
        },

        archiveCommentAttachImageToElement: function( element, x, y )
        {
            var image_src = element.getAttribute( 'datasrc');

            var image_id = element.id+'_attached_webcommentimage';

            if (!image_src.match(/.(jpg|jpeg|png)$/i))
            {
                var html = '<img id="'+image_id+'" src="'+getStaticAssetUrl('img/mainsite/unsupported_types.jpg')+'"  class="archiveCommentAttachedImage"></img>';
            }
            else
            {
                var html = '<img id="'+image_id+'" src="'+image_src+'" class="archiveCommentAttachedImage"></img>';
            }

            dojo.place( html, element );

            dojo.connect( $(image_id), 'onload', dojo.hitch( this, function() {

                if( typeof x != 'undefined' && typeof y != 'undefined')
                {
                    dojo.style( image_id, 'left', x+'px');
                    dojo.style( image_id, 'top', y+'px');
                }
                else
                {
                    this.placeOnObject( image_id, element );
                }


                var draggable_image = new ebg.draggable();
                draggable_image.create( this, image_id, image_id );


                this.bMustRemoveArchiveCommentImage = false;

                draggable_image.onStartDragging = dojo.hitch( this, function() {
                    dojo.style('archivecontrol_editmode', 'display', 'none' );
                    dojo.style( 'archivecontrol_editmode_dropcommentimage', 'display', 'block');

                    dojo.connect( $('archivecontrol_editmode_dropcommentimage'), 'mouseenter', dojo.hitch( this, (function(){this.bMustRemoveArchiveCommentImage=true; }) ) );
                    dojo.connect( $('archivecontrol_editmode_dropcommentimage'), 'mouseleave', dojo.hitch( this, (function(){this.bMustRemoveArchiveCommentImage=false;}) ) );
                } );
                draggable_image.onEndDragging = dojo.hitch( this, function( item_id ) {
                    dojo.style('archivecontrol_editmode', 'display', 'block' );
                    dojo.style( 'archivecontrol_editmode_dropcommentimage', 'display', 'none');

                    // Is the mouse in or out
                    if( this.bMustRemoveArchiveCommentImage )
                    {
                        // Remove it
                        dojo.destroy( item_id );
                    }
                } );

            }));

        },


        onArchiveCommentPointElementClick: function( evt )
        {
            dojo.stopEvent( evt );

            if( typeof this.archiveCommentImageToAnchor != 'undefined' &&  this.validURL( this.archiveCommentImageToAnchor ))
            {
                // There is an image to anchor here
                dojo.addClass( this.archiveCommentPointElementMouseEnterItem, 'archiveCommentPointedImage' );
                $( this.archiveCommentPointElementMouseEnterItem ).setAttribute( 'datasrc', this.archiveCommentImageToAnchor );
                this.archiveCommentAttachImageToElement( $( this.archiveCommentPointElementMouseEnterItem ) );
                return ;
            }

            // Add an element pointer
            var selection = dojo.query( '.tuto_pointer.selected')[0].id.split('_')[2];
            var elem_id = this.archiveCommentPointElementMouseEnterItem;



            if( dojo.query( '#'+elem_id+' .archiveCommentPointed'+selection).length > 0 )
            {
                // Remove existing pointer
                dojo.query( '#'+elem_id+' .archiveCommentPointed').forEach( dojo.destroy );
            }
            else
            {
                // Remove existing pointer
                dojo.query( '#'+elem_id+' .archiveCommentPointed').forEach( dojo.destroy );
    
                // Add a pointer associated to the element
                var html = '<div id="tuto_pointer_'+elem_id+'" class="archiveCommentPointed archiveCommentPointed'+selection+'"><div class="archiveCommentPointed_inner"></div></div>';
                dojo.place( html, this.archiveCommentPointElementMouseEnterItem );


            }
        },

        onArchiveCommentContinueModeChange: function( evt )
        {
            if( $('newArchiveCommentContinueMode').value == 0 )
            {
                dojo.style( 'newArchiveCommentContinueModeWarning', 'display', 'none' );
            }
            else
            {
                dojo.style( 'newArchiveCommentContinueModeWarning', 'display', 'block' );

                if( ! this.isCurrentPlayerActive() )
                {
                    alert( dojo.string.substitute( __('lang_mainsite','You can choose this option only if this is the turn of ${player}.'), {player: $('archiveViewerName').innerHTML} ) );
                    $('newArchiveCommentContinueMode').value = 0;
                    this.onArchiveCommentContinueModeChange();
                }
            }
        },

        onArchiveCommentDisplayModeChange: function( evt )
        {
            if( $('newArchiveCommentDisplayMode').value == 0 )
            {
                // With an arrow to the element
                // TODODO: reposition popup
            }
            else
            {
                // Above current elemente
                // TODODO: reposition popup
            }

        },

        onTutoRatingEnter: function( evt )
        {
            if( this.tutoratingDone )
            {   return ;    }

            // tutorating_<i>
            var star_id = evt.currentTarget.id.substr( 11 );

            for( var i = 1; i<=star_id; i++ )
            {
                dojo.removeClass( 'tutorating_'+i, 'fa-star-o' );
                dojo.addClass( 'tutorating_'+i, 'fa-star' );
            }
            for( ; i<=5; i++ )
            {
                dojo.removeClass( 'tutorating_'+i, 'fa-star' );
                dojo.addClass( 'tutorating_'+i, 'fa-star-o' );
            }

            if( toint(star_id) == 1 )
            {      $('rating_explanation').innerHTML = __('lang_mainsite',"I still don't know how to play this game ...");            }
            else if( toint(star_id) == 2 )
            {      $('rating_explanation').innerHTML = __('lang_mainsite',"I'm not really sure I can play this game.");            }
            else if( toint(star_id) == 3 )
            {      $('rating_explanation').innerHTML = __('lang_mainsite',"Imperfect, but at least I know how to play.");            }
            else if( toint(star_id) == 4 )
            {      $('rating_explanation').innerHTML = __('lang_mainsite',"Good tutorial.");            }
            else if( toint(star_id) == 5 )
            {      $('rating_explanation').innerHTML = __('lang_mainsite',"Perfect tutorial!");            }

        },
        onTutoRatingLeave: function( evt )
        {
            if( this.tutoratingDone )
            {   return ;    }

            for( var i = 1; i<=5; i++ )
            {
                dojo.removeClass( 'tutorating_'+i, 'fa-star' );
                dojo.addClass( 'tutorating_'+i, 'fa-star-o' );
            }
            $('rating_explanation').innerHTML = '&nbsp;';
        },
        onTutoRatingClick: function( evt )
        {
            dojo.stopEvent( evt );

            this.tutoratingDone = true;

            var star_id = evt.currentTarget.id.substr( 11 );

            this.ajaxcall( "/archive/archive/rateTutorial.html", {
                    id: g_tutorialwritten.id,
                    rating: star_id,
                    move:  toint( $('move_nbr').innerHTML )
                    }, this, function( result ){

                        this.showMessage( __('lang_mainsite',"Thanks for your feedback"), 'info' );

                        window.location.href = `/gamepanel?game=${this.game_name}#quick-play`;

                    }, function( is_error ) {
                        if( is_error )
                        {
                            this.tutoratingDone = false;
                        }
                    } );

        },

        onRepositionPopop: function()
        {
            if( $( this.archiveCommentMobile.anchor ) )
            {
                if( this.archiveCommentMobile.bCenter )
                {
                    dojo.query( '.dijitTooltipConnector' ).style( 'display', 'none' );

                    if( this.archiveCommentMobile.anchor == 'game_play_area' ) 
                    {
                        // Centered comment case => no need to reposition at all
                    }
                    else
                    {
                        // Centered on the given anchor element
                        var gamearena = dojo.position( this.archiveCommentMobile.anchor );

                        var popup_height = dojo.query( '.dijitTooltipDialogPopup' ).style( 'height' );

                        var centered_x = gamearena.x+ gamearena.w/2-( 430/2 );
                        var centered_y = gamearena.y - gamearena.h/2;

                        dijit.popup.close( this.archiveCommentNew );
                        dijit.popup.open({
                            popup: this.archiveCommentNew,
                            x: centered_x,
                            y: centered_y,
                            orient: 'above-centered'
                        });

                        var coords = dojo.position( this.archiveCommentMobile.anchor );
                        if( coords.x != this.archiveCommentMobile.lastX
                         || coords.y != this.archiveCommentMobile.lastY )
                        {
                            this.archiveCommentMobile.timeout = setTimeout( dojo.hitch( this, 'onRepositionPopop' ), 200 ); // Test 200ms later
                        }
                        else
                        {
                            this.archiveCommentMobile.timeout = setTimeout( dojo.hitch( this, 'onRepositionPopop' ), 1000 );    // Test every 1s when it is fixed
                        }
    
                    }

                }
                else
                {
                    // Because tooltips are sometimes strangely positionned, we must reposition them regularly in any case.

                    dojo.query( '.dijitTooltipConnector' ).style( 'display', 'block' );

                    dijit.popup.close( this.archiveCommentNew );
                    dijit.popup.open({
                        popup: this.archiveCommentNew,
                        around: $( this.archiveCommentMobile.anchor ),
                        orient: this.archiveCommentPosition
                    });

                    var coords = dojo.position( this.archiveCommentMobile.anchor );
                    if( coords.x != this.archiveCommentMobile.lastX
                     || coords.y != this.archiveCommentMobile.lastY )
                    {
                        this.archiveCommentMobile.timeout = setTimeout( dojo.hitch( this, 'onRepositionPopop' ), 200 ); // Test 200ms later
                    }
                    else
                    {
                        this.archiveCommentMobile.timeout = setTimeout( dojo.hitch( this, 'onRepositionPopop' ), 1000 );    // Test every 1s when it is fixed
                    }
                }
            }
        },

        clearArchiveCommentTooltip: function()
        {
            clearTimeout( this.archiveCommentMobile.timeout );
            if( this.archiveCommentNew !== null )
            {
                this.archiveCommentNew.destroy();
                dijit.popup.close( this.archiveCommentNew );
                this.archiveCommentNew = null;
            }

            this.removeArchiveCommentAssociatedElements();
        },

        removeArchiveCommentAssociatedElements: function()
        {
            dojo.query( '.archiveCommentPointed' ).forEach( dojo.destroy );
            dojo.query( '.archiveCommentAttachedImage' ).forEach( dojo.destroy );
            dojo.query( '.archiveCommentPointedImage' ).removeClass( 'archiveCommentPointedImage' );
            dojo.style( 'archiveCommentMinimizedIcon', 'display', 'none' );
        },

        onArchiveAddComment: function( evt )
        {
            evt.preventDefault();

            this.showArchiveComment( 'edit' );
        },

        onNewArchiveCommentCancel: function(evt)
        {
            dojo.stopEvent( evt );

            this.removeArchiveCommentPointElement();
            this.removeArchiveCommentAssociatedElements();

            this.archiveCommentNew.destroy( );
            this.archiveCommentNew = null;

            this.showArchiveComment( 'display', this.archiveCommentNo );
        },
        onNewArchiveCommentSave: function(evt)
        {
            dojo.stopEvent( evt );

            this.removeArchiveCommentPointElement();

            this.newArchiveCommentSave();
        },
        newArchiveCommentSave:function()
        {
            var msg = $('newArchiveCommentText').value;

            if( msg != '' )
            {
                this.ajaxcall( "/archive/archive/addArchiveComment.html", {
                        table:this.table_id, viewpoint:this.player_id, move: toint( $('move_nbr').innerHTML ),
                        text:msg, anchor:this.archiveCommentNewAnchor,
                        aftercomment: this.archiveCommentLastDisplayedNo,
                        afteruid: g_last_msg_dispatched_uid,
                        continuemode: $('newArchiveCommentContinueMode').value,
                        displaymode: $('newArchiveCommentDisplayMode').value,
                        pointers: this.getArchiveCommentsPointers()
                        }, this, function( result ){
                    $('newArchiveCommentText').value = '';
                    dojo.place( result, 'archiveComments', 'first' );
                    this.archiveCommentNo++;
                    this.showArchiveComment( 'saved' );

                    dojo.style( 'publishtutorial_block', 'display', ( dojo.query( '.archiveComment' ).length > 0 ) ? 'block' : 'none' );

                    // Is this our first archive comment?

                    if( this.tutorialShowOnce( 23 ) )
                    {
                        var title = _("About making tutorials");
                        var text = _("Using game replays and comments, you can build tutorials for games on Board Game Arena!");
                        text += '<br/><br/>';
                        text += dojo.string.substitute( _('Before you start, please read carefully ${our_guidelines} to make sure your tutorial has a chance to be selected.'), { our_guidelines: '<a href="/tutorialfaq" target="_blank">'+ _('our guidelines')+'</a>' } );
                        this.infoDialog( text, title );
                    }
                } );
            }

        },
        onNewArchiveCommentSaveModify: function( evt )
        {
            dojo.stopEvent( evt );

            this.removeArchiveCommentPointElement();

            var comment_id = evt.currentTarget.id.substr( 28 );

            this.newArchiveCommentSaveModify( comment_id );
        },
        newArchiveCommentSaveModify: function( comment_id )
        {
            // newArchiveCommentSaveModify_<comment_id>
            var msg = $('newArchiveCommentText').value;

            if( msg != '' )
            {
                this.ajaxcall( "/archive/archive/updateArchiveComment.html", {
                        comment_id: comment_id,
                        text:msg,
                        anchor:this.archiveCommentNewAnchor,
                        continuemode: $('newArchiveCommentContinueMode').value,
                        displaymode: $('newArchiveCommentDisplayMode').value,
                        pointers: this.getArchiveCommentsPointers()
                        }, this, function( result ){
                    $('newArchiveCommentText').value = '';
                    dojo.place( result, 'archiveComment_'+this.archiveCommentLastDisplayedId, 'replace' );
                    this.showArchiveComment( 'displayid', comment_id );
                } );
            }

        },

        getArchiveCommentsPointers: function()
        {
            var res = '';

            dojo.query( '.archiveCommentPointed' ).forEach( function( node ) {
                 var classees = node.className.split(" ");
                 for( var i in classees )
                 {
                     var classname = classees[i];
                     if( classname.substr(0, 21) == 'archiveCommentPointed' )
                     {
                         var type = classname.substr( 21 );
                         if( type != '' && ! isNaN( type ))
                         {
                             res += node.parentNode.id+' '+type+' ';
                         }
                     }
 
                 }
             } );

            dojo.query( '.archiveCommentAttachedImage' ).forEach( function( node ) {
                var image_src = btoa( node.getAttribute( 'src') );
                var image_x =  Math.round( dojo.style( node, 'left' ) );
                var image_y = Math.round( dojo.style( node, 'top' ) );
                res += node.parentNode.id+' '+image_src+'/'+image_x+'/'+image_y+' ';
            } );

            return res;
        },

        onKeyPressTutorial: function( evt )
        {
            if( evt.keyCode == dojo.keys.SPACE )
            {
                dojo.stopEvent( evt );
                return false;
            }
        },
        onKeyUpTutorial: function(evt)
        {
            if( evt.keyCode == dojo.keys.SPACE )
            {
                if( $('newArchiveCommentNext') !== null )
                {
                    dojo.stopEvent( evt );
                    this.doNewArchiveCommentNext();


                    return false;
                }
                else
                {
                    if( $('do_action_to_continue') )
                    {
                        this.showMessage( __('lang_mainsite','You must do the action to continue the tutorial'), 'error');
                        return ;
                    }
                }
            }
        },

        onNewArchiveCommentNext: function( evt )
        {
            dojo.stopEvent( evt );

            this.doNewArchiveCommentNext();
        },
        doNewArchiveCommentNext: function()
        {
            if( ! this.checkLock( true ) )
            {
                // There is an move in progress, so we cannot send the "jump" action right now.
                // => delay the jump action when the move is over
                this.bJumpToNextArchiveOnUnlock = true;
                return ;
            }

            this.notifqueue.bStopAfterOneNotif = false;

            // We must clean the leading "archivewaiting" in the current notification queue
            // Reason: if we place a comment at the end of a move, which is quite frequent, we should not have any delay before playing
            //  the next notification

            if( this.notifqueue.queue.length > 0 )
            {
                if( this.notifqueue.queue[0].type == "archivewaitingdelay" )
                {
                    this.notifqueue.queue.shift();    // Remove archivewaitingdelay
                    this.notifqueue.queue.shift();    // Remove archivewaitingdelay_end
                }
            }

            this.archiveCommentNo++;
            this.clearArchiveCommentTooltip();

            if( this.checkIfArchiveCommentMustBeDisplayed() )
            {
                // Okay, we've shown next comment
            }
            else
            {
                // Is there a next comment?
                var commentNbr = dojo.query( '.archiveComment' ).length;

                if( this.getCommentsViewedFromStart() >= commentNbr )
                {
                    // No more comments
                    this.showMessage( __('lang_mainsite',"No more comments"), 'info' );

                    // Display at least 1 notif so we can have the result of the action when we are "doing the tutorial game action" with no comment afterward
                    this.doArchiveNextLog();
                }
                else
                {
                    this.archive_playmode = 'nextcomment';
                    this.sendNextArchive();
                }
            }
        },
        onNewArchiveCommentDelete: function( evt )
        {
            dojo.stopEvent( evt );

            this.confirmationDialog( __('lang_mainsite','Are you sure?'), dojo.hitch( this, function() {
                this.ajaxcall( "/archive/archive/deleteArchiveComment.html", {
                        id: this.archiveCommentLastDisplayedId
                        }, this, function( result ){
                    this.showMessage( __('lang_mainsite',"Done"),'info' );

                    this.removeArchiveCommentPointElement();

                    if( $('gamelog_archiveComment_'+this.archiveCommentLastDisplayedId ) )
                    {
                        dojo.destroy( 'gamelog_archiveComment_'+this.archiveCommentLastDisplayedId );
                    }
                    else
                    {
                        dojo.destroy( 'archiveComment_'+this.archiveCommentLastDisplayedId );
                    }
                    this.archiveCommentNo--; // Note: due to destruction
                    this.onNewArchiveCommentNext( evt );
                } );
            } ) );

            // Archive comments z-index are 1000 while dialogs are 950 => we need to explicitely push the dialog in front
            dojo.query( '.dijitDialog' ).style( 'zIndex', 1010 );
        },
        onNewArchiveCommentModify: function( evt )
        {
            dojo.stopEvent( evt );
            this.showArchiveComment( 'edit', this.archiveCommentLastDisplayedId );
        },
        onNewArchiveCommentStartDrag: function(evt )
        {
            dojo.addClass( 'overall-content', 'disable_selection' );
            dojo.style( 'newArchiveCommentControls', 'display', 'none' );
            dojo.style( 'newArchiveCommentMove', 'display', 'none' );
            dojo.style( 'newArchiveCommentMoveHelp', 'display', 'block' );

            dojo.style('archivecontrol_editmode', 'display', 'none' );
            dojo.style('archivecontrol_editmode_centercomment', 'display', 'block' );

            dojo.query( '.dijitTooltipConnector' ).style( 'display', 'block' );

            this.addCommentDragMouseUpLink = dojo.connect( $('ebd-body'), "onmouseup", this, "onNewArchiveCommentEndDrag" );
            this.addCommentDragMouseOverLink = dojo.connect( $('ebd-body'), "onmousemove", this, "onNewArchiveCommentDrag" );

            this.archiveCommentDraggingInProgress = true;
        },
        onNewArchiveCommentEndDrag: function( evt )
        {
            this.archiveCommentDraggingInProgress = false;

            dojo.removeClass( 'overall-content', 'disable_selection' );
            dojo.disconnect( this.addCommentDragMouseUpLink );
            dojo.disconnect( this.addCommentDragMouseOverLink );

            dojo.query( '.newArchiveCommentMouseOver' ).removeClass( 'newArchiveCommentMouseOver' );

            dojo.style( 'newArchiveCommentControls', 'display', 'block' );
            dojo.style( 'newArchiveCommentMove', 'display', 'block' );
            dojo.style( 'newArchiveCommentMoveHelp', 'display', 'none' );

            dojo.style('archivecontrol_editmode', 'display', 'block' );
            dojo.style('archivecontrol_editmode_centercomment', 'display', 'none' );

            if( this.archiveCommentMobile.anchor == 'archivecontrol_editmode_centercomment' )
            {
                // Must position dropdown as a "centered"
                dijit.popup.close( this.archiveCommentNew );
                dijit.popup.open({
                    popup: this.archiveCommentNew,
                    x: 50,
                    y: 180,
                    orient: this.archiveCommentPosition
                });
            }
            else
            {
                this.onArchiveCommentPointElementOnMouseEnter(evt);
            }

            // Save new position
            if( this.archiveCommentMobile.id != 0 )
            {
                // DEPRECATED : we do not save. Player must click on "save" to save all its change.
                //              otherwise, newArchiveCommentSaveModify is removing the current "edit"
                //              mode on the interface.
              //  this.newArchiveCommentSaveModify( this.archiveCommentMobile.id, 'moveonly' );
            }

        },

        onNewArchiveCommentDrag: function( evt )
        {
            console.log( 'onNewArchiveCommentDrag' );
            console.log( evt.target.id );

            var target = evt.target;

            while( ! target.id )
            {
                // Take the first parent with an ID, instead
                target = target.parentNode;
            }

            if( target.id )
            {
                if( ! dojo.hasClass( target, 'newArchiveCommentMouseOver' ) )
                {
                    dijit.popup.close( this.archiveCommentNew );

                    dojo.query( '.newArchiveCommentMouseOver' ).removeClass( 'newArchiveCommentMouseOver' );
                    dojo.addClass( target, 'newArchiveCommentMouseOver' );

                    dijit.popup.open({
                        popup: this.archiveCommentNew,
                        around: target,
                        orient: this.archiveCommentPosition
                    });

                    this.archiveCommentMobile.anchor = target.id;

                    this.archiveCommentNewAnchor=target.id;

                    this.archiveCommentMobile.bCenter = ( target.id == 'archivecontrol_editmode_centercomment' );
                }
            }
        },

        initCommentsForMove: function( move_id )
        {
            this.archiveCommentNo = 0;  // Note: display first comment for this move
            this.archiveCommentLastDisplayedNo=0;
            this.clearArchiveCommentTooltip();
        },

        // Note: called after each notification dispatched by gamenotif
        onEndOfNotificationDispatch: function()
        {
            if( g_archive_mode )
            {
                // Must check if there is some archive comment to dispatch now
                if( this.checkIfArchiveCommentMustBeDisplayed() )
                {
                    // We displayed some archive comment !

                    // => we must stop after this notif if we are in the "go to next comment" play mode
                    if( this.archive_playmode == 'nextcomment' )
                    {
                        this.notifqueue.bStopAfterOneNotif = true;

                        this.unlockInterface(  this.interface_locked_by_id );   // Note: unlock interface unconditionnally, because otherwise unlockInterface is unlocked when the LATEST notif from the packet is dispatched
                    }
                }
            }
        },

        // Check if some archive comment must be displayed, taking account current move / last notification dispatched
        // Display this archive if yes
        // Do nothing if not
        checkIfArchiveCommentMustBeDisplayed: function()
        {
            var next_notif = this.showArchiveComment( 'do_not_show_only_infos', this.archiveCommentNo );
            var move_id = $('move_nbr').innerHTML;

            if( next_notif && typeof next_notif.notif_uid != 'undefined' )
            {
                //console.log( "checkIfArchiveCommentMustBeDisplayed: move "+move_id+" / commentno "+this.archiveCommentNo+", there is a comment on notif "+next_notif.notif_uid+" and we dispatched "+g_last_msg_dispatched_uid);

                if( next_notif.notif_uid == 0 )
                {
                    // NULL uid => legacy archive comment => display it anyway
                    this.showArchiveComment( 'display', this.archiveCommentNo );
                    return true;
                }
                else
                {
                    if( g_last_msg_dispatched_uid == next_notif.notif_uid )
                    {
                        // notif UID matches!!!! Let's display this comment

//                        console.log( "checkIfArchiveCommentMustBeDisplayed: we should display comment" );

                        var archivecomment_internal_uid = move_id+'_'+this.archiveCommentNo+'_'+next_notif.notif_uid;
                        if( typeof this.archiveCommentAlreadyDisplayed[ archivecomment_internal_uid ] != 'undefined' )
                        {
                            // Already displayed
                            return false;
                        }
                        else
                        {
                            this.archiveCommentAlreadyDisplayed[ archivecomment_internal_uid ] = true;  // Note: to avoid to display twice the same comment (note: happend because of archivewaitingdelay notif that does not refresh g_last_msg_dispatched_uid)

//                            console.log( "checkIfArchiveCommentMustBeDisplayed: DO DISPLAY COMMENT!" );
                            this.showArchiveComment( 'display', this.archiveCommentNo );
                            return true;
                        }
                    }
                    else
                    {
                        // notif UID => there is nothing to do
                    }
                }

            }

            return false;
        },


        onHowToTutorial: function( evt )
        {
            dojo.stopEvent( evt );

            // Hide the current comment, otherwise it can mask the dialog
            this.clearArchiveCommentTooltip();

            var url = '/tutorialfaq';
            window.open(url,'_blank');
           
            // DEPRECATED now that we redirect to dedicated page
            /*

            var howToTuto = new ebg.popindialog();
            howToTuto.create( 'howToBuildTuto' );
            howToTuto.setTitle( __('lang_mainsite', 'How to build a tutorial?') );
            howToTuto.setMaxWidth( 600 );


            var html = '<div id="howToBuildTuto">';

            html += '<p>'+__('lang_mainsite',"You can add comments to a game replay to create a tutorial for a game.")+'</p>';
            html += '<p>'+__('lang_mainsite',"There is only ONE official tutorial for each game. If you want to build an official tutorial, you should contact first the developer of this game to get his authorization.")+'</p>';
            html += '<br/><h3>'+__('lang_mainsite',"Tips :")+'</h3>';
            html += '<p>_ '+__('lang_mainsite',"The shorter the better.")+'</p>';
            html += '<p>_ '+__('lang_mainsite',"The tutorial must be written IN ENGLISH: it will be translated afterwards by the community.")+'</p>';


            html += '<a id="howToTuto_btn" class="bgabutton bgabutton_blue">'+__('lang_mainsite','Close')+'</a>';
            html += "</div>";

            howToTuto.setContent( html );
            howToTuto.show();

            dojo.connect( $('howToTuto_btn'), 'onclick', dojo.hitch( howToTuto, function() {
                this.destroy();
            } ) );
*/

        },

        onTutoPointerClick: function( evt )
        {
            dojo.stopEvent( evt );

            dojo.query( '.tuto_pointer.selected').removeClass( 'selected');
            dojo.addClass( evt.currentTarget.id, 'selected');
        },

        onPublishTutorial: function( evt )
        {
            dojo.stopEvent( evt );

            this.clearArchiveCommentTooltip();

            if( $('publishTuto') )
            {
                dojo.destroy( 'publishTuto' );
            }

            if( this.game_status == 'private' )
            {
                this.showMessage( __("lang_mainsite", "You cannot publish a tutorial for a game in Alpha"), 'error' );
                return ;
            }
            if( this.game_name == 'terramystica' )
            {
                this.showMessage( __("lang_mainsite", "Sorry, but for legal reasons we cannot propose tutorial for this game on BGA."), 'error' );
                return ;
            }

            this.publishTuto = new ebg.popindialog();
            this.publishTuto.create( 'publishTuto' );
            this.publishTuto.setTitle( __('lang_mainsite', 'Publish as tutorial') );
            this.publishTuto.setMaxWidth( 600 );

            var html = '<div id="publishTuto">';

            html += '<p>'+__('lang_mainsite',"This game and your comments will be proposed to beginners as a tutorial to learn this game.")+'</p>';
            html += '<br/>';

            html += '<p>'+ dojo.string.substitute( __('lang_mainsite',"Before this, expert players (Gurus) will review your tutorial, evaluate it, and check that it respects <a href='${guidelines}' target='_blank'>BGA tutorial guidelines</a>.")+'</p>', {guidelines: '/tutorialfaq'} );


            html += '<br/>';
            html += '<input id="tuto_lang" type="checkbox"></input> ' + dojo.string.substitute( __('lang_mainsite',"My tutorial is written in English."), {guidelines: '/tutorialfaq'} )
            html += '<br/>';
            html += '<input id="tuto_guidelines" type="checkbox"></input> ' + dojo.string.substitute( __('lang_mainsite',"My tutorial respects <a href='${guidelines}' target='_blank'>BGA tutorial guidelines</a>."), {guidelines: '/tutorialfaq'} )
            html += '<br/>';


            html += '<br/>';

            html += '<p id="publish_conclusion"></p>';

            html += '<a id="closepublish_btn" class="bgabutton bgabutton_gray">'+__('lang_mainsite','Close')+'</a> ';
            html += '<a id="publishTuto_btn" class="bgabutton bgabutton_blue">'+__('lang_mainsite', 'Publish as tutorial')+'</a>';
            html += "</div>";

            this.publishTuto.setContent( html );
            this.publishTuto.show();


            dojo.connect( $('closepublish_btn'), 'onclick', dojo.hitch( this, function() {
                if( $('publish_conclusion').innerHTML !== '' )
                {
                    // Publication status may have changed => reload the page
                    window.location.reload(false);
                }
                this.publishTuto.destroy();

            } ) );

            dojo.connect( $('publishTuto_btn'), 'onclick', dojo.hitch( this, function() {

                if( ! $('tuto_lang').checked )
                {
                    this.showMessage( _("You must check all the checkboxes"), 'error');
                    return ;
                }
                if( ! $('tuto_guidelines').checked )
                {
                    this.showMessage( _("You must check all the checkboxes"), 'error');
                    return ;
                }

                this.ajaxcall( "/archive/archive/publishTutorial.html", {
                        id: this.table_id,
                        intro: '',
                        lang: 'en',
                        viewpoint: this.player_id
                        }, this, function( result ){

                    this.showMessage( __('lang_mainsite',"Done"),'info' );

                    var tuto_url = window.location.href + '&tutorial';
                    tuto_url = tuto_url.replace( '#&tutorial', '&tutorial' ); // In case there is a hash, we must remove it
                    $('publish_conclusion').innerHTML = __('lang_mainsite',"You can test the tutorial from the following URL (or send it to friends for review) :")+'<br/><a target="_blank" href="'+tuto_url+'">'+tuto_url+'</a>';
                    dojo.destroy( 'publishTuto_btn' );
                }, function() {}, 'post' );



            } ) );
        },

        onQuitTutorial: function( evt )
        {
            dojo.stopEvent( evt );

            if( typeof this.bTutorialRatingStep != 'undefined' && this.bTutorialRatingStep )
            {
                this.showMessage( __('lang_mainsite',"Please rate this tutorial to quit and return to BGA."), 'error' );
                return ;
            }

            analyticsPush({
                    'game_name': this.game_name,         
                    'event': 'tutorial_quit'         
            });

            // We remove the "tell the reason why you are leaving this tutorial" because it makes the tutorial ratings unsignificant

            /*
            this.quitTutorialDlg = new ebg.popindialog;
            this.quitTutorialDlg.create( 'quitTutorialDlg' );
            this.quitTutorialDlg.setTitle( __('lang_mainsite', 'Quit tutorial') );



            var html = '<div id="quitTutorialDlgContent">';

            html += "<div style='text-align: center;margin: 60px'>";

                html += '<h2>'+__('lang_mainsite',"Your help is very important to improve our tutorials")+'</h2>';

                html += '<p>'+__('lang_mainsite',"Why do you want to quit?")+'</p>';

                html += "<p><a href='#' id='quitTutorialNoTime' class='bgabutton bgabutton_blue bgabutton_big quitTutorialReason'>"+ __('lang_mainsite',"I don't have time to continue.").replace(/\.$/, "")+"</a></p>";
                html += "<p><a href='#' id='quitTutorialOk' class='bgabutton bgabutton_blue bgabutton_big quitTutorialReason'>"+__('lang_mainsite',"I got everything I need to play.").replace(/\.$/, "")+"</a></p>";
                html += "<p><a href='#' id='quitTutorialPoor' class='bgabutton bgabutton_blue bgabutton_big quitTutorialReason'>"+__('lang_mainsite',"This is a poor tutorial.").replace(/\.$/, "")+"</a></p>";
                html += "<p><a href='#' id='quitTutorialCancel' class='bgabutton bgabutton_gray quitTutorialReason'>"+__('lang_mainsite',"Cancel")+"</a></p>";


            html += "</div>"; // div for text-align:center

            html += "</div>"; // quitTutorialDlgContent

            this.quitTutorialDlg.setContent( html );
            this.quitTutorialDlg.show();

            // Archive comments z-index are 1000 while dialogs are 950 => we need to explicitely push the dialog in front
            dojo.style( 'popin_quitTutorialDlg','zIndex', 1001 );

            dojo.query( '.quitTutorialReason' ).connect( 'onclick', this, 'onQuitTutorialReason' );
            */

            window.location.href = `/gamepanel?game=${this.game_name}#quick-play`;

        },
/*
        onQuitTutorialReason: function( evt )
        {
            dojo.stopEvent( evt );

            var rating = 0;

            if( evt.currentTarget.id == 'quitTutorialNoTime' )
            {   rating = 0; // No rating
            }
            else if( evt.currentTarget.id == 'quitTutorialOk' )
            {   rating = 4; // Average rating, as we know how to play but the tutorial is too long
            }
            else if( evt.currentTarget.id == 'quitTutorialPoor' )
            {   rating = 1; // Lowest possible rating
            }
            else if( evt.currentTarget.id == 'quitTutorialCancel' )
            {
                this.quitTutorialDlg.destroy();
                return ;
            }

            this.ajaxcall( "/archive/archive/rateTutorial.html", {
                    id: g_tutorialwritten.id,
                    rating: rating,
                    move:  toint( $('move_nbr').innerHTML )
                    }, this, function( result ){

                        if( rating >= 3 )
                        {
                            window.location.href = '/'+this.mslobby+'?game='+this.game_id;
                        }
                        else
                        {
                            window.location.href = '/gamepanel?id='+this.game_id;
                        }

                    }, function( is_error ) {
                    } );


        },
        */

        // Load archive logs & comments in "Replay logs" section
        loadReplayLogs: function()
        {
            var nodeReplayLogs = this.getReplayLogNode();

            dojo.empty( nodeReplayLogs );

            if( g_tutorialwritten.status == 'public' )
            {
                // Display tutorial stats
                dojo.place( '<div class="row"><div id="replaylogs" class="col-md-8"></div><div id="tutorial_stats" class="col-md-4"><h4>'+__('lang_mainsite','Tutorial statistics')+'</h4></div></div>', nodeReplayLogs );

                var html = '';
                html += '<div class="row-data"><div class="row-label">Unique view</div><div class="row-value">'+g_tutorialwritten.stats.viewed+'</div></div>';
                html += '<div class="row-data"><div class="row-label">Recent (<2 months)</div><div class="row-value">'+g_tutorialwritten.stats.recentviewed+'</div></div>';
                html += '<div class="row-data"><div class="row-label">Average rating</div><div class="row-value">'+(  Math.round( g_tutorialwritten.stats.rating*10 )/10 )+' / 5</div></div>';
                html += '<div class="row-data"><div class="row-label">Viewed duration</div><div class="row-value">'+( ( g_tutorialwritten.stats.duration===null ) ? '-' : g_tutorialwritten.stats.duration )+' mn</div></div>';
                html += '<div class="row-data"><div class="row-label">&nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></div><div class="row-value">'+g_tutorialwritten.stats.rating5 +'</div></div>';
                html += '<div class="row-data"><div class="row-label">&nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></div><div class="row-value">'+g_tutorialwritten.stats.rating4 +'</div></div>';
                html += '<div class="row-data"><div class="row-label">&nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></div><div class="row-value">'+g_tutorialwritten.stats.rating3 +'</div></div>';
                html += '<div class="row-data"><div class="row-label">&nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-star"></i><i class="fa fa-star"></i></div><div class="row-value">'+g_tutorialwritten.stats.rating2 +'</div></div>';
                html += '<div class="row-data"><div class="row-label">&nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-star"></i></div><div class="row-value">'+g_tutorialwritten.stats.rating1 +'</div></div>';

                for( var step in g_tutorialwritten.stats.steps )
                {
                    var nbr = g_tutorialwritten.stats.steps[step];
                    var pcent = Math.round( 100 * nbr / g_tutorialwritten.stats.recentviewed );
                    html += '<div class="row-data"><div class="row-label">Abandon on move '+step+'</div><div class="row-value">'+nbr+' ('+pcent+'%)</div></div>';
                }

                dojo.place( html, 'tutorial_stats' );
            }
            else
            {
                dojo.place( '<div class="row"><div class="col-md-1"></div><div id="replaylogs" class="col-md-10"></div></div>', nodeReplayLogs );
            }

            var previous_date = '';
            var date_string = '';
            var previous_move = null;

            var html = '';
            var cursor_first_pos = null;
            var bMoveTxtDisplayed = false;
            var viewed = '';

            html += '<div id="archivecursor"><i class="fa fa-caret-right fa-3x" aria-hidden="true"></i></div>';

            for( var i in g_gamelogs )
            {
                var gamelogpacket = g_gamelogs[i];
                var bIsLogVisible = true;

                if( gamelogpacket.channel.substr( 0, 6 ) != '/table' )
                {
                    // This is a private notification for a player

                    if( (gamelogpacket.channel == this.private_channel ) // Compatibility mode for old archives
                     || (gamelogpacket.channel == '/player/p'+this.player_id ) )
                    {
                        // This is a notification for our player !
                    }
                    else
                    {
                        bIsLogVisible = false;
                    }
                }

                if( bIsLogVisible )
                {

                    if( gamelogpacket.move_id !== null && previous_move !== null && previous_move != gamelogpacket.move_id )
                    {
                        // We must close previous move first
                        html += '</div>';   // replaylogs_move
                    }

                    var bFirstMoveLogs = false;
                    if( gamelogpacket.move_id !== null && previous_move != gamelogpacket.move_id )
                    {
                        // Starting new move
                        bFirstMoveLogs = true;

                        previous_move = gamelogpacket.move_id;

                        viewed = '';
                        if( gamelogpacket.move_id <= toint( $('move_nbr').innerHTML ) )
                        {   viewed = ' viewed ';  }

                        var movetxt = '<div id="replaylogs_move_'+gamelogpacket.move_id+'" class="replaylogs_move '+viewed+'"><div class="replaylogs_progression"><div id="replaylogs_progression_'+gamelogpacket.move_id+'" class="replaylogs_progression_bottom"></div></div><div class="smalltext">'+__('lang_mainsite','Move')+' '+gamelogpacket.move_id+' :';

                        if( typeof gamelogpacket.time != 'undefined' )  // Now, we have a timestamp in game log packet
                        {

                            var date = new Date( gamelogpacket.time*1000 );
                            date_string = date.toLocaleDateString();
                            if( date_string != previous_date )
                            {
                                movetxt +=  '<span style="float: right">'+date_string+' '+ date.toLocaleTimeString()+'</span></div>';
                            }
                            else
                            {
                                movetxt +=  '<span style="float: right">'+date.toLocaleTimeString()+'</span></div>';
                            }
                        }
                        else
                        {
                            // Old style (only hh:mm with server time)
                            movetxt +=  '<span style="float: right">'+gamelogpacket.data[0].time+' GMT+1</span></div>';
                        }

                        // We won't display this move until bMoveTxtDisplayed is true
                        bMoveTxtDisplayed = false;
                    }

                    for( var j in gamelogpacket.data )
                    {
                        var gamelog = gamelogpacket.data[j];
                        if( gamelog.log != '' )
                        {
                            if( !bMoveTxtDisplayed )
                            {
                                // Ther is at least one log for this move => add this move to HTML
                                bMoveTxtDisplayed = true;
                                html += movetxt;
                            }
                            html += '<div class="gamelogreview whiteblock">'+this.format_string_recursive( gamelog.log, gamelog.args )+'</div>';
                        }
                    }

                    if( bMoveTxtDisplayed )
                    {
                        previous_date = date_string;

                        if( viewed != '' )
                        {   cursor_first_pos = gamelogpacket.move_id; }
                    }

                    if( bFirstMoveLogs )
                    {
                        // Check if there are some comments for this move
                        dojo.query( '.archiveComment_move'+gamelogpacket.move_id ).forEach( dojo.hitch( this, function( node ){
                            if( !bMoveTxtDisplayed )
                            {
                                // Originally we didn't plan to display this move (no logs), but as there is a comment we must display it.
                                bMoveTxtDisplayed = true;
                                html += movetxt;
                            }
                            html += '<div class="gamelogreview gamelog_archivecomment whiteblock"><i class="fa fa-graduation-cap" style="float:left;margin-right:8px;"></i>'+ node.outerHTML +'<i class="fa fa-trash"></i></div>';
                            dojo.destroy( node );   // Note : we are replacing the original comments management
                        }  ) );
                    }
                }
            }

            if( previous_move !== null )
            {
                // We must close last move
                html += '</div>';   // replaylogs_move
            }


            dojo.place( html, 'replaylogs' );

            dojo.query( '.replaylogs_move' ).connect( 'onclick', this, 'onReplayLogClick' );
            if( cursor_first_pos !== null )
            {
                this.archiveCursorPos = cursor_first_pos;
                this.replaceArchiveCursor();
            }

            // All logs with "own_comment" must transmit this class to their .gamelog_archivecomment parent
            dojo.query( '.own_comment' ).forEach( function( node ) {
                dojo.addClass( node.parentNode, 'own_comment' );
                node.parentNode.id = 'gamelog_'+node.id;
            } );

            // Edit comments (only if WE are the authors of the comment)
            dojo.query( '.own_comment .archiveComment_text' ).connect( 'onclick', this, 'onEditReplayLogsComment' );

            // Never do any actions if we click on a comment (because we except, for example, editing it)
            dojo.query( '.archiveComment' ).connect( 'onclick', this, function( evt ){   dojo.stopEvent( evt );  } );

            dojo.query( '.gamelog_archivecomment .fa-trash' ).connect( 'onclick', this, 'onRemoveReplayLogsComment' );
        },


        replaceArchiveCursor: function()
        {
            this.slideToObjectPos( 'archivecursor',  'replaylogs_progression_'+this.archiveCursorPos, -30, -23 ).play();
        },


        onEditReplayLogsComment: function( evt )
        {
            dojo.stopEvent( evt );

            // archiveComment_text_<id>
            var comment_id = evt.currentTarget.id.substr( 20 );

            // Replace this by a textarea
            dojo.place( '<div id="replaylogs_edit_inplace_'+comment_id+'" class="replaylogs_edit_inplace"><textarea  id="replaylogs_edit_text_'+comment_id+'">'+( evt.currentTarget.innerHTML )+'</textarea><br/><div id="replaylogs_edit_save_'+comment_id+'" class="bgabutton bgabutton_blue">'+__('lang_mainsite',"Save")+'</div></div>', evt.currentTarget.id, 'after' );
            dojo.style( evt.currentTarget.id, 'display', 'none' );

            dojo.connect( $('replaylogs_edit_save_'+comment_id ), 'onclick', this, 'onEditReplayLogsCommentSave' );
        },

        onRemoveReplayLogsComment: function( evt )
        {
            dojo.stopEvent( evt );

            // gamelog_archiveComment_<id>
            var comment_id = evt.currentTarget.parentNode.id.substr( 23 );

            this.confirmationDialog( __('lang_mainsite','Are you sure?'), dojo.hitch( this, function() {
                this.ajaxcall( "/archive/archive/deleteArchiveComment.html", {
                        id: comment_id
                        }, this, function( result ){
                    this.showMessage( __('lang_mainsite',"Done"),'info' );
                    dojo.destroy( 'gamelog_archiveComment_'+comment_id );
                } );
            } ) );

        },

        onEditReplayLogsCommentSave: function( evt )
        {
            dojo.stopEvent( evt );

            // replaylogs_edit_save_<id>
            var comment_id = evt.currentTarget.id.substr( 21 );

            var msg = $('replaylogs_edit_text_'+comment_id).value;

            if( msg == '' )
            {
                // Remove this comment
                // TODO
            }
            else
            {
                this.ajaxcall( "/archive/archive/updateArchiveComment.html", {
                        comment_id: comment_id,
                        text:msg, anchor:''
                        }, this, function( result ){

                    dojo.style( 'archiveComment_text_'+comment_id, 'display', 'block' );
                    $('archiveComment_text_'+comment_id).innerHTML = msg;
                    dojo.destroy( 'replaylogs_edit_inplace_'+comment_id );
                } );
            }
        },

        onReplayLogClick: function( evt )
        {
            dojo.stopEvent( evt );

            // replaylogs_move_<id>
            var replay_from = evt.currentTarget.id.substr( 16 );

            if( ( toint( replay_from )-1 ) < toint( $('move_nbr').innerHTML ) )
            {
                // Replay in the past : must reload page
                this.insertParamIntoCurrentURL( 'goto', replay_from-1 );
            }
            else if(  ( toint( replay_from )-1 ) == toint( $('move_nbr').innerHTML ) )
            {
                // Do nothing (we are at the correct place)
            }
            else
            {
                // Forward to this move
                $('archive_go_to_move_nbr').value = replay_from-1;
                this.archive_gotomove = toint( replay_from-1 );
                this.archive_playmode = 'goto';
                this.sendNextArchive();
            }

        },


        //////////////////////////////////////////////////////////////
        ///// Image loading detector

        // Ensure all games image are loaded
        ensureImageLoading: function()
        {
            for( var i in g_img_preload )
            {
                var image_name = g_img_preload[i];
                if( image_name != '' )
                {
                    var img = new Image();

                    dojo.connect( img, 'onload', this, 'onLoadImageOk' ); // Not used for now
                    dojo.connect( img, 'onerror', this, 'onLoadImageNok' );

                    var url = g_gamethemeurl+'img/'+image_name;

                    this.images_loading_status[ url ] = false;

                    img.src = g_gamethemeurl+'img/'+image_name;
                }
            }
        },

        // Ensure some specific images are loaded (for common images from the metasite !!! breaks game modularity !!!)
        ensureSpecificImageLoading: function( imagelist )
        {
            for( var i in imagelist )
            {
                var image_name = imagelist[i];
                if( image_name != '' )
                {
                    var img = new Image();

                    //dojo.connect( img, 'onload', this, 'onLoadImageOk' ); // Not used for now
                    dojo.connect( img, 'onerror', this, 'onLoadImageNok' );

                    img.src = getStaticAssetUrl('img/'+this.game_name+'/'+image_name);
                }
            }
        },

        // Ensure some specific images are loaded
        ensureSpecificGameImageLoading: function( imagelist )
        {
            for( var i in imagelist )
            {
                var image_name = imagelist[i];
                if( image_name != '' )
                {
                    var img = new Image();

                    dojo.connect( img, 'onload', this, 'onLoadImageOk' );
                    dojo.connect( img, 'onerror', this, 'onLoadImageNok' );

                    img.src = g_gamethemeurl+'img/'+image_name;
                }
            }
        },

        dontPreloadImage: function( image )
        {
            for( var i in g_img_preload )
            {
                var image_name = g_img_preload[i];
                if( image_name == image )
                {
                    g_img_preload.splice( i, 1 );
                }
            }
        },

        onLoadImageOk: function( evt )  // Note: not used for now
        {
            console.log( 'onLoadImageOk' );
            console.log( evt );

            var image_url = decodeURIComponent(  evt.target.src );

            if( typeof this.images_loading_status[ image_url ] != 'undefined' )
            {
                this.images_loading_status[ image_url ] = true;

                this.updateLoaderPercentage();
            }

        } ,
        onLoadImageNok: function( evt )
        {
            console.log( 'onLoadImageNok' );
            console.log( evt );

            this.showMessage( __('lang_mainsite',"Can't load image:") + ' <a href="'+evt.currentTarget.src+'" target="_blank">' + evt.currentTarget.src +'</a><br/>'+__('lang_mainsite', "Please check your connexion or hard-refresh this web page (Ctrl+F5)" ), 'error' );
        },



        updateLoaderPercentage: function()
        {
            if( typeof g_replayFrom != 'undefined')
            {
                // Skip classic loading screen during the "replay from move X" feature, because the "replay from move X" is already
                // using the loading screen when loading the past notifications to go to move X => cause a collision.
                return ;
            }

            // Base = 10
            // Images loaded = 90
            // Log history loaded = 100 (on the other progression bar)

            // Images
            var total_images = 0;
            var total_images_loaded = 0;
            for( var i in this.images_loading_status )
            {
                total_images ++;
                if( this.images_loading_status[i] )
                {
                    total_images_loaded ++;
                }
            }

            if( total_images == 0 )
                var pcent_images = 90;
            else
            {
                var pcent_images = 90 * total_images_loaded / total_images;
            }

            // Logs
            var pcent_logs = 0;

            if( this.log_history_loading_status.downloaded == 1 )
            {
                if( this.log_history_loading_status.total == 0 )
                {
                    pcent_logs = 100;
                }
                else
                {
                    pcent_logs = 100 * ( this.log_history_loading_status.loaded / this.log_history_loading_status.total );
                }
            }

            //document.title = '10 + / '+pcent_images+' / '+pcent_logs;

            this.setLoader( 10 + pcent_images, pcent_logs );
        },

        //////////////////////////////////////////////////////////////
        ///// Display table window

        displayTableWindow: function( id, title, data, header, footer, closelabel )
        {
            console.log( 'displayTableWindow' );

            if( typeof header == 'undefined' )
            {   header = '';    }
            if( typeof footer == 'undefined' )
            {   footer = '';    }
            if( typeof closelabel != 'undefined' )
            {
				footer += "<br/><br/><div style='text-align: center'>";
				footer += "<a class='bgabutton bgabutton_blue' id='close_btn' href='#'><span>"+_( closelabel )+"</span></a>";
				footer += "</div>";
			}

            var tableDlg = new ebg.popindialog();
            tableDlg.create( 'tableWindow' );
            tableDlg.setTitle( title );

            var html = "<div class='tableWindow'>";
            if( typeof header == 'object' ) {
            	header.args = this.notifqueue.playerNameFilterGame( header.args );
                html += this.format_string_recursive( header.str, header.args );
            } else {
            	html += header;
        	}
            html += "<table>";
            for( var row_id in data )
            {
                var row = data[ row_id ];
                html += "<tr>";
                for( col_id in row )
                {
                    var col = row[ col_id ];
                    if( typeof col == 'object' )
                    {
                        if( col.str && col.args )
                        {
                            if( col.type && col.type=='header' )
                            {   html += '<th>'; }
                            else
                            {   html += '<td>'; }
                            col.args = this.notifqueue.playerNameFilterGame( col.args );
                            html += this.format_string_recursive( col.str, col.args );
                            if( col.type && col.type=='header' )
                            {   html += '</th>'; }
                            else
                            {   html += '</td>'; }
                        }
                        else
                        {   html += '<td>invalid displayTable obj</td>'; }
                    }
                    else
                    {
                        html += "<td>"+col+"</td>";
                    }
                }
                html += "</tr>";
            }
            html += "</table>";
            html += footer;
            html += "</div>";

            tableDlg.setContent( html );

            if ( $('close_btn') ) {
				dojo.connect( $('close_btn'), 'onclick', this, function( evt )
				{
					evt.preventDefault();
					tableDlg.destroy();
				} );
			}

            tableDlg.show();

            return tableDlg;
        },

        ///////////////////////////////////////////////////
        //// Publisher banner management
        updatePubBanner: function()
        {
            if( g_archive_mode )
            {
                // There is no pub banner during archive (because there is no space for it)
                return ;
            }
            
            if( !this.isCurrentPlayerActive() && !this.gameisalpha )
            {
                var pubbanners = dojo.query( '.publisherannounce' );
                if( pubbanners.length == 0 )
                {   return; }   // No publisher annouce

                if( this.nextPubbanner === null )
                {
                    // First banner = random banner
                    var to_display = Math.floor((Math.random()*pubbanners.length));
                }
                else
                {
                    var to_display = this.nextPubbanner % pubbanners.length;
                }

                dojo.place( $('announce_'+to_display).innerHTML, 'inactiveplayermessage', 'only' );

                this.nextPubbanner++;
            }
            if( !this.isCurrentPlayerActive() && this.gameisalpha )
            {
				// For alpha games, we use the banner space to display information about alpha + link to report bugs/suggestions
				var html = '<div class="alphabanner">'
                html += '  <div style="display:inline-block; vertical-align: middle;">';
				html += '    <a href="#" class="emblemalpha emblemstatus emblemstatus_nofold" style="margin: 6px 8px 6px 8px;"></a>';
                html += '  </div><div style="display:inline-block; vertical-align: middle;">';
				html += '    <a target="_blank" href="'+this.metasiteurl+'/bug?id=0&table='+this.table_id+'" class="bgabutton bgabutton_small bgabutton_small_margin bgabutton_blue">'+_('Report a bug')+'</a>';
				html += '    <a target="_blank" href="'+this.metasiteurl+'/bug?id=0&table='+this.table_id+'&suggest" class="bgabutton bgabutton_small bgabutton_small_margin bgabutton_blue">'+_('Make a suggestion')+'</a>';
                html += '    <br />';
				html += '    <a target="_blank" href="'+this.metasiteurl+'/forum/viewtopic.php?f=240&t=17325" class="bgabutton bgabutton_small bgabutton_small_margin bgabutton_gray" style="margin-top: 0px;"> <i class="fa fa-info-circle"></i> '+_('Guidelines')+'</a>';
                if (this.game_group != '')
                    html += '    <a target="_blank" href="'+this.metasiteurl+'/group?id='+this.game_group+'" class="bgabutton bgabutton_small bgabutton_small_margin bgabutton_gray" style="margin-top: 0px;"> <i class="fa fa-comment"></i> '+_('Discuss')+'</a>';
                html += '  </div>';
				html += '</div>'
				dojo.place( html, 'inactiveplayermessage', 'only' );
			}
        },

        ///////////////////////////////////////////////////
        //// Save / restore game state
        onSaveState: function(evt)
        {
            evt.preventDefault();
            // debug_save1
            var stateid = evt.currentTarget.id.substr( 10 );
            this.ajaxcall( "/table/table/debugSaveState.html", {table:this.table_id, state:stateid}, this, function( result ){
                this.showMessage("Done",'info');
            } );
        },
        onLoadState: function(evt)
        {
            evt.preventDefault();
            // debug_load1
            var stateid = evt.currentTarget.id.substr( 10 );
            this.ajaxcall( "/table/table/loadSaveState.html", {table:this.table_id, state:stateid}, this, function( result ){
                this.showMessage("Done, reload in progress...",'info');
                window.location.reload();
            } );
        },



         ///////////////////////////////////////////////////////
         // Error management

         // Called when a script error occured
         // => must return useful information to get back to the server
         getScriptErrorModuleInfos: function()
         {
            return "U="+this.player_id;
         },

        ///////////////////////////////////////////////////////
        // Tutorial
        showTutorial: function()
        {
        return; // DISABLED
            // Adjust tutorial item 3 to real log position
            var parentPos = dojo.position( 'game_play_area' );
            var pos = dojo.position( 'logs_wrap' );
            var item_3_arrow = pos.y+90-parentPos.y;
            var item_3_text = pos.y+170-parentPos.y;
            dojo.style( 'tuto_arrow3', 'top', item_3_arrow+'px' );
            dojo.style( 'tuto_text3', 'top', item_3_text+'px' );

            dojo.connect( $('close_tutorial'), 'onclick', this, 'onCloseTutorial' );
        },

        onCloseTutorial: function( evt )
        {
            dojo.stopEvent( evt );
            dojo.destroy( 'tutorial_support' );
        },



        onBeforeChatInput: function( params )
        {
            var chatWithSpace = ' '+params.msg.toLowerCase()+' ';
            if( chatWithSpace.indexOf( ' bug ' ) != -1 )
            {
                var url = this.metasiteurl+'/bug?id=0&table='+this.table_id;
                this.notifqueue.addChatToLog( '<b>'+dojo.string.substitute(__('lang_mainsite','Found a bug? Please report it using <a href="${url}">BGA bug reporting system</a>.'), { url: url+'" target="_blank'} )+'</b>' );
            }

            return true;
        },

        //////////////////////////////////////////////////
        // Elimination

        showEliminated: function()
        {


            var scoreDlg = new ebg.popindialog();
            scoreDlg.create( 'eliminateDlg' );
            scoreDlg.setTitle( __('lang_mainsite', 'You have been eliminated') );


            var html = '<div id="eliminateDlgContent">';

            html += "<div style='text-align: center'>";
            html += '<p>'+__('lang_mainsite', 'You have been eliminated from this game.')+'</p><br/>';

            if( ! this.quickGameEnd )
            {
                html += "<a href='"+this.metasiteurl+"/table?table="+this.table_id+"' class='bgabutton bgabutton_blue'>"+ __( 'lang_mainsite', 'Return to main site') +"</a><br/>"+ __('lang_mainsite','or') +"<br/>";
            }
            else
            {
                html += "<a href='"+this.metasiteurl+"/' class='bgabutton bgabutton_blue'>"+ __( 'lang_mainsite', 'Return to main site') +"</a><br/>"+ __('lang_mainsite','or') +"<br/>";
            }
            html += "<a href='#' id='closeScoreDlg_btn_elim' onclick='return false;' class='bgabutton bgabutton_blue'>" + __('lang_mainsite', 'Continue to watch the game') + "</a><br/>";

            if( this.blinkid && this.blinkid != '' )
            {
                html += __('lang_mainsite','or') +"<br/><a href='"+this.blinkid+"' target='_new' class='bgabutton bgabutton_blue'>" + this.blinkdomain + "</a>";
            }

            html += "</div>"; // div for text-align:center



            html += "</div>"; // eliminateDlgContent

            scoreDlg.setContent( html );
            scoreDlg.show();

            dojo.connect( $('closeScoreDlg_btn_elim'), 'onclick', dojo.hitch( scoreDlg, function() {
                dojo.destroy('eliminateDlgContent');
                this.destroy();
            } ) );


        },

        //////////////////////////////////////////////////////////////////////
        // Loader

        setLoader: function( image_progress, logs_progress )
        {
            image_progress = Math.round( image_progress );
            logs_progress = Math.round( logs_progress );

            //document.title = progress;

            if( image_progress < 8 )
            {
                // Note: below 8% the display is ugly
                image_progress = 8;
            }

            dojo.style( 'progress_bar_progress', 'width', image_progress+'%' );
            dojo.style( 'game_box_loader_front_wrap', 'width', image_progress+'%' );

            // Note: we cannot use __('lang_mainsite', '') for translation here as the mainsite lang bundle is not yet loaded when this code is run
            $('images_status_text').innerHTML = ($('loader_loading_art_text') != null ? $('loader_loading_art_text').textContent : "Loading game art") + ' ('+image_progress+'%)';

            if( toint( image_progress ) >= 100 )
            {
                // Loaded ! hide loader
                var anim = dojo.fadeOut( {node:'loader_mask',  });

                dojo.connect( anim, 'onEnd', function(){
                    dojo.style( 'loader_mask', 'display', 'none' );
                });

                anim.play();
            }

            // Note: we cannot use __('lang_mainsite', '') for translation here as the mainsite lang bundle is not yet loaded when this code is run
            $('log_history_status_text').innerHTML = ($('loader_loading_logs_text') != null ? $('loader_loading_logs_text').textContent : "Loading game log history") + ' ('+logs_progress+'%)';
            dojo.style( 'log_history_progress_bar_progress', 'width', logs_progress+'%' );

            if( toint( logs_progress ) >= 100 )
            {
                dojo.style( 'log_history_status', 'display', 'none');
            }
        },


        ////////////////////////////////////////////////////////////////////
        // Zombie back (out of time) zone

        displayZombieBack: function()
        {
        	dojo.style( 'zombieBack', 'display', 'block' );
        },

        onZombieBack: function( evt )
        {
        	dojo.stopEvent( evt );

            this.confirmationDialog( __('lang_mainsite',"You will get back into the game, but you will keep the penalty you received for quitting this game. Continue?"), dojo.hitch( this, function() {


                // Player wants to get back into the game
                this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/zombieBack.html", {}, this, function( result ){} );
            } ) );
        },


        showNeutralizedGamePanel: function( progression, player_id )
        {
            if( dojo.style( 'neutralized_game_panel', 'display' ) != 'block' )
            {
                dojo.style( 'neutralized_game_panel', 'display', 'block' );

                var html = '';

                html += "<div id='neutralized_explanation'>";

                html += '<p>'+dojo.string.substitute( __('lang_mainsite','Player ${name} was out of time (or quit this game) and lost this game (at ${progression}% of the game progression).'), {

                    name: '<b>'+( ( typeof this.gamedatas.players[ player_id ] == 'undefined' ) ? '-inexistent player: '+player_id+'-' : this.gamedatas.players[ player_id ].name ) +'</b>',
                    progression: Math.round( progression )
                } );
                html += '</p>';

                if( dojo.hasClass('ebd-body', 'training_mode')) {
                    html += '<p>'+__('lang_mainsite', 'Training mode has been enabled for this table: no penalty will be applied.')+'</p>';
                } else {                    
                    html += '<p>'+__('lang_mainsite', 'All other players will be considered winners.')+'</p>';
                    html += '<p>'+__('lang_mainsite', 'This may be frustrating, so quitting players gets a penalty on their Karma (☯). If you want to avoid this situation in the future, play with opponents with a good Karma.')+'</p>';
                }
                
                html += '</div>';

                if( this.player_id != player_id && !this.isSpectator )
                {
                    html += dojo.string.substitute( __('lang_mainsite','You may continue to play if you like, or ${quit} this game without any penalty.'), {
                        quit: '<div class="bgabutton bgabutton_blue" id="neutralized_quit">' + __('lang_mainsite', 'quit') + '</div>'
                    } );
                }

                $('neutralized_game_panel').innerHTML = html;

                if( $('neutralized_quit' ) )
                {
                    dojo.connect( $('neutralized_quit'), 'onclick', this, function() {
                        this.ajaxcall( "/table/table/quitgame.html?src=panel", {table: this.table_id, neutralized: true, s:'gameui_neutralized'}, this, function( result ){
                            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                                this.prepareMediaRatingParams();
                                this.doLeaveRoom( dojo.hitch(this, function() { this.redirectToTablePage(); } ) );
                            } else {
                                this.redirectToTablePage();
                            }
                        } );
                    } );
                }

                if( this.player_id == player_id )
                {
                    // WE have been expelled
                    // => display the explanation dialog

                    if( this.gamedatas.players[ player_id ].zombie == 1)
                    {
                        // ... so if the player is back in the game the popup is no more displayed
                        this.expelledDlg = new ebg.popindialog();
                        this.expelledDlg.create( 'expelledDlg' );
                        this.expelledDlg.setTitle( __('lang_mainsite',"You've been expelled") );

                        var html = '<div>';
                        html += '<p>'+_('You had no more time and an opponent expelled you from the game :(')+'</p><br/>';
                        html += '<p>'+_('Some tips to avoid this in the future (and avoid a bad reputation):')+'</p>';
                        html += '<p>_ '+_('Choose a slower game speed (ex: `Slow`) or play turn-based.')+'</p>';
                        html += '<p>_ '+_('Make sure you are playing from a stable Internet and reliable device.')+'</p>';
                        html += '<p>_ '+_('Discuss with your opponents and explain your difficulties.')+'</p>';
                        html += '</div>';

                        this.expelledDlg.setContent( html );
                        this.expelledDlg.show();

                    }
                }
            }
        },

        ///////////////////////////////////////////////////
        //// Reaction to cometD notifications
        // (functions prefix: "ntf_", to distinguish with game object callback methods: "notif_" )

        setupCoreNotifications: function()
        {
            dojo.subscribe( 'gameStateChange', this, "ntf_gameStateChange" );
            dojo.subscribe( 'gameStateChangePrivateArg', this, "ntf_gameStateChangePrivateArgs" );
            dojo.subscribe( 'gameStateMultipleActiveUpdate', this, "ntf_gameStateMultipleActiveUpdate" );
            dojo.subscribe( 'newActivePlayer', this, "ntf_newActivePlayer" );
            dojo.subscribe( 'playerstatus', this, "ntf_playerStatusChanged" );
            dojo.subscribe( 'yourturnack', this, "ntf_yourTurnAck" );
            dojo.subscribe( 'clockalert', this, "ntf_clockalert" );
            dojo.subscribe( 'tableInfosChanged', this, "ntf_tableInfosChanged" );
            dojo.subscribe( 'playerEliminated', this, "ntf_playerEliminated" );
            dojo.subscribe( 'tableDecision', this, "ntf_tableDecision" );
            dojo.subscribe( 'infomsg', this, "ntf_infomsg" );

            dojo.subscribe( 'archivewaitingdelay', this, "ntf_archivewaitingdelay" );
            dojo.subscribe( 'end_archivewaitingdelay', this, "ntf_end_archivewaitingdelay" );
            this.notifqueue.setSynchronous( 'archivewaitingdelay', 500 );

            dojo.subscribe( 'replaywaitingdelay', this, "ntf_replaywaitingdelay" );
            dojo.subscribe( 'end_replaywaitingdelay', this, "ntf_end_replaywaitingdelay" );
            this.notifqueue.setSynchronous( 'replaywaitingdelay', 1500 );

            dojo.subscribe( 'replayinitialwaitingdelay', this, "ntf_replayinitialwaitingdelay" );
            dojo.subscribe( 'end_replayinitialwaitingdelay', this, "ntf_end_replayinitialwaitingdelay" );
            this.notifqueue.setSynchronous( 'replayinitialwaitingdelay', 1500 );

            dojo.subscribe( 'aiPlayerWaitingDelay', this, "ntf_aiPlayerWaitingDelay" );
            this.notifqueue.setSynchronous( 'aiPlayerWaitingDelay', 2000 );


            dojo.subscribe( 'replay_has_ended', this, "ntf_replay_has_ended" );

            dojo.subscribe( 'updateSpectatorList', this, "ntf_updateSpectatorList" );
            dojo.subscribe( 'tableWindow', this, "ntf_tableWindow" );
            dojo.subscribe( 'wouldlikethink', this, "ntf_wouldlikethink" );
            dojo.subscribe( 'updateReflexionTime', this, "ntf_updateReflexionTime" );

            dojo.subscribe( 'undoRestorePoint', this, "ntf_undoRestorePoint" );
            dojo.subscribe( 'resetInterfaceWithAllDatas', this, "ntf_resetInterfaceWithAllDatas" );

            dojo.subscribe( 'zombieModeFail', this, "ntf_zombieModeFail" );
            dojo.subscribe( 'zombieModeFailWarning', this, "ntf_zombieModeFailWarning" );
            dojo.subscribe( 'aiError', this, "ntf_aiError" );

            dojo.subscribe( 'skipTurnOfPlayer', this, "ntf_skipTurnOfPlayer" );
            dojo.subscribe( 'zombieBack', this, "ntf_zombieBack" );
            dojo.subscribe( 'allPlayersAreZombie', this, "ntf_allPlayersAreZombie" );
            dojo.subscribe( 'gameResultNeutralized', this, "ntf_gameResultNeutralized" );

            dojo.subscribe( 'playerConcedeGame', this, "ntf_playerConcedeGame" );

            dojo.subscribe( 'showTutorial', this, "ntf_showTutorial" );
            this.notifqueue.setSynchronous( 'showTutorial' );

            dojo.subscribe( 'showCursor', this, "ntf_showCursor" );
            dojo.subscribe( 'showCursorClick', this, "ntf_showCursorClick" );


            dojo.subscribe( 'skipTurnOfPlayerWarning', this, "ntf_skipTurnOfPlayerWarning" );

            dojo.subscribe( 'simplePause', this, "ntf_simplePause" );
            this.notifqueue.setSynchronous( 'simplePause' );

            dojo.subscribe( 'banFromTable', this, 'ntf_banFromTable' );

            dojo.subscribe( 'resultsAvailable', this, 'ntf_resultsAvailable' );

            dojo.subscribe( 'switchToTurnbased', this, 'ntf_switchToTurnbased' );
            
            dojo.subscribe( 'newPrivateState', this, 'ntf_newPrivateState' );
        },
        ntf_gameStateChange: function( notif )
        {
            console.log( 'ntf_gameStateChange' );

            // Getting the complete infos avout this gamestate
            if( typeof notif.args.id != 'undefined' )
            {
                if( typeof this.gamedatas.gamestates[ notif.args.id ] == 'undefined' )
                {
                    console.error( "Unknow gamestate: "+notif.args.id );
                }

                if( typeof this.gamedatas.gamestates[ notif.args.id ].args != 'undefined' )
                {   delete this.gamedatas.gamestates[ notif.args.id ].args;   }   // This was, it will not erase our args
                if( typeof this.gamedatas.gamestates[ notif.args.id ].updateGameProgression != 'undefined' )
                {   delete this.gamedatas.gamestates[ notif.args.id ].updateGameProgression;   }   // This was, it will not erase our updateGameProgression

                for( var key in this.gamedatas.gamestates[ notif.args.id ] )
                {
                    notif.args[ key ] = this.gamedatas.gamestates[ notif.args.id ][ key ];
                }
            }

            //leaving private state if exists
            if (this.gamedatas.gamestate.private_state) {
                dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.private_state.name );
                this.onLeavingState( this.gamedatas.gamestate.private_state.name );
            }            
            
            // Leaving current state
            dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );
            this.onLeavingState( this.gamedatas.gamestate.name );

            if( this.next_private_args != null )
            {
                notif.args.args._private = this.next_private_args;
                this.next_private_args = null;
            }

            if( this.gamedatas.gamestate.name == 'gameSetup' )
            {
                // trigger a "onresize" to make sure all objects that resize themselves (ex: Stock) are up to date
                this.sendResizeEvent();
            }


            this.gamedatas.gamestate = dojo.clone( notif.args );
            this.last_server_state = dojo.clone( this.gamedatas.gamestate );
            console.log( "******** New game state : "+this.gamedatas.gamestate.name+" *********************" );
            console.log( notif.args );

            this.on_client_state = false;

            // Remove the ACK for all players
            for( var player_id in this.gamedatas.players )
            {
                this.gamedatas.players[ player_id ].ack = 'wait';
            }
            this.cancelPlannedWakeUp();
            this.cancelPlannedWakeUpCheck();

            if( this.updateActivePlayerAnimation() && !g_archive_mode && this.bRealtime )
            {   // If current player is active, we have to ACK the game state change
                console.log( "ack your turn event" );
                this.sendWakeupInTenSeconds();
            }
            if( this.bRealtime && ! g_archive_mode )
            {
                this.checkWakupUpInFourteenSeconds();   // In all case, we will verify that all active players has sent there wakeup in 14s
                // Note: in turn based mode, we dont check that, because this is normal that the opponents are offline at this moment.
            }
            this.updatePageTitle();
            dojo.style( 'pagemaintitle_wrap', 'display', 'block' ); // Note: we ensure that the gamestate change if visible even if we are in the middle of a "game updating" situation
            dojo.style( 'gameaction_status_wrap', 'display', 'none' ); // And we make sure to hide the 'game updating' so as not to have a dual display

            // Update game progression
            if( typeof(notif.args.updateGameProgression) != 'undefined' )
            {
                console.log( "Updating game progression" );

                $('pr_gameprogression').innerHTML = notif.args.updateGameProgression;
            }

            // If new game state = game setup, reload page
            if( notif.args.name == 'gameSetup' )
            {
                if( ! g_archive_mode )  // In archive mode, this is normal to receive "gameSetup" as a first notification
                {
                    this.showMessage( "Game will start in few seconds ...", "error" );
                    setTimeout( "window.location.reload();", 3000 );
                }
            }
            else
            {
                this.lastWouldLikeThinkBlinking = 0;

                dojo.addClass( 'overall-content', 'gamestate_'+notif.args.name );
                this.onEnteringState( notif.args.name, notif.args );

                if( notif.args.name == 'gameEnd' )
                {
                    this.bGameEndJustHappened = true;   // Note: to distinguish from a F5 on a game already ended
                    this.onGameEnd();

                    if( typeof this.end_of_game_timestamp == 'undefined' )
                    {
                        this.end_of_game_timestamp = Math.floor(Date.now() / 1000);
                    }

                    // Switch to "game result" after 3 sec
                    // DEPRECATED : now we are switching to game results when they are ready ("resultsAvailable" notification sent)
//                    setTimeout( dojo.hitch( this, function(){
//                        this.switchToGameResults();
//                    } ), 3000 );
                }
            }
        },

        ntf_gameStateChangePrivateArgs: function( notif )
        {
            // Must store this private args for next game state change
            this.next_private_args = notif.args;
        },

        ntf_gameStateMultipleActiveUpdate: function( notif )
        {
            // Current multiactive player list has changed
            console.log( "ntf_gameStateMultipleActiveUpdate" );
            this.gamedatas.gamestate.multiactive = notif.args;
            this.last_server_state.multiactive = notif.args;

            if( this.updateActivePlayerAnimation() )
            {   // If current player is active, we have to ACK the game state change
                console.log( "ack your turn event" );
                this.sendWakeupInTenSeconds();
            }
         
            var gamestate = null;
            if (this.gamedatas.gamestate.private_state != null && this.isCurrentPlayerActive()) {
                gamestate = this.gamedatas.gamestate.private_state;
            }
            this.updatePageTitle(gamestate);
        },
        ntf_newActivePlayer: function( notif )
        {
            console.log( 'ntf_newActivePlayer' );
            this.gamedatas.gamestate.active_player = notif.args;
            console.log( 'this.gamedatas.gamestate.active_player = ' + this.gamedatas.gamestate.active_player );

            this.updatePageTitle();
            this.updateActivePlayerAnimation();
        },
        ntf_playerStatusChanged: function( notif )
        {
            console.log( 'ntf_playerStatusChanged' );

            var player_status_img_id = 'player_'+notif.args.player_id+'_status';
            console.log( player_status_img_id );
            var player_status_img = $(player_status_img_id);

            if( player_status_img )
            {
                dojo.removeClass( player_status_img_id, 'status_online' );
                dojo.removeClass( player_status_img_id, 'status_offline' );
                dojo.removeClass( player_status_img_id, 'status_inactive' );

                dojo.addClass( player_status_img_id, 'status_'+notif.args.player_status );
            }

            this.updateFirePlayerLink();
        },
        ntf_yourTurnAck: function( notif )
        {
            var player_id = notif.args.player;
            console.log( "ntf_yourTurnAck for player "+player_id );
			if( this.gamedatas.players[ player_id ] )
			{
		        this.gamedatas.players[ player_id ].ack = 'ack';
		        if( $("avatar_active_" + player_id).src.indexOf( "active_player" ) != -1 )
		        {
		            if( ! this.shouldDisplayClockAlert( player_id  ) )
		            {   $("avatar_active_" + player_id).src = getStaticAssetUrl('img/layout/active_player.gif');   }
		            else
		            {   $("avatar_active_" + player_id).src = getStaticAssetUrl('img/layout/active_player_clockalert.gif');   }
		        }
			}
        },
        ntf_clockalert: function( notif )
        {
            // Game signals that a player has no more reflexion time
            // => signals it
            // => make appear the "zombify" command

        /*    console.log( 'ntf_clockalert' );
            console.log( notif );

            var player_id = notif.args.player_id;
            this.gamedatas.gamestate.reflexion[ player_id ].move = -1;  // Trick: set current move time as negative => shouldDisplayClockAlert return true

            this.updateActivePlayerAnimation();  */
        },
        ntf_tableInfosChanged: function( notif )
        {
			console.log( "ntf_tableInfosChanged" );
            console.log( notif );
            if( notif.args.reload_reason == 'playerQuitGame' )
            {
                this.gamedatas.players[ notif.args.who_quits ].zombie = 1;
                this.updateActivePlayerAnimation();
            }
            else if( notif.args.reload_reason == 'playerElimination' )
            {
                this.gamedatas.players[ notif.args.who_quits ].eliminated = 1;
                this.updateActivePlayerAnimation();

            }
        },
        ntf_playerEliminated: function( notif ) {
			if( notif.args.who_quits == this.player_id )
			{
				// You have been eliminated from the game dialog
				this.showEliminated();
			}
		},
        ntf_tableDecision: function( notif )
        {
            console.log( "ntf_tableDecision" );
            this.updateDecisionPanel( notif.args );
        },
        // General information message. Display it on a message panel if current player is specified
        ntf_infomsg: function( notif )
        {
            console.log( 'ntf_infomsg' );
            console.log( notif );
            if( notif.args.player == this.player_id )
            {
                var output = dojo.string.substitute( notif.log, notif.args );
                this.showMessage( output, 'info' );
            }
        },
        ntf_archivewaitingdelay: function( notif )
        {
            console.log( 'ntf_archivewaitingdelay' );
            this.lockInterface();
            // Do nothing
        },
        ntf_end_archivewaitingdelay: function( notif )
        {
            console.log( 'ntf_end_archivewaitingdelay' );
            this.unlockInterface();

            if( this.bJumpToNextArchiveOnUnlock )
            {
                this.bJumpToNextArchiveOnUnlock = false;
                this.doNewArchiveCommentNext();
            }

            this.onEndDisplayLastArchive();
        },

        ntf_replaywaitingdelay: function( notif )
        {
            console.log( 'ntf_replaywaitingdelay' );
            // Do nothing
        },
        ntf_end_replaywaitingdelay: function( notif )
        {
            console.log( 'ntf_end_replaywaitingdelay' );
            // Do nothing
        },

        ntf_replayinitialwaitingdelay: function( notif )
        {
            console.log( 'ntf_replayinitialwaitingdelay' );
            // Do nothing
        },
        ntf_end_replayinitialwaitingdelay: function( notif )
        {
            console.log( 'ntf_end_replayinitialwaitingdelay' );
            // Do nothing
        },

        ntf_replay_has_ended: function( notif )
        {
            this.onEndOfReplay();
        },

        onEndOfReplay: function()
        {
            this.unlockInterface( 'replayFrom' );
            this.setLoader( 100, 100 );
            g_replayFrom = undefined;

            if( $('current_header_infos_wrap' ) )
            {
                dojo.style( 'current_header_infos_wrap', 'display', 'block' );
                dojo.style( 'previously_on', 'display', 'none' );
            }

            if( this.gameUpgraded )
            {
                // We must reload the game to ensure there is no display problem
                window.location.href = this.getGameStandardUrl();
            }
        },

        ntf_updateSpectatorList: function( notif )
        {
            console.log( notif );
            if( notif.channelorig == '/table/ts'+this.table_id )
            {
                this.updateVisitors( notif.args );
            }

        },
        ntf_tableWindow: function( notif )
        {
            console.log( 'ntf_tableWindow' );
            // Display a table window (commanded by server)

            var header_arg ='';
            if( typeof notif.args.header != 'undefined' )
            {   header_arg = notif.args.header; }

            var footer_arg='';
            if( typeof notif.args.footer != 'undefined' )
            {   footer_arg = notif.args.footer; }

            var closing_arg='';
            if( typeof notif.args.closing != 'undefined' )
            {   closing_arg = notif.args.closing; }


            this.displayTableWindow( notif.args.id, _(notif.args.title), notif.args.table,_(header_arg), _(footer_arg), _(closing_arg) );
        },
        ntf_wouldlikethink: function( notif )
        {
            console.log( 'ntf_wouldlikethink' );
            // Reset "would like to think" bliking counter
            this.lastWouldLikeThinkBlinking = 0;
        },
        ntf_updateReflexionTime: function( notif )
        {
            // Add some reflexion time
            if( typeof g_replayFrom == 'undefined' )
            {
                var before = toint( this.gamedatas.gamestate.reflexion.total[ notif.args.player_id ] );


                this.gamedatas.gamestate.reflexion.total[ notif.args.player_id ] = before + toint( notif.args.delta );
                if( notif.args.max !== null )
                {
                    this.gamedatas.gamestate.reflexion.total[ notif.args.player_id ] = Math.min( toint( this.gamedatas.gamestate.reflexion.total[ notif.args.player_id ] ) , toint( notif.args.max ) );
                }

                var after = toint( this.gamedatas.gamestate.reflexion.total[ notif.args.player_id ] );

                // Note: we need to upgrade "reflexion.initial" with the same delta, so it won't be recalculated during the next timers update
                if( typeof this.gamedatas.gamestate.reflexion.initial != 'undefined' )
                {
                    this.gamedatas.gamestate.reflexion.initial[ notif.args.player_id ] = toint( this.gamedatas.gamestate.reflexion.initial[ notif.args.player_id ] ) + toint( ( toint( after ) - toint( before ) ) );
                }
            }
        },


	    //// Undo
	    ntf_undoRestorePoint: function( notif )
	    {
            if( ! g_archive_mode )
            {
            // if( this.isSpectator )
                {
                    // Note : spectators must reload to see the undo results


                    // Current method: reload the whole page

                /*    this.showMessage( __('lang_mainsite',"Active player chooses to undo his whole move: reloading..."), 'info' );

                    setTimeout( dojo.hitch( this, function(){
                        window.location.href = this.getGameStandardUrl();
                    } ), 1000 );
*/

                    // Future method (to be stabilized): reload only what is needed

                    // At first, query needed gamedatas
                    this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/gamedatas.html", {}, this, function( result ){

                        console.log( "restoring game with datas:");
                        console.log( result );

                        // Reset all game panels

                        dojo.query( '.player_board_content > *' ).forEach( function( node ) {

                            if( dojo.hasClass( node, 'player_score' ) || dojo.hasClass( node, 'player_table_status' ) )
                            {
                                // Keep it safe
                            }
                            else
                            {
                                // This is something this game has added, so remove it
                                dojo.destroy( node );
                            }

                        } );

                        // Reset game interface with original HTML
                        dojo.empty( 'game_play_area' );
                        dojo.place( this.original_game_area_html, 'game_play_area' );

                        // Reset some HTML elements
                        dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );

                        // Remove all Stock (and others) controls, with all associated events
                        this.destroyAllEbgControls();

                        // Remove setupNotifications so that notification handlers are not called twice
                        this.setupNotifications = function() {};

                        // Then, relaunch completesetup
                        this.completesetup( this.game_name, this.game_name_displayed, this.table_id, this.player_id, null, null, 'keep_existing_gamedatas_limited', result.data, null, null );


                    } );


                }
            }
        },

	    ntf_resetInterfaceWithAllDatas: function( notif )
	    {
	        // Reset all game panels

            dojo.query( '.player_board_content > *' ).forEach( function( node ) {

                if( dojo.hasClass( node, 'player_score' ) || dojo.hasClass( node, 'player_table_status' ) )
                {
                    // Keep it safe
                }
                else
                {
                    // This is something this game has added, so remove it
                    dojo.destroy( node );
                }

            } );

            // Reset game interface with original HTML
            dojo.empty( 'game_play_area' );
            dojo.place( this.original_game_area_html, 'game_play_area' );

            // Reset some HTML elements
            dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.name );

            // Remove all Stock (and others) controls, with all associated events
            this.destroyAllEbgControls();

            // Remove setupNotifications so that notification handlers are not called twice
            this.setupNotifications = function() {};

	        // Then, relaunch completesetup
            this.completesetup( this.game_name, this.game_name_displayed, this.table_id, this.player_id, null, null, 'keep_existing_gamedatas_limited', notif.args, null, null );

	    },

	    ntf_zombieModeFailWarning: function( notif )
	    {
	        // Zombie mode failed => propose a way to exit the game => propose to abandon the game
            this.showMessage( __('lang_mainsite',"Error during Skip turn execution : if you are blocked please retry the same action and the game will be abandonned."), 'info' );
	    },

	    ntf_zombieModeFail: function( notif )
	    {
	        // Zombie mode failed => propose a way to exit the game

	        this.showMessage( __('lang_mainsite',"Error during Skip turn execution : this game has been cancelled. Please leave the game."), 'info' );
	    },

	    ntf_aiError : function( notif )
	    {
	    	this.showMessage( __('lang_mainsite',"Artificial intelligence error:")+" "+notif.args.error, 'error' );
			dojo.style( 'ai_not_playing', 'display', 'inline' );
	    },

	    ntf_skipTurnOfPlayer: function( notif )
	    {
	    	if( notif.args.player_id == this.player_id )
	    	{
	    	    if( notif.args.zombie )
	    	    {
	    		    this.displayZombieBack();
	    		}
	    	}

    	    if( notif.args.zombie )
    	    {
    	    	this.gamedatas.players[ notif.args.player_id ].zombie = 1;
    	    }
	    	this.updateActivePlayerAnimation();
	    },
		ntf_zombieBack: function( notif )
	    {
	    	if( notif.args.player_id == this.player_id )
	    	{
				dojo.style( 'zombieBack', 'display', 'none' );

				// RTC chat setup (joining back)
				this.setNewRTCMode( this.table_id, null, this.rtc_mode );
	    	}

	    	this.gamedatas.players[ notif.args.player_id ].zombie = 0;
	    	this.updateActivePlayerAnimation();

	    },
	    ntf_gameResultNeutralized: function( notif )
	    {
	        this.showNeutralizedGamePanel( notif.args.progression, notif.args.player_id );
	    },
		ntf_allPlayersAreZombie: function( notif )
		{
			this.showMessage( __('lang_mainsite',"All players are over time limit and all turns are skipped: game is abandonned."), 'info' );

			// Leave real time chat room (if open)
            if( typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null ) {
                this.prepareMediaRatingParams();
                this.doLeaveRoom( dojo.hitch(this, function() {
                    // => redirect to mainsite
                    if( !this.quickGameEnd )
                    {
                        this.redirectToTablePage();
                    }
                    else
                    {
                        this.redirectToMainsite();
                    }
                } ) );
            } else {
                // => redirect to mainsite
                if( !this.quickGameEnd )
                {
                    this.redirectToTablePage();
                }
                else
                {
                    this.redirectToMainsite();
                }
            }
		},

		ntf_simplePause: function( notif )
		{
		    var delay = notif.args.time;

		    delay = Math.min( delay, 10000 ); // Maximum, 10 secs

		    this.notifqueue.setSynchronousDuration( delay );
		},

		ntf_showTutorial: function( notif )
		{
            this.lockInterface();

		    if( notif.args.delay && notif.args.delay > 0 )
            {
                setTimeout( dojo.hitch( this, function() {
                    this.showTutorialItem( notif );
                } ), toint( notif.args.delay ) );
            }
            else
            {   this.showTutorialItem( notif ); }
		},
		showTutorialActivationDlg: function()
		{
		    if( this.is_solo )
		    {
		        // This is a solo game => automatically accepts the tutorial
                this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/activeTutorial.html", {active:1}, this, function( result ){} );
		    }
		    else
		    {
		        // Show a tutorial at given place
		        var html = "<div class='tutorial_ingame'>";

		        html += dojo.string.substitute( __('lang_mainsite', "Welcome on ${game}. Do you want to learn how to play?" ), {game:this.game_name_displayed} );

		        html += "<div class='tutorial_footer'>";

		        html += "<a id='disable_tutorial' class='bgabutton bgabutton_gray' href='#'>";
		        html += "<span>"+__('lang_mainsite', "No, thanks" )+"</span></a>&nbsp;&nbsp;";

		        html += "<a id='enable_tutorial' class='bgabutton bgabutton_blue' href='#'>";
		        html += "<span>"+__('lang_mainsite', "Yes" )+"</span></a></div>";

		        html += "</div>";

		        html += "</div>";


                this.tutorialActiveDlg = new ebg.popindialog();
                this.tutorialActiveDlg.create( 'tutorialActiveDlg' );
                this.tutorialActiveDlg.setTitle( __('lang_mainsite',"Tutorial") );

                this.tutorialActiveDlg.setContent( html );
                this.tutorialActiveDlg.show();

                dojo.connect( $('disable_tutorial'), 'onclick', this, function() {
                        this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/activeTutorial.html", {active:0}, this, function( result ){} );
                        this.tutorialActiveDlg.destroy();
                } );
                dojo.connect( $('enable_tutorial'), 'onclick', this, function() {
                        this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/activeTutorial.html", {active:1}, this, function( result ){} );
                        this.tutorialActiveDlg.destroy();
                } );
            }
		},
		showTutorialItem: function( notif )
		{
		    if( typeof this.tutorialItem[ notif.args.id ] != 'undefined' )
		    {
		        endnotif();
		        return ;
		    }

		    // Show a tutorial at given place
		    var html = "<div class='tutorial_ingame'>";

		    html += _( notif.args.text );

		    html += "<div class='tutorial_footer'><a id='close_tutorial_"+notif.args.id+"' class='bgabutton bgabutton_blue' href='#'>";

		    if( notif.args.calltoaction )
		    {
    		    html += "<span>"+_( notif.args.calltoaction )+"</span></a></div>";
		    }
		    else
		    {
    		    html += "<span>"+__('lang_mainsite','Ok')+"</span></a></div>";
    		}

		    html += "</div>";

            var anchor = null;

            if( notif.args.attachement )
            {
                var anchor = notif.args.attachement;
            }

            if( ! $(anchor) )
            {
                // Anchor does not exists => fallback to dialog
                anchor = null;
            }


            if( anchor === null )
            {
                // Display a dialog

                if( $('tutorialDialogContent' ) )
                {   dojo.destroy( 'tutorialDialogContent' );    }

                this.tutorialItem[ notif.args.id ] = new dijit.Dialog({
                    title: __('lang_mainsite',"Tutorial")
                });


                this.tutorialItem[ notif.args.id ].set("content", html );
                this.tutorialItem[ notif.args.id ].show();

                dojo.connect( $('close_tutorial_'+notif.args.id), 'onclick', this, 'onTutorialDlgClose' );
            }
            else
            {
                // Display a tooltip

		        this.tutorialItem[ notif.args.id ] = new dijit.TooltipDialog({
                    id: 'tutorial_item_'+notif.args.id,
                    content: html,
                    closable: true
                });


                dijit.popup.open({
                    popup: this.tutorialItem[ notif.args.id ],
                    around: ( anchor !== null ? $(anchor) : null )
                });

                dojo.connect( $('close_tutorial_'+notif.args.id), 'onclick', this, 'onTutorialClose' );

            }
        },
		onTutorialClose: function( evt )
		{
		    // close_tutorial_<ID>
		    var tutorial_id = evt.currentTarget.id.substr( 15 );
		    dijit.popup.close( this.tutorialItem[ tutorial_id ] );
            this.tutorialItem[ tutorial_id ].destroy();
            this.markTutorialAsSeen( tutorial_id );

		},
		onTutorialDlgClose: function( evt )
		{
		    // close_tutorial_<ID>
		    var tutorial_id = evt.currentTarget.id.substr( 15 );

		    this.tutorialItem[ tutorial_id ].hide();
		    this.tutorialItem[ tutorial_id ].destroy();
            this.markTutorialAsSeen( tutorial_id );
		},
		markTutorialAsSeen: function( tutorial_id )
		{
		    this.unlockInterface();

            this.interface_status = 'updated';
            console.log( "Interface status is now: updated" );
            dojo.style( 'pagemaintitle_wrap', 'display', 'block' );
            dojo.style( 'gameaction_status_wrap', 'display', 'none' );
            dojo.style( 'synchronous_notif_icon', 'display', 'none' );


		    endnotif();

		    // Signal the website that we saw this
            this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/seenTutorial.html", {id:tutorial_id}, this, function( result ){} );
		},

		toggleTurnBasedNotes: function()
		{
            var anchor = $('ingame_menu_notes');

            if( typeof this.turnBasedNotes == 'undefined' )
            {
                this.openTurnBasedNotes();
            }
            else
            {
                if( this.turnBasedNotesIsOpen )
                {
                    this.closeTurnBasedNotes();
                }
                else
                {
                    this.openTurnBasedNotes();
                }
            }

		},
		closeTurnBasedNotes: function()
		{
            if( typeof this.turnBasedNotes!= 'undefined' )
            {
                if( this.turnBasedNotesIsOpen )
                {
                    dijit.popup.close( this.turnBasedNotesPopup );
                    this.turnBasedNotesIsOpen = false;

                    // Give the document focus
                    window.focus();

                    // Remove focus from any focused element
                    if (document.activeElement) {
                        document.activeElement.blur();
                    }
                }
            }

		},
		openTurnBasedNotes: function( content )
		{
		    if( typeof content == 'undefined' )
		    {   content = '';   }
		    else
		    {
		        dojo.removeClass( 'ingame_menu_notes', 'icon32_notes' );
		        dojo.addClass( 'ingame_menu_notes', 'icon32_notes_active' );
		    }

            var anchor = $('ingame_menu_notes');

            if( typeof this.turnBasedNotesPopup == 'undefined' )
            {
                var html = '<div id="turnbased_notes">';
                html += "<h3>"+__('lang_mainsite',"My personal notes on this game")+":</h3>";
                html += __('lang_mainsite',"Note: your opponents CANNOT see your notes.");
                html += "<br/>";
                html += "<br/>";
                html += "<textarea id='turnbased_notes_content'>"+content+"</textarea>";
                html += "<br/>";
                html += "<div id='turnbased_notes_commands'>";
                    html += "<a href='#' id='btn_clearmynotes' class='bgabutton bgabutton_gray' style='float:left'>"+__('lang_mainsite',"Clear my notes")+"</a> &nbsp;";
                    html += "<a href='#' id='btn_savemynotes' class='bgabutton bgabutton_blue'>"+__('lang_mainsite',"OK")+"</a> &nbsp;";
                html += "</div>";
                html += "<div class='clear'></div>";
                html += "</div>";

                this.turnBasedNotesPopup = new dijit.TooltipDialog({
                    id: 'turnBasedNotes',
                    content: html,
                    closable: true
                });


                dijit.popup.open({
                    popup: this.turnBasedNotesPopup,
                    around: $(anchor),
                    orient: [ "below", "below-alt", "above", "above-alt" ]
                });
                $('turnbased_notes_content').focus();
                setCaretPosition( $('turnbased_notes_content'), 9999 );

                dojo.query( '.dijitPopup' ).style( 'zIndex', 1054 ); // Just above topbar

                dojo.connect( $('btn_savemynotes'),'onclick', this, 'onSaveNotes' );
                dojo.connect( $('btn_clearmynotes'),'onclick', this, 'onClearNotes' );

                this.turnBasedNotesIsOpen = true;
            }
            else
            {

                dijit.popup.open({
                    popup: this.turnBasedNotesPopup,
                    around: $(anchor),
                    orient: [ "below", "below-alt", "above", "above-alt" ]
                });
                this.turnBasedNotesIsOpen = true;
                $('turnbased_notes_content').focus();

                setCaretPosition( $('turnbased_notes_content'), 9999 );
                dojo.query( '.dijitPopup' ).style( 'zIndex', 1054 ); // Just above topbar
            }
		},
		onSaveNotes: function( evt )
		{
		    dojo.stopEvent( evt );

		    var notes = $('turnbased_notes_content').value;

            this.ajaxcall( "/table/table/updateTurnBasedNotes.html", {
                value:notes, table: this.table_id
            }, this, function( result ){} );

		    if( notes != '' )
		    {
	            dojo.removeClass( 'ingame_menu_notes', 'icon32_notes' );
	            dojo.addClass( 'ingame_menu_notes', 'icon32_notes_active' );
		    }
		    else
		    {
	            dojo.removeClass( 'ingame_menu_notes', 'icon32_notes_active' );
	            dojo.addClass( 'ingame_menu_notes', 'icon32_notes' );
		    }

		    this.closeTurnBasedNotes();
		},
		onClearNotes: function( evt )
		{
		    dojo.stopEvent( evt );

            this.ajaxcall( "/table/table/updateTurnBasedNotes.html", {
                value:'', table: this.table_id
            }, this, function( result ){} );

	        dojo.removeClass( 'ingame_menu_notes', 'icon32_notes_active' );
	        dojo.addClass( 'ingame_menu_notes', 'icon32_notes' );

		    this.closeTurnBasedNotes();
		},


        //////////////////////////////////////////////////////////////////////////////////////////////::
        /////   Footer section management


         onSeeMoreLink: function( evt )
         {
            dojo.stopEvent( evt );

            // seemoreXXX
            var link_type = evt.currentTarget.id.substr( 7 );
            dojo.query( '.link_see_more' ).style( 'display', 'block' );
            dojo.style( evt.currentTarget.id, 'display', 'none' );
         },
         onThumbUpLink: function( evt )
         {
            dojo.stopEvent( evt );

            // thumbup_link_<id>
            var link_id = evt.currentTarget.id.substr( 13 );
            this.ajaxcall( '/table/table/thumbUpLink.html', {id: link_id}, this, function( result )
            {
                $('thumbup_current_'+link_id).innerHTML = toint( $('thumbup_current_'+link_id).innerHTML )+1;
            } );
         },

         onChangePreference : function( evt )
         {

            // preference_global_control_<id>
            var pref_id = evt.currentTarget.id.substr( 26 );
            var value =  evt.currentTarget.value;

            $('preference_global_control_'+pref_id).value = value;
            $('preference_global_fontrol_'+pref_id).value = value;

            if( pref_id == 'logsSecondColumn' )
            {
                this.switchLogModeTo( value );
            }
            else if( pref_id == 'showOpponentCursor' )
            {
                this.showMessage( __('lang_mainsite',"Your preference will be applied starting next move"), 'info' );
            }
            else if( pref_id == 'displayTooltips' )
            {
				this.switchDisplayTooltips( value );
            }

            this.hideIngameMenu();

            this.ajaxcall( "/table/table/changeGlobalPreference.html", {
                id: pref_id, value: value
            }, this, function( result ){} );
         },

        getRanking: function()
        {
            if( typeof this.last_rank_displayed == 'undefined' )
            {
                this.last_rank_displayed=0;
                this.ranking_mode_displayed = 'arena';
            }

            this.ajaxcall( '/gamepanel/gamepanel/getRanking.html', { game: this.game_id, start: this.last_rank_displayed, mode:this.ranking_mode_displayed }, this, function( result )
                    {
                        console.log( result );
                        this.insert_rankings( result.ranks );

                        if( dojo.query( '.champion').length == 0 )
                        {
                            if( result.champion )
                            {
                                // Insert champion at the top

                                result.champion.rank = _('Reigning Champion');
                                result.champion.premium = 'emblemwrap_l player_in_list_l';
                                result.champion.flag = result.champion.country.code;
                                result.champion.flagdisplay='inline-block';
                                result.champion.additional_ranking='';
                                result.champion.ranking='';
                                result.champion.add_class='champion';

                                result.champion.avatar = getPlayerAvatar(result.champion.id, result.champion.avatar, 32);
                                result.champion.device = playerDeviceToIcon( result.champion.device );

                                dojo.place( this.format_string( this.jstpl_player_ranking, result.champion ), 'players','first' );
                            }

                        }
                  } );
        },

        insert_rankings: function( rankings )
        {
            console.log( 'insert_rankings' );
            console.log( rankings );

            var rank = this.last_rank_displayed + 1;

            for( var i in rankings )
            {
                var bMasked = false;
                var player = rankings[i];
                player.rank = this.getRankString( player.rank_no );
                player.additional_ranking = '';

                player.premium = '';
                player.add_class='';
                player.avatar = getPlayerAvatar(player.id, player.avatar, 32);
                player.device = playerDeviceToIcon( player.device );


                if( player.ranking )
                {
                    player.ranking = this.getEloLabel( player.ranking );
                    player.link = this.metasiteurl+'/player?id='+player.id;
                    player.flag = player.country.code;
                    player.flagdisplay='inline-block';
                }
                else if( player.arena )
                {
                    player.ranking = this.getArenaLabel( player.arena );

                    if( player.arena >= 500 )
                    {
                        // Adding world rank
                        player.ranking = this.getArenaLabel( player.arena, player.rank_no );
                    }                    player.link = 'player?id='+player.id;
                    player.flag = player.country.code;
                    player.flagdisplay='inline-block';
                    player.additional_ranking = 'ranking_arena';
                }
                else
                {
                    // Masqued
                    bMasked = true;
                    player.name = '<img class="masqued_rank" id="maskn_'+player.rank_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'"/>';
                    player.ranking = '<a href="premium"><img class="masqued_rank" id="maskr_'+player.rank_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'"/></a>';
                    player.link = 'premium';
                    player.flag = 'XX';
                    player.flagdisplay='none';
                    player.id='';
                }
                dojo.place( this.format_string( this.jstpl_player_ranking, player ), 'players' );

                if( !bMasked )
                {
                    this.addTooltip( 'flag_'+player.id, player.country.name, '' );
                }

                this.last_rank_displayed = rank;
                rank ++;
            }


        },

        // User wants to see more player ranks
        onSeeMoreRanking: function( evt )
        {
            dojo.stopEvent( evt );
            this.getRanking();
        },


        onChangeRankMode: function( evt )
        {
            dojo.stopEvent( evt );

            // Closing all menus
            dojo.query( '.sectiontitle_dropdown_menu_visible' ).removeClass( 'sectiontitle_dropdown_menu_visible' );

            var parts = evt.currentTarget.id.split('_');
            var season = parts[1];

            if( season == 'current')
            {
                this.ranking_mode_displayed = 'arena';
            }
            else
            {
                this.ranking_mode_displayed = 'elo';
            }

            // Change current entry
            dojo.query( '#ranking_menu .display_section .fa-check' ).forEach( dojo.destroy );
            dojo.query( '#ranking_menu .display_section .rank_season' ).removeClass('selected_');
            dojo.query( '#ranking_menu .display_section .rank_season' ).addClass('notselected');

            $( 'ranking_menu_menu_title').innerHTML = evt.currentTarget.innerHTML + ' <i class="fa fa-caret-down" aria-hidden="true"></i>';

            dojo.place( ' <i class="fa fa-check" aria-hidden="true"></i>', evt.currentTarget );

            this.last_rank_displayed = 0;
            dojo.empty( 'players');
            this.getRanking();
        },



		ntf_aiPlayerWaitingDelay: function( notif )
		{   // do nothing
		},

		ntf_playerConcedeGame: function( notif )
		{
		    this.showMessage( dojo.string.substitute( __('lang_mainsite','${player_name} concedes this game.'), notif.args ), 'info' );
		},

		ntf_skipTurnOfPlayerWarning: function( notif )
		{
		    if( notif.args.player_id == this.player_id )
		    {
		        this.showMessage(
                    dojo.string.substitute( __('lang_mainsite',"You are out of time and an opponent is ready to EXPEL you from the game. You have ${delay} SECONDS to finish your turn or you'll lose this game."),
                    {
                        delay:notif.args.delay
                    } ) , 'error' 
                );
		    }

            // Forcing a resynchronize so we make sure that we are aware it's your turn
            this.notifqueue.resynchronizeNotifications( false );

		},

		ntf_showCursorClick: function( notif )
		{
	        if( $('player_hidecursor_'+notif.args.player_id) )
	        {
	            if( ! $('player_hidecursor_'+notif.args.player_id).checked )
	            {
	                // Do not want to see this cursor
	                return;
	            }
	        }


	        // Compute position of cursor depending on what exists
	        var ref = null;
	        var x = null;
	        var y = null;
            var icon_pointer_dx = -10;

	        for( var i in notif.args.path )
	        {
	            var elem = notif.args.path[i];

	            if( $( elem.id ) )
	            {
	                // Yeah ! This element exists in our client !

	                if( $( elem.id ).offsetParent !== null )
	                {
	                    // Yeah !! It is visible !
	                    ref = elem.id;
	                    x = elem.x;
	                    y = elem.y;
	                    break;
                    }
	            }
	        }

	        if( ref !== null )
	        {
		        var cursor_player = notif.args.player_id;
                this.showClick( ref, x, y, '#'+this.gamedatas.players[ cursor_player ].color );
            }
	    },

		ntf_showCursor: function( notif )
		{
		    // Do not display my own cursor
	     /*   if( notif.args.player_id == this.player_id )
	        {
                return ;
	        }*/

	        if( $('player_hidecursor_'+notif.args.player_id) )
	        {
	            if( ! $('player_hidecursor_'+notif.args.player_id).checked )
	            {
	                // Do not want to see this cursor
	                return;
	            }
	        }

//            if( $( 'preference_global_control_showOpponentCursor' ).value == 0 )
            {
		        // Compute position of cursor depending on what exists
		        var ref = null;
		        var x = null;
		        var y = null;
	            var icon_pointer_dx = -10;

	            if( notif.args.path == null )
	            {
	                // Make cursor disappear

	                if( $('opponent_cursor_'+notif.args.player_id) )
	                {
    	                dojo.destroy( 'opponent_cursor_'+notif.args.player_id );
    	            }

    	            dojo.style( 'player_showcursor_'+notif.args.player_id, 'display', 'none' );

	                return ;
	            }

	            dojo.style( 'player_showcursor_'+notif.args.player_id, 'display', 'block' );

		        for( var i in notif.args.path )
		        {
		            var elem = notif.args.path[i];

		            if( $( elem.id ) )
		            {
		                // Yeah ! This element exists in our client !

		                if( $( elem.id ).offsetParent !== null )
		                {
		                    // Yeah !! It is visible !
		                    ref = elem.id;
		                    x = elem.x;
		                    y = elem.y;
		                    break;
                        }
		            }
		        }

		        var cursor_player = notif.args.player_id;

		        if( ! $('opponent_cursor_'+cursor_player ) )
		        {
		            // Create it
    //		        dojo.place(  '<i id="opponent_cursor" class="fa fa-mouse-pointer"></i>', 'ebd-body' );

                    var player_name = '';
                    if( this.gamedatas.players[ cursor_player ] )
                    {   player_name = this.gamedatas.players[ cursor_player ].name; }

		            dojo.place(  '<i id="opponent_cursor_'+cursor_player+'" class="opponent_cursor fa fa-hand-pointer-o"> '+player_name+'</i>', 'ebd-body' );

		            if( ref !== null )
		            {
    		            this.placeOnObjectPos( $('opponent_cursor_'+cursor_player ), ref, x+icon_pointer_dx, y );
    		        }
		        }

		        // Make sure the color is right
                dojo.style( 'opponent_cursor_'+cursor_player, 'display', 'block' );
		        dojo.style( 'opponent_cursor_'+cursor_player, 'color', '#'+this.gamedatas.players[ cursor_player ].color );

		        // Slide it to dest
		        if( ref !== null )
		        {
		            this.slideToObjectPos( $('opponent_cursor_'+cursor_player ), ref, x+icon_pointer_dx, y, 500 ).play();

		           // document.title = ref+' '+x+','+y;
		        }
            }
		},

		onChatKeyDown: function( evt )
		{
            if( this.control3dmode3d && evt.target.id=='ebd-body' && (
                  evt.keyCode == 37
             ||   evt.keyCode == 38
             ||   evt.keyCode == 39
             ||   evt.keyCode == 40
             ||   evt.keyCode == 107
             ||   evt.keyCode == 109
            ) )
            {
                if( evt.ctrlKey == false )
                {
                    if( evt.keyCode == 37 ) // Left
                    {
                        this.change3d(  0 , 0 , 100 , 0 , 0 , true,false);
                    }
                    else if( evt.keyCode == 38 ) // Up
                    {
                        this.change3d(  0 , 100 , 0 , 0 , 0 , true,false);
                    }
                    else if( evt.keyCode == 39 ) // Right
                    {
                        this.change3d(  0 , 0 , -100 , 0 , 0 , true,false);
                    }
                    else if( evt.keyCode == 40 ) // Down
                    {
                        this.change3d(  0 , -100 , 0 , 0 , 0 , true,false);
                    }
                    else if( evt.keyCode == 107 ) // +
                    {
                        this.change3d(  0 , 0 , 0 , 0 , 0.1 , true,false);
                        return ; // Do not open chat
                    }
                    else if( evt.keyCode == 109 ) // -
                    {
                        this.change3d(  0 , 0 , 0 , 0 , -0.1 , true,false);
                        return ; // Do not open chat
                    }
                }
                else
                {   // Same with control pressed
                    if( evt.keyCode == 37 ) // Left
                    {
                        this.change3d(  0 , 0 , 0 , -10 , 0 , true,false);
                    }
                    else if( evt.keyCode == 38 ) // Up
                    {
                        this.change3d(  -10 , 0 , 0 , 0 , 0 , true,false);
                    }
                    else if( evt.keyCode == 39 ) // Right
                    {
                        this.change3d(  0 , 0 , 0 , 10 , 0 , true,false);
                    }
                    else if( evt.keyCode == 40 ) // Down
                    {
                        this.change3d(  10 , 0 , 0 , 0 , 0 , true,false);
                    }
                }

                if( evt.keyCode == 107 ||   evt.keyCode == 109 )
                {
                    // Do no break ctrl+ / ctrl-
                }
                else
                {
                    dojo.stopEvent( evt );  // Otherwise the browser window is scrolling
                }
            }


            if( evt.target.id=='ebd-body' && evt.ctrlKey==false && evt.metaKey==false && (
                   (evt.keyCode >= 48 && evt.keyCode <= 57) // numbers
                || (evt.keyCode >= 65 && evt.keyCode <= 90) // letters
                || (evt.keyCode >= 96 && evt.keyCode <= 111) // num pad
                || evt.keyCode==32
                || evt.keyCode==59
                || evt.keyCode==61
                || evt.keyCode==173
                || evt.keyCode==186
                || evt.keyCode==187
                || evt.keyCode==188
                || evt.keyCode==189
                || evt.keyCode==190
                || evt.keyCode==191
                || evt.keyCode==192
                || evt.keyCode==219
                || evt.keyCode==220
                || evt.keyCode==221
                || evt.keyCode==222
                ) )
            {
    		    this.expandChatWindow( 'table_'+this.table_id, true );
    		}

            if( evt.keyCode == 27 && evt.ctrlKey==false ) // echap
            {
                this.collapseChatWindow( 'table_'+this.table_id );
            }




		},

		onChatInputBlur: function( evt )
		{
		   // Not a good idea for those who want to keep it open
           //this.collapseChatWindow( 'table_'+this.table_id );
		},

		onJudgeDecision: function( evt )
		{
		    // judgegivevictory_<player_id>
		    var winner = evt.currentTarget.id.substr( 17 );
            this.ajaxcall( "/table/table/judgegivevictory.html", {
                id: this.table_id, winner: winner
            }, this, function( result ){} );
		},

		registerEbgControl: function( control )
		{
		    this.ebgControls.push( control );
		},
		destroyAllEbgControls: function()
		{
		    for( var i in this.ebgControls )
		    {
		        this.ensureEbgObjectReinit( this.ebgControls[i] );
		    }
		    this.ebgControls = [];
		},

		playMusic: function( evt )
		{
		    if( typeof $('melodice_frame').getAttribute( 'to_be_loaded_src' ) != 'undefined' )
		    {
		        if( $('melodice_frame').getAttribute( 'to_be_loaded_src' ) !== null )
		        {
		            $('melodice_frame').src = $('melodice_frame').getAttribute( 'to_be_loaded_src' );
		            $('melodice_frame').removeAttribute( 'to_be_loaded_src' );
                }
		    }
        },

        onShowGameHelp: function()
        {
            if ($('mediawiki_gamehelp_content') == null) return;

            dojo.place( '<div class="loading_icon"></div>', 'mediawiki_gamehelp_content' );

            this.ajaxcall( "/gamepanel/gamepanel/getWikiHelp.html", {
                gamename: this.game_name,
                section: 'help'
            }, this, function( result ){
                dojo.place( result.content, 'mediawiki_gamehelp_content', 'only');
            } );
        },

        onShowStrategyHelp: function()
        {
            if ($('mediawiki_strategy_content') == null)
            {
                return;
            }

            dojo.place( '<div class="loading_icon"></div>', 'mediawiki_strategy_content' );

            this.ajaxcall( "/gamepanel/gamepanel/getWikiHelp.html", {
                gamename: this.game_name,
                section: 'tips'
            }, this, function( result ){
                dojo.place( result.content, 'mediawiki_strategy_content', 'only');
            } );


        },

		lockScreenCounter: function()
		{
            if( this.gamedatas.gamestate.name == 'gameSetup' && !g_archive_mode )
            {
                this.updatePageTitle();

                this.lockts --;

                if( this.lockts <= 0 )
                {
                    this.ajaxcall( "/"+this.game_name+"/"+this.game_name+"/endLockScreen.html", {}, this, function( result ){
                        if( result.data.c == true )
                        {
                            // Continue
                        }
                        else
                        {
                            // Stop, now
                            if( typeof this.lockScreenTimeout != 'undefined' )
                            {
                                clearTimeout( this.lockScreenTimeout );
                                return ;
                            }
                        }
                    } );
                }

                this.lockScreenTimeout = setTimeout( dojo.hitch( this, 'lockScreenCounter' ), 1000 );
            }
		},

		///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////// Hotseat mode

		initHotseat: function()
		{
		    this.hotseat_focus = null;

		    for( var hotseat_player_id in this.hotseat )
		    {
		        var url = '/'+this.gameserver+'/'+this.game_name+'?table='+this.table_id+'&lang='+dojoConfig.locale+'&testuser='+hotseat_player_id;

    		    if( this.hotseat_interface == 'normal' )
    		    {
                    dojo.place( dojo.string.substitute( this.jstpl_hotseat_interface, {url:url, player_id:hotseat_player_id, } ), 'overall-footer', 'before' );
    		        dojo.style( 'hotseat_mask', 'display', 'block' );
                }

		        this.hotseat_focus = this.player_id; // By default, focus = current player id
		    }

		    if( this.hotseat_focus !== null )
		    {
		        // Add current player
		        this.hotseat[ this.player_id ] = 1;
		    }

		    if( this.hotseat_interface == 'hotseataccount' )
		    {
		        // We are viewing some hotseat account
		        this.forceTestUser = this.player_id;
		    }

		    // Clicking anywhere on the mask let you play
		    dojo.connect( $('hotseat_mask'), 'onclick',this, 'onHotseatPlayButton' );
		},

		onHotseatPlayButton: function( evt )
		{
		    dojo.stopEvent( evt );
		    dojo.style( 'hotseat_mask', 'display', 'none' );
		},

		checkHotseatFocus: function()
		{
		    if( this.hotseat_focus === null )
		    {   return; }   // No hotseat in this game

		    if( this.isPlayerActive( this.hotseat_focus ) )
		    {
		        // Player who have the focus is active, so there is no reason to remove its focus
		        return ;
		    }
            else
            {
                for( var player_id in this.hotseat )
                {
                    if( this.isPlayerActive( player_id ) )
                    {
                        // This player is active, is managed by hotseat, so it should get the focus in 1 second.
                        setTimeout( dojo.hitch( this, function() {
                            this.giveHotseatFocusTo( player_id );
                        } ), 1000 );
                        return ;
                    }
                }
            }
		},

		giveHotseatFocusTo: function( player_id )
		{
		    if( this.hotseat_interface == 'single_screen' )
		    {
		        // Hotseat is based on a single interface

      		    this.hotseat_focus = player_id;

                // Change active player
                this.player_id = player_id;
                this.forceTestUser = player_id;

                this.showMessage( dojo.string.substitute( ('This is ${player} turn!'), { player: this.gamedatas.players[ player_id ].player_name } ), 'info' );
		    }
		    else
		    {
		        // Hotseat is based on multiple iframe/views

	            dojo.query( '.hotseat_iframe' ).style( 'left', '200%' );

		        if( player_id != this.player_id )
		        {
        		    dojo.style( 'hotseat_iframe_'+player_id, 'left', '0px' );
        	//	    dojo.style( 'hotseat_iframe_'+player_id, 'display', 'block' ); // We do not display none/block iframe anymore because this causes strange JS error with Firefox.
        		    dojo.addClass( 'ebd-body', 'fullscreen_iframe' );
		        }

		        this.hotseat_focus = player_id;


		        // Display hotseat mask on new frame
		        if( this.hotseat_focus == this.player_id )
		        {
		            dojo.style( 'hotseat_mask', 'display', 'block' );
        		    dojo.removeClass( 'ebd-body', 'fullscreen_iframe' );
		        }
		        else
		        {
                    var hotseat_mask = window.frames['hotseat_iframe_'+this.hotseat_focus].contentDocument.getElementById('hotseat_mask');
		            dojo.style( hotseat_mask, 'display', 'block' );
		        }

		    }

		},


		///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////// 3D  -  three dimensional feature

		init3d: function()
		{
            // 3D
			dojo.connect($('c3dAngleUp'), "onclick", dojo.hitch(this, this.change3d,  -10 , 0 , 0 , 0 , 0 , true  ,false));
			dojo.connect($('c3dAngleDown'),"onclick", dojo.hitch(this, this.change3d,  10 , 0 , 0 , 0 , 0 , true,false));
			dojo.connect($('c3dUp'),      "onclick", dojo.hitch(this, this.change3d,  0 , 100 , 0 , 0 , 0 , true,false));
			dojo.connect($('c3dDown'),    "onclick", dojo.hitch(this, this.change3d,  0 , -100 , 0 , 0 , 0 , true ,false));
			dojo.connect($('c3dLeft'),    "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 100 , 0 , 0 , true,false));
			dojo.connect($('c3dRight'),   "onclick", dojo.hitch(this, this.change3d,  0 , 0 , -100 , 0 , 0 , true ,false));
			dojo.connect($('c3dRotateL'), "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 0 , -10 , 0 , true  ,false));
			dojo.connect($('c3dRotateR'), "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 0 , 10 , 0 , true ,false));
			dojo.connect($('ingame_menu_3d'),   "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 0 , 0 , 0 , false  ,false));
			dojo.connect($('c3dZoomIn'),  "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 0 , 0 , 0.1 , true ,false));
			dojo.connect($('c3dZoomOut'), "onclick", dojo.hitch(this, this.change3d,  0 , 0 , 0 , 0 , -0.1 , true,false));

			dojo.query( '.control3d_command' ).connect( 'onmouseenter', this, 'enter3dButton' );
			dojo.query( '.control3d_command' ).connect( 'onmouseleave', this, 'leave3dButton' );

			if( dojo.hasClass( 'ebd-body', 'mobile_version' ) )
			{
			    this.control3ddraggable = new ebg.draggable();
			    this.control3ddraggable.create( this, 'controls3d_wrap', 'controls3d_img' );
            }

			// Enable this to enable 3d by default (for dev only)
			//this.change3d(  0 , 0 , 0 , 0 , 0 , false  ,false);

		},

        change3d: function ( xaxis , xpos , ypos , zaxis , scale, enable3d , clear3d )
		{
			if ( enable3d == false ){
    			this.control3dmode3d= !this.control3dmode3d ;
			}

			if ( this.control3dmode3d == false )
			{
			    if( dojo.hasClass( 'ebd-body', 'mode_3d' ) )
			    {
    		        dojo.removeClass( 'ebd-body', 'mode_3d' );
		        }

		        $('ingame_menu_3d_label').innerHTML = __('lang_mainsite',"3D mode") ;

			    $('game_play_area').style.transform = "rotatex("+0+"deg) translate("+0+"px,"+0+"px) rotateZ("+0+"deg)" ;
			}
			else
			{
			    if( ! dojo.hasClass( 'ebd-body', 'mode_3d' ) )
			    {
		            dojo.addClass( 'ebd-body', 'mode_3d' );
		        }

		        dojo.addClass( 'ebd-body', 'enableTransitions' );

		        $('ingame_menu_3d_label').innerHTML = __('lang_mainsite',"2D mode") ;
				this.control3dxaxis+= xaxis;
				if (this.control3dxaxis >= 80 ) { this.control3dxaxis = 80 ; }
				if (this.control3dxaxis <= 0 ) { this.control3dxaxis = 0 ;}

                if( this.control3dscale < 0.5 ) {   this.control3dscale = 0.5;  }

				this.control3dzaxis+= zaxis;
				this.control3dxpos+= xpos;
				this.control3dypos+= ypos;
				this.control3dscale+= scale;
				if (clear3d == true )
				{
					this.control3dxaxis=0;
					this.control3dzaxis=0;
					this.control3dxpos=0;
					this.control3dypos=0;
					this.control3dscale=1;
				}
				$('game_play_area').style.transform = "rotatex("+this.control3dxaxis+"deg) translate("+this.control3dypos+"px,"+this.control3dxpos+"px) rotateZ("+this.control3dzaxis+"deg) scale3d("+this.control3dscale+","+this.control3dscale+","+this.control3dscale+")";

			}
		},

		enter3dButton: function( evt )
		{
		    if( evt.currentTarget.id == 'c3dLeft' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Left arrow");	    }
		    if( evt.currentTarget.id == 'c3dRight' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Right arrow");	    }
		    if( evt.currentTarget.id == 'c3dUp' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Up arrow");	    }
		    if( evt.currentTarget.id == 'c3dDown' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Down arrow");	    }

		    if( evt.currentTarget.id == 'c3dRotateL' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Ctrl+Left arrow");	    }
		    if( evt.currentTarget.id == 'c3dRotateR' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Ctrl+Right arrow");	    }
		    if( evt.currentTarget.id == 'c3dAngleDown' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Ctrl+Down arrow");	    }
		    if( evt.currentTarget.id == 'c3dAngleUp' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : Ctrl+Up arrow");	    }

		    if( evt.currentTarget.id == 'c3dZoomIn' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : +");	    }
		    if( evt.currentTarget.id == 'c3dZoomOut' )
		    {       $('tooltip3d').innerHTML = __('lang_mainsite',"Shortcut : -");	    }

		},
		leave3dButton: function( evt )
		{
		    $('tooltip3d').innerHTML = __('lang_mainsite',"Note: 3D is experimental");

		},

		ntf_banFromTable: function( notif )
		{
            if( this.isSpectator && typeof this.gamedatas.players[ notif.args.from ] != 'undefined' )
            {
                // If the player is really a spectator at current table + the player who did the ban is really a player at this table
                // => reload the hash so the "ban" can be taken into account
                location.hash = '';
                window.location.reload();
            }
		},

		ntf_resultsAvailable: function( notif )
		{
		    // Results has been processed by BGA MS and are available to be displayed on Game UI

        //    if( typeof this.end_of_game_timestamp == 'undefined' )
          //  {
            //    this.end_of_game_timestamp = Math.floor(Date.now() / 1000);
           // }

            this.updateResultPage();
		},

		ntf_switchToTurnbased: function( notif )
		{
		    this.showMessage( __('lang_mainsite',"This Realtime table has been switched to Turnbased table."), 'info' );

		    setTimeout( dojo.hitch( this, function(){
                window.location.href = this.getGameStandardUrl();
		    }), 1000 );
            ;
        },

        ntf_newPrivateState: function( notif)
        {
            console.log( 'ntf_newPrivateState' );

            // Getting the complete infos about this gamestate
            if( typeof notif.args.id != 'undefined' )
            {
                if( typeof this.gamedatas.gamestates[ notif.args.id ] == 'undefined' )
                {
                    console.error( "Unknow gamestate: "+notif.args.id );
                }

                if( typeof this.gamedatas.gamestates[ notif.args.id ].args != 'undefined' )
                {   delete this.gamedatas.gamestates[ notif.args.id ].args;   }   // This was, it will not erase our args
                if( typeof this.gamedatas.gamestates[ notif.args.id ].updateGameProgression != 'undefined' )
                {   delete this.gamedatas.gamestates[ notif.args.id ].updateGameProgression;   }   // This was, it will not erase our updateGameProgression

                for( var key in this.gamedatas.gamestates[ notif.args.id ] )
                {
                    notif.args[ key ] = this.gamedatas.gamestates[ notif.args.id ][ key ];
                }
            }

            // Leaving current state
            if (this.gamedatas.gamestate.private_state) {
                dojo.removeClass( 'overall-content', 'gamestate_'+this.gamedatas.gamestate.private_state.name );
                this.onLeavingState( this.gamedatas.gamestate.private_state.name );
            }

            this.gamedatas.gamestate.private_state = dojo.clone( notif.args );
            console.log( "******** New private state : "+this.gamedatas.gamestate.private_state.name+" *********************" );
            console.log( notif.args );

            this.updatePageTitle(this.gamedatas.gamestate.private_state);
            dojo.style( 'pagemaintitle_wrap', 'display', 'block' ); // Note: we ensure that the gamestate change if visible even if we are in the middle of a "game updating" situation
            dojo.style( 'gameaction_status_wrap', 'display', 'none' ); // And we make sure to hide the 'game updating' so as not to have a dual display

            dojo.addClass( 'overall-content', 'gamestate_'+notif.args.name );
            this.onEnteringState( notif.args.name, notif.args );

        },





        saveclient: function()
        {
            // Save the whole client state

            this.save = dojo.clone( $('game_play_area'));
        },

        restoreClient: function()
        {
            dojo.destroy( 'game_play_area');
            dojo.place( this.save, 'game_play_area_wrap');
        },

        decodeHtmlEntities: function (text) {
            var textArea = document.createElement('textarea');
            textArea.innerHTML = text;
            return textArea.value;
        },

        applyTranslationsOnLoad: function()
        {
            dojo.query( '.to_translate').forEach( dojo.hitch( this, function( node ) {

                // We need first to decode html entities if any are present (for example "&" is returned as "&amp;" by innerHTML)
                var to_translate = this.decodeHtmlEntities(node.innerHTML);

                var parts = to_translate.split( '£µ;' );
                if( parts.length > 1 )
                {
                    // We have some replacements to do
                    var result = _( parts.shift() );

                    for( var i in parts )
                    {
                        var elements = parts[i].split('µù;');
                        if( elements.length == 2 )
                        {
                            result = result.replace( elements[0], elements[1]);
                        }
                    }

                    node.innerHTML = result;
                }
                else
                {
                    // Simple case: simple string with no specific variable
                    node.innerHTML = _( to_translate );
                }
            }));
        },


        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////// GAMES EVALUATION/RATING FRAMEWORK ///////////////////////////////////////////////////////////

        showGameRatingDialog: function () {
            g_sitecore.displayRatingContent('game', {
                table: this.table_id,
                rating: null,
                issue: null,
                text: null
            });
        },
   });
});



