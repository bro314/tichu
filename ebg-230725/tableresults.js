/* Table results : full & interactive results from a game */

define("ebg/tableresults", [
    "dojo","dojo/_base/declare",
    "ebg/thumb", "ebg/core/common"
],
function (dojo, declare) {
    return declare("ebg.tableresults", null, {
        constructor: function(){
            this.page = null;
            this.div = null;
            
            this.jstpl_template = '<div class="game_abandonned" id="game_abandonned" style="display:none">\
                                        <h4 class="game_result_status_important">${LB_GAME_ABANDONNED}</h4>\
                                        <span id="game_abandonned_explanation"></span>\
                                        <br/>\
                                        <br/>\
                                    </div>\
                                    <div class="game_cancelled" id="game_cancelled" style="display:none">\
                                        <h4 class="game_result_status_important">${LB_GAME_RESULT_CANCELLED} (${LB_SOMEONE_LEFT_THE_GAME_BEFORE_THE_END}) :</h4>\
                                        ${THE_PLAYER_WHO_LEFT}<br/>\
                                        ${THE_OTHERS_PLAYERS}\
                                        <br/>\
                                        <br/>\
                                    </div>\
                                    <div class="game_cancelled" id="game_unranked_cancelled" style="display:none">\
                                        <h4 class="game_result_status_important">${LB_SOMEONE_LEFT_THE_GAME_BEFORE_THE_END}</h4>\
                                        <br/>\
                                    </div>\
                                    <h4 class="game_conceded" id="game_conceded" style="display:none">${LB_GAME_CONCEDED}</h4>\
                                    <h4 class="game_unranked" id="game_unranked" style="display:none"><span id="game_unranked_label">${label_unranked} <i class="fa fa-question-circle"></i></span></h4>\
                                    <div class="game_result" id="game_result"></div>\
                                    <div id="tiebreaker_explanation"></div>\
                                    <div class="publishresult_container">\
                                        <span class="publishresult_button">\
                                            <span class="publishresult bgabutton bgabutton_gray" id="publishresult">\
                                                <i class="fa fa-share-alt"></i> ${share}\
                                            </span>\
                                            <div id="publishresult_content">\
                                                <div class="fb-share-button" data-href="https://${LANGUAGE_SHORT}.boardgamearena.com/table?table=${TABLE_ID}" data-layout="button" data-size="large"></div>\
                                            </div>\
                                        </span>\
                                    </div>\
';

           this.jstpl_score_entry = '<div class="score-entry" id="score_entry_${player_id}">'+
                        '<div class="rank">${rankstr}</div>'+
                       '<div class="emblemwrap ${emblem_class} emblemwrap_l"><img id="emblem_${player_id}" src="${emblem}" alt="${name}" class="emblem"/><div class="emblempremium"></div></div>'+
                       '<div class="name"><a href="${url_base}/player?id=${player_id}" id="player_${player_id}_name" class="playername">${name}</a><span style="display:${is_creator_display}"> [creator]</span></div>'+
                       '<div class="score">'+
                            '${score} <i class="fa fa-lg fa-star"></i>'+
                            '<span class="score_aux score_aux_${score} tttiebraker" id="score_aux_${index}"> (${score_aux}<i class="fa fa-star tiebreaker"></i>)</span>'+
                        '</div>'+
                        '<div class="clear"></div>'+
                        '<div class="adddetails adddetails_arena">'+
                            '<span class="rankdetails rankdetailsarena" style="display:${show_arena}">'+
                                '<div id="winpointsarena_${player_id}" class="winpoints">'+
                                '<span class="" id="winpointsarena_value_${player_id}">${arena_win_display}</span> &nbsp;'+
                                '&nbsp;<img alt="->" src="'+getStaticAssetUrl('img/common/arrow.png')+'" class="imgtext"/>&nbsp;&nbsp;</div>'+
                                '<div id="newrankarena_${player_id}" class="newrank">${arena_after_display}</div>'+
                            '</span>'+
                        '</div>'+
                        '<div id="adddetails_${player_id}" class="adddetails">'+
                            '<span class="rankdetails">'+
                                '<div id="winpoints_${player_id}" class="winpoints">'+
                                '<span id="leave_${player_id}" style="display:none;" class="leavepenalty">&nbsp;<span id="leavevalue_wrap_${player_id}"><div class="icon20 icon20_penaltyleave "></div> </span></span>'+                                
                                '<span class="" id="winpoints_value_${player_id}">${point_win}</span> &nbsp;'+
                                '&nbsp;<img alt="->" src="'+getStaticAssetUrl('img/common/arrow.png')+'" class="imgtext"/>&nbsp;&nbsp;</div>'+
                                '<div id="newrank_${player_id}" class="newrank">${rank_after_game}</div>'+
                            '</span>'+
                            '<div class="penalties">'+
                                '<span id="clock_${player_id}" style="display:none;" class="clockpenalty">&nbsp;<div class="icon20 icon20_penaltyclock"></div></span>'+
                            '</div>'+
                        '</div>'+
                        '<div class="reputation_wrap" style="display:${reputation_display}">'+
                            '<p id="reputation_block_${player_id}">'+
                                '<div class="reputation" id="reput_${player_id}">'+
                                '</div>'+
                            '</p><br/>'+
                            '<p id="stickynote_wrap_${player_id}" class="stickynote_wrap">'+
                                '<a class="bga-link" href="#" id="stickynote_edit_${player_id}"><i class="fa fa-lg fa-sticky-note-o"></i>&nbsp; <span id="stickynote_ctrl_${player_id}"></span></a>'+
                            '</p>'+
// DEPRECATED : now, we are using red thumb interface for this
//                            '<p>'+
//                                '<a href="/report?id=0&player=${player_id}&table=${table_id}" class="signalplayer">${signal_player_label}</a>'+
//                            '</p>'+
                        '</div>'+
                        '<div class="clear"></div>'+                     
                    '</div>';

            this.jstpl_trophy = '<div class="trophy">\
                           <a id="award_${AWARD_ID}" href="${url_base}/award?game=${GAME_ID}&award=${AWARD_TYPE_ID}">\
                                <div class="trophyimg_wrap"><div class="trophyimg" id="awardimg_${AWARD_ID}" style="background-image:  url(\'${base_img}\')"></div></div>\
                                <div class="trophyname"><b>${TROPHY_NAME}</b><br/>${TROPHY_SPECIAL} <div class="xp_container">+${TROPHY_PRESTIGE} XP<div class="arrowback"></div><div class="arrow"></div><div class="arrowbackl"></div><div class="arrowl"></div></div></div><div class="clear"></div>\
                            </a>\
                        </div>\
';

            
            this.jstpl_statistics = '<p>${intro}</p><div id="table_stats" class="smalltext">\
                </div>\
                <div id="player_stats">\
                    <table class="statstable" id="player_stats_table">\
                        <tr id="player_stats_header">\
                            <th></th>\
                        </tr>\
                    </table>\
                </div>\
';

            this.jstpl_table_stat = '<div class="row-data">\
                            <div class="row-label" title="${statname}">${statname}</div>\
                            <div class="row-value">&nbsp;${value} ${unit}</div>\
                        </div>\
';

            this.jstpl_playerstatheader = '<th id="playerstatheader_${ID}">${NAME}</th>';

            this.jstpl_playerstat = '<tr>\
                                <th>${NAME}</th>\
                                ${PLAYER_STATS}\
                            </tr>';
            
            this.tableinfos = null;
            this.pma = false;
    
        },
        create: function( page, target_div, target_stats_div, tableinfos, is_premium )
        {
            this.page = page;
            this.div = target_div;
            this.stats_div = target_stats_div;
            this.tableinfos = tableinfos;
            this.pma = is_premium;
            
            if( ! $( this.div ) )
            {
                return ;
            }
            
            dojo.place( dojo.string.substitute( this.jstpl_template, {
                LANGUAGE_SHORT: dojo.config.locale.substr( 0, 2 ),
                TABLE_ID: tableinfos.id,
                LB_GAME_ABANDONNED: __('lang_mainsite','LB_GAME_ABANDONNED'),
                LB_GAME_CONCEDED: __('lang_mainsite',"LB_GAME_CONCEDED"),
                label_unranked: __('lang_mainsite',"Unranked game (Training mode)"),
                LB_SOMEONE_LEFT_THE_GAME_BEFORE_THE_END: __('lang_mainsite',"LB_SOMEONE_LEFT_THE_GAME_BEFORE_THE_END"),
                LB_GAME_RESULT_CANCELLED: __('lang_mainsite',"LB_GAME_RESULT_CANCELLED"),
                THE_PLAYER_WHO_LEFT: __('lang_mainsite',"The player who left (or was skipped) lost the game and got a %s penalty.").replace( '%s', '☯'),
                THE_OTHERS_PLAYERS: __('lang_mainsite',"The other players won this game and get %s of normal ELO points (because %s of this game has been played before the incident).").replace( '%s', this.tableinfos.progression+'%' ).replace( '%s', this.tableinfos.progression+'%' ),
                share: __('lang_mainsite',"Share")
            } ), this.div, 'replace' );      
            
            this.playeropinion = {};

            dojo.connect( $('publishresult'), 'onclick', this, 'onPublishResult' );
            
            this.update();  
            this.updateStats();    
        },
        destroy: function()
        {
        },
        
        update: function()
        {
            var table = this.tableinfos;
            if( typeof table.thumbs != 'undefined' )
            {
                this.playeropinion = table.thumbs;
            }

            if( typeof current_player_id == 'undefined' )
            {
                var current_player_id = this.page.player_id;
            }

            
            dojo.style( 'game_abandonned', 'display', 'block' );  
            dojo.style( 'publishresult', 'display', 'none' ); 
            var bShowRankDetails = false; 
        
            // Depending on endgame reason, display the right elements

            if( table.result.endgame_reason === 'didntstart_cron_timeout' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","Table closed automatically because not enough players joined the table after a while.");            
            }
            else if( table.result.endgame_reason === 'didntstart_cron_init_timeout' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","Table has been abandonned during initial configuration.");
            }
            else if( table.result.endgame_reason === 'didntstart_players_left' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","All players left the game before it begins.");
            }
            else if( table.result.endgame_reason === 'didntplay_cron_timeout' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","Game has been closed automatically because no move had been done on it during a long period of time.");            
            }
            else if( table.result.endgame_reason === 'normal_end' 
                  || table.result.endgame_reason === 'normal_concede_end' 
               )
            {
                // "normal" end, with a concede or not
            
                dojo.style( 'game_abandonned', 'display', 'none' );  
                //dojo.style( 'statistics', 'display', 'block' );
                dojo.style( 'publishresult', 'display', 'none' );
                bShowRankDetails = true;  

   
                if( table.result.endgame_reason === 'normal_concede_end' )
                {   
                    dojo.style( 'game_conceded', 'display', 'block' );  
                }

            }
            else if( table.result.endgame_reason === 'neutralized_after_skipturn' 
                  || table.result.endgame_reason === 'neutralized_after_skipturn_error' 
              )
            {
                // game has been neutralized after some player left.

                dojo.style( $('game_cancelled'), 'display', 'block' );

                
                dojo.style( 'game_abandonned', 'display', 'none' );  
                //dojo.style( 'statistics', 'display', 'block' );
                dojo.style( 'publishresult', 'display', 'none' );  
                bShowRankDetails = true;  

            }
            else if( table.result.endgame_reason === 'abandon_by_decision' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","The game has been abandonned because all players (with a positive clock) decided it, or because all players left the game.");                        
            }
            else if( table.result.endgame_reason === 'abandon_by_tournamenttimeout' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite", "Game has been abandonned automatically because players did not managed to finish it before the next round of the tournament. The player with the most remaining reflexion time wins the game.");            
            }
            else if( table.result.endgame_reason === 'error_tournament_wrongnumber' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","Some players of this tournament game did not show up, so we could not start the game (these players got a penalty on their profile).");                       
            }
            else if( table.result.endgame_reason === 'synchro_error_corrupted'
                  || table.result.endgame_reason === 'synchro_error_finished_on_gs'
                  || table.result.endgame_reason === 'synchro_error_not_on_gs'
             )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","Game has been closed automatically due to a technical error")+' ('+table.result.endgame_reason+')';            
            }
            else if( table.result.endgame_reason === 'express_stop' )
            {
                $('game_abandonned_explanation').innerHTML = "A developer cancel this game using Express Stop.";                        
            }
            else if( table.result.endgame_reason == 'abandon_sandbox_disagreement' )
            {
                $('game_abandonned_explanation').innerHTML = __( "lang_mainsite","The players disagree on the game result of this game, so we cancelled it.");                        
            }
            else
            {
                $('game_abandonned_explanation').innerHTML = "Unknow endgame reason: "+table.result.endgame_reason;
            }
            
            if( toint( table.unranked ) == 1 )
            {
                if( table.result.endgame_reason === 'neutralized_after_skipturn' 
                    || table.result.endgame_reason === 'neutralized_after_skipturn_error' )
                {
                    // This game is unranked: adapt cancelled message
                    dojo.style( $('game_cancelled'), 'display', 'none' );
                    dojo.style( $('game_unranked_cancelled'), 'display', 'block' );
                }
                
                dojo.style( $('game_unranked'), 'display', 'block' );  
                this.page.addTooltip( 'game_unranked_label', __('lang_mainsite',"The Training mode has been enabled for this table (no ranking points gain/loss for this game)."), '' );
            }

            var player;
            var bCurrentPlayerAtTable = false;
            var bAtLeastOneNonVoted = false;
            var previous_score = null;
            var tied_scores = [];
            var player_id = null;
            var player_to_rank = {};
            var bAtLeastOneNonFirst = false;

            for( var i in table.result.player )
            {
				player = table.result.player[ i ];
                var player_id = player.player_id;

                player.is_creator_display = (typeof globalUserInfos !== 'undefined' && globalUserInfos.user_rights.includes('display_technical') && table.table_creator === player.player_id) ? '':'none';
                	                                
                player_to_rank[ player_id ] = {
                    rank_after_game: player.rank_after_game,
                    elo_win: player.point_win,
                    rank_before_game: ( player.rank_after_game - player.point_win ),
                    gamerank: player.gamerank,
                    name: player.name,
                    opponents: {}
                };

                if( player.gamerank != 1 )
                {
                    bAtLeastOneNonFirst = true;
                }
            }
            
            // Compute ELO variation ("retro engineering" style)
            for( var player_id in player_to_rank )
            {
                var sum_elo_delta_no_k = 0;
                
                
                
                
                
                for( var opponent_id in player_to_rank )
                {
                    if( opponent_id != player_id )
                    {
                        // Compute the points earned against opponent_id
                        
                        var elo_diff = player_to_rank[player_id].rank_before_game - player_to_rank[opponent_id].rank_before_game;
                        
                        if( toint( player_to_rank[player_id].gamerank ) < toint( player_to_rank[opponent_id].gamerank ) )
                            var gameresult = 1;
                        else if( player_to_rank[player_id].gamerank == player_to_rank[opponent_id].gamerank )
                            var gameresult = 0.5;
                        else
                            var gameresult = 0;
                        
                        var expectedResult = 1 / ( 1 + Math.pow(10, -elo_diff/400 ) );
                        var elo_delta_no_k = gameresult - expectedResult;
                        sum_elo_delta_no_k += elo_delta_no_k;
                                                
                        player_to_rank[ player_id ].opponents[ opponent_id ] = {
                            gameresult:gameresult,
                            expectedResult: expectedResult,
                            elo_delta_no_k: elo_delta_no_k
                        };

                    }
                }
                if(sum_elo_delta_no_k != 0 )
                {
                    player_to_rank[ player_id ].k_factor = Math.round( player_to_rank[ player_id ].elo_win / sum_elo_delta_no_k );
                }
                else
                {
                    player_to_rank[ player_id ].k_factor = 60;  // Note: default
                }
                
                // Particular cases
                if( player_to_rank[ player_id ].rank_after_game == 1301 && player_to_rank[ player_id ].rank_before_game == 1300 )
                {
                    // 1st game => always 1
                    player_to_rank[ player_id ].k_factor = 60;
                    player_to_rank[ player_id ].particular_case = __('lang_mainsite',"You always get at least 1 ELO point during your first game on BGA.");
                }
                else if( player_to_rank[ player_id ].rank_after_game == 1400 && sum_elo_delta_no_k < 0 )
                {
                    // Cannot go under 100 ELO
                    player_to_rank[ player_id ].particular_case = __('lang_mainsite',"Note: you can never go back under 100 ELO.");
                }
                else if( player_to_rank[ player_id ].rank_after_game < 1400 && sum_elo_delta_no_k < 0 )
                {
                    // Cannot decrease under 100 ELO
                    player_to_rank[ player_id ].particular_case = __('lang_mainsite',"Note: you cannot lose ELO while your ELO has not reach 100.");
                }
            }
            var pos_to_score = {};
            
            for( var i in table.result.player )
            {
				player = table.result.player[ i ];
                var player_id = player.player_id;

                player.index = i;
                
                var rank_after_game = player.rank_after_game;
                var elo_win = player.point_win;
                var rank_before_game = rank_after_game - elo_win;

                player.point_win_arena = '';
                player.show_arena = 'none';
                player.arena_win_display = '';
                player.arena_after_display = '';

                if( ! player.score )
                {
                    // This player has no rank (ex: game abandonned)
                    player.rank_mask = '';
                    player.point_win = '';
                    player.rank_after_game = '';
                    player.is_tie = '';
                    player.score = '';
                    player.score_aux = '';
                    player.rankstr = '';
                }
                else
                {
                    if( table.result.losers_not_ranked && !bAtLeastOneNonFirst )
                    {
                        // Particular case: all players are tied
                        player.rankstr = __('lang_mainsite', 'Tie');
                    }
                    else if ( table.result.is_coop || table.result.is_solo )
                    {
                        if (player.score > 0) {
                            player.rankstr = __('lang_mainsite', 'Winner');
                        } else {
                            player.rankstr = __('lang_mainsite', 'Loser');
                        }
                    }
                    else
                    {
                        // Normal case
                        player.rankstr = this.page.getRankString( player.gamerank, table.result.losers_not_ranked );
                    }

                    //player.point_win = Math.round( player.point_win );
                    // DEPRECATED => now we display the exact difference between new rank and old rank, otherwise too many players are asking questions
                    player.point_win = Math.round( player_to_rank[ player_id ].rank_after_game ) - Math.round( player_to_rank[ player_id ].rank_before_game );

                    if( player.point_win >= 0 )
                    {    player.point_win = '+'+player.point_win;       }
                    player.rank_after_game =  this.page.getEloLabel( player.rank_after_game );
                    
                    if( toint( table.unranked ) == 1 )
                    {
                        player.rank_after_game = '';
                        player.point_win = '';
                    }

                    // Arena
                    if( player.arena_points_win != null )
                    {
                        player.show_arena = 'block';

                        var arena_points_details = this.page.arenaPointsDetails( player.arena_after_game );

                        if( arena_points_details.league == 5 )
                        {
                            // Elite specific display
                            var sign = player.arena_points_win >= 0 ? '+':'';
                            player.arena_win_display = sign+Math.round( player.arena_points_win%1 * 10000 );
                            player.arena_after_display = Math.round( player.arena_after_game%1 * 10000 )+ ' '+__('lang_mainsite',"pts")+' ';
    
                            player.arena_after_display += '<div style="display:inline-block;position:relative;margin-top: -32px;margin-bottom: 26px;">';
                            player.arena_after_display += '<div class="myarena_league league_'+arena_points_details.league+'" style="position:relative;display:inline-block;top:21px;left:0px">';
                            player.arena_after_display += '<div class="arena_label"></div>';
                            player.arena_after_display += '</div>';
                            player.arena_after_display += '</div>';  
    
                        }
                        else
                        {
                            if( player.arena_points_win > 100 )    
                            {
                                // League promotion
                                player.arena_win_display = '';
                            }
                            else
                            {
                                // Arena point gain
                                var sign = player.arena_points_win >= 0 ? '+':'';
                                player.arena_win_display = sign+( Math.round( player.arena_points_win )%10 ) + '<div class="icon20 icon_arena"></div>';
                            }
                            player.arena_after_display = '<div style="display:inline-block;position:relative;margin-top: -29px;margin-bottom: 26px;">';
                            player.arena_after_display += '<div class="myarena_league league_'+arena_points_details.league+'" style="position:relative;display:inline-block;top:21px;">';
                            player.arena_after_display += '<div class="arena_label">'+arena_points_details.points+'</div>';
                            player.arena_after_display += '</div>';
                            player.arena_after_display += '</div>';    
                        }
    

                    }
                }              

                player.emblem = getPlayerAvatar(player.player_id, player.avatar, 50);

                if( player.gender === null )
                {   player.gender = '' ;    }
                player.flag = player.country.code;
                player.table_id = table.id;

                player.emblem_class = '';
                if( player.is_premium == 1 )
                {
                    player.emblem_class = 'is_premium';
                }


                if( previous_score !== null && previous_score==player.score && player.score_aux!==null )
                {
                    tied_scores.push( player.score );
                }

                pos_to_score[ i ] = {score: player.score, score_aux: player.score_aux };
                previous_score = player.score;
                
                if( player.score_aux===null )
                {   player.score_aux ='';   }                
                
                player.signal_player_label = __( "lang_mainsite",'Signal this player');
                
                player.reputation_display = 'block';
                if( player_id == current_player_id )
                {   player.reputation_display = 'none';  } 
                
                player.url_base = '';
                if( typeof this.page.metasiteurl != 'undefined' )
                {
                    player.url_base = this.page.metasiteurl;
                }

                dojo.place( this.page.format_string( this.jstpl_score_entry, player ), 'game_result' );

                this.page.addTooltip( 'flag_'+player_id, player.country.name, '' );
                
                // Load sticky note on this player if any
                if( this.playeropinion[ player_id ] && this.playeropinion[ player_id ].n == 1 )
                {
                    this.page.ajaxcall( "/table/table/loadStickyNote.html", {player: player_id}, this, function( result ){
                        $('stickynote_ctrl_'+result.player).innerHTML = result.note;
                    } );
                    this.page.addTooltip( 'stickynote_edit_'+player_id, dojo.string.substitute( __( "lang_mainsite",'A personal note on ${player}, for your eyes only'), { player: player.name } ), __( "lang_mainsite",'Modify') );
                }
                else
                {
                    $('stickynote_ctrl_'+player_id).innerHTML = dojo.string.substitute( __( "lang_mainsite",'Write a personal note about ${name}' ), { name: $('player_'+player_id+'_name').innerHTML } )
                    this.page.addTooltip( 'stickynote_edit_'+player_id, '', dojo.string.substitute( __( "lang_mainsite",'Write a personal note about ${player}, for your eyes only'), { player: player.name } ) );
                }

                dojo.connect( $('stickynote_edit_'+player_id), 'onclick', this, 'onEditSticky' );
                
                // Penalties
                if( toint( table.result.penalties[ player_id ].clock ) >= 0 )
                {   
                    dojo.style( 'clock_'+player_id, 'display', 'inline' ); 
                    
                    if( typeof ( table.result.penalties[ player_id ].clock_cancelled ) != 'undefined' )
                    {
                        dojo.place( '<span> ('+__('lang_mainsite',"Penalty cancelled")+') </span>', 'clock_'+player_id );
                        dojo.addClass( 'clock_'+player_id, 'clockpenalty_cancelled' );
                    }
                }
                if( toint( table.result.penalties[ player_id ].leave ) >= 0 )
                {   
                    if( typeof ( table.result.penalties[ player_id ].leave_cancelled ) != 'undefined' )
                    {
                        dojo.place( '<span> ('+__('lang_mainsite',"Penalty cancelled")+') </span>', 'leave_'+player_id );
                        dojo.addClass( 'leave_'+player_id, 'leavepenalty_cancelled' );
                    }
                    else
                    {
                        $('winpoints_value_'+player_id).innerHTML += ' - '+table.result.penalties[ player_id ].leave;
                    }

                    //$('leavevalue_'+player_id).innerHTML = table.result.penalties[ player_id ].leave;
                    dojo.style( 'leave_'+player_id, 'display', 'inline' );  
                    
                  //  if( toint( table.result.penalties[ player_id ].leave ) == 0 )
                  //  {
                  //      dojo.style( 'leavevalue_wrap_'+player_id, 'display', 'none' );
                  //  }
                  //  else // DEPRECATED : now we always display penalty on tableresult, otherwise we understand nothing when applying penalties with 0 value (= 0 ELO variation)
                    {
                        dojo.style( 'leavevalue_wrap_'+player_id, 'display', 'inline' );
                    }


                }

                // ELO detailled explanation tooltip
                this.addPlayerEloTooltip(table, player, player_to_rank);
                
                this.page.addTooltipToClass( 'adddetails_arena', __('lang_mainsite','Arena points won/loss during this game'), '' );

                // Green/Red vote button
                var player_opinion = 0;
                if( this.playeropinion[ player_id ] )
                {
                    player_opinion = toint( this.playeropinion[ player_id ].t );

                    if( player_opinion == 0 && player_id != current_player_id && dojo.style( 'reputation_block_'+player_id, 'display' )!='none' )
                    {   bAtLeastOneNonVoted = true; }
                }
                else
                {
                    if( player_id != current_player_id && dojo.style( 'reputation_block_'+player_id, 'display' )!='none' )
                    {   bAtLeastOneNonVoted = true;             }
                }
                
                if( player_id == current_player_id )
                {
                    // No way you can vote for yourself 
                    bCurrentPlayerAtTable = true;
                }
                else
                {
                    var newThumb = new ebg.thumb();
                    newThumb.create( this.page, 'reput_'+player_id, player_id, player_opinion );
                }            
            }
            
            if( player_id !== null )
            {
                dojo.addClass( 'score_entry_'+player_id, 'last-score-entry' );
            }
            

            // Display score aux when needed
            var tiebreaker_explanation = null;
            if( $('gametiebreaker') !== null )
            {   tiebreaker_explanation = $('gametiebreaker').innerHTML; }   // table.view case
            else if( typeof this.page.tiebreaker != 'undefined' )
            {   tiebreaker_explanation = __( 'lang_'+ this.tableinfos.game_name, this.page.tiebreaker ); }   // game.view case

            if(  tiebreaker_explanation != '' && toint( table.cancelled ) != 1 )
            {
                for( var i in tied_scores )
                {
                    var tie_score = tied_scores[i];
                    dojo.query( ".score_aux_"+tie_score ).style( "display", "inline" );
                }            
                this.page.addTooltipToClass( 'tttiebraker', __( "lang_mainsite","Tie breaker") +': '+ tiebreaker_explanation, '' );

                if( tied_scores.length > 0 )
                {
                    $('tiebreaker_explanation').innerHTML = "<div class='smalltext'>(<i class='fa fa-star tiebreaker'></i>: "+ __( "lang_mainsite","Tie breaker")+': '+ tiebreaker_explanation+")</div><br/>";

                    // Multiple tie breaker: change the display to split between different tie breakers when there is such a split
                    var tie_splitter = false;
                    if( $('gametiebreaker_split') && $('gametiebreaker_split').innerHTML != '' )
                    {
                        tie_splitter = $('gametiebreaker_split').innerHTML.split( ','); // MS case
                    }
                    else if( typeof this.page.tiebreaker_split != 'undefined' && this.page.tiebreaker_split )
                    {
                        tie_splitter = this.page.tiebreaker_split;
                    }

                    if( tie_splitter)
                    {
                        
                        var pos_to_score_suite = {};

                        for( var i in pos_to_score )
                        {
                            var score = pos_to_score[i].score;
                            var score_aux = pos_to_score[i].score_aux;

                            // Build array with "score, tie breaker 1, tie breaker 2, tie breaker 3, ..."
                            var score_array = [];
                            score_array.push( parseInt( score ) );
                            for( var step in tie_splitter )
                            {
                                var score_aux_this_step = Math.floor( score_aux / tie_splitter[step] );
                                score_aux -= ( score_aux_this_step * tie_splitter[step] );
                                score_array.push( score_aux_this_step );
                            }

                            pos_to_score_suite[ i ] = {
                                html: '',
                                tie_step: 0,
                                score: score_array
                            };
                        }
                        

                        // Now, player by player, determine which is the correct level to display the tie breaker
                        for( var i in pos_to_score_suite )
                        {
                            for( var opp in pos_to_score_suite )
                            {
                                if( opp != i )
                                {
                                    for( var step in pos_to_score_suite[i].score )
                                    {
                                        if( pos_to_score_suite[i].score[step] == pos_to_score_suite[opp].score[step] )
                                        {
                                            pos_to_score_suite[i].tie_step ++; // scores are equal => need to display next level
                                        }
                                        else
                                        {
                                            break ;
                                        }
                                    }
                                }
                            }
                        }

                        // Finally, display each tie breaker as it should be
                        for( var i in pos_to_score_suite )
                        {
                            var html = '';
                            if( pos_to_score_suite[i].tie_step > 0 )
                            {
                                html = ' (';
                                for( var step=1; step <= pos_to_score_suite[i].tie_step; step++ )
                                {
                                    if( typeof pos_to_score_suite[i].score[step] != 'undefined' )
                                    {
                                        html += pos_to_score_suite[i].score[step]+'<i class="fa fa-star tiebreaker"></i> &nbsp;';
                                    }
                                }

                                html = html.slice(0, -7);
                                html += ')';

                                $('score_aux_'+i).innerHTML = html;
                            }
                        }                        

                        // debug tie breaker
                        //console.log( pos_to_score_suite );

                    }

                }
            }

            if( ! bShowRankDetails )
            {    
                // Game was abandonned before the end
                dojo.query( '.rankdetails' ).style( 'display','none' );           
                dojo.query( '.score' ).style( 'display','none' );           
            }
            if( toint( table.unranked ) == 1 ) {
            	// Rank is unchanged, so don't display incorrect information
            	dojo.query( '.rankdetails' ).style( 'display','none' );
            }

            this.page.addTooltipToClass( 'clockpenalty', __( "lang_mainsite","This player ran out of time during this game."), '' );
            this.page.addTooltipToClass( 'leavepenalty', __( "lang_mainsite","This player left this game before the end."), '' );
            this.page.addTooltipToClass( 'leavepenalty_cancelled', __( "lang_mainsite","This penalty has been cancelled because we judged that it was not this player fault (ex: technical error)."), '' );
            this.page.addTooltipToClass( 'clockpenalty_cancelled', __( "lang_mainsite","This penalty has been cancelled because we judged that it was not this player fault (ex: technical error)."), '' );
   
            if( typeof mainsite != 'undefined' )
            {
                mainsite.updatePremiumEmblemLinks();          
            }
            else if( typeof gameui != undefined )
            {
                gameui.updatePremiumEmblemLinks();          
            }
        },
        
        onEditSticky: function( evt )
        {
            dojo.stopEvent( evt );
            // stickynote_edit_<id>
            var pid = evt.currentTarget.id.substr( 16 );
            
            dojo.destroy('stickEditDialog');

            var stickyDlg = new ebg.popindialog();
            stickyDlg.create( 'stickEditDialog' );
            stickyDlg.setTitle( dojo.string.substitute( __( "lang_mainsite",'Write a personal note about ${name}' ), { name: $('player_'+pid+'_name').innerHTML } ) );
            stickyDlg.setMaxWidth( 400 );

            stickyDlg.tableModule = this.page;             
            
            var text = '';                        
            if( $('stickynote_ctrl_'+pid).innerHTML != dojo.string.substitute( __( "lang_mainsite",'Write a personal note about ${name}' ), { name: $('player_'+pid+'_name').innerHTML } ) )
            {
                text = $('stickynote_ctrl_'+pid).innerHTML;                
            }
                        
            var html = '<div id="stickEditDialog">';
            html += "<textarea id='sticky_text' style='width: 100%'>"+text+"</textarea>";
            html += "<p><a class='bgabutton bgabutton_gray' id='stickyedit_cancel' href='#'><span>"+__( "lang_mainsite","Cancel")+"</span></a> <a class='bgabutton bgabutton_blue' id='stickyedit_save' href='#'><span>"+__( "lang_mainsite","Save")+"</span></a></p>";
            html += "</div>";

            
            stickyDlg.setContent( html );
            stickyDlg.show();   
            

            dojo.connect( $('stickyedit_cancel'), 'onclick',
                    dojo.hitch( stickyDlg, function( evt ) { 
                            evt.preventDefault();
                            dojo.destroy('stickEditDialog');
                            this.destroy(); 
                           } ) );
                           
            dojo.connect( $('stickyedit_save'), 'onclick',
                    dojo.hitch( stickyDlg, function(evt ) {
                            evt.preventDefault();
                            var text = $('sticky_text').value;
                            this.destroy();

                            this.tableModule.ajaxcall( "/table/table/updateText.html", {type:'stickynote',id:pid,text:text}, this, function( result ){} );
                            $('stickynote_ctrl_'+pid).innerHTML = text;
                           } ) );

        },
        
        updateStats: function()
        {
            var intro = '';
            
            if( ! this.tableinfos.result.stats )
            {
                return ;
            }
            
            if( !this.pma && this.tableinfos.game_status != 'private' ) // NB: we display statistics for alpha games also for non-premium (playtesting phase)
            {
                intro = '<p style="text-align:center;"><a href="/premium?src=gamestats" class="bgabutton bgabutton_blue">'+__( "lang_mainsite","Go Premium to see game statistics!")+'</a></p><br/><br/>';
            }
        
            dojo.place( dojo.string.substitute( this.jstpl_statistics, {intro: intro} ),this.stats_div, 'only' );
          
            var stat_no = 1;
            if( this.pma || this.tableinfos.game_status == 'private' ) // NB: we display statistics for alpha games also for non-premium (playtesting phase)
            {
                this.insertTableStat( __( "lang_mainsite",'Game duration'), Math.round( this.tableinfos.result.time_duration/60 ), __('lang_mainsite','mn') );
                stat_no++;
                this.insertTableStat( __( "lang_mainsite",'Players average level'), this.page.getEloLabel( this.tableinfos.result.table_level ) );
                stat_no++;
            }
            else
            {
                this.insertTableStat( __( "lang_mainsite",'Game duration'), '<img class="statmasked" id="statmasked_'+stat_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'" alt="masked" />' );
                stat_no++;
                this.insertTableStat( __( "lang_mainsite",'Players average level'), '<img class="statmasked" id="statmasked_'+stat_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'" alt="masked" />' );
                stat_no++;
            }
            
            for( var i in this.tableinfos.result.stats.table )
            {
                var stat = this.tableinfos.result.stats.table[i];
                stat_no++;
                
                if( stat.id==3 || stat.id==1 )
                {   // These statistics has no interest in display
                }
                else
                {
                    
                    if( typeof stat.value != 'undefined' && stat.value !== null )
                    {
                        if( stat.value == '*masked*' || !this.pma && this.tableinfos.game_status != 'private' ) // NB: we display statistics for alpha games also for non-premium (playtesting phase)
                        {
                            stat.value = '<img class="statmasked" id="statmasked_'+stat_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'" alt="masked" />';
                        }
                        else
                        {
                            if( stat.type == 'int' )
                            {
                                stat.value = Math.round( stat.value );
                            }
                            else if( stat.type == 'bool' )
                            {
                                stat.value  = ( stat.value == 0 ) ? __( "lang_mainsite",'no') : __( "lang_mainsite",'yes');
                            }
                            
                            if (typeof stat.valuelabel != 'undefined') {
								stat.value = __( 'lang_'+this.tableinfos.game_name, stat.valuelabel );
							}
                        }
                        this.insertTableStat( __( 'lang_'+ this.tableinfos.game_name, stat.name ), stat.value, stat.unit );
                    }
                }
            }
            
            this.page.addTooltipToClass( 'statmasked', __( "lang_mainsite",'You must be a Premium member to see statistics'), '' );          
            
            // Add players
            var player_to_rank = {};
            var player_to_score = {};
            for( var i in this.tableinfos.result.player )
            {
                var player = this.tableinfos.result.player[ i ];
                dojo.place( dojo.string.substitute( this.jstpl_playerstatheader, {
                    ID: player.player_id,
                    NAME: player.name
                } ), 'player_stats_header' );
                
                player_to_rank[ player.player_id ] = player.gamerank;
                player_to_score[ player.player_id ] = player.score;
            }

            // Additional line to repeat the score of this player
            var output = '';
            for( var i in this.tableinfos.result.player )
            {
                var player = this.tableinfos.result.player[ i ];
                var player_id = player.player_id;

                output += '<td>'+this.page.getRankString( player_to_rank[ player_id ] )+' ('+player_to_score[ player_id ]+'<i class="fa fa-lg fa-star"></i>)</td>'; 
            }
            dojo.place( dojo.string.substitute( this.jstpl_playerstat, {
                NAME: __( "lang_mainsite","LB_GAME_RESULT"),
                PLAYER_STATS: output
            } ), 'player_stats_table' );

            
            // Add players stats
            for( var stat_id in this.tableinfos.result.stats.player )
            {
                if( ( stat_id=='time_bonus_nbr' || stat_id=='reflexion_time_sd' ) && ( $('go_to_table')===null ) ) 
                {   // These statistics has no interest in display
                    // (except for admins, who have a "go_to_table" not null
                }
                else
                {
                    var stat = this.tableinfos.result.stats.player[ stat_id ];
                    var output = '';
                    var unit = typeof stat.unit == 'undefined' ? '' : ' '+stat.unit;
                    var bAtLeastOneNonVoid = false;

                    for( var i in this.tableinfos.result.player )
                    {
                        var player_id = this.tableinfos.result.player[ i ].player_id;
                        var value = '-';

                        if( typeof stat.values[ player_id ] != 'undefined' && stat.values[ player_id ] !== null )
                        {
                            value = stat.values[ player_id ];
                        }

                        stat_no++;

                        if( value !== null )
                        {   bAtLeastOneNonVoid = true;  }

                        if( value == '*masked*' || !this.pma && this.tableinfos.game_status != 'private' ) // NB: we display statistics for alpha games also for non-premium (playtesting phase)
                        {
                            value = '<img class="statmasked" id="statmasked_'+stat_no+'" src="'+getStaticAssetUrl('img/common/rankmask.png')+'" alt="masked" />';
                        }
                        else if (value != '-')
                        {
                            if( stat.type == 'int' )
                            {
                                value = Math.round( value );
                            }
                            else if( stat.type == 'bool' )
                            {
                                value  = ( value == 0 ) ? __( "lang_mainsite",'no') : __( "lang_mainsite",'yes');
                            }
                            
                            if (typeof stat.valuelabels[ player_id ] != 'undefined') {
							    value = __( 'lang_'+this.tableinfos.game_name, stat.valuelabels[ player_id ] );
						    }
						    
						    if( stat_id == 'reflexion_time' )
						    {
						        // Value is in seconds => display it in minutes
						        value = this.page.formatReflexionTime( value ).string;
						        unit = '';
						    }
                        }
                        
                        output += '<td>'+ value+unit+'</td>';
                    }
                    
                    if( bAtLeastOneNonVoid )
                    {
                        dojo.place( dojo.string.substitute( this.jstpl_playerstat, {
                            NAME: __( 'lang_'+this.tableinfos.game_name,stat.name ),
                            PLAYER_STATS: output
                        } ), 'player_stats_table' );
                    }
                }
            }
            
            // Additional line to see "all player stats for this game"
            var output = '';
            for( var i in this.tableinfos.result.player )
            {
                var player = this.tableinfos.result.player[ i ];
                var player_id = player.player_id;

                output += '<td class="smalltext"><div class="icon20 icon20_stat"></div> <a class="bga-link" href="/playerstat?id='+player_id+'&game='+this.tableinfos.game_id+'">'+__('lang_mainsite', "%s`s statistics at this game").replace('%s', player.name)+'</a></td>';
            }
            dojo.place( dojo.string.substitute( this.jstpl_playerstat, {
                NAME: '<div class="icon20 icon20_stat"></div> '+__( "lang_mainsite",'All stats'),
                PLAYER_STATS: output
            } ), 'player_stats_table' );

        },
        
        insertTableStat: function( statname, value, unit )
        {
            // TODO : if not premium mask value
        
            if( typeof unit == 'undefined' )
            {   unit = '';  }
                                
            dojo.place( dojo.string.substitute( this.jstpl_table_stat, {
                statname: statname,
                value: value,
                unit: unit
            } ), 'table_stats' );
        },

        onPublishResult: function( evt )
        {
            // "Share"  button click
            dojo.stopEvent( evt );

            dojo.style( 'publishresult', 'display', 'none' );
            dojo.style( 'publishresult_content', 'display', 'block' );

            FB.XFBML.parse();
        },

        addPlayerEloTooltip: function (table, player, player_to_rank) {
            player_id = player.player_id;

            var html = '<h2>' + dojo.string.substitute(__( "lang_mainsite",'Details of the ELO computation for ${player}'), { player: player.name }) + '</h2>';

            html += '<hr/>';


            html += "<table class='newbgatable'>";

            html +=
                '<tr><td>' +
                __('lang_mainsite','ELO rank before this game') +
                "</td><td style='text-align:right'>" +
                this.page.getEloLabel(player_to_rank[player_id].rank_before_game, false, false) +
                '</td>';

            if (table.result.is_coop) {

                html += '<tr><td style="font-style: italic;">' + __('lang_mainsite','Details are not yet available for a cooperative game.') + '</td>';

            } else {

                html +=
                    '<tr><td>' +
                    __('lang_mainsite','K factor') +
                    "</td><td style='text-align:right'>" +
                    player_to_rank[player_id].k_factor +
                    '</td>';

                for (var opponent_id in player_to_rank[player_id].opponents) {
                    if (player_to_rank[player_id].opponents[opponent_id].gameresult == 1) {
                        var label = dojo.string.substitute(__( "lang_mainsite",'Victory against ${player}'), {
                            player: player_to_rank[opponent_id].name,
                        });
                    } else if (player_to_rank[player_id].opponents[opponent_id].gameresult == 0.5) {
                        var label = dojo.string.substitute(__( "lang_mainsite",'Tie with ${player}'), {
                            player: player_to_rank[opponent_id].name,
                        });
                    } else {
                        var label = dojo.string.substitute(__( "lang_mainsite",'Defeat against ${player}'), {
                            player: player_to_rank[opponent_id].name,
                        });
                    }

                    label += '<br/>';
                    label += this.page.getEloLabel(player_to_rank[opponent_id].rank_before_game, true);
                    label +=
                        ': ' +
                        __('lang_mainsite','Probability of a win') +
                        ': ' +
                        Math.round(player_to_rank[player_id].opponents[opponent_id].expectedResult * 100) +
                        '%';

                    var elo_win =
                        Math.round(
                            player_to_rank[player_id].opponents[opponent_id].elo_delta_no_k *
                                player_to_rank[player_id].k_factor *
                                100
                        ) / 100;

                    html += '<tr><td>' + label + "</td><td style='text-align:right'>" + elo_win + '</td>';
                }

                if (typeof player_to_rank[player_id].particular_case != 'undefined') {
                    html +=
                        "<tr><td colspan='2' style='text-align:center'>" +
                        player_to_rank[player_id].particular_case +
                        '</td>';
                }

                html +=
                    '<tr><td><b>' +
                    __('lang_mainsite','Total ELO variation') +
                    "</b></td><td style='text-align:right'><b>" +
                    Math.round(player_to_rank[player_id].elo_win * 100) / 100 +
                    '</b></td>';

            }

            html +=
                '<tr><td>' +
                __('lang_mainsite','ELO rank after this game') +
                "</td><td style='text-align:right'>" +
                this.page.getEloLabel(player_to_rank[player_id].rank_after_game, false, false) +
                '</td>';
            html += '</table>';
            this.page.addTooltipHtml('adddetails_' + player_id, html);
        },
        
    });
});
