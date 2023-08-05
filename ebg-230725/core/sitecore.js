// e board game site core stuff
// (base class of gamegui & mainsite)

define("ebg/core/sitecore", [
    'dojo',
    'dojo/_base/declare',
    "svelte/index",
    'dojo/has',
    'ebg/core/core',
    'ebg/core/soundManager',
    'dijit/form/Select',
    'dijit/TooltipDialog',
    'dojox/dtl/filter/htmlstrings',
    'ebg/gamenotif',
    'ebg/chatinput',
    'ebg/thumb'
], function (dojo, declare, svelte) {
    return declare('ebg.core.sitecore', ebg.core.core, {
        constructor: function () {
            console.log('ebg.core.sitecore constructor');
            this.ajaxcall_running = 0;

            g_sitecore = this;

            this.notifqueue = new ebg.gamenotif();

            this.active_menu_label = '';
            this.next_headmsg_id = 1;

            this.cometd_is_connected = false;
            this.page_is_unloading = false;
            this.cometd_first_connect = true;

            this.cometd_subscriptions = {}; // CometD subscription (used to reconnect after disconnection)

            this.reportErrorTimeout = false;

            this.next_log_id = 0;
            this.chatbarWindows = {}; // chat bar unique id => chat bar infos
            this.jstpl_chatwindow = [
                '<div id="chatwindow_${id}" class="chatwindow chatwindowtype_${type}">',
                    '<div id="chatwindowexpanded_${id}" class="chatwindowexpanded">',
                        '<div class="dropshadow"></div>',
                        '<div id="chatbarinput_${id}" class="chatbarinput"></div>',
                        '<div id="chatbarbelowinput_${id}" class="chatbarbelowinput">',
                            '<div id="chatbarinput_stopnotif_${id}" class="chatbarinput_stopnotif">',
                                '<input type="checkbox" checked="checked" id="chatbarinput_stopnotif_box_${id}" />',
                                '<span id="chatbarinput_stopnotif_label_${id}">${stop_notif_label}</span>',
                            '</div>',
                            '<div',
                               ' id="chatbarinput_startaudiochat_${id}"',
                               ' class="chatwindow_startaudiochat chatbarbelowinput_item audiovideo_inactive">',
                                '<i class="fa fa-microphone"></i>',
                            '</div>',
                            '<div',
                               ' id="chatbarinput_startvideochat_${id}"',
                               ' class="chatwindow_startvideochat chatbarbelowinput_item audiovideo_inactive">',
                                '<i class="fa fa-video-camera"></i>',
                            '</div>',
                            '<div id="chatbarinput_predefined_${id}" class="chatbarbelowinput_item">',
                                '<div class="chatbarinput_predefined icon20 icon20_meeple_wb"></div>',
                            '</div>',
                            '<div id="chatbarinput_showcursor_${id}" class="chatbarbelowinput_item chatbarbelowinput_item_showcursor">',
                                '<i class="fa fa-hand-pointer-o"></i>',
                            '</div>',
                            '<div id="chatbar_startchat_${id}" class="chatbar_startchat">',
                                '<a class="bgabutton bgabutton_blue" id="startchat_accept_${id}">${start_chat}</a><br />',
                                '<a class="bgabutton bgabutton_red" id="startchat_block_${id}">${block_chat}</a>',
                            '</div>',
                        '</div>',
                        '<div id="chatwindowlogs_${id}" class="chatwindowlogs">',
                            '<div id="chatwindowlogstitlebar_${id}" class="chatwindowlogstitlebar">',
                                '<div class="chatwindowlogstitle" id="chatwindowlogstitle_${id}">',
                                    '<span id="is_writing_now_title_${id}" class="is_writing_now">',
                                        '<i class="fa fa-pencil fa-blink"></i>&nbsp;<span',
                                           ' id="is_writing_now_expl_title_${id}"',
                                           ' class="is_writing_now_expl"></span>',
                                    '</span>',
                                    '<span id="chatwindowlogstitle_content_${id}">${title}</span>',
                                '</div>',
                                '<div id="chatwindowicon_${id}" class="chatwindowicon">',
                                    '<div class="avatarwrap emblemwrap">${avatar}</div>',
                                '</div>',
                                '<div id="chatwindowcollapse_${id}" class="chatwindowcollapse icon20 icon20_collapse_white"></div>',
                                '<div id="chatwindowremove_${id}" class="chatwindowremove icon20 icon20_remove_white"></div>',
                            '</div>',
                            '<div id="chatwindowlogs_zone_${id}" class="chatwindowlogs_zone">',
                                '<div id="chatwindowlogs_endzone_${id}" class="chatwindowlogs_endzone"></div>',
                            '</div>',
                            '<div id="chatwindowmorelogs_${id}" class="chatwindowmorelogs roundedbox">',
                                '<a class="bga-link" id="chatwindowmorelogslink_${id}" href="#">${more_logs_label}</a>',
                            '</div>',
                        '</div>',
                    '</div>',
                    '<div id="chatwindowpreview_${id}" class="chatwindowpreview"></div>',
                    '<div id="chatwindowcollapsed_${id}" class="chatwindowcollapsed">',
                        '<div class="chatwindowcollapsedtitle">',
                            '<span id="chatwindownewmsgcount_${id}" class="chatwindownewmsgcount"></span>',
                            '<span id="is_writing_now_${id}" class="is_writing_now">',
                                '<i class="fa fa-pencil fa-blink"></i>&nbsp;<span',
                                   ' id="is_writing_now_expl_${id}"',
                                   ' class="is_writing_now_expl"></span>',
                            '</span>',
                            '<span id="chatwindowtitlenolink_${id}">${titlenolink}</span>',
                        '</div>',
                        '<div id="chatwindowremovc_${id}" class="chatwindowremovec icon20 icon20_remove"></div>',
                        '<div class="chatwindowavatar">',
                            '<div class="avatarwrap emblemwrap emblemwrap_l">${avatar}</div>',
                            '<div id="chatMindownewmsgcount_${id}" class="chatwindownewmsgcount chatMindownewmsgcount"></div>',
                            '<i class="bubblecaret fa fa-caret-up"></i>',
                        '</div>',
                    '</div>',
                '</div>',
            ].join('');

            this.dockedChatInitialized = false;

            this.groupToCometdSubs = {};

            this.window_visibility = 'visible';

            this.premiumMsgAudioVideo = null;

            var urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('media_rating') && urlParams.has('room')) {
                var media = urlParams.get('media_rating');
                var room = urlParams.get('room');
                if (media == 'video' || media == 'audio') {
                    g_sitecore.displayRatingContent(media, {
                        room_id: room,
                        media: media,
                        rating: null,
                        issue: null,
                        text: null,
                    });
                }
            }

            this.badWordList = [
                'youporn',
                'redtube',
                'pornotube',
                'pornhub',
                'xtube',
                'a-hole',
                'dumb',
                'fool',
                'imbecile',
                'nutcase',
                'dipstick',
                'lunatic',
                'weirdo',
                'dork',
                'dope',
                'dimwit',
                'half-wit',
                'oaf',
                'bimbo',
                'jerk',
                'numskull',
                'numbskull',
                'goof',
                'suck',
                'moron',
                'morons',
                'idiot',
                'idi0t',
                'rape',
                'rapist',
                'hitler',
                '4r5e',
                '5h1t',
                '5hit',
                'a55',
                'anal',
                'anus',
                'ar5e',
                'arrse',
                'arse',
                'ass',
                'ass-fucker',
                'asses',
                'assfucker',
                'assfukka',
                'asshole',
                'assholes',
                'asswhole',
                'a_s_s',
                'b!tch',
                'b00bs',
                'b17ch',
                'b1tch',
                'ballbag',
                'ballsack',
                'bastard',
                'beastial',
                'beastiality',
                'bellend',
                'bestial',
                'bestiality',
                'bi+ch',
                'biatch',
                'bitch',
                'bitcher',
                'bitchers',
                'bitches',
                'bitchin',
                'bitching',
                'blow job',
                'blowjob',
                'blowjobs',
                'boiolas',
                'bollock',
                'bollok',
                'boner',
                'boob',
                'boobs',
                'booobs',
                'boooobs',
                'booooobs',
                'booooooobs',
                'breasts',
                'buceta',
                'bugger',
                'bum',
                'bunny fucker',
                'butt',
                'butthole',
                'buttmuch',
                'buttplug',
                'c0ck',
                'c0cksucker',
                'carpet muncher',
                'cawk',
                'chink',
                'cipa',
                'cl1t',
                'clit',
                'clitoris',
                'clits',
                'cnut',
                'cock',
                'cock-sucker',
                'cockface',
                'cockhead',
                'cockmunch',
                'cockmuncher',
                'cocks',
                'cocksuck ',
                'cocksucked ',
                'cocksucker',
                'cocksucking',
                'cocksucks ',
                'cocksuka',
                'cocksukka',
                'cokmuncher',
                'coksucka',
                'coon',
                'cox',
                'crap',
                'cum',
                'cummer',
                'cumming',
                'cums',
                'cumshot',
                'cunilingus',
                'cunillingus',
                'cunnilingus',
                'cunt',
                'cuntlick ',
                'cuntlicker ',
                'cuntlicking ',
                'cunts',
                'cyalis',
                'cyberfuc',
                'cyberfuck ',
                'cyberfucked ',
                'cyberfucker',
                'cyberfuckers',
                'cyberfucking ',
                'd1ck',
                'damn',
                'dick',
                'dickhead',
                'dildo',
                'dildos',
                'dink',
                'dinks',
                'dirsa',
                'dlck',
                'dog-fucker',
                'doggin',
                'dogging',
                'donkeyribber',
                'doosh',
                'duche',
                'dyke',
                'ejaculate',
                'ejaculated',
                'ejaculates ',
                'ejaculating ',
                'ejaculatings',
                'ejaculation',
                'ejakulate',
                'f u c k',
                'f u c k e r',
                'f4nny',
                'fag',
                'fagging',
                'faggitt',
                'faggot',
                'faggs',
                'fagot',
                'fagots',
                'fags',
                'fanny',
                'fannyflaps',
                'fannyfucker',
                'fanyy',
                'fatass',
                'fcuk',
                'fcuker',
                'fcuking',
                'feck',
                'fecker',
                'felching',
                'fellate',
                'fellatio',
                'fingerfuck ',
                'fingerfucked ',
                'fingerfucker ',
                'fingerfuckers',
                'fingerfucking ',
                'fingerfucks ',
                'fistfuck',
                'fistfucked ',
                'fistfucker ',
                'fistfuckers ',
                'fistfucking ',
                'fistfuckings ',
                'fistfucks ',
                'flange',
                'fook',
                'fooker',
                'fucka',
                'fucked',
                'fucker',
                'fuckers',
                'fuckhead',
                'fuckheads',
                'fuckings',
                'fuckingshitmotherfucker',
                'fuckme ',
                'fucks',
                'fuckwhit',
                'fuckwit',
                'fudge packer',
                'fudgepacker',
                'fuk',
                'fuker',
                'fukker',
                'fukkin',
                'fuks',
                'fukwhit',
                'fukwit',
                'fux',
                'fux0r',
                'f_u_c_k',
                'gangbang',
                'gangbanged ',
                'gangbangs ',
                'gaylord',
                'gaysex',
                'goatse',
                'God',
                'god-dam',
                'god-damned',
                'goddamn',
                'goddamned',
                'hardcoresex ',
                'heshe',
                'hoar',
                'hoare',
                'hoer',
                'homo',
                'hore',
                'horniest',
                'horny',
                'hotsex',
                'jack-off ',
                'jackoff',
                'jap',
                'jerk-off ',
                'jism',
                'jiz ',
                'jizm ',
                'jizz',
                'kawk',
                'knob',
                'knobead',
                'knobed',
                'knobend',
                'knobhead',
                'knobjocky',
                'knobjokey',
                'kock',
                'kondum',
                'kondums',
                'kum',
                'kummer',
                'kumming',
                'kums',
                'kunilingus',
                'l3i+ch',
                'l3itch',
                'labia',
                'lmfao',
                'lust',
                'lusting',
                'm0f0',
                'm0fo',
                'm45terbate',
                'ma5terb8',
                'ma5terbate',
                'masochist',
                'master-bate',
                'masterb8',
                'masterbat*',
                'masterbat3',
                'masterbate',
                'masterbation',
                'masterbations',
                'masturbate',
                'mo-fo',
                'mof0',
                'mofo',
                'mothafuck',
                'mothafucka',
                'mothafuckas',
                'mothafuckaz',
                'mothafucked ',
                'mothafucker',
                'mothafuckers',
                'mothafuckin',
                'mothafucking ',
                'mothafuckings',
                'mothafucks',
                'mother fucker',
                'motherfuck',
                'motherfucked',
                'motherfucker',
                'motherfuckers',
                'motherfuckin',
                'motherfucking',
                'motherfuckings',
                'motherfuckka',
                'motherfucks',
                'muff',
                'mutha',
                'muthafecker',
                'muthafuckker',
                'muther',
                'mutherfucker',
                'n1gga',
                'n1gger',
                'nazi',
                'nigg3r',
                'nigg4h',
                'nigga',
                'niggah',
                'niggas',
                'niggaz',
                'nigger',
                'niggers ',
                'nob',
                'nob jokey',
                'nobhead',
                'nobjocky',
                'nobjokey',
                'numbnuts',
                'nutsack',
                'orgasim ',
                'orgasims ',
                'orgasm',
                'orgasms ',
                'p0rn',
                'pecker',
                'penis',
                'penisfucker',
                'phonesex',
                'phuck',
                'phuk',
                'phuked',
                'phuking',
                'phukked',
                'phukking',
                'phuks',
                'phuq',
                'pigfucker',
                'pimpis',
                'piss',
                'pissed',
                'pisser',
                'pissers',
                'pisses ',
                'pissflaps',
                'pissin ',
                'pissing',
                'pissoff ',
                'poop',
                'porn',
                'porno',
                'pornography',
                'pornos',
                'prick',
                'pricks ',
                'pron',
                'pube',
                'pusse',
                'pussi',
                'pussies',
                'pussy',
                'pussys ',
                'rectum',
                'retards',
                'rimjaw',
                'rimming',
                's hit',
                's.o.b.',
                'sadist',
                'schlong',
                'screwing',
                'scroat',
                'scrote',
                'scrotum',
                'semen',
                'sex',
                'sh!+',
                'sh!t',
                'sh1t',
                'shag',
                'shagger',
                'shaggin',
                'shagging',
                'shemale',
                'shi+',
                'shit',
                'shitdick',
                'shite',
                'shited',
                'shitey',
                'shitfuck',
                'shitfull',
                'shithead',
                'shiting',
                'shitings',
                'shits',
                'shitted',
                'shitter',
                'shitters ',
                'shitting',
                'shittings',
                'shitty ',
                'skank',
                'slut',
                'sluts',
                'smegma',
                'smut',
                'snatch',
                'son-of-a-bitch',
                'spac',
                'spunk',
                's_h_i_t',
                't1tt1e5',
                't1tties',
                'teets',
                'teez',
                'testical',
                'testicle',
                'tit',
                'titfuck',
                'tits',
                'titt',
                'tittie5',
                'tittiefucker',
                'titties',
                'tittyfuck',
                'tittywank',
                'titwank',
                'tosser',
                'turd',
                'tw4t',
                'twat',
                'twathead',
                'twatty',
                'twunt',
                'twunter',
                'v14gra',
                'v1gra',
                'vulva',
                'w00se',
                'wang',
                'wank',
                'wanker',
                'wanky',
                'whoar',
                'whore',
                'willies',
                'willy',
                'xrated',
                'xxx',
                /** Manually added **/
                'enculé',
                'baiser',
                'nique',
                'niquer',
                'salope',
                'pute',
                'fuck',
                'f*ck',
                'f**k',
                'noob',
            ];

            this.tutorialHighlightedQueue = [];

            this.browser_inactivity_time = 0;
            this.bInactiveBrowser = false;

            this.red_thumbs_given = {};
            this.red_thumbs_taken = {};
        },

        init_core: function () {
            console.log('init_core');

            console.log('Version of Dojo: ' + dojo.version.toString());

            this.premiumMsgAudioVideo =
                __('lang_mainsite', 'Premium feature: audio or video calls can be started by Premium players.') +
                '<br /><a href="/premium?src=avchat">' +
                __('lang_mainsite', 'To be able to start a live chat with fellow players, go Premium!') +
                '</a><br />' +
                __('lang_mainsite', '(browser compatibility: %s)').replace('%s', 'Chrome, Firefox, Opera');

            dojo.removeClass('ebd-body', 'page_is_loading');

            if ($('head_infomsg')) {
                dojo.empty('head_infomsg');
            }

            this.takeIntoAccountAndroidIosRequestDesktopWebsite(document);

            // Active the new chat log system
            if (typeof mainsite != 'undefined' && mainsite.dockedChat) {
                if (typeof this.chatDetached == 'undefined' || this.chatDetached.type === null) {
                    this.notifqueue.onPlaceLogOnChannel = dojo.hitch(this, 'onPlaceLogOnChannel');
                    this.initChatDockedSystem();
                }
            }
            if (typeof gameui != 'undefined' && gameui.dockedChat) {
                this.notifqueue.onPlaceLogOnChannel = dojo.hitch(this, 'onPlaceLogOnChannel');
                this.initChatDockedSystem();
            }

            //
            this.isTouchDevice = 'ontouchstart' in window || navigator.msMaxTouchPoints > 0;
            if (this.isTouchDevice) {
                dojo.addClass('ebd-body', 'touch-device');
            } else {
                dojo.addClass('ebd-body', 'notouch-device');
            }

            this.predefinedTextMessages = {
                tbleave: "Sorry I will continue to play later.",    // Only for TB
                goodmove: "Sorry I have an emergency: I'm back in few seconds...",
                gm: 'Good move!',
                think: 'I would like to think a little, thank you',
                stillthinkin: 'Yeah, still there, just thinking.',
                stillthere: 'Hey, are you still there?',
                gg: 'Good Game!',
                glhf: 'Good luck, have fun!',
                hf: 'Have fun!',
                tftg: 'Thanks for the game!',
            };
            this.predefinedTextMessages_untranslated = {
                "Sorry I will continue to play later." : 'tbleave',
                "Sorry I have an emergency: I'm back in few seconds...": 'goodmove',
                'Good move!': 'gm',
                'Yeah, still there, just thinking.': 'stillthinkin',
                'Hey, are you still there?': 'stillthere',
                'I would like to think a little, thank you': 'think',
                'Good Game!': 'gg',
                'Good luck, have fun!': 'glhf',
                'Have fun!': 'hf',
                'Thanks for the game!': 'tftg',
            };
            this.predefinedTextMessages_target_translation = {
                tbleave: __('lang_mainsite', 'Sorry I will continue to play later.'),
                goodmove: __('lang_mainsite', "Sorry I have an emergency: I'm back in few seconds..."),
                gm: __('lang_mainsite', 'Good move!'),
                think: __('lang_mainsite', 'I would like to think a little, thank you'),
                stillthinkin: __('lang_mainsite', 'Yeah, still there, just thinking.'),
                stillthere: __('lang_mainsite', 'Hey, are you still there?'),
                gg: __('lang_mainsite', 'Good Game!'),
                glhf: __('lang_mainsite', 'Good luck, have fun!'),
                test: __('lang_mainsite', 'We detect an insult in your chat input.'),
                hf: __('lang_mainsite', 'Have fun!'),
                tftg: __('lang_mainsite', 'Thanks for the game!'),
            };

            // More logs
            if ($('seemorelogs_btn')) {
                dojo.connect($('seemorelogs_btn'), 'onclick', this, 'onSeeMoreLogs');
            }

            this.initMonitoringWindowVisibilityChange();

            // Diff with server time
            var server_time = $('servicetime').innerHTML;
            var now = new Date();
            var local_time = 60 * now.getHours() + now.getMinutes();

            this.timezoneDelta = Math.round((local_time - server_time) / 60);
            if (this.timezoneDelta < 0) {
                this.timezoneDelta += 24;
            }

            this.register_subs(dojo.subscribe('ackmsg', this, 'onAckMsg'));
            this.register_subs(dojo.subscribe('force_browser_reload', this, 'onForceBrowserReload'));
            this.register_subs(dojo.subscribe('debugPing', this, 'onDebugPing'));
            this.register_subs(dojo.subscribe('newRequestToken', this, 'onNewRequestToken'));

            // Sound volume control
            if (soundManager.bMuteSound == true && $('toggleSound_icon') !== null) {
                dojo.removeClass('toggleSound_icon', 'fa-volume-up');
                dojo.addClass('toggleSound_icon', 'fa-volume-off');
            }
            if ($('toggleSound')) {
                dojo.connect($('toggleSound'), 'onclick', this, 'onToggleSound');
                dojo.connect($('toggleSound'), 'onmouseover', this, 'onDisplaySoundControls');
                dojo.connect($('toggleSound'), 'onmouseout', this, 'onHideSoundControls');
            }
            if ($('soundVolumeControl')) {
                dojo.connect($('soundVolumeControl'), 'onmouseup', this, 'onSoundVolumeControl');
                dojo.connect($('soundVolumeControl'), 'ontouchend', this, 'onSoundVolumeControl');
            }
            if ($('soundControls')) {
                dojo.connect($('soundControls'), 'onmouseover', this, 'onStickSoundControls');
                dojo.connect($('soundControls'), 'onmouseout', this, 'onUnstickSoundControls');
            }

            // Connect the svelte store "userVolume".
            // For now, volume control is actually done from here; volume information is communicated via the store.
            {
                let isInitialSoundValue = true;
                svelte.stores.userVolume.subscribe((e) => {
                    console.log('volume change', e.volume, e.volumeMuted);
                    localStorage.setItem('sound_muted', e.volumeMuted ? '1' : '0');
                    localStorage.setItem('sound_volume', e.volume);
                    this.onSetSoundVolume(!isInitialSoundValue);
                    isInitialSoundValue = false;
                });
            }

            // Initialize universal modal holder
            this.bgaUniversalModals = new svelte.ms.universalmodals.BgaUniversalModals({
                target: document.body
            });

            // Initialize toast holder
            this.bgaToastHolder = new svelte.ms.toasts.BgaToastHolder({
                target: document.body
            });

            // 8 secs after the page loading, we post back the loading performances to the server.
            // Note: disabled as we are not monitoring this anyway. To be re-enabled if we decide to build a real monitoring of this at some point
            //setTimeout( dojo.hitch( this, 'traceLoadingPerformances' ), 8000 );

            //Increment the idle time counter every minute.
            setInterval(dojo.hitch(this, 'inactivityTimerIncrement'), 60000); // 1 minute
            document.onmousemove = dojo.hitch(this, 'resetInactivityTimer');
            document.onkeypress = dojo.hitch(this, 'resetInactivityTimer');

            // Pi link
            if ($('pilink')) {
                dojo.connect($('pilink'), 'onclick', this, function (evt) {
                    dojo.stopEvent(evt);

                    this.ajaxcall('/player/player/pilink.html', {}, this, function (result) {});
                });
            }
        },

        unload: function () {
            console.log('Unloading page ...');
            var current_player_id =
                typeof this.current_player_id != 'undefined' ? this.current_player_id : this.player_id;
            this.recordMediaStats(current_player_id, 'stop');
            this.page_is_unloading = true;
        },

        // Update ajax call status notification icons in the interface
        // (depending on the number of ajax call in progress)
        updateAjaxCallStatus: function () {
            svelte.stores.menuStates.setIsPageLoading(this.ajaxcall_running > 0);
        },

        // Show an information message during few seconds on page head
        showMessage: function (msg, type) {
            // Gender management
            // Disabled: should not be necessary as messages addressing the player should be using the first person, and if we are talking about someone else (or a game character) we don't want to mess with the gender.
            //if (typeof globalUserInfos != 'undefined') {
            //    msg = this.applyGenderRegexps( msg, globalUserInfos.gender );
            //}

            console.log('Show message ' + msg + ' with id ' + this.next_headmsg_id + ' and style head_' + type);

            if (type != 'only_to_log') {
                var msg_div_id = 'head_infomsg_' + this.next_headmsg_id;
                var msg_div =
                    "<div class='bga-link-inside head_" +
                    type +
                    "' id='" +
                    msg_div_id +
                    "' style='display:none;'><div class='head_infomsg_close' id='close_" +
                    msg_div_id +
                    "'><i class='fa fa-close' aria-hidden='true'></i></div><div class='head_infomsg_item'>" +
                    msg +
                    '</div></div>';
                this.next_headmsg_id++;
                dojo.place(msg_div, 'head_infomsg');
                dojo.connect($('close_' + msg_div_id), 'onclick', this, function (evt) {
                    dojo.style(evt.currentTarget.parentElement.id, 'display', 'none');
                });

                dojo.fx
                    .chain([
                        dojo.fx.wipeIn({
                            node: msg_div_id,
                            duration: 500,
                        }),
                        dojo.fx.wipeOut({
                            node: msg_div_id,
                            delay: 5000,
                            duration: 500,
                        }),
                    ])
                    .play();
            }

            if (type == 'error' || type == 'only_to_log') {
                // In addition, display it on logs
                g_sitecore.notifqueue.addToLog(msg);
            }
        },

        //////////////////////////////////////////////
        // Menu items management

        changeActiveMenuItem: function (menu_label) {
            // Restore current active menu label to its original position
            var nav_button;

            svelte.stores.menuStates.setActivePageName(menu_label);

            // Menu items equivalents ...
            menu_label_mappings = {
                preferences: 'welcome',
                playernotif: 'welcome',
                welcomestudio: 'welcome',
                start: 'welcome',
                legal: 'welcome',
                message: 'welcome',
                gameinprogress: 'welcome',
                table: 'lobby',
                lobby: 'gamelobby',
                meetinglobby: 'gamelobby',
                availableplayers: 'gamelobby',
                createtable: 'gamelobby',
                newtable: 'gamelobby',
                gamereview: 'gamelobby',
                gamelobby: 'gamelobby',
                gamelobbyauto: 'gamelobby',
                tournament: 'gamelobby',
                newtournament: 'gamelobby',
                tournamentlist: 'gamelobby',
                gamepanel: 'gamelist',
                games: 'gamelist',
                player: 'community',
                playerstat: 'community',
                group: 'community',
                newgroup: 'community',
                community: 'community',
                report: 'community',
                newreport: 'community',
                moderated: 'community',
                translation: 'community',
                translationhq: 'community',
                map: 'community',
                grouplist: 'community',
                contribute: 'community',
                sponsorship: 'community',
                moderator: 'community',
                bug: 'community',
                bugs: 'community',
                faq: 'community',
                gamepublishers: 'community',
                team: 'community',
                troubleshootmainsite: 'community',
                sandbox: 'community',
                penalty: 'community',
                karmalimit: 'community',
                club: 'premium',
                premium: 'premium',
                contact: 'community',
                reviewer: 'community',
                giftcodes: 'premium',
                shop: 'shop',
                shopsupport: 'shopsupport',
                prestige: 'competition',
                gameranking: 'competition',
                award: 'competition',
                gamestats: 'competition',
                leaderboard: 'competition',
                page: 'doc',
                news: 'headlines',
                event: 'events',
                eventnew: 'events',
                eventmodify: 'events',
                controlpanel: 'controlpanel',
                linkmoderation: 'controlpanel',
                moderation: 'controlpanel',
                studio: 'controlpanel',
                studiogame: 'controlpanel',
                administration: 'controlpanel',
                banners: 'controlpanel',
                projects: 'projects',
                startwannaplay: 'welcome',
                startsteps: 'welcome',
                halloffame: 'halloffame',
            };
            if (menu_label_mappings[menu_label]) {
                menu_label = menu_label_mappings[menu_label];
            }

            if (this.active_menu_label != '') {
                console.log('inactivate menu item ' + this.active_menu_label);
                nav_button = $('navbutton_' + this.active_menu_label);
                if (nav_button) {
                    dojo.removeClass('navbutton_' + this.active_menu_label, 'navigation-button-active');
                }
                svelte.stores.menuStates.setActiveMenuItem(null);
            }

            // Set new active menu label to its new position
            this.active_menu_label = menu_label;
            if (menu_label != '') {
                console.log('activate menu item ' + menu_label);
                nav_button = $('navbutton_' + menu_label);
                if (nav_button) {
                    dojo.addClass('navbutton_' + menu_label, 'navigation-button-active');
                }
                svelte.stores.menuStates.setActiveMenuItem(menu_label);
            }

            return menu_label;
        },

        ///////////////////////////////////////////
        // CometD subscriptions

        subscribeCometdChannel: function (channel, notifqueue, notifqueue_event) {
            if (this.cometd_service == 'socketio') {
                if (typeof this.cometd_subscriptions[channel] == 'undefined') {
                    this.socket.emit('join', channel);

                    console.log('Listening cometd channel ' + channel);

                    this.cometd_subscriptions[channel] = 1;
                } else {
                    this.cometd_subscriptions[channel]++;

                    console.log(
                        'Listening (+1 = ' + this.cometd_subscriptions[channel] + ' ) cometd channel ' + channel
                    );
                }

                return channel;
            }
        },

        // Connect to multiple channels at the same time
        subscribeCometdChannels: function (channels, notifqueue, notifqueue_event) {
            var result = {};

            if (this.cometd_service == 'socketio') {
                var to_join = [];

                for (var i in channels) {
                    var channel = channels[i];

                    if (typeof this.cometd_subscriptions[channel] == 'undefined') {
                        to_join.push(channel);
                        console.log('Listening cometd channel ' + channel);

                        this.cometd_subscriptions[channel] = 1;
                    } else {
                        this.cometd_subscriptions[channel]++;

                        console.log(
                            'Listening (+1 = ' + this.cometd_subscriptions[channel] + ' ) cometd channel ' + channel
                        );
                    }
                }

                if (to_join.length > 0) {
                    this.socket.emit('join', to_join);
                }

                result = channels;
            }

            return result;
        },

        unsubscribeCometdChannel: function (id) {
            if (typeof this.cometd_subscriptions[id] != 'undefined') {
                this.cometd_subscriptions[id]--;

                if (this.cometd_subscriptions[id] == 0) {
                    console.log('No more listening cometd channel ' + id);
                    this.socket.emit('leave', id);
                    delete this.cometd_subscriptions[id];
                } else {
                    console.log('No more listening (-1 = ' + this.cometd_subscriptions[id] + ' cometd channel ' + id);
                }
            }
        },

        // Reconnect all current subscription (trigger after a reconnection)
        reconnectAllSubscriptions: function () {
            console.log('reconnectAllSubscriptions');
            console.log(this.cometd_subscriptions);

            console.log('Reconnecting automatically to ' + id);

            var to_join = [];
            for (var id in this.cometd_subscriptions) {
                to_join.push(id);
            }

            if (to_join.length > 0) {
                this.socket.emit('join', to_join);
            }
        },

        ///////////////////////////////////////////
        // CometD connection status

        onSocketIoConnectionStatusChanged: function (status, arg) {
            console.log('onSocketIoConnectionStatusChanged: ' + status);

            if (this.page_is_unloading) {
                // During page unload, cometD connection is unstable => mask the status
                dojo.style('connect_status', 'display', 'none');
            } else {
                if (status == 'connect') {
                    dojo.style('connect_status', 'display', 'none');
                    this.cometd_is_connected = true;
                } else if (status == 'connect_error') {
                    dojo.style('connect_status', 'display', 'block');
                    this.cometd_is_connected = false;
                    $('connect_status_text').innerHTML = __('lang_mainsite', 'Disconnected from game server !');
                    console.error('Disconnected from game server : ' + arg);
                    g_sitecore.notifqueue.addToLog($('connect_status_text').innerHTML);
                } else if (status == 'connect_timeout') {
                    dojo.style('connect_status', 'display', 'block');
                    this.cometd_is_connected = false;
                    $('connect_status_text').innerHTML = __('lang_mainsite', 'Disconnected from game server !');
                    $('connect_status_text').innerHTML += ' (timeout)';
                    g_sitecore.notifqueue.addToLog($('connect_status_text').innerHTML);
                } else if (status == 'reconnect') {
                    dojo.style('connect_status', 'display', 'none');
                    this.cometd_is_connected = true;
                    g_sitecore.notifqueue.addToLog(__('lang_mainsite', 'You are connected again.'));
                    this.reconnectAllSubscriptions();
                } else if (status == 'reconnect_error') {
                    dojo.style('connect_status', 'display', 'block');
                    this.cometd_is_connected = false;
                    $('connect_status_text').innerHTML = __('lang_mainsite', 'Disconnected from game server !');
                    console.error('Disconnected from game server : ' + arg);
                    g_sitecore.notifqueue.addToLog($('connect_status_text').innerHTML);
                } else if (status == 'reconnect_failed') {
                    dojo.style('connect_status', 'display', 'block');
                    this.cometd_is_connected = false;
                    $('connect_status_text').innerHTML = __('lang_mainsite', 'Disconnected from game server !');
                    $('connect_status_text').innerHTML += ' (reconnect failed)';
                    g_sitecore.notifqueue.addToLog($('connect_status_text').innerHTML);
                }
            }
        },

        onFirstConnectedToComet: function () {
            // Empty: to be subscribed
        },

        ////////////////////////////////////////////
        // Leaving a game in progress

        leaveTable: function (table_id, callback_confirmed) {
            this.ajaxcall(
                '/table/table/quitgame.html',
                { table: table_id, neutralized: true, s: 'table_quitgame' },
                this,
                function (result) {
                    callback_confirmed();
                },
                function (is_error, error, error_no) {
                    if (is_error) {
                        // The game is in progress ! We may leave this table but with a confirmation dialog first!

                        if (error_no == 803 || error_no == 804) {
                            // FEX_user_get_penalty OR FEX_no_penalty_training_mode
                            var confirmationDlg = new ebg.popindialog();
                            confirmationDlg.create('quitConfirmContent');
                            confirmationDlg.setTitle(__('lang_mainsite', 'Quit game in progress'));

                            confirmationDlg.tableModule = this;

                            var html = '<div id="quitConfirmContent">';

                            if (error_no == 803) {
                                html += __('lang_mainsite', 'You are about to quit a game in progress.') + '<br/>';
                                html += __('lang_mainsite', 
                                    "This will cost you some <img src='theme/img/common/rank.png' class='imgtext'/> for this game, and 1 <div class='icon20 icon20_penaltyleave'></div> for your reputation.<br/><br/>"
                                );
                                html +=
                                    '<b style="color:red">' +
                                    __('lang_mainsite', 'A bad reputation may prevent you to chat or to join some games!') +
                                    '</b><br/><br/>';
                                html += `
                                    <span>${__('lang_mainsite','Before deciding to quit a game in progess, especially if your opponent is not playing, please consider the following alternatives')}:</span>
                                    <ul>
                                        <li class="list-disc ml-6"">${__('lang_mainsite','You can vote to abandon/concede the game collectively to avoid losing ELO or Karma points')}</li>
                                        <li class="list-disc ml-6"">${__('lang_mainsite','You can vote to change the game to turn-based mode to allow out-of-time players to return to the table later and continue playing')}</li>
                                        <li class="list-disc ml-6"">${__('lang_mainsite','You can choose to eject out-of-time players from the game (causing them to lose ELO and Karma)')}</li>
                                    </ul>
                                `
                                + '<br/>';
                            } else {
                                html += __('lang_mainsite', 'You are about to quit a Training game in progress.') + '<br/>';
                                html += __('lang_mainsite', 
                                    'Because this is a Training game, this will have no consequence (no penalty whatsoever).'
                                );
                            }
                            html +=
                                "<p><a class='bgabutton bgabutton_blue' id='quitgame_cancel' href='#'>" +
                                __('lang_mainsite', 'Cancel') +
                                "</a>&nbsp;&nbsp;&nbsp;<a class='bgabutton bgabutton_gray' id='quitgame_confirm' href='#'>" +
                                __('lang_mainsite', 'Leave game') +
                                '</a></p>';
                            html += '</div>';

                            confirmationDlg.setContent(html);
                            confirmationDlg.show();

                            dojo.connect(
                                $('quitgame_cancel'),
                                'onclick',
                                dojo.hitch(confirmationDlg, function (evt) {
                                    evt.preventDefault();
                                    this.destroy();
                                })
                            );

                            dojo.connect(
                                $('quitgame_confirm'),
                                'onclick',
                                dojo.hitch(confirmationDlg, function (evt) {
                                    evt.preventDefault();
                                    this.destroy();

                                    this.tableModule.ajaxcall(
                                        '/table/table/quitgame.html',
                                        { table: table_id, s: 'table_quitdlg' },
                                        this,
                                        function (result) {
                                            callback_confirmed();
                                        }
                                    );
                                })
                            );
                        }
                    }
                }
            );
        },

        ////////////////////////////////////////////
        // Logs

        onSeeMoreLogs: function (evt) {
            console.log('onSeeMoreLogs');
            evt.preventDefault();
            var cur_height = toint(dojo.style($('logs'), 'maxHeight'));
            console.log(cur_height);
            var new_height = cur_height + 600;
            dojo.style($('logs'), 'maxHeight', new_height + 'px');
            dojo.style($('seemorelogs'), 'top', new_height - 24 + 'px');

            // This can change content height
            this.onIncreaseContentHeight(600);
        },

        // To be override ...
        onIncreaseContentHeight: function () {},

        /////// Error management

        onScriptError: function (msg, url, linenumber) {
            console.log('onScriptError');

            if (this.page_is_unloading) {
                // Don't report errors during page unloading
                return;
            }

            // In anycase, report these errors in the console
            console.error(msg);
            console.error('url=' + url);
            console.error('line=' + linenumber);

            if (typeof this.setLoader == 'function') {
                // If there is a loading screen, disable it so we can access the game anyway
                // (make the debugging easier)
                this.setLoader(100, 100);
            }

            if (this.reportJsError === false) {
                return;
            }

            // Filter Errors /////////////////////////

            // loading script with cometd
            if (url.search('telwa/cometd?') != -1) {
                return;
            }

            // external script
            if (url.search('cloudfront.net') != -1) {
                return;
            }

            // This error can be safely ignored (https://stackoverflow.com/a/50387233/373175)
            if (msg === 'ResizeObserver loop limit exceeded') {
                return;
            }

            ///////////////////////////////////////

            var log = msg + '\nScript: ' + url + '\nUrl: ' + window.location + '\n';

            if ($('bga_release_id')) {
                log += 'BGA version ' + $('bga_release_id').innerHTML + '\n';
            }

            log += this.getScriptErrorModuleInfos() + '\n';
            log += navigator.userAgent + '\n';

            if (this.reportJsError == 'show') {
                // This is an administrator => show this error...
                var htmllog = this.nl2br(log, false);
                this.showMessage('Javascript error:<br/>' + htmllog, 'error');
            }

            // Server protection against webscripterror bombing...

            if (this.reportErrorTimeout) {
                return;
            } // We already reported an error during the last minute => don't do it again.

            this.reportErrorTimeout = true;
            setTimeout(
                dojo.hitch(this, function () {
                    this.reportErrorTimeout = false;
                }),
                60000
            );

            // Send infos to server
            this.ajaxcall('/web/scripterror', { log: log }, this, function (result) {});
        },

        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////    Chat bar management
        ///
        /// Note: chat window status:
        ///       _ expanded
        ///       _ collapsed
        ///       _ stacked (ie: screen not wide enouth to display it => stacked in the left chatbarmenu)
        ///

        initChatDockedSystem: function () {
            // Insert "stacked menu" at the bottom left

            var args = {
                id: 'stacked',
                type: 'stacked',
                title: '<div class="icon20 icon20_speak"></div>',
                titlenolink: '<span style="font-size:120%">+</span>',
                avatar: '<i class="fa fa-ellipsis-h" aria-hidden="true"></i>',
                more_logs_label: __('lang_mainsite', 'Scroll down to see new messages'),
                stop_notif_label: __('lang_mainsite', 'Notify chat messages'),
                start_chat: __('lang_mainsite', 'Accept chat'),
                block_chat: __('lang_mainsite', 'Block player'),
            };
            dojo.place(this.format_string(this.jstpl_chatwindow, args), 'chatbarstackedmenu', 'first');
            dojo.place('<div id="stackedmenu"></div>', 'chatwindowcollapsed_stacked');

            dojo.connect($('chatwindowcollapsed_stacked'), 'onclick', this, 'onToggleStackMenu');

            this.adaptChatbarDock();

            dojo.connect(
                window,
                'onresize',
                this,
                dojo.hitch(this, function (evt) {
                    this.stackOrUnstackIfNeeded();
                })
            );

            this.dockedChatInitialized = true;
        },

        // Extract from notification all informations we need to create+manage a chat window
        extractChannelInfosFromNotif: function (notif) {
            var channel = notif.channelorig;

            var bMobile = dojo.hasClass('ebd-body', 'mobile_version');

            if (channel.substr(0, 8) == '/table/t') {
                var table_id = channel.substr(8);
                var game_name = '';

                if (typeof notif.gamenameorig != 'undefined') {
                    var label = this.getGameNameDisplayed(notif.gamenameorig) + ' #' + table_id;
                    game_name = notif.gamenameorig;
                } else if (typeof notif.args.game_name_ori != 'undefined') {
                    // Note: we must FIRST look for game_name_ori cause it has better chances to be untranslated
                    var label = this.getGameNameDisplayed(notif.args.game_name_ori) + ' #' + table_id;
                    game_name = notif.args.game_name_ori;
                } else if (typeof notif.args.game_name != 'undefined') {
                    var label = this.getGameNameDisplayed(notif.args.game_name) + ' #' + table_id;
                    game_name = notif.args.game_name;
                } else {
                    var label = 'Table #' + table_id;
                }

                var is_chat =
                    notif.type == 'chat' ||
                    notif.type == 'groupchat' ||
                    notif.type == 'chatmessage' ||
                    notif.type == 'tablechat' ||
                    notif.type == 'privatechat' ||
                    notif.type == 'startWriting' ||
                    notif.type == 'stopWriting' ||
                    notif.type == 'newRTCMode';

                if (!is_chat && typeof gameui != 'undefined') {
                    // This is not a chat (this is a game log notification) and we are in the Game UI => display them on a separate window
                    return {
                        type: 'tablelog',
                        id: table_id,
                        game_name: game_name,
                        label: __('lang_mainsite', 'Game log'),
                        url: '#',
                        channel: channel,
                        window_id: 'tablelog_' + table_id,
                        subscription: true,
                        notifymethod: 'title',
                        start: 'collapsed',
                    };
                } else {
                    return {
                        type: 'table',
                        id: table_id,
                        game_name: game_name,
                        label: label,
                        url: '/table?table=' + table_id,
                        channel: channel,
                        window_id: 'table_' + table_id,
                        subscription: true,
                        start: 'collapsed',
                    };
                }
            } else if (channel.substr(0, 8) == '/group/g') {
                // Note : happened with startWriting/stopWriting
                var group_id = channel.substr(8);
                return {
                    type: 'group',
                    id: group_id,
                    group_avatar: notif.args.group_avatar,
                    group_type: notif.args.group_type,
                    label: typeof notif.args.group_name == 'undefined' ? '' : notif.args.group_name,
                    url: typeof notif.args.seemore == 'undefined' ? '' : '/' + notif.args.seemore,
                    channel: '/group/g' + group_id,
                    window_id: 'group_' + group_id,
                    start: 'collapsed',
                };
            } else if (channel.substr(0, 13) == '/chat/general') {
                // General lobby chat
                return {
                    type: 'general',
                    id: 0,
                    label: __('lang_mainsite', 'General messages'),
                    url: null,
                    channel: '/chat/general',
                    window_id: 'general',
                    start: 'collapsed',
                };
            } else if (channel.substr(0, 9) == '/player/p') {
                if (
                    notif.type == 'privatechat' ||
                    notif.type == 'startWriting' ||
                    notif.type == 'stopWriting' ||
                    notif.type == 'newRTCMode'
                ) {
                    // Private message
                    if (typeof current_player_id != 'undefined') {
                        // MS case
                        if (current_player_id == notif.args.player_id) {
                            var player_id = notif.args.target_id;
                            var player_name = notif.args.target_name;
                            var avatar = notif.args.target_avatar;
                        } else {
                            var player_id = notif.args.player_id;
                            var player_name = notif.args.player_name;
                            var avatar = notif.args.avatar;
                        }
                    } else if (this.player_id) {
                        // GS case
                        if (this.player_id == notif.args.player_id) {
                            var player_id = notif.args.target_id;
                            var player_name = notif.args.target_name;
                            var avatar = notif.args.target_avatar;
                        } else {
                            var player_id = notif.args.player_id;
                            var player_name = notif.args.player_name;
                            var avatar = notif.args.avatar;
                        }
                    } else {
                        // Should not happend
                        var player_id = notif.args.player_id;
                        var player_name = notif.args.player_name;
                        var avatar = notif.args.avatar;
                    }

                    return {
                        type: 'privatechat',
                        id: player_id,
                        label: player_name,
                        avatar: avatar,
                        url: '/player?id=' + player_id,
                        channel: '/player/p' + player_id,
                        window_id: 'privatechat_' + player_id,
                        subscription: false,
                        start: 'collapsed',
                    };
                } else if (typeof notif.gamenameorig != 'undefined' && typeof gameui != 'undefined') {
                    // This is a private game message inside a game => should be inside game log window
                    var table_id = gameui.table_id;
                    return {
                        type: 'tablelog',
                        id: table_id,
                        label: __('lang_mainsite', 'Game log'),
                        url: '#',
                        channel: '/table/t' + table_id,
                        window_id: 'tablelog_' + table_id,
                        subscription: true,
                        notifymethod: 'title',
                        start: 'collapsed',
                    };
                }
            } else if (channel.substr(0, 18) == '/general/emergency') {
                // Maintenance message
                return {
                    type: 'emergency',
                    id: 0,
                    label: __('lang_mainsite', 'Important notice'),
                    url: null,
                    channel: '/general/emergency',
                    window_id: 'emergency',
                    start: bMobile ? 'collapsed' : 'expanded', // Note : on mobile, started emergency messages with expanded view is way too violent
                };
            }

            if (notif.type == 'startWriting' || notif.type == 'stopWriting') {
                return null; // trash it (we never initiate a chatwindow with such a message anyway)
                // Note : it does not mean that all startWriting/stopWriting must be trashed : some are intercepted above by this method.
            }

            // If not recognized => place it on general message
            return {
                type: 'general',
                id: 0,
                label: __('lang_mainsite', 'General messages'),
                url: null,
                channel: '/chat/general',
                window_id: 'general',
                start: 'collapsed',
            };
        },

        // Return needed arguments to configure chat input, or null if input is not allowed on this channel
        // (or null if there is no chat)
        getChatInputArgs: function (notifinfos) {
            if (notifinfos.type == 'table') {
                var avatar = '';
                if (typeof notifinfos.game_name != 'undefined') {
                    avatar =
                        '<img src="' +
                        getMediaUrl(notifinfos.game_name, 'icon') +
                        '" alt="" class="game_icon emblem" />';
                }

                var action = '/table/table/say.html';
                var doubleaction = '';

                if (
                    typeof gameui != 'undefined' &&
                    typeof gameui.debug_from_chat != 'undefined' &&
                    gameui.debug_from_chat &&
                    typeof notifinfos.game_name != 'undefined'
                ) {
                    doubleaction = '/' + notifinfos.game_name + '/' + notifinfos.game_name + '/say.html';
                }
                if (
                    typeof gameui != 'undefined' &&
                    typeof gameui.chat_on_gs_side != 'undefined' &&
                    gameui.chat_on_gs_side &&
                    typeof notifinfos.game_name != 'undefined'
                ) {
                    // Notify also the game, so that it can be incorporated to game logs
                    doubleaction = '/' + notifinfos.game_name + '/' + notifinfos.game_name + '/say.html';
                }

                return {
                    type: 'table',
                    id: notifinfos.id,
                    action: action,
                    doubleaction: doubleaction,
                    label: __('lang_mainsite', 'Discuss at this table'),
                    param: { table: notifinfos.id },
                    channel: '/table/t' + notifinfos.id,
                    avatar: avatar,
                };
            } else if (notifinfos.type == 'tablelog') {
                // This is not a discussion but the game history
                return null;
            } else if (notifinfos.type == 'general') {
                return {
                    type: 'global',
                    id: 0,
                    action: '/chat/chat/say.html',
                    label: __('lang_mainsite', 'Discuss with everyone'),
                    param: {},
                    channel: null, // No "X is writing now" function on this channel,
                    avatar: '<i class="fa fa-comments" aria-hidden="true"></i>',
                };
            } else if (notifinfos.type == 'privatechat') {

                return {
                    type: 'player',
                    id: notifinfos.id,
                    action: '/table/table/say_private.html',
                    label: __('lang_mainsite', 'Discuss with') + ' ' + notifinfos.label,
                    param: { to: notifinfos.id },
                    channel: '/player/p' + notifinfos.id,
                    avatar: 
                        '<img src="' + getPlayerAvatar(notifinfos.id, notifinfos.avatar, 50) + '" alt="" class="emblem" />',
                };
            } else if (notifinfos.type == 'emergency') {
                return null;
            } else if (notifinfos.type == 'group') {
                var armsdir = Math.floor(notifinfos.id / 1000);
                var groupAvatarUrl = notifinfos.avatar_src ? 
                    notifinfos.avatar_src : 
                    getGroupAvatar(notifinfos.id, notifinfos.group_avatar, notifinfos.group_type, 50);
                return {
                    type: 'group',
                    id: notifinfos.id,
                    action: '/group/group/say.html',
                    label: __('lang_mainsite', 'Discuss with the group'),
                    param: { to: notifinfos.id },
                    channel: '/group/g' + notifinfos.id,
                    avatar:
                        '<img src="' +
                        groupAvatarUrl +
                        '" alt="" class="emblem" />',
                };
            }

            // Default = no chat
            return null;
        },

        onPlaceLogOnChannel: function (notif) {
            if (!this.dockedChatInitialized) {
                return false;
            }

            var notifinfos = this.extractChannelInfosFromNotif(notif);

            if (notifinfos === null) {
                // This message does not allow us to initiate a chat window (ex: startWriting) so ignore it
                return true;
            }

            var chatwindow_id = notifinfos.window_id;
            var bMobile = dojo.hasClass('ebd-body', 'mobile_version');
            var bDontDisplayItAlsoOnRightColumnLog = true;

            if (notif.args.reload_reason == 'playerQuitGame') {
                if (!(this.current_player_id in notif.args.players) && notif.args.was_expected) {
                    // Close the chat window and don't send message if:
                    // - we are no longer on the table
                    // - we were expected on the table (not fully joined)
                    this.closeChatWindow(chatwindow_id);
                    // Return true to signal that the notif is handled
                    return true;
                }
            }

            /*            if( notifinfos.type == 'general' )
            {
                // Message to all players on metasite
                if( ! bMobile )
                {
                    return false;   // Desktop => display it on general log on the right
                }

                // ... Mobiles => display it on a "General messages" on the docked system
            }*/
            if (this.notifqueue.game !== null) {
                // Game UI
                if (notifinfos.type == 'playtable' || notifinfos.type == 'table' || notifinfos.type == 'tablelog') {
                    // This is a table move (tablelog) or a table chat (table), so we can continue with the docked system
                } else if (
                    notif.type == 'privatechat' ||
                    notif.type == 'newRTCMode' ||
                    notif.type == 'startWriting' ||
                    notifinfos.type == 'emergency'
                ) {
                    // By exception, we allow private game chat + emergency message in docked window during the game, otherwise they are not received
                } else {
                    // To not disturb the current game in progress, all other messages are displayed on the right log
                    return false;
                }
            }

            var is_gamelog = this.notifqueue.game !== null;

            var is_chat =
                notif.type == 'chat' ||
                notif.type == 'groupchat' ||
                notif.type == 'chatmessage' ||
                notif.type == 'tablechat' ||
                notif.type == 'privatechat' ||
                notif.type == 'stopWriting' ||
                notif.type == 'startWriting';

            var bLeaveChat = false;
            var bPredefinedMessage = false;
            if (is_chat && typeof notif.args.text != 'undefined' && notif.args.text === null) {
                notif.log = '~ ' + __('lang_mainsite', '${player_name} left the chat') + ' ~';
                bLeaveChat = true;
                bPredefinedMessage = true;
            }

            var bDisplayPreview = true;
            if (notif.type == 'history_history' || typeof notif.loadprevious != 'undefined') {
                bDisplayPreview = false; // For performance reason, we don't display preview + preview animation for these ones

                if (typeof notif.loadprevious != 'undefined' && notif.loadprevious) {
                    // Exception: if the message is NEW (unread), we display the preview animation
                    if (is_chat && typeof notif.args.is_new != 'undefined' && notif.args.is_new == 1) {
                        bDisplayPreview = true;
                        notif.args.mread = null; // For compatibility with private message => allow to show them as new message + ACK as read mechanism
                    }
                }
            }
            if (typeof notif.donotpreview != 'undefined') {
                bDisplayPreview = false;
            }
            if (notif.type == 'chat' && notif.channelorig == '/chat/general') {
                // We must disable message preview if player asked for it
                if (typeof mainsite != 'undefined') {
                    if (mainsite.notifyOnGeneralChat == 0) {
                        bDisplayPreview = false;
                    }
                }
            }

            if (is_gamelog) {
                if (!is_chat) {
                    // This is NOT a chat at table
                    // => this is a game notification

                    // For Desktop AND mobile, display it both on the docked system AND on the right column
                    // (so we can keep the history in case we switch from mobile to desktop or the opposite)
                    bDontDisplayItAlsoOnRightColumnLog = false;
                }
            }

            // Specificity for Werewolves
            if (
                is_chat &&
                notif.type == 'chatmessage' &&
                typeof notif.args.message != 'undefined' &&
                typeof notif.gamenameorig != 'undefined' &&
                typeof notif.args.message.log == 'undefined'
            ) {
                if (notif.gamenameorig == 'werewolves' && notif.args.message.indexOf('$$$') != -1) {
                    // Very specific to Werewolves: dead players are chatting, and no one should be able to see this
                    return true;
                }
            }

            ///////////////////////////////////////////////
            // X is writing something
            if (typeof this.chatbarWindows[chatwindow_id] != 'undefined') {
                if (notif.type == 'startWriting') {
                    // This player just start writing
                    if (
                        typeof this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name] != 'undefined'
                    ) {
                        // We already have it => prolongate his name erasing timeout
                        clearTimeout(this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name]);
                    } else {
                        // A new writer!
                    }

                    this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name] = setTimeout(
                        dojo.hitch(this, function () {
                            // No more writing!
                            if (typeof this.chatbarWindows[chatwindow_id] != 'undefined') {
                                delete this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name];
                                this.onUpdateIsWritingStatus(chatwindow_id);
                            }
                        }),
                        8000
                    );

                    this.onUpdateIsWritingStatus(chatwindow_id);
                    return true;
                }
                if (is_chat && typeof notif.args.player_id != 'undefined') {
                    // This player has written something => auto-remove it from the list of "X is writing something"
                    if (
                        typeof (
                            this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name] != 'undefined'
                        )
                    ) {
                        clearTimeout(this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name]);

                        delete this.chatbarWindows[chatwindow_id].is_writing_now[notif.args.player_name];
                        this.onUpdateIsWritingStatus(chatwindow_id);
                    }
                }
            } else if (notif.type == 'startWriting' || notif.type == 'stopWriting') {
                // Note : we receive a "X starts to write something", but the window is still NOT open, and we don't open it for many reasons :
                //   _ if finally no message is sent, this is better not display an empty window
                //   _ for certain chat window, we need a lot of infos to initiliaze the chat window, and these infos are not carried in a simple "startWriting" message
                //   _ we dont want to display a chatwindow to handle a "stopWriting" message

                return true; // => so we ignore it!
            }

            var log_id = this.next_log_id;
            this.next_log_id++;

            var bSubscribe = false;
            if (typeof notifinfos.subscription != 'undefined' && notifinfos.subscription && notifinfos.subscription) {
                bSubscribe = true;
            }

            if (typeof this.chatbarWindows[notifinfos.window_id] == 'undefined') {
                if (bLeaveChat) {
                    // This is a "leave chat" message: this message is not important enought to create a new window, so dismiss the message
                    return true; // => ignore it
                }
            }

            // Does this window already exists?
            var bCreated = this.createChatBarWindow(notifinfos, bSubscribe);

            if (notif.type == 'newRTCMode' && typeof notif.args.table_id != 'undefined') {
                if (notif.args.rtc_mode > 0 && this.room !== null && this.room.indexOf('P') >= 0) {
                    var html = '<div  class="rtc_dialog">' + '<br />';
                    html +=
                        '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                        (this.mediaConstraints.video !== false
                            ? __('lang_mainsite', 'A Premium user has set up a video chat session for this table!')
                            : __('lang_mainsite', 'A Premium user has set up an audio chat session for this table!')) +
                        '</i></div>' +
                        '<br /><br />';
                    html +=
                        '<div style="text-align: center; font-weight: bold;">' +
                        __('lang_mainsite', 'But you are already taking part in another live chat session!') +
                        '<br /><br /> ' +
                        __('lang_mainsite', 'Do you want to join the call?') +
                        ' (' +
                        __('lang_mainsite', 'you will be disconnected from your current live chat session to join the new one') +
                        ')</div><br /><br />';
                    html += '</div>';

                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            var rtc_players = this.room.substr(1).split('_');
                            var other_player_id = rtc_players[0] == current_player_id ? rtc_players[1] : rtc_players[0];

                            if (this.mediaConstraints.video) {
                                this.ajaxcall(
                                    '/table/table/startStopVideo.html',
                                    { target_table: null, target_player: other_player_id },
                                    this,
                                    dojo.hitch(this, function (result) {
                                        this.already_accepted_room = 'T' + notif.args.table_id;
                                        this.setNewRTCMode(
                                            notif.args.table_id,
                                            null,
                                            notif.args.rtc_mode,
                                            notif.args.room_creator
                                        );
                                    })
                                );
                            } else if (this.mediaConstraints.audio) {
                                this.ajaxcall(
                                    '/table/table/startStopAudio.html',
                                    { target_table: null, target_player: other_player_id },
                                    this,
                                    dojo.hitch(this, function (result) {
                                        this.already_accepted_room = 'T' + notif.args.table_id;
                                        this.setNewRTCMode(
                                            notif.args.table_id,
                                            null,
                                            notif.args.rtc_mode,
                                            notif.args.room_creator
                                        );
                                    })
                                );
                            }
                        }),
                        dojo.hitch(this, function () {
                            // Nothing!
                        })
                    );
                } else if (this.room === null || this.room.indexOf('T') >= 0) {
                    this.setNewRTCMode(notif.args.table_id, null, notif.args.rtc_mode, notif.args.room_creator);
                }
            }

            if (notif.type == 'newRTCMode' && typeof notif.args.player_id != 'undefined') {
                if (notif.args.rtc_mode > 0 && this.room !== null && this.room.indexOf('T') >= 0) {
                    var html = '<div  class="rtc_dialog">' + '<br />';
                    html +=
                        '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                        (this.mediaConstraints.video !== false
                            ? __('lang_mainsite', 'A Premium user has set up a video chat session with you!')
                            : __('lang_mainsite', 'A Premium user has set up an audio chat session with you!')) +
                        '</i></div>' +
                        '<br /><br />';
                    html +=
                        '<div style="text-align: center; font-weight: bold;">' +
                        __('lang_mainsite', 'But you are already taking part in another live chat session!') +
                        '<br /><br /> ' +
                        __('lang_mainsite', 'Do you want to join the call?') +
                        ' (' +
                        __('lang_mainsite', 'you will be disconnected from your current live chat session to join the new one') +
                        ')</div><br /><br />';
                    html += '</div>';

                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            var table_id = this.room.substr(1);

                            this.doLeaveRoom(
                                dojo.hitch(this, function () {
                                    this.already_accepted_room =
                                        'P' +
                                        Math.min(notif.args.player_id, notif.args.target_id) +
                                        '_' +
                                        Math.max(notif.args.player_id, notif.args.target_id);

                                    // Expand chat window
                                    this.expandChatWindow(notifinfos.window_id);

                                    this.setNewRTCMode(
                                        null,
                                        notif.args.target_id,
                                        notif.args.rtc_mode,
                                        notif.args.room_creator
                                    );
                                })
                            );
                        }),
                        dojo.hitch(this, function () {
                            // Clear private chat a/v session as it has been refused on one side
                            if (this.mediaConstraints.video) {
                                this.ajaxcall(
                                    '/table/table/startStopVideo.html',
                                    { target_table: null, target_player: notif.args.target_id },
                                    this,
                                    function (result) {
                                        this.mediaChatRating = false;
                                    }
                                );
                            } else if (this.mediaConstraints.audio) {
                                this.ajaxcall(
                                    '/table/table/startStopAudio.html',
                                    { target_table: null, target_player: notif.args.target_id },
                                    this,
                                    function (result) {
                                        this.mediaChatRating = false;
                                    }
                                );
                            }
                        })
                    );
                } else if (this.room === null || this.room.indexOf('P') >= 0) {
                    // Expand chat window
                    this.expandChatWindow(notifinfos.window_id);

                    this.setNewRTCMode(null, notif.args.target_id, notif.args.rtc_mode, notif.args.room_creator);
                }
            }

            // Post-window creation: default messages
            if (bCreated) {
                if (
                    notif.type == 'groupchat' &&
                    typeof notif.args.gamesession != 'undefined' &&
                    notif.args.gamesessionadmin != this.getCurrentPlayerId()
                ) {
                    // New gaming session chat
                    var msg = dojo.clone(notif);
                    // msg.log = dojo.string.substitute( __('lang_mainsite', ''), {} );
                    msg.log =
                        '<p style="text-align:center"><a id="quit_playingsession_' +
                        notif.args.group_id +
                        '" href="#" class="bgabutton bgabutton_gray">' +
                        __('lang_mainsite', 'Quit this playing session') +
                        '</a></p>';
                    msg.donotpreview = true;
                    this.onPlaceLogOnChannel(msg);
                    dojo.connect(
                        $('quit_playingsession_' + notif.args.group_id),
                        'onclick',
                        this,
                        dojo.hitch(this, function (evt) {
                            dojo.stopEvent(evt);
                            var group_id = evt.currentTarget.id.substr(20);
                            this.ajaxcall(
                                '/community/community/quitGroup.html',
                                { id: group_id },
                                this,
                                function () {},
                                function (isError) {}
                            );

                            this.closeChatWindow('group_' + group_id);
                        })
                    );
                }
            }

            var logaction = notif.args.logaction;

            // Now we are 100% sure the chat window exists
            // => place log on channel

            if (
                is_chat &&
                typeof notif.args.text != 'undefined' &&
                typeof this.predefinedTextMessages_untranslated[notif.args.text] != 'undefined'
            ) {
                // This is a pre-defined message
                // => a translation exists for it
                notif.args.text = __('lang_mainsite', notif.args.text);
                bPredefinedMessage = true;
            }

            if (is_chat) {
                var bOnlyBgaLinks = false;
                if (notif.channelorig == '/chat/general') {
                    // On chat general: only internal links
                    bOnlyBgaLinks = true;
                }

                if (is_chat && typeof notif.args.text != 'undefined' && notif.args.text != null) {
                    // Check if there are some links, and if any make them clickables
                    notif.args.text = this.makeClickableLinks(notif.args.text, bOnlyBgaLinks);
                } else if (
                    is_chat &&
                    typeof notif.args.message != 'undefined' &&
                    typeof notif.args.message.log == 'undefined'
                ) {
                    // Unless undefined message or sublog (recursive) message
                    // Check if there are some links, and if any make them clickables
                    // Note: notif.args.message is DEPRECATED
                    notif.args.message = this.makeClickableLinks(notif.args.message, bOnlyBgaLinks);
                }
            }

            var html = this.notifqueue.formatLog(notif.log, notif.args);
            var actionhtml = '';
            var actionhtmlp = '';

            if (this.notifqueue.game == null) {
                if (logaction) {
                    var actionhtmlinner = this.notifqueue.formatLog(logaction.log, logaction.args);
                    actionhtml =
                        '<div class="logaction"><a href="#" id="logaction_' +
                        log_id +
                        '">[' +
                        actionhtmlinner +
                        ']</a></div>';
                    actionhtmlp =
                        '<div class="logaction"><a href="#" id="logactionp_' +
                        log_id +
                        '">[' +
                        actionhtmlinner +
                        ']</a></div>';
                }
            } else if (!is_chat) {
                html = this.notifqueue.game.applyGenderRegexps( html );
            }

            if (is_chat && typeof notif.args.text != 'undefined') {
                if (this.isBadWorkInChat(notif.args.text)) {
                    actionhtml +=
                        '<div  class="logaction">' +
                        __('lang_mainsite', 'Insult? Aggressive attitude? Please do not respond or you will be moderated too.') +
                        ' ' +
                        __('lang_mainsite', 'Block this player (thumb down) and report him/her to moderators.') +
                        '</div>';
                }
            }

            var output = '';

            // Timestamping message management
            // => we add a timestamp if posted in a different minute
            var lastMsgTime = this.chatbarWindows[chatwindow_id].lastMsgTime;
            var thisMsgTime = notif.time;
            var time_to_display = '';

            var this_msg_date = new Date(thisMsgTime * 1000);
            time_to_display = this_msg_date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            var last_msg_date = new Date(lastMsgTime * 1000);

            var time_since_last_msg = thisMsgTime - lastMsgTime;

            if (Math.floor(lastMsgTime / 60) != Math.floor(thisMsgTime / 60)) {
                // We are not on the same minute => must place a timestamp here

                if (last_msg_date.toLocaleDateString() != this_msg_date.toLocaleDateString()) {
                    // We are even NOT on the same DAY => we must display the date in a separate "timestamp" div here
                    var display = this_msg_date.toLocaleDateString();
                    output += '<div class="timestamp">' + display + '</div>';
                } else {
                    // The day is the same => just display the time
                }

                this.chatbarWindows[chatwindow_id].lastMsgTime = thisMsgTime;
            }

            var additional_class = '';
            var bOwnChatLog = false;
            var bSameAsPreviousAuthor = false;
            var id_of_newmsg = '';

            if (is_chat) {
                additional_class += ' chatlog';

                var current_player_id =
                    typeof this.current_player_id != 'undefined' ? this.current_player_id : this.player_id;
                if (typeof notif.args.player_id != 'undefined' && notif.args.player_id == current_player_id) {
                    additional_class += ' ownchatlog';
                    bOwnChatLog = true;
                }

                if (
                    typeof this.chatbarWindows[chatwindow_id].lastMsgAuthor != 'undefined' &&
                    this.chatbarWindows[chatwindow_id].lastMsgAuthor == notif.args.player_id
                ) {
                    if (time_since_last_msg < 60) {
                        // Less than 60 sec since the last message + same author => we are going to group these posts
                        bSameAsPreviousAuthor = true;
                        additional_class += ' sameauthor';
                    }
                }
                this.chatbarWindows[chatwindow_id].lastMsgAuthor = notif.args.player_id;

                if (typeof notif.args.mread != 'undefined' && !bOwnChatLog) {
                    if (notif.args.mread) {
                        // Note: not a new message
                    } else {
                        // New message for me!
                        additional_class += ' newmessage';

                        if (typeof notif.args.id != 'undefined') {
                            // We have an id for this message => will be needed to ACK it later
                            id_of_newmsg = ' id="newmessage_' + chatwindow_id.substr(0, 1) + '_' + notif.args.id + '"';
                        }
                    }
                }

                if (bLeaveChat) {
                    additional_class += ' leavechat';
                }
                else if (bPredefinedMessage) {
                    additional_class += ' predefinedchat';
                }
            }

            output +=
                '<div class="roundedbox log bga-link-inside' +
                additional_class +
                '" id="dockedlog_' +
                log_id +
                '">' +
                '<div class="roundedboxinner"' +
                id_of_newmsg +
                '>';

            var original_html = html;
            if (is_chat) {
                html = this.addSmileyToText(html).replace(/(?:\r\n|\r|\n)/g, '<br>');
            }

            var html_without_time = html;
            if (time_to_display != '') {
                var space = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
                var read_mark = '';

                // "read" mark
                if (notif.type == 'privatechat' && typeof notif.args.mread != 'undefined' && bOwnChatLog) {
                    if (notif.args.mread) {
                        // Message has been read
                        read_mark = '<i class="fa fa-check message_read" aria-hidden="true"></i>';
                        space += '&nbsp;&nbsp;';
                    } else {
                        // Message has not been read
                        read_mark =
                            '<i class="fa fa-check message_unread" id="privmsg_read_' +
                            notif.args.id +
                            '" aria-hidden="true"></i>';
                        space += '&nbsp;&nbsp;';
                    }
                }

                if (!is_chat) {
                    space += '&nbsp;&nbsp;'; // It appears that non-chat logs (ex: game logs) needs more space
                }

                html += space + '<div class="msgtime">' + time_to_display + ' ' + read_mark + '</div>';
            }

            output += html + actionhtml;

            if (is_chat && !bOwnChatLog && !bPredefinedMessage) {
                // Setup Google Translate icon
                output +=
                    '<div class="translate_icon ' +
                    '" id="logtr_' +
                    chatwindow_id +
                    '_' +
                    log_id +
                    '" title="' +
                    __('lang_mainsite', 'Translate with Google') +
                    '"></div>';
            }
            if (is_chat && bPredefinedMessage && !bLeaveChat) {
                // Setup predefined chat icon
                output +=
                    '<div class="predefinedchat_icon ' +
                    '" title="' +
                    __('lang_mainsite', 'Predefined message translated in each player\'s language') +
                    '"></div>';
            }

            output += '</div></div>';

            var scroll_zone_height = dojo.style('chatwindowlogs_zone_' + chatwindow_id, 'height');
            var bScrollAlreadyAtBottom =
                $('chatwindowlogs_zone_' + chatwindow_id).scrollTop + scroll_zone_height >=
                $('chatwindowlogs_zone_' + chatwindow_id).scrollHeight - 10;

            if (typeof notif.loadprevious == 'undefined' || !$('load_previous_message_wrap_' + chatwindow_id)) {
                // General case
                dojo.place(output, 'chatwindowlogs_endzone_' + chatwindow_id, 'before');
            } else {
                // Load history => put log at the top
                dojo.place(output, 'load_previous_message_wrap_' + chatwindow_id, 'before');
            }

            this.addTooltipToClass('message_read', __('lang_mainsite', 'This message has been read'), '');
            this.addTooltipToClass('message_unread', __('lang_mainsite', 'This message has not been read yet'), '');

            if (this.notifqueue.game == null) {
                if (logaction) {
                    if ($('logaction_' + log_id)) {
                        dojo.connect($('logaction_' + log_id), 'onclick', this, function (evt) {
                            dojo.stopEvent(evt);
                            if (logaction.action_analytics) analyticsPush(logaction.action_analytics);
                            mainsite.ajaxcall(logaction.action, logaction.action_arg, this, function () {});
                        });
                    }
                }
            } else {
                if (is_chat && typeof notif.args.player_id != 'undefined') {
                    if ($('ban_spectator_' + notif.args.player_id)) {
                        dojo.style('ban_spectator_' + notif.args.player_id, 'display', 'inline');
                    }
                }
            }

            // Scroll to bottom if needed

            if (typeof notif.loadprevious == 'undefined') {
                if (bScrollAlreadyAtBottom) {
                    // Scroll was at bottom => it should stay at bottom
                    $('chatwindowlogs_zone_' + chatwindow_id).scrollTop = $(
                        'chatwindowlogs_zone_' + chatwindow_id
                    ).scrollHeight;
                } else {
                    // Display a message "scroll down to see new messages" at the top of the zone
                    dojo.style('chatwindowmorelogs_' + chatwindow_id, 'display', 'block');
                }
            }

            // Setup translate event
            if (is_chat && $('logtr_' + chatwindow_id + '_' + log_id)) {
                dojo.connect($('logtr_' + chatwindow_id + '_' + log_id), 'onclick', this.notifqueue, 'onTranslateLog');
            }

            var node_id = 'dockedlog_' + log_id;

            if (typeof notif.loadprevious == 'undefined') {
                dojo.style(node_id, 'display', 'none');

                dojo.fx
                    .chain([
                        dojo.fx.wipeIn({
                            node: node_id,
                            onAnimate: function (node) {
                                if (bScrollAlreadyAtBottom) {
                                    // Scroll was at bottom => it should stay at bottom
                                    $('chatwindowlogs_zone_' + chatwindow_id).scrollTop = $(
                                        'chatwindowlogs_zone_' + chatwindow_id
                                    ).scrollHeight;
                                }
                            },
                            onEnd: function (node) {
                                if (bScrollAlreadyAtBottom) {
                                    // Scroll was at bottom => it should stay at bottom
                                    $('chatwindowlogs_zone_' + chatwindow_id).scrollTop = $(
                                        'chatwindowlogs_zone_' + chatwindow_id
                                    ).scrollHeight;
                                }
                            },
                        }),

                        dojo.animateProperty({
                            node: node_id,
                            delay: 5000,
                            properties: {
                                color: { end: '#000000' },
                                onEnd: function (node) {
                                    dojo.style(node, 'display', 'block');
                                },
                            },
                        }),
                    ])
                    .play();
            } else {
                if ($(node_id)) {
                    dojo.style(node_id, 'color', '#000000');
                }
            }

            if (this.chatbarWindows[chatwindow_id].notifymethod == 'title') {
                // Change the title of the chat window to signal the change
                // Note: we cannot display any formatted HTML here EXCEPT the colored players names which are wrapped in <!--PNS--> / <!--PNE-->

                var parts = html_without_time.split('<!--');
                var result = '';
                var bFirst = true;
                for (var i in parts) {
                    var part = parts[i];

                    if (part.substr(0, 6) == 'PNS-->') {
                        // This is a player name => keeps it intact
                        if (bFirst) {
                            result += part;
                        } else {
                            result += '<!--' + part;
                        }
                    } else {
                        // Strip tags
                        if (!bFirst) {
                            part = '<!--' + part;
                        }

                        result += dojox.dtl.filter.htmlstrings.striptags(part);
                    }

                    if (bFirst) {
                        bFirst = false;
                    }
                }

                $('chatwindowtitlenolink_' + chatwindow_id).innerHTML = result;
            }

            // If collapsed, special animation
            var chatwindow_status = this.chatbarWindows[chatwindow_id].status;
            if (bDisplayPreview && (chatwindow_status == 'collapsed' || chatwindow_status == 'stacked')) {
                if (chatwindow_status == 'collapsed') {
                    if (chatwindow_id == 'general') {
                        // Do not display messages count on general chat / general message (useless and anoying as these messages are popped already)
                    } else if (
                        this.chatbarWindows[chatwindow_id].notifymethod == 'normal' ||
                        (bMobile && notif.type == 'tablechat')
                    ) {
                        // Note : for mobile, chatmessage which a notifymethod='title' are invisible if we do not update newmsgcount
                        // Signal on collapsed status bar
                        dojo.addClass('chatwindow_' + chatwindow_id, 'newmessage');
                        var current = $('chatwindownewmsgcount_' + chatwindow_id).innerHTML;
                        if (current == '') {
                            $('chatwindownewmsgcount_' + chatwindow_id).innerHTML = 1;
                            $('chatMindownewmsgcount_' + chatwindow_id).innerHTML = 1;
                        } else if (toint(current) <= 8) {
                            $('chatwindownewmsgcount_' + chatwindow_id).innerHTML = toint(current) + 1;
                            $('chatMindownewmsgcount_' + chatwindow_id).innerHTML = toint(current) + 1;
                        } else {
                            $('chatwindownewmsgcount_' + chatwindow_id).innerHTML = '9+';
                            $('chatMindownewmsgcount_' + chatwindow_id).innerHTML = '9+';
                        }
                    }

                    if (!bMobile) {
                        // Preview chat message
                        // Note: we insert an extra <div> to make it coherent with all the other log (otherwize things like Jaipur log removal system may be broken)
                        dojo.place(
                            '<div><div id="logprev_' +
                                log_id +
                                '" class="chatwindowpreviewmsg bga-link-inside">' +
                                html_without_time +
                                actionhtmlp +
                                '</div></div>',
                            'chatwindowpreview_' + chatwindow_id
                        );

                        // In case there is more than 5 preview messages, we immediately remove the oldest ones
                        var all_previews = dojo.query('#chatwindowpreview_' + chatwindow_id + ' .chatwindowpreviewmsg');
                        if (all_previews.length > 5) {
                            var nbr = all_previews.length;
                            for (var i in all_previews) {
                                if (nbr <= 5) {
                                    break;
                                }

                                dojo.destroy(all_previews[i]);

                                nbr--;
                            }
                        }
                    }
                } else if (chatwindow_status == 'stacked') {
                    if (!bMobile) {
                        // Preview chat message on stackmenu preview
                        dojo.place(
                            '<div id="logprev_' +
                                log_id +
                                '" class="chatwindowpreviewmsg bga-link-inside">' +
                                html +
                                actionhtmlp +
                                '</div>',
                            'chatwindowpreview_stacked'
                        );
                    }
                }

                if (!bMobile) {
                    var node_id = 'logprev_' + log_id;
                    dojo.style(node_id, 'display', 'none');

                    dojo.fx.wipeIn({ node: node_id }).play();

                    this.fadeOutAndDestroy(node_id, 500, 5000);
                }

                if (this.notifqueue.game == null) {
                    if (logaction) {
                        if ($('logactionp_' + log_id)) {
                            dojo.connect($('logactionp_' + log_id), 'onclick', this, function (evt) {
                                dojo.stopEvent(evt);
                                if (logaction.action_analytics) analyticsPush(logaction.action_analytics);
                                mainsite.ajaxcall(logaction.action, logaction.action_arg, this, function () {});
                            });
                        }
                    }
                }
            }

            // DEPRECATED: we not more ACK messages when they are "visible": we ACK messages when there is an interaction with the chat window.
            //            if( typeof notif.loadprevious == 'undefined'  )
            //            {
            //                if( notif.type == 'privatechat'  )
            //                {
            //                    var bMustAck = false;
            //                    if( this.notifqueue.game==null && notif.args.target_id == current_player_id  )
            //                    {
            //                        bMustAck = true;
            //                    }
            //                    else if( notif.args.target_id == this.player_id )
            //                    {
            //                        bMustAck = true;
            //                    }
            //
            //                    if( bMustAck )
            //                    {
            //                        if( this.window_visibility == 'visible' )
            //                        {
            //                            // Must ACK the notif
            //                            this.ajaxcall( '/table/table/chatack.html', {  id:notif.args.id  }, this, function( result ) {}, function( is_error) {}, 'get'  );
            //                        }
            //                        else
            //                        {
            //                            // Must ACK when visible
            //                            this.msg_to_ack_when_visible.push( notif.args.id );
            //                        }
            //                    }
            //                }
            //            }

            if (['privatechat','tablechat','groupchat'].includes(notif.type)) {
                // Note: chat with "load previous message" capabilities
                if (typeof this.chatbarWindows[chatwindow_id].first_msg_timestamp == 'undefined') {
                    this.chatbarWindows[chatwindow_id].first_msg_timestamp = toint(notif.time);
                } else {
                    this.chatbarWindows[chatwindow_id].first_msg_timestamp = Math.min(
                        notif.time,
                        this.chatbarWindows[chatwindow_id].first_msg_timestamp
                    );
                }
            }

            if (bLeaveChat) {
                if (notif.args.type == 'leavelast') {
                    $('chatbarinput_' + chatwindow_id + '_input').disabled = true;
                    $('chatbarinput_' + chatwindow_id + '_input').placeholder = __(
                        'lang_mainsite',
                        'There is no one left in this chat'
                    );
                    // TODO
                    //                    alert('TODO: add another message to signal that the player is alone in this chat');
                }
            }

            return bDontDisplayItAlsoOnRightColumnLog;
        },

        onUpdateIsWritingStatus: function (chatwindow_id) {
            var count = 0;
            var list = '';
            for (var playername in this.chatbarWindows[chatwindow_id].is_writing_now) {
                if (playername != this.current_player_name) {
                    if (list == '') {
                        list = playername;
                    } else {
                        list += ', ' + playername;
                    }

                    count++;
                }
            }

            if (count == 0) {
                // Restore normal title
                dojo.style('chatwindowtitlenolink_' + chatwindow_id, 'display', 'inline');
                dojo.style('is_writing_now_' + chatwindow_id, 'display', 'none');

                dojo.style('chatwindowlogstitle_content_' + chatwindow_id, 'display', 'inline');
                dojo.style('is_writing_now_title_' + chatwindow_id, 'display', 'none');
            } else {
                $('is_writing_now_expl_' + chatwindow_id).innerHTML = dojo.string.substitute(
                    __('lang_mainsite', '${player} is writing something ...'),
                    { player: list }
                );
                $('is_writing_now_expl_title_' + chatwindow_id).innerHTML = dojo.string.substitute(
                    __('lang_mainsite', '${player} is writing something ...'),
                    { player: list }
                );
                dojo.style('chatwindowtitlenolink_' + chatwindow_id, 'display', 'none');
                dojo.style('is_writing_now_' + chatwindow_id, 'display', 'inline');

                dojo.style('chatwindowlogstitle_content_' + chatwindow_id, 'display', 'none');
                dojo.style('is_writing_now_title_' + chatwindow_id, 'display', 'inline');
            }
        },

        createChatBarWindow: function (notifinfos, bSubscribeChannel) {
            if (!this.dockedChatInitialized) {
                return false;
            }

            var bMobile = dojo.hasClass('ebd-body', 'mobile_version');

            var chatwindow_id = notifinfos.window_id;
            var title = notifinfos.label;

            if (typeof this.chatbarWindows[chatwindow_id] != 'undefined') {
                // Already exists
                if (this.chatbarWindows[chatwindow_id].status == 'collapsed') {
                    // nothing to do
                    return false;
                } else if (this.chatbarWindows[chatwindow_id].status == 'expanded') {
                    // nothing to do
                    return false;
                } else if (this.chatbarWindows[chatwindow_id].status == 'stacked') {
                    // nothing to do (notif should be placed in stackmenu preview)
                    return false;
                }
            }

            // Okay, create a new one
            this.stackChatWindowsIfNeeded(notifinfos.start);

            if (notifinfos.url !== null) {
                title =
                    '<a href="' +
                    notifinfos.url +
                    '" class="chatwindowtitlelink no-underline" id="chatwindowtitlelink_' +
                    chatwindow_id +
                    '"">' +
                    title +
                    '</a>';
            }

            var notifymethod = 'normal';
            if (typeof notifinfos.notifymethod != 'undefined') {
                notifymethod = notifinfos.notifymethod;
            }

            var autoShowOnKeyPress = false;
            if (typeof notifinfos.autoShowOnKeyPress != 'undefined') {
                autoShowOnKeyPress = notifinfos.autoShowOnKeyPress;
            }

            this.chatbarWindows[chatwindow_id] = {
                status: notifinfos.start,
                title: title,
                input: new ebg.chatinput(),
                subscription: null,
                notifymethod: notifymethod,
                autoShowOnKeyPress: autoShowOnKeyPress,
                lastMsgTime: 0,
                lastMsgAuthor: 0,
                is_writing_now: {},
            };

            this.chatbarWindows[chatwindow_id].input.callbackBeforeChat = dojo.hitch(this, 'onCallbackBeforeChat');
            this.chatbarWindows[chatwindow_id].input.callbackAfterChat = dojo.hitch(this, 'onCallbackAfterChat');
            this.chatbarWindows[chatwindow_id].input.callbackAfterChatError = dojo.hitch(
                this,
                'callbackAfterChatError'
            );

            this.adaptChatbarDock();

            // Detach button
            var inputargs = this.getChatInputArgs(notifinfos);

            var parts = chatwindow_id.split('_');
            var chatwindowtype = parts[0];

            // Mobile chat avatar
            if (inputargs == null || typeof inputargs.avatar == 'undefined' || inputargs.avatar == '') {
                var avatar = '<i class="fa fa-comment" aria-hidden="true"></i>';

                if (inputargs === null) {
                    // Some specific default avatars
                    if (notifinfos.type == 'tablelog') {
                        // Chat log history
                        var avatar = '<i class="fa fa-history" aria-hidden="true"></i>';
                    }
                }
            } // Default
            else {
                var avatar = inputargs.avatar;
            }

            // Particular cases :
            if (typeof gameui != 'undefined' && notifinfos.type == 'table' && notifinfos.id == gameui.table_id) {
                // Chat during current game => display "comment" icon instead
                var avatar = '<i class="fa fa-comment" aria-hidden="true"></i>';
            }
            if (notifinfos.type == 'emergency') {
                var avatar =
                    '<img src="' + getStaticAssetUrl('img/logo/logo.png') + '" alt="" class="bga_logo emblem" />';
            }

            // Now, the dock is at the right size, so we can add our chat window on the left of the dock
            var args = {
                id: chatwindow_id,
                title: title,
                type: chatwindowtype,
                titlenolink: notifinfos.label,
                more_logs_label: __('lang_mainsite', 'Scroll down to see new messages'),
                stop_notif_label: __('lang_mainsite', 'Notify chat messages'),
                avatar: avatar,
                start_chat: __('lang_mainsite', 'Accept chat'),
                block_chat: __('lang_mainsite', 'Block player'),
            };
            dojo.place(this.format_string(this.jstpl_chatwindow, args), 'chatbardock', 'first');

            dojo.addClass('chatwindow_' + chatwindow_id, notifinfos.start);

            if (notifinfos.start == 'expanded') {
                // Expanded for start
                dojo.style('chatwindowexpanded_' + chatwindow_id, 'display', 'block');
                if (!bMobile) {
                    dojo.style('chatwindowcollapsed_' + chatwindow_id, 'display', 'none');
                }
                dojo.style('chatwindowpreview_' + chatwindow_id, 'display', 'none');

                if (bMobile) {
                    this.makeSureChatBarIsOnTop(chatwindow_id);
                }
            }

            if ($('chatbarinput_stopnotif_general')) {
                this.addTooltip(
                    'chatbarinput_stopnotif_general',
                    '',
                    __('lang_mainsite', 
                        "Uncheck this box if you don't want to be notified when there is a new message in the global chat."
                    )
                );

                dojo.connect($('chatbarinput_stopnotif_box_general'), 'onclick', this, 'onChangeStopNotifGeneralBox');
                dojo.connect(
                    $('chatbarinput_stopnotif_label_general'),
                    'onclick',
                    this,
                    'onChangeStopNotifGeneralLabel'
                );

                if (typeof mainsite != 'undefined') {
                    if (mainsite.notifyOnGeneralChat == 0 || mainsite.bUnderage) {
                        bDisplayPreview = false;
                        $('chatbarinput_stopnotif_box_general').checked = '';
                    }
                }
            }

            dojo.connect( $('startchat_accept_'+chatwindow_id), 'onclick', this, 'onStartChatAccept' );
            dojo.connect( $('startchat_block_'+chatwindow_id), 'onclick', this, 'onStartChatBlock' );

            // Configuring input zone

            if (inputargs !== null) {
                //                this.chatbarWindows[ chatwindow_id ].input.detachType = inputargs.type; // Disable detach
                //                this.chatbarWindows[ chatwindow_id ].input.detachId = inputargs.id;
                this.chatbarWindows[chatwindow_id].input.create(
                    this,
                    'chatbarinput_' + chatwindow_id,
                    inputargs.action,
                    inputargs.label
                );
                this.chatbarWindows[chatwindow_id].input.writingNowChannel = inputargs.channel;
                this.chatbarWindows[chatwindow_id].input.baseparams = inputargs.param;

                if (typeof inputargs.doubleaction != 'undefined' && inputargs.doubleaction != '') {
                    this.chatbarWindows[chatwindow_id].input.post_url_bis = inputargs.doubleaction;
                }

                dojo.connect($('chatbarinput_predefined_' + chatwindow_id), 'onclick', this, 'onShowPredefined');
            } else {
                // No chat => can extend log zone
                dojo.addClass('chatwindowlogs_zone_' + chatwindow_id, 'chatwindowlogs_zone_big');
            }

            if (['privatechat','table','group'].includes(chatwindowtype)) {
                var html =
                    '<div id="load_previous_message_wrap_' +
                    chatwindow_id +
                    '" class="load_previous_message">\
                                <a class="bga-link" href="#" id="load_previous_message_' +
                    chatwindow_id +
                    '">' +
                    __('lang_mainsite', 'Load previous messages') +
                    '</a>\
                            </div>';
                dojo.place(html, 'chatwindowlogs_endzone_' + chatwindow_id, 'before');
                dojo.connect($('load_previous_message_' + chatwindow_id), 'onclick', this, 'onLoadPreviousMessages');
            }

            // Window top right buttons
            dojo.connect($('chatwindowremove_' + chatwindow_id), 'onclick', this, 'onCloseChatWindow');
            dojo.connect($('chatwindowcollapse_' + chatwindow_id), 'onclick', this, 'onCollapseChatWindow');
            dojo.connect($('chatwindowlogstitlebar_' + chatwindow_id), 'onclick', this, 'onCollapseChatWindow');
            dojo.connect($('chatwindowcollapsed_' + chatwindow_id), 'onclick', this, 'onExpandChatWindow');
            dojo.connect($('chatwindowremovc_' + chatwindow_id), 'onclick', this, 'onCloseChatWindow');

            dojo.connect($('chatwindowmorelogslink_' + chatwindow_id), 'onclick', this, 'onScrollDown');

            dojo.connect($('chatbar_inner'), 'onclick', this, 'onCollapseAllChatWindow');

            dojo.connect(this.chatbarWindows[chatwindow_id].input, 'onChatInputKeyUp', this, 'onDockedChatInputKey');
            dojo.connect($('chatbarinput_' + chatwindow_id + '_input'), 'onclick', this, 'onDockedChatFocus');

            // TODO: connect accept chat / block chat here

            // Subscribe to channel linked with window
            if (bSubscribeChannel) {
                this.chatbarWindows[chatwindow_id].subscription = this.subscribeCometdChannel(
                    notifinfos.channel,
                    this.notifqueue,
                    'onNotification'
                );
            }

            // Audio video live chat
            if (chatwindowtype == 'table' || chatwindowtype == 'privatechat') {
                if ((typeof mainsite != 'undefined' && mainsite.pma) || (typeof gameui != 'undefined' && gameui.pma)) {
                    dojo.query('#chatbarinput_startaudiochat_' + chatwindow_id).connect(
                        'onclick',
                        this,
                        'onStartStopAudioChat'
                    );
                    this.addTooltip('chatbarinput_startaudiochat_' + chatwindow_id, '', __('lang_mainsite', 'Audio call'));
                    dojo.query('#chatbarinput_startvideochat_' + chatwindow_id).connect(
                        'onclick',
                        this,
                        'onStartStopVideoChat'
                    );
                    this.addTooltip('chatbarinput_startvideochat_' + chatwindow_id, '', __('lang_mainsite', 'Video call'));
                } else {
                    this.addTooltip('chatbarinput_startaudiochat_' + chatwindow_id, this.premiumMsgAudioVideo, '');
                    dojo.query('#chatbarinput_startaudiochat_' + chatwindow_id).connect('onclick', this, function (
                        evt
                    ) {
                        dojo.stopEvent(evt);
                        this.showMessage(_(this.premiumMsgAudioVideo), 'info');
                    });
                    this.addTooltip('chatbarinput_startvideochat_' + chatwindow_id, this.premiumMsgAudioVideo, '');
                    dojo.query('#chatbarinput_startvideochat_' + chatwindow_id).connect('onclick', this, function (
                        evt
                    ) {
                        dojo.stopEvent(evt);
                        this.showMessage(_(this.premiumMsgAudioVideo), 'info');
                    });
                }

                // Interface a/v buttons
                if (this.mediaConstraints.video) {
                    dojo.query('#chatbarinput_startvideochat_' + chatwindow_id)
                        .removeClass('audiovideo_inactive')
                        .addClass('audiovideo_active');
                } else if (this.mediaConstraints.audio) {
                    dojo.query('#chatbarinput_startaudiochat_' + chatwindow_id)
                        .removeClass('audiovideo_inactive')
                        .addClass('audiovideo_active');
                }
            }

            return true;
        },
        onStartChatAccept: function( evt )
        {
            dojo.stopEvent( evt );
            var chat_id = evt.currentTarget.id.substr( 17 ); // startchat_accept_privatechat_1
            dojo.removeClass( 'chatwindow_'+chat_id, 'startchat_toconfirm' );
        },
        onStartChatBlock: function( evt )
        {
            dojo.stopEvent( evt );
            var chat_id = evt.currentTarget.id.substr( 16 ); // startchat_block_privatechat_1
            var target_id = evt.currentTarget.id.substr( 28 );

            var newThumb = new ebg.thumb();

            newThumb.create( this, evt.currentTarget.id, target_id, 0 );
            newThumb.bForceThumbDown=true;
            newThumb.onGiveThumbDown( evt );

            // Close window
            this.closeChatWindow( chat_id );
        },
        onChangeStopNotifGeneralBox: function (evt) {
            var value = $('chatbarinput_stopnotif_box_general').checked ? 1 : 0;
            this.ajaxcall(
                '/player/profile/setNotificationPreference.html',
                { type: 'notifyGeneralChat', value: value },
                this,
                function () {
                    this.showMessage(__('lang_mainsite', 'Preference updated!'), 'info');
                }
            );

            if (typeof mainsite != 'undefined') {
                mainsite.notifyOnGeneralChat = value;
            }
        },
        onChangeStopNotifGeneralLabel: function (evt) {
            console.log('onChangeStopNotifGeneral');
            dojo.stopEvent(evt);

            if ($('chatbarinput_stopnotif_box_general').checked) {
                $('chatbarinput_stopnotif_box_general').checked = '';
            } else {
                $('chatbarinput_stopnotif_box_general').checked = 'checked';
            }
            this.onChangeStopNotifGeneralBox(evt);
        },

        checkAVFrequencyLimitation: function () {
            var timeToWaitNextAV = sessionStorage.getItem('timeToWaitNextAV');
            var lastAVAttemptTimestamp = sessionStorage.getItem('lastAVAttemptTimestamp');

            if (!timeToWaitNextAV || !lastAVAttemptTimestamp) {
                return false;
            } else {
                var currentTimestamp = Date.now();
                var time_waited = Math.round((currentTimestamp - lastAVAttemptTimestamp) / 1000);

                if (time_waited >= 120) {
                    // Reset the cooldown in any case after 2 minutes
                    sessionStorage.removeItem('timeToWaitNextAV');
                    sessionStorage.removeItem('AVAttemptNumber');
                    sessionStorage.removeItem('lastAVAttemptTimestamp');
                    return false;
                }

                var time_to_wait_left = timeToWaitNextAV - time_waited;
                if (time_to_wait_left > 0) {
                    this.showMessage(
                        __(
                            'lang_mainsite',
                            'You need to wait %s seconds before launching an audio/video chat again.'
                        ).replace('%s', time_to_wait_left),
                        'info'
                    );
                    return true;
                }
            }
            return false;
        },

        setAVFrequencyLimitation: function () {
            var AVAttemptNumber = sessionStorage.getItem('AVAttemptNumber')
                ? sessionStorage.getItem('AVAttemptNumber')
                : 0;
            AVAttemptNumber++;
            sessionStorage.setItem('AVAttemptNumber', AVAttemptNumber);

            var lastAVAttemptTimestamp = Date.now();
            sessionStorage.setItem('lastAVAttemptTimestamp', lastAVAttemptTimestamp);

            // AV chat spam prevention
            var timeToWaitNextAV = Math.min(10 * AVAttemptNumber, 60); // Min 10 max 60
            sessionStorage.setItem('timeToWaitNextAV', timeToWaitNextAV);
        },

        onStartStopAudioChat: function (evt) {
            console.log('onStartStopAudioChat');
            dojo.stopEvent(evt);

            // Prevent spam on room creation
            if (this.room === null && this.checkAVFrequencyLimitation()) {
                return;
            }

            var chat_type = evt.target.id.split('_')[2];
            if (typeof chat_type == 'undefined') {
                chat_type = evt.target.parentNode.id.split('_')[2];
            }

            if (chat_type == 'table') {
                if (this.room !== null && this.room.indexOf('T') < 0) {
                    this.showMessage(
                        __('lang_mainsite', 'You must end your other live chat sessions before starting a new one.'),
                        'error'
                    );
                    return;
                }

                var player_id = typeof current_player_id != 'undefined' ? current_player_id : this.player_id;
                if (typeof mainsite != 'undefined' && $('active_player_' + player_id) === null) {
                    this.showMessage(
                        __('lang_mainsite', 
                            "You are not currently playing at this table (you haven't joined yet, you have quit or the game has ended)."
                        ),
                        'error'
                    );
                    return;
                }

                var table_id = evt.target.id.split('_')[3];
                if (typeof table_id == 'undefined') {
                    table_id = evt.target.parentNode.id.split('_')[3];
                }

                if (this.room === null) {
                    var html = '<div  class="rtc_dialog">' + '<br />';
                    html +=
                        '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                        __('lang_mainsite', 'You are launching an audio chat session for this table!') +
                        '</i></div>';
                    html += '</div>';

                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            this.ajaxcall(
                                '/table/table/startStopAudio.html',
                                { target_table: table_id, target_player: null },
                                this,
                                function (result) {}
                            );
                        }),
                        dojo.hitch(this, function () {
                            // Nothing!
                        })
                    );
                } else {
                    // Spam prevention
                    this.setAVFrequencyLimitation();

                    // End chat now
                    this.ajaxcall(
                        '/table/table/startStopAudio.html',
                        { target_table: table_id, target_player: null },
                        this,
                        function (result) {
                            if (this.mediaChatRating) {
                                g_sitecore.displayRatingContent('audio', {
                                    room_id: result.room_id,
                                    media: 'audio',
                                    rating: null,
                                    issue: null,
                                    text: null,
                                });
                            }
                        }
                    );
                }
            }

            if (chat_type == 'privatechat') {
                if (this.room !== null && this.room.indexOf('P') < 0) {
                    this.showMessage(
                        __('lang_mainsite', 'You must end your other live chat sessions before starting a new one.'),
                        'error'
                    );
                    return;
                }

                var player_id = evt.target.id.split('_')[3];
                if (typeof player_id == 'undefined') {
                    player_id = evt.target.parentNode.id.split('_')[3];
                }

                if (this.room === null) {
                    var html = '<div  class="rtc_dialog">' + '<br />';
                    html +=
                        '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                        __('lang_mainsite', 'You are launching an audio chat session with another player!') +
                        '</i></div>';
                    html += '</div>';

                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            this.ajaxcall(
                                '/table/table/startStopAudio.html',
                                { target_table: null, target_player: player_id },
                                this,
                                function (result) {}
                            );
                        }),
                        dojo.hitch(this, function () {
                            // Nothing!
                        })
                    );
                } else {
                    // Spam prevention
                    this.setAVFrequencyLimitation();

                    // End chat now
                    this.ajaxcall(
                        '/table/table/startStopAudio.html',
                        { target_table: null, target_player: player_id },
                        this,
                        function (result) {
                            if (this.mediaChatRating) {
                                g_sitecore.displayRatingContent('audio', {
                                    room_id: result.room_id,
                                    media: 'audio',
                                    rating: null,
                                    issue: null,
                                    text: null,
                                });
                            }
                        }
                    );
                }
            }
        },

        onStartStopVideoChat: function (evt) {
            console.log('onStartStopVideoChat');
            dojo.stopEvent(evt);

            var chat_type = evt.target.id.split('_')[2];
            if (typeof chat_type == 'undefined') {
                chat_type = evt.target.parentNode.id.split('_')[2];
            }

            if (chat_type == 'table') {
                if (this.room !== null && this.room.indexOf('T') < 0) {
                    this.showMessage(
                        __('lang_mainsite', 'You must end your other live chat sessions before starting a new one.'),
                        'error'
                    );
                    return;
                }

                var player_id = typeof current_player_id != 'undefined' ? current_player_id : this.player_id;
                if (typeof mainsite != 'undefined' && $('active_player_' + player_id) === null) {
                    this.showMessage(
                        __('lang_mainsite', 
                            "You are not currently playing at this table (you haven't joined yet, you have quit or the game has ended)."
                        ),
                        'error'
                    );
                    return;
                }

                var table_id = evt.target.id.split('_')[3];
                if (typeof table_id == 'undefined') {
                    table_id = evt.target.parentNode.id.split('_')[3];
                }

                var html = '<div  class="rtc_dialog">' + '<br />';
                html +=
                    '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                    __('lang_mainsite', 'You are launching a video chat session for this table!') +
                    '</i></div>';
                html += '</div>';

                if (this.room === null) {
                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            this.ajaxcall(
                                '/table/table/startStopVideo.html',
                                { target_table: table_id, target_player: null },
                                this,
                                function (result) {}
                            );
                        }),
                        dojo.hitch(this, function () {
                            // Nothing!
                        })
                    );
                } else {
                    // End chat now
                    this.ajaxcall(
                        '/table/table/startStopVideo.html',
                        { target_table: table_id, target_player: null },
                        this,
                        function (result) {
                            if (this.mediaChatRating) {
                                g_sitecore.displayRatingContent('video', {
                                    room_id: result.room_id,
                                    media: 'video',
                                    rating: null,
                                    issue: null,
                                    text: null,
                                });
                            }
                        }
                    );
                }
            }

            if (chat_type == 'privatechat') {
                if (this.room !== null && this.room.indexOf('P') < 0) {
                    this.showMessage(
                        __('lang_mainsite', 'You must end your other live chat sessions before starting a new one.'),
                        'error'
                    );
                    return;
                }

                var player_id = evt.target.id.split('_')[3];
                if (typeof player_id == 'undefined') {
                    player_id = evt.target.parentNode.id.split('_')[3];
                }

                var html = '<div  class="rtc_dialog">' + '<br />';
                html +=
                    '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' +
                    __('lang_mainsite', 'You are launching a video chat session with another player!') +
                    '</i></div>';
                html += '</div>';

                if (this.room === null) {
                    // Join now
                    this.confirmationDialog(
                        html,
                        dojo.hitch(this, function () {
                            this.ajaxcall(
                                '/table/table/startStopVideo.html',
                                { target_table: null, target_player: player_id },
                                this,
                                function (result) {}
                            );
                        }),
                        dojo.hitch(this, function () {
                            // Nothing!
                        })
                    );
                } else {
                    // End chat now
                    this.ajaxcall(
                        '/table/table/startStopVideo.html',
                        { target_table: null, target_player: player_id },
                        this,
                        function (result) {
                            if (this.mediaChatRating) {
                                g_sitecore.displayRatingContent('video', {
                                    room_id: result.room_id,
                                    media: 'video',
                                    rating: null,
                                    issue: null,
                                    text: null,
                                });
                            }
                        }
                    );
                }
            }
        },

        setNewRTCMode: function (table_id, player_id, rtc_mode, room_creator) {
            console.log('setNewRTCMode', table_id, player_id, rtc_mode);

            if (rtc_mode === null) {
                return;
            }

            this.rtc_mode = rtc_mode;

            if (typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && !this.isSpectator) {
                var this_player_id = typeof current_player_id != 'undefined' ? current_player_id : this.player_id;
                var resetRTC = false;

                var audio = rtc_mode == 0 ? false : true;
                if (this.mediaConstraints.audio != audio) {
                    this.mediaConstraints.audio = audio;
                    resetRTC = true;
                }

                var video = this.getRtcVideoConstraints(rtc_mode);
                if (JSON.stringify(this.mediaConstraints.video) != JSON.stringify(video)) {
                    this.mediaConstraints.video = video;
                    resetRTC = true;
                }

                // Media constraints have changed: hang up & destroy all audio/video containers (full cleanup)
                if (resetRTC && this.webrtc !== null) {
                    this.clearRTC();
                    this.room = null;
                }

                if (this.room === null && (this.mediaConstraints.audio || this.mediaConstraints.video)) {
                    if (table_id !== null) {
                        // Set room
                        this.room = 'T' + table_id;

                        // Setup audio/video container in replacement for the player avatar (game)
                        if (typeof gameui != 'undefined' && $('rtc_container_' + this_player_id) == null) {
                            dojo.place(
                                this.format_string(
                                    this.getRTCTemplate(
                                        this.mediaConstraints.audio,
                                        this.mediaConstraints.video,
                                        false
                                    ),
                                    { player_id: this_player_id, muted: 'muted' }
                                ), // Video of self must be muted in order not to generate echo
                                $('rtc_placeholder_' + this_player_id)
                            );

                            this.setupRTCEvents(this_player_id);
                        }

                        if (typeof mainsite != 'undefined') {
                            // Make sure that we have an audio/video container for the current player if he has joined the table
                            if (
                                $('active_player_' + this_player_id) != null &&
                                $('emblem_' + this_player_id) != null &&
                                $('rtc_container_' + this_player_id) == null
                            ) {
                                dojo.place(
                                    this.format_string(
                                        this.getRTCTemplate(
                                            this.mediaConstraints.audio,
                                            this.mediaConstraints.video,
                                            false
                                        ),
                                        { player_id: this_player_id, muted: 'muted' }
                                    ), // Video of self must be muted in order not to generate echo
                                    $('table_rtc_placeholder')
                                );

                                this.placeOnObject($('rtc_container_' + this_player_id), $('emblem_' + this_player_id));

                                this.setupRTCEvents(this_player_id);
                            }
                        }
                    } else if (player_id !== null) {
                        // Set room
                        this.room =
                            'P' + Math.min(this_player_id, player_id) + '_' + Math.max(this_player_id, player_id);

                        if ($('chatwindowlogs_privatechat_' + player_id) !== null) {
                            // Make sure that we have an audio/video container above the chat window
                            if ($('rtc_container_' + this_player_id) == null) {
                                dojo.place(
                                    this.format_string(
                                        this.getRTCTemplate(
                                            this.mediaConstraints.audio,
                                            this.mediaConstraints.video,
                                            false
                                        ),
                                        { player_id: this_player_id, muted: 'muted' }
                                    ), // Video of self must be muted in order not to generate echo
                                    $('chatwindowlogs_privatechat_' + player_id)
                                );

                                if (this.mediaConstraints.video) {
                                    // Set it at the center of the chat window title bar
                                    dojo.style($('rtc_container_' + this_player_id), 'top', '-6px');
                                    dojo.style($('rtc_container_' + this_player_id), 'left', '115px');

                                    // Set it at the same level as maximized windows
                                    dojo.style($('rtc_container_' + this_player_id), 'zIndex', '496');
                                } else if (this.mediaConstraints.audio) {
                                    // Set it at the center right, leaving space for the speaker
                                    dojo.style($('rtc_container_' + this_player_id), 'top', '-13px');
                                    dojo.style($('rtc_container_' + this_player_id), 'left', '135px');
                                }

                                this.setupRTCEvents(this_player_id);
                            }
                        }
                    }

                    // Table creator doesnt need to confirm
                    if (room_creator == this_player_id) {
                        this.already_accepted_room = this.room;
                    }

                    // Interface a/v buttons
                    var chatwindow_id = table_id !== null ? 'table_' + table_id : 'privatechat_' + player_id;
                    if (this.mediaConstraints.video) {
                        dojo.query('#chatbarinput_startvideochat_' + chatwindow_id)
                            .removeClass('audiovideo_inactive')
                            .addClass('audiovideo_active');
                        dojo.query('#playersaroundtable_startvideochat_' + chatwindow_id)
                            .removeClass('audiovideo_inactive')
                            .addClass('audiovideo_active');
                    } else if (this.mediaConstraints.audio) {
                        dojo.query('#chatbarinput_startaudiochat_' + chatwindow_id)
                            .removeClass('audiovideo_inactive')
                            .addClass('audiovideo_active');
                        dojo.query('#playersaroundtable_startaudiochat_' + chatwindow_id)
                            .removeClass('audiovideo_inactive')
                            .addClass('audiovideo_active');
                    }

                    // Init webrtc
                    this.startRTC();
                }
            }
        },

        onLoadPreviousMessages: function (evt) {
            dojo.stopEvent(evt);

            // load_previous_message_privatechat_<id>

            var chatwindow_id = evt.currentTarget.id.substr(22);

            var chatwindow_type = chatwindow_id.split('_')[0];
            var chatwindow_type_id = chatwindow_id.split('_')[1];

            this.loadPreviousMessage(chatwindow_type, chatwindow_type_id);
        },
        loadPreviousMessage: function (chat_type, chatwindow_type_id) {
            var chatwindow_id = chat_type + '_' + chatwindow_type_id;

            var from = null;
            if (typeof this.chatbarWindows[chatwindow_id].first_msg_timestamp != 'undefined') {
                from = this.chatbarWindows[chatwindow_id].first_msg_timestamp;
            }

            this.ajaxcall(
                '/table/table/chatHistory.html',
                { type: chat_type, id: chatwindow_type_id, before: from },
                this,
                'loadPreviousMessageCallback',
                function (is_error) {},
                'get'
            );
        },
        loadPreviousMessageCallback: function (result) {
            if (typeof current_player_id == 'undefined') {
                var current_player_id = this.player_id;
            }

            console.log(result);

            var chat_type = result.type;
            var chat_id = result.id;

            if (result.status) {
                // This is the status of the discussion, for the current player

                if (result.status == 'underage') {
                    // This player is not authorized to discuss here for a underage question (ex: because he is underage or the other player is underage)
                    this.showMessage(_('Sorry, you are not authorized to discuss with this player'), 'error');

                    this.closeChatWindow(chat_type + '_' + chat_id);
                    return;
                }
                if (result.status == 'admin') {
                    // This player is an admin that you cannot contact directly
                    var msg = __('lang_mainsite', 'Our ${contact_page} is the best way to get in touch with us :)');
                    msg = msg.replace('${contact_page}', __('lang_mainsite', 'Contact page'));
                    this.showMessage(msg, 'error');
                    this.closeChatWindow(chat_type + '_' + chat_id);

                    gotourl('support');
                    return;
                }
                if (result.status == 'blocked') {
                    // The recipient blocked current player so cannot be contacted anymore
                    
                    // => do not block: let the player write messages so he cannot know that he has been blocked (otherwise he will create another account to harrass)

                    //this.showMessage(_('Sorry, you are not authorized to discuss with this player'), 'error');

                    //this.closeChatWindow(chat_type + '_' + chat_id);
                    //return;
                }
                if (result.status == 'newchat') {
                    // This is a brand new chat!
                    // We must add a warning to the player
                    dojo.place('<div class="whiteblock"><i class="fa fa-exclamation-triangle"></i> '+_('Unsollicited messages may lead to be blocked and affect your reputation.')+'</div>', 'chatwindowlogs_endzone_' + chat_type + '_' + chat_id, 'before');
                }
                if( result.status == 'newchattoconfirm')
                {
                    dojo.addClass( 'chatwindow_'+chat_type + '_' + chat_id, 'startchat_toconfirm' );
                }

            }

            this.chatbarWindows[chat_type + '_' + chat_id].lastMsgAuthor = null; // So we can reset the "do not display message poster name if the previous message is from the same author"

            var scrollHeightBefore = $('chatwindowlogs_zone_' + chat_type + '_' + chat_id).scrollHeight;

            var bAtLeastOne = false;
            for (var i in result.history) {
                bAtLeastOne = true;

                if (chat_type == 'privatechat') {
                    var notif = {
                        channel: '/player/p' + current_player_id,
                        channelorig: '/player/p' + current_player_id,
                        args: result.history[i],
                        bIsTableMsg: false,
                        lock_uuid: 'dummy',
                        log: '${player_name} ${text}',
                        type: 'privatechat',
                        time: result.history[i].time,
                        mread: result.history[i].mread,
                        loadprevious: true,
                        uid: 0,
                    };
                    this.onPlaceLogOnChannel(notif);
                } else if (chat_type == 'table') {
                    var notif = {
                        channel: '/table/t' + chat_id,
                        channelorig: '/table/t' + chat_id,
                        args: result.history[i],
                        bIsTableMsg: true,
                        lock_uuid: 'dummy',
                        log: '${player_name} ${text}',
                        type: 'tablechat',
                        time: result.history[i].time,
                        loadprevious: true,
                        uid: 0,
                    };
                    this.onPlaceLogOnChannel(notif);
                } else if (chat_type == 'group') {
                    var notif = {
                        channel: '/group/g' + chat_id,
                        channelorig: '/group/g' + chat_id,
                        args: result.history[i],
                        lock_uuid: 'dummy',
                        log: '${player_name} ${text}',
                        type: 'groupchat',
                        time: result.history[i].time,
                        loadprevious: true,
                        uid: 0,
                    };
                    this.onPlaceLogOnChannel(notif);
                } else {
                    console.error('unknow previous message type: ' + chat_type);
                }
            }

            // We must replace "load previous message" to the top
            dojo.place(
                'load_previous_message_wrap_' + chat_type + '_' + chat_id,
                'chatwindowlogs_zone_' + chat_type + '_' + chat_id,
                'first'
            );

            if (!bAtLeastOne) {
                dojo.destroy('load_previous_message_' + chat_type + '_' + chat_id);
            }

            var scrollHeightAfter = $('chatwindowlogs_zone_' + chat_type + '_' + chat_id).scrollHeight;

            if (scrollHeightAfter > scrollHeightBefore) {
                $('chatwindowlogs_zone_' + chat_type + '_' + chat_id).scrollTop += toint(
                    scrollHeightAfter - scrollHeightBefore
                );
            }
        },

        stackOrUnstackIfNeeded: function () {
            var stacked_nbr = this.countStackedWindows();
            var bMobileVersion = dojo.hasClass('ebd-body', 'mobile_version');

            if (stacked_nbr > 0) {
                // check if we could unstack one window

                var needed = this.getNeededChatbarWidth(); // <== this is the space we occupy
                var chatbarpos = dojo.position('chatbar');
                var totalwidth = chatbarpos.w - 50; // Note: 50 px margin to save space for the stack menu

                var margin = bMobileVersion ? 80 : 300;

                //document.title = 'needed '+needed+' / totalwidth '+totalwidth;

                if (needed + margin <= totalwidth) {
                    //alert( 'unstacking some window cause '+needed+'+200 <= '+totalwidth );

                    // We can unstack one window
                    for (var i in this.chatbarWindows) {
                        if (this.chatbarWindows[i].status == 'stacked') {
                            this.unstackChatWindow(i, 'automatic');
                            return;
                        }
                    }
                }
            }

            this.stackChatWindowsIfNeeded();

            if (bMobileVersion) {
                // On mobile, when resizing, we scroll expanded discussion logs to the bottom.
                // Reason of this : on mobile, expanded discussion is a "position:fixed" with a top and a bottom. When reducing the window, the discussion stays where it is
                //  and we are hiding more and more of the recent discussion => we have to fix this.

                dojo.query('#chatbar .expanded .chatwindowlogs_zone').forEach(function (node) {
                    // Note : for unknown reasons, we must do this a little bit AFTER onresize, otherwise this does not work for very small screen height (typical case : when keyboard is opening)
                    setTimeout(function () {
                        node.scrollTop = node.scrollHeight;
                    }, 1);
                });
            }
        },

        onUnstackChatWindow: function (evt) {
            // stackmenu_item_<id>
            dojo.stopEvent(evt);
            var chatwindow_id = evt.currentTarget.id.substr(15);
            this.unstackChatWindow(chatwindow_id);
            dojo.style('stackedmenu', 'display', 'none');
        },

        unstackChatWindow: function (chatwindow_id, reason) {
            if (typeof reason == 'undefined') {
                reason = 'normal';
            }

            this.stackChatWindowsIfNeeded('expanded');
            this.expandChatWindow(chatwindow_id);

            if (reason == 'automatic') {
                // Note : when a chat window is unstacked without a use action, it shouldn't be expanded
                this.collapseChatWindow(chatwindow_id);
            }

            if ($('stackmenu_item_' + chatwindow_id)) {
                dojo.destroy('stackmenu_item_' + chatwindow_id);
            }
        },

        // Stack chat windows if needed (because of screen size)
        // if specified, make sure save_spaces_nbr new space can be added without problem & stacking
        stackChatWindowsIfNeeded: function (save_spaces_for) {
            var bMobileVersion = dojo.hasClass('ebd-body', 'mobile_version');

            if (dojo.style('chatbar', 'display') == 'none') {
                // Chatbar is hidden => nothing to do!
                return;
            }

            if (typeof save_spaces_nbr == 'undefined') {
                save_spaces_nbr = null;
            }

            var chatbarpos = dojo.position('chatbar');
            var totalwidth = chatbarpos.w - 50; // Note: 50 px margin to save space for the stack menu

            var needed = this.getNeededChatbarWidth();

            if (save_spaces_for == 'collapsed') {
                needed += bMobileVersion ? 64 : 176;
            }
            if (save_spaces_for == 'expanded') {
                needed += bMobileVersion ? 64 : 220;
            }

            if (needed > totalwidth) {
                //alert( 'stacking some window cause '+needed+' > '+totalwidth );

                // Here, we need to stack some window to make space for the new one.
                this.stackOneChatWindow();

                // ... and loop until it's okay
                this.stackChatWindowsIfNeeded(save_spaces_for);
            }
        },

        stackOneChatWindow: function () {
            // Find a collapsed window if possible
            var chatwindow_id = null;
            for (var i in this.chatbarWindows) {
                var status = this.chatbarWindows[i].status;
                if (status == 'collapsed') {
                    chatwindow_id = i;
                }
            }

            if (chatwindow_id === null) {
                // Otherwize find an expanded
                for (var i in this.chatbarWindows) {
                    var status = this.chatbarWindows[i].status;
                    if (status == 'expanded') {
                        chatwindow_id = i;
                    }
                }
            }

            if (chatwindow_id === null) {
                console.error('Cannot find any chatwindow to stack!!!');
            }

            // Now, stack it
            this.chatbarWindows[chatwindow_id].status = 'stacked';

            dojo.removeClass('chatwindow_' + chatwindow_id, ['collapsed', 'expanded', 'stacked']);
            dojo.addClass('chatwindow_' + chatwindow_id, 'stacked');
            this.updateChatBarStatus();

            dojo.style('chatwindowexpanded_' + chatwindow_id, 'display', 'none');
            dojo.style('chatwindowcollapsed_' + chatwindow_id, 'display', 'none');
            dojo.style('chatwindowpreview_' + chatwindow_id, 'display', 'none');

            // Add this window to stackmenu
            var title = $('chatwindowtitlenolink_' + chatwindow_id).innerHTML;
            dojo.place(
                '<div class="stackmenu_item" id="stackmenu_item_' + chatwindow_id + '">' + title + '</div>',
                'stackedmenu'
            );
            dojo.connect($('stackmenu_item_' + chatwindow_id), 'onclick', this, 'onUnstackChatWindow');

            this.adaptChatbarDock();
        },

        // Get the needed chat bar width according to this.chatbarWindows
        getNeededChatbarWidth: function () {
            var bMobileVersion = dojo.hasClass('ebd-body', 'mobile_version');

            var expanded_nbr = 0;
            var collapsed_nbr = 0;

            var expanded_width = bMobileVersion ? 64 : 280; // 268 width + 2px border + 10px margin // Note : mobile version take the same space on dock collapsed & expanded
            var collapsed_width = bMobileVersion ? 64 : 176; // 166 width + 10px margin
            var additional_width = 0;

            for (var i in this.chatbarWindows) {
                if (
                    i.substr(0, 8) == 'tablelog' &&
                    dojo.hasClass('ebd-body', 'desktop_version') &&
                    !dojo.hasClass('ebd-body', 'new_gameux')
                ) {
                    // Exception : we hide "tablelog" windows in desktop mode.
                } else {
                    if (this.chatbarWindows[i].status == 'expanded') {
                        expanded_nbr++;
                    } else if (this.chatbarWindows[i].status == 'collapsed') {
                        collapsed_nbr++;
                    }
                }

                if (
                    i.substr(0, 6) == 'table_' &&
                    dojo.hasClass('ebd-body', 'desktop_version') &&
                    typeof gameui != 'undefined'
                ) {
                    // Exception : in desktop mode, "table" docked chat is larger
                    if (this.chatbarWindows[i].status == 'expanded') {
                        additional_width += 412 - expanded_width;
                    } else if (this.chatbarWindows[i].status == 'collapsed') {
                        additional_width += 312 - collapsed_width;
                    }
                }
            }

            return 2 + expanded_nbr * expanded_width + collapsed_nbr * collapsed_width + additional_width;
        },

        // Adapt chat bar dock width & height to this.chatbarWindows
        adaptChatbarDock: function () {
            if (!$('chatwindowcollapsed_stacked')) {
                return; // Docked chat is not initialized, and probably not enabled.
            }

            var needed_width = this.getNeededChatbarWidth();

            if (needed_width > 0) {
                // Show dock
                dojo.addClass('chatbardock', 'chatbardock_visible');
                dojo.style('chatbardock', 'width', needed_width + 'px');
            } else {
                // Hide dock
                dojo.removeClass('chatbardock', 'chatbardock_visible');
            }

            // Count stacked windows
            var stacked_nbr = this.countStackedWindows();
            if (stacked_nbr > 0) {
                // Show stacked menu
                dojo.style('chatwindowcollapsed_stacked', 'display', 'block');
            } else {
                // Hide stacked menu
                dojo.style('chatwindowcollapsed_stacked', 'display', 'none');
            }
        },

        countStackedWindows: function () {
            var stacked_nbr = 0;
            for (var i in this.chatbarWindows) {
                if (this.chatbarWindows[i].status == 'stacked') {
                    stacked_nbr++;
                }
            }
            return stacked_nbr;
        },

        closeChatWindow: function (chatwindow_id) {
            if (this.chatbarWindows[chatwindow_id]) {
                this.makeSureChatBarIsOnBottom(chatwindow_id);

                // Remove chat window
                if (this.chatbarWindows[chatwindow_id].subscription !== null) {
                    g_sitecore.unsubscribeCometdChannel(this.chatbarWindows[chatwindow_id].subscription);
                }

                dojo.destroy('chatwindow_' + chatwindow_id);
                delete this.chatbarWindows[chatwindow_id];
                this.updateChatBarStatus();

                this.stackOrUnstackIfNeeded();
                this.adaptChatbarDock();
            }
        },

        onCloseChatWindow: function (evt) {
            dojo.stopEvent(evt);

            // chatwindowremove_<id>
            var chatwindow_id = evt.currentTarget.id.substr(17);
            var chatwindow_type = chatwindow_id.split('_')[0];
            var chatwindow_type_id = chatwindow_id.split('_')[1];

            this.ackUnreadMessage(chatwindow_id, 'unsub');

            // If we have a private chat room set up, leave it then close the chat window
            if (this.room !== null && this.room.indexOf('P') >= 0) {
                var this_player_id = typeof current_player_id != 'undefined' ? current_player_id : this.player_id;
                if (chatwindow_type == 'table' && this.room == 'T' + chatwindow_type_id) {
                    this.doLeaveRoom();
                    this.closeChatWindow(chatwindow_id);
                } else if (
                    (chatwindow_type == 'privatechat' &&
                        this.room == 'P' + chatwindow_type_id + '_' + this_player_id) ||
                    (chatwindow_type == 'privatechat' && this.room == 'P' + this_player_id + '_' + chatwindow_type_id)
                ) {
                    if (this.mediaConstraints.video) {
                        this.ajaxcall(
                            '/table/table/startStopVideo.html',
                            { target_table: null, target_player: chatwindow_type_id },
                            this,
                            function (result) {
                                this.closeChatWindow(chatwindow_id);
                            }
                        );
                    } else if (this.mediaConstraints.audio) {
                        this.ajaxcall(
                            '/table/table/startStopAudio.html',
                            { target_table: null, target_player: chatwindow_type_id },
                            this,
                            function (result) {
                                this.closeChatWindow(chatwindow_id);
                            }
                        );
                    }
                } else {
                    this.closeChatWindow(chatwindow_id);
                }
            } else {
                // Just close the chat window
                this.closeChatWindow(chatwindow_id);
            }
        },

        onCollapseChatWindow: function (evt) {
            if (evt.target.id.substr(0, 19) == 'chatwindowtitlelink') {
                // Don't do anything (click on the link itself)
                return true;
            }

            dojo.stopEvent(evt);

            // chatwindowcollapse_<id>
            // or chatwindowlogstitlebar_<id>
            if (evt.currentTarget.id.substr(0, 18) == 'chatwindowcollapse') {
                var chatwindow_id = evt.currentTarget.id.substr(19);
            } else {
                var chatwindow_id = evt.currentTarget.id.substr(23);
            }

            this.collapseChatWindow(chatwindow_id);
        },

        collapseChatWindow: function (chatwindow_id, bDoNotPlaceChatBarAtBottom) {
            this.chatbarWindows[chatwindow_id].status = 'collapsed';

            dojo.removeClass('chatwindow_' + chatwindow_id, ['collapsed', 'expanded', 'stacked']);
            dojo.addClass('chatwindow_' + chatwindow_id, 'collapsed');
            this.updateChatBarStatus();

            // Collapse!
            dojo.style('chatwindowexpanded_' + chatwindow_id, 'display', 'none');
            dojo.style('chatwindowcollapsed_' + chatwindow_id, 'display', 'block');
            dojo.style('chatwindowpreview_' + chatwindow_id, 'display', 'block');

            this.stackOrUnstackIfNeeded();
            this.adaptChatbarDock();

            if (typeof this.autoChatWhilePressingKey != 'undefined') {
                dijit.popup.close(this.autoChatWhilePressingKey);
            }

            if (typeof bDoNotPlaceChatBarAtBottom == 'undefined' || !bDoNotPlaceChatBarAtBottom) {
                this.makeSureChatBarIsOnBottom(chatwindow_id);
            }
        },

        onExpandChatWindow: function (evt) {
            // chatwindowcollapsed_<id>
            var chatwindow_id = evt.currentTarget.id.substr(20);

            if (this.chatbarWindows[chatwindow_id].status != 'expanded') {
                this.expandChatWindow(chatwindow_id);

                this.ackUnreadMessage(chatwindow_id);
            } else {
                this.collapseChatWindow(chatwindow_id);
            }
        },

        // Note : on mobile, used to collapse all windows when cliquing on the enlighted background on the top
        onCollapseAllChatWindow: function (evt) {
            console.log(evt);
            if (evt.target.id == 'chatbar_inner') {
                dojo.stopEvent(evt);

                for (var i in this.chatbarWindows) {
                    if (this.chatbarWindows[i].status == 'expanded') {
                        this.collapseChatWindow(i);
                    }
                }
            }
        },

        updateChatBarStatus: function () {
            if (dojo.query('.chatwindow.expanded').length > 0) {
                dojo.addClass('chatbar', 'at_least_one_expanded');
            } else {
                dojo.removeClass('chatbar', 'at_least_one_expanded');
            }
        },

        expandChatWindow: function (chatwindow_id, bAutoCollapseAfterMessage) {
            var bMobile = dojo.hasClass('ebd-body', 'mobile_version');

            if (this.chatbarWindows[chatwindow_id].status == 'expanded') {
                // Already done
            } else {
                if (bMobile) {
                    // On mobile, we automaticalle collapsed all other expanded windows before expanding this one
                    for (var i in this.chatbarWindows) {
                        if (this.chatbarWindows[i].status == 'expanded') {
                            this.collapseChatWindow(i, true);
                        }
                    }
                }

                if (typeof bAutoCollapseAfterMessage != 'undefined' && bAutoCollapseAfterMessage) {
                    this.chatbarWindows[chatwindow_id].autoCollapseAfterMessage = true;
                } else {
                    this.chatbarWindows[chatwindow_id].autoCollapseAfterMessage = false;
                }

                this.chatbarWindows[chatwindow_id].status = 'expanded';

                dojo.removeClass('chatwindow_' + chatwindow_id, ['collapsed', 'expanded', 'stacked']);
                dojo.addClass('chatwindow_' + chatwindow_id, 'expanded');
                this.updateChatBarStatus();

                // Expand
                dojo.style('chatwindowexpanded_' + chatwindow_id, 'display', 'block');
                if (!bMobile) {
                    // Note : do not hide collapsed item on mobile
                    dojo.style('chatwindowcollapsed_' + chatwindow_id, 'display', 'none');
                } else {
                    dojo.style('chatwindowcollapsed_' + chatwindow_id, 'display', 'block');
                }
                dojo.style('chatwindowpreview_' + chatwindow_id, 'display', 'none');

                // Remove new message signal
                dojo.removeClass('chatwindow_' + chatwindow_id, 'newmessage');
                $('chatwindownewmsgcount_' + chatwindow_id).innerHTML = '';

                // Scroll to bottom
                $('chatwindowlogs_zone_' + chatwindow_id).scrollTop = $(
                    'chatwindowlogs_zone_' + chatwindow_id
                ).scrollHeight;

                this.stackOrUnstackIfNeeded();
                this.adaptChatbarDock();

                if (bMobile) {
                    this.makeSureChatBarIsOnTop(chatwindow_id);
                }
            }

            // Focus on chat if any
            if ($('chatbarinput_' + chatwindow_id + '_input')) {
                //if( !this.isTouchDevice )   // Note: on touch device this is painful to set the focus immediately // DEPRECATED : now that we have a mobile chat, it is no more painful
                {
                    $('chatbarinput_' + chatwindow_id + '_input').focus();
                }
            }
        },

        makeSureChatBarIsOnTop: function (chatwindow_id) {
            if (dojo.hasClass('ebd-body', 'chatbar_ontop')) {
                return;
            } // Work already done

            var initial = dojo.position('chatbar');

            dojo.addClass('ebd-body', 'chatbar_ontop');

            // Sliding chatbar from bottom to top.
            var after = dojo.position('chatbar');

            dojo.style('chatbar', 'top', initial.y + 'px');
            dojo.style('chatbar', 'bottom', 'auto');
            var anim = dojo.fx.slideTo({
                node: 'chatbar',
                top: after.y,
                left: 0,
                delay: 0,
                duration: 200,
                unit: 'px',
            });
            dojo.connect(anim, 'onEnd', function () {
                dojo.style('chatbar', 'bottom', '');
                dojo.style('chatbar', 'top', '');
                dojo.style('chatbar', 'position', '');
            });
            anim.play();

            if (initial.y == after.y) {
                // Note : if there is no animation, there is no fadein
                dojo.style('chatwindowexpanded_' + chatwindow_id, 'opacity', 1);
            } else {
                dojo.style('chatwindowexpanded_' + chatwindow_id, 'opacity', 0);
                dojo.fadeIn({
                    node: 'chatwindowexpanded_' + chatwindow_id,
                    duration: 200,
                    delay: 180,
                    onEnd: function (node) {
                        dojo.style(node, 'opacity', '');
                    },
                }).play();
            }
        },
        makeSureChatBarIsOnBottom: function (chatwindow_id) {
            if (!dojo.hasClass('ebd-body', 'chatbar_ontop')) {
                return;
            } // Work has been done

            var initial = dojo.position('chatbar');

            dojo.removeClass('ebd-body', 'chatbar_ontop');

            // Sliding chatbar from top to bottom.
            var after = dojo.position('chatbar');

            dojo.style('chatbar', 'top', 'auto');
            dojo.style('chatbar', 'bottom', after.y - initial.y + 'px');

            dojo.animateProperty({
                node: 'chatbar',
                delay: 0,
                properties: {
                    bottom: { end: '0', unit: 'px' },
                },
                onEnd: function (node) {
                    dojo.style('chatbar', 'top', '');
                    dojo.style('chatbar', 'bottom', '');
                    dojo.style('chatbar', 'position', '');
                },
            }).play();

            dojo.style('chatwindowexpanded_' + chatwindow_id, 'opacity', 1);
        },

        onScrollDown: function (evt) {
            dojo.stopEvent(evt);

            // chatwindowmorelogslink_<id>
            var chatwindow_id = evt.currentTarget.id.substr(23);

            dojo.style('chatwindowmorelogs_' + chatwindow_id, 'display', 'none');
            $('chatwindowlogs_zone_' + chatwindow_id).scrollTop = $(
                'chatwindowlogs_zone_' + chatwindow_id
            ).scrollHeight;
        },

        onToggleStackMenu: function (evt) {
            dojo.stopEvent(evt);

            if (dojo.style('stackedmenu', 'display') == 'block') {
                dojo.style('stackedmenu', 'display', 'none');
            } else {
                dojo.style('stackedmenu', 'display', 'block');
            }
        },

        onCallbackBeforeChat: function (params, post_url) {
            if (typeof params.table != 'undefined') {
                if (this.chatbarWindows['table_' + params.table] != 'undefined') {
                    if (this.chatbarWindows['table_' + params.table].autoCollapseAfterMessage != 'undefined') {
                        if (this.chatbarWindows['table_' + params.table].autoCollapseAfterMessage) {
                            // We must auto collapse this window after the chat.
                            this.collapseChatWindow('table_' + params.table);
                        }
                    }

                    if (typeof this.discussblock != 'undefined') {
                        this.showMessage(_('A player at thie table blocked you.'), 'error');
                        return false;
                    }
                }
            }

            if (this.isBadWorkInChat(params.msg)) {
                var confirtxt =
                    __(
                        'lang_mainsite',
                        'We detect a word in your chat input that may be considered as an insult/profanity/aggressive attitude by others.'
                    ) + '\n\n';
                confirtxt +=
                    __(
                        'lang_mainsite',
                        'BGA has a zero-tolerance policy about insults and aggressive attitudes, whatever the reason.'
                    ) + '\n\n';
                confirtxt += __('lang_mainsite', 'If another player reports you, you will be ban from BGA.') + '\n\n';
                confirtxt +=
                    __(
                        'lang_mainsite',
                        'If someone is provoking you, DO NOT RESPOND, block this player (thumb down on his/her profile) and report this players to moderators.'
                    ) + '\n\n';
                confirtxt += __('lang_mainsite', 'Insults on both side = Moderation of both side.') + '\n\n';
                confirtxt += __('lang_mainsite', 'Do you really want to send your message and risk a moderation?');
                return confirm(confirtxt);
            }

            if (post_url == '/chat/chat/say.html') {
                // Chat general input
                if (typeof mainsite != 'undefined') {
                    if (mainsite.tutorialShowOnce(21)) {
                        var confirtxt =
                            __(
                                'lang_mainsite',
                                'You are using Board Game Arena global chat: your message will be visible by all players'
                            ) + '\n\n';
                        confirtxt +=
                            __(
                                'lang_mainsite',
                                'There is a zero-tolerance policy on this chat for insults, advertising, or any content that may not be appropriate for all audience, or may be interpreted as an aggression.'
                            ) + '\n\n';
                        confirtxt +=
                            __(
                                'lang_mainsite',
                                'Players who do not respect these rules will be banned immediately with no warning.'
                            ) + '\n\n';
                        confirtxt += __('lang_mainsite', 'Do you confirm you want to send this message?');
                        return confirm(confirtxt);
                    }
                }
            }

            return true;
        },

        isBadWorkInChat: function (msg) {
            if (msg === null) {
                return false;
            }

            var chatWithSpace = ' ' + msg.toLowerCase() + ' ';

            for (var i in this.badWordList) {
                if (chatWithSpace.indexOf(' ' + this.badWordList[i].replace('-', ' ') + ' ') != -1) {
                    return true;
                }
            }

            return false;
        },

        onCallbackAfterChat: function (params) {
            if (typeof this.autoChatWhilePressingKey != 'undefined') {
                dijit.popup.close(this.autoChatWhilePressingKey);
            }
        },

        callbackAfterChatError: function (params) {
            if (typeof params.table != 'undefined') {
                if (this.chatbarWindows['table_' + params.table] != 'undefined') {
                    if (this.chatbarWindows['table_' + params.table].autoCollapseAfterMessage != 'undefined') {
                        if (this.chatbarWindows['table_' + params.table].autoCollapseAfterMessage) {
                            // There have been an error after an autoCollapse => we must re-expand the window
                            this.expandChatWindow('table_' + params.table, true);
                        }
                    }
                }
            }
        },

        onDockedChatFocus: function (evt) {
            var chatwindow_id = evt.target.id.substr(13).slice(0, -6);

            this.ackUnreadMessage(chatwindow_id);
        },

        onDockedChatInputKey: function (evt) {
            // chatbarinput_<id>_input
            var chatwindow_id = evt.target.id.substr(13).slice(0, -6);

            this.ackUnreadMessage(chatwindow_id);

            if (
                this.chatbarWindows[chatwindow_id].autoShowOnKeyPress &&
                !this.chatbarWindows[chatwindow_id].autoCollapseAfterMessage
            ) {
                // 1° this is a chat window that can be shown automatically by pressing any key on the keyboard.
                // 2° the user is typing on this input field
                // 3° the window has not been open automatically by pressing a key

                // In this case, we advertise for the "auto chat while pressing key", if we didn't
                if (
                    typeof this.autoChatWhilePressingKey == 'undefined' &&
                    dojo.hasClass('ebd-body', 'desktop_version')
                ) {
                    var html = '<div class="icon20 icon20_suggestion"></div> ';
                    html += '<b>' + __('lang_mainsite', 'Did you know?') + '</b>';
                    html += "<hr/><div style='max-width:200px'>";
                    html += __('lang_mainsite', 
                        'You can type messages anytime during a game to start chatting without opening this chat window manually.'
                    );
                    html += '</div>';

                    this.autoChatWhilePressingKey = new dijit.TooltipDialog({
                        id: 'autoChatWhilePressingKey',
                        content: html,
                        closable: true,
                    });

                    var anchor = evt.target;

                    dijit.popup.open({
                        popup: this.autoChatWhilePressingKey,
                        around: $(anchor),
                        orient: ['before-centered', 'before', 'below', 'below-alt', 'above', 'above-alt'],
                    });
                }
            }
        },

        onShowPredefined: function (evt) {
            // chatbarinput_predefined_<id>
            var chatwindow_id = evt.currentTarget.id.substr(24);
            var anchor = evt.currentTarget.id;

            // Show predefined chat messages window

            var bNewWindow = false;
            if (typeof this.chatbarWindows[chatwindow_id].predefinedMessages == 'undefined') {
                bNewWindow = true;
                var class_to_code = this.getSmileyClassToCodeTable();

                var html = '';
                html += "<div style='width:300px'>";

                if (this.notifqueue.game !== null) {
                    if (chatwindow_id.substr(0, 6) == 'table_') {
                        // For game interface, adding predefined messages
                        for (var code in this.predefinedTextMessages) {

                            if( code=='tbleave' && dojo.hasClass( 'ebd-body', 'playmode_realtime'))
                            {
                                // Skip it (turn based only message)
                            }
                            else
                            {

                                html +=
                                "<p class='predefined_textmessage' id='predefined_textmessage_" +
                                chatwindow_id +
                                '-' +
                                code +
                                "'>" +
                                __('lang_mainsite', this.predefinedTextMessages[code]) +
                                '</p>';

                            }
                        }

                        html += '<hr/>';
                    }
                }

                for (var iconclass in class_to_code) {
                    html +=
                        "<div class='predefined_message' id='predefined_message_" +
                        chatwindow_id +
                        '-' +
                        iconclass +
                        "'>";
                    html += this.addSmileyToText(class_to_code[iconclass]);
                    html += '</div>';
                }

                html += '</div>';

                this.chatbarWindows[chatwindow_id].predefinedMessages = new dijit.TooltipDialog({
                    id: 'predefinedMessages_' + chatwindow_id,
                    content: html,
                    closable: true,
                });

                var orient = { BL: 'TL', TL: 'BL' };

                this.chatbarWindows[chatwindow_id].predefinedMessagesOpen = false;
            }

            if (this.chatbarWindows[chatwindow_id].predefinedMessagesOpen == false) {
                this.chatbarWindows[chatwindow_id].predefinedMessagesOpen = true;

                dijit.popup.open({
                    popup: this.chatbarWindows[chatwindow_id].predefinedMessages,
                    around: $(anchor),
                    orient: ['after-centered', 'after', 'below', 'below-alt', 'above', 'above-alt'],
                });
            } else {
                this.chatbarWindows[chatwindow_id].predefinedMessagesOpen = false;
                dijit.popup.close(this.chatbarWindows[chatwindow_id].predefinedMessages);
            }

            var bMobile = dojo.hasClass('ebd-body', 'mobile_version');
            dojo.style('chatbarinput_predefined_' + chatwindow_id + '_dropdown', 'zIndex', bMobile ? 10510 : 1051); // 1051 : same zindex that dockedchat (see 7_dockedchat.css) (+ above everything on mobile)

            if (bNewWindow) {
                dojo.query('#chatbarinput_predefined_' + chatwindow_id + '_dropdown .predefined_message').connect(
                    'onclick',
                    this,
                    'onInsertPredefinedMessage'
                );
                dojo.query('#chatbarinput_predefined_' + chatwindow_id + '_dropdown .predefined_textmessage').connect(
                    'onclick',
                    this,
                    'onInsertPredefinedTextMessage'
                );
            }
        },

        onInsertPredefinedMessage: function (evt) {
            // predefined_message_"+chatwindow_id+'_'+iconclass
            var id = evt.currentTarget.id.substr(19);
            var parts = id.split('-');
            var chatwindow_id = parts[0];
            var code = parts[1];
            var class_to_code = this.getSmileyClassToCodeTable();

            this.chatbarWindows[chatwindow_id].input.addContentToInput(class_to_code[code]);
            $('chatbarinput_' + chatwindow_id + '_input').focus();

            this.chatbarWindows[chatwindow_id].predefinedMessagesOpen = false;
            dijit.popup.close(this.chatbarWindows[chatwindow_id].predefinedMessages);
        },
        onInsertPredefinedTextMessage: function (evt) {
            // predefined_textmessage_"+chatwindow_id+'_'+iconclass
            var id = evt.currentTarget.id.substr(23);
            var parts = id.split('-');
            var chatwindow_id = parts[0];
            var code = parts[1];
            var text = this.predefinedTextMessages[code];

            this.chatbarWindows[chatwindow_id].input.addContentToInput(text);
            $('chatbarinput_' + chatwindow_id + '_input').focus();

            if (this.chatbarWindows[chatwindow_id].input.input_div.value == text) {
                // Placed text is the only message
                // => immediately send the message !
                this.chatbarWindows[chatwindow_id].input.sendMessage();
            }

            this.chatbarWindows[chatwindow_id].predefinedMessagesOpen = false;
            dijit.popup.close(this.chatbarWindows[chatwindow_id].predefinedMessages);
        },

        // Initial setup of groups
        setGroupList: function (groups, all_groups, red_thumbs_given, red_thumbs_taken) {
            this.groupList = groups;
            this.red_thumbs_given = {};
            this.red_thumbs_taken = {};

            if (typeof all_groups != 'undefined') {
                this.allGroupList = all_groups;
            }
            if (typeof red_thumbs_given != 'undefined' && typeof red_thumbs_given == 'object') {
                this.red_thumbs_given = red_thumbs_given;
            } else {
                this.red_thumbs_given = {};
            }
            if (typeof red_thumbs_taken != 'undefined' && typeof red_thumbs_taken == 'object') {
                this.red_thumbs_taken = red_thumbs_taken;
            } else {
                this.red_thumbs_taken = {};
            }

            if (!this.bChatDetached) {
                var channels = {};

                for (var group_id in groups) {
                    channels[group_id] = '/group/g' + group_id;
                }

                this.groupToCometdSubs = this.subscribeCometdChannels(channels, this.notifqueue, 'onNotification');
            }
        },

        // Initial setup of spoken languages
        setLanguagesList: function (all_lang) {
            this.allLanguagesList = all_lang;
        },

        // Initial setup of pma
        setPma: function (pma) {
            this.pma = pma;
        },

        // Initial setup of RTC mode
        setRtcMode: function (rtc_mode, rtc_room) {
            this.rtc_mode = rtc_mode;
            this.rtc_room = rtc_room;
        },

        takeIntoAccountAndroidIosRequestDesktopWebsite: function (d) {
            //quick dookie checker
            function C(k) {
                return (d.cookie.match('(^|; )' + k + '=([^;]*)') || 0)[2];
            }

            var ua = navigator.userAgent, //get the user agent string
                ismobile = / mobile/i.test(ua), //android and firefox mobile both use android in their UA, and both remove it from the UA in their "pretend desktop mode"
                mgecko = !!(/ gecko/i.test(ua) && / firefox\//i.test(ua)), //test for firefox
                wasmobile = C('wasmobile') === 'was', //save the fact that the browser once claimed to be mobile
                desktopvp = 'user-scalable=yes, maximum-scale=2',
                el;

            if (ismobile && !wasmobile) {
                d.cookie = 'wasmobile=was'; //if the browser claims to be mobile and doesn't yet have a session cookie saying so, set it
            } else if (!ismobile && wasmobile) {
                //if the browser once claimed to be mobile but has stopped doing so, change the viewport tag to allow scaling and then to max out at whatever makes sense for your site (could use an ideal max-width if there is one)
                if (mgecko) {
                    el = d.createElement('meta');
                    el.setAttribute('content', desktopvp);
                    el.setAttribute('name', 'viewport');
                    d.getElementsByTagName('head')[0].appendChild(el);
                } else {
                    if (typeof d.getElementsByName('viewport')[0] == 'undefined') {
                        // Error, do nothing (ignore the feature)
                    } else {
                        d.getElementsByName('viewport')[0].setAttribute('content', desktopvp); //if not Gecko, we can just update the value directly
                    }
                }
            }
        },

        traceLoadingPerformances: function () {
            if (window.performance) {
                if (window.performance.getEntries) {
                    var perfs = window.performance.getEntries();
                    console.log(perfs);
                    var perfs_by_domain = {};

                    for (var i in perfs) {
                        var perfitem = perfs[i];
                        var domain = extractDomain(perfitem['name']);

                        if (typeof perfs_by_domain[domain] == 'undefined') {
                            perfs_by_domain[domain] = {
                                nb: 1,
                                max: perfitem['duration'],
                                total: perfitem['duration'],
                            };
                        } else {
                            perfs_by_domain[domain].nb++;
                            perfs_by_domain[domain].max = Math.max(perfs_by_domain[domain].max, perfitem['duration']);
                            perfs_by_domain[domain].total += perfitem['duration'];
                        }
                    }

                    for (var i in perfs_by_domain) {
                        perfs_by_domain[i].avg = Math.round(perfs_by_domain[i].total / perfs_by_domain[i].nb);
                        perfs_by_domain[i].total = Math.round(perfs_by_domain[i].total);
                        perfs_by_domain[i].max = Math.round(perfs_by_domain[i].max);
                    }

                    this.ajaxcall(
                        '/table/table/perfs.html',
                        { perfs: dojo.toJson(perfs_by_domain) },
                        this,
                        function (result) {},
                        function (is_error) {},
                        'post'
                    );
                }
            }
        },

        getCurrentPlayerId: function () {
            if (typeof current_player_id != 'undefined') {
                // (MS)
                return current_player_id;
            } else {
                // (GS)
                return this.player_id;
            }
        },

        ///////////////////////////////////////////////////////
        // Mainsite tutorial management

        // Return true if we haven't seen this tutorial before
        // Return false if we have
        // If we don't have seen it, mark it as "seen" and update it as "seen" on server side too.
        // DEPRECATED, use svelte store 'createCueSeenStore' now
        tutorialShowOnce: function (tutorial_id, bMarkAsSeen) {
            if (typeof bMarkAsSeen == 'undefined') {
                bMarkAsSeen = true;
            }

            if (typeof current_player_id != 'undefined') {
                // (MS)
                // We do not show tutorial to visitors
                if (toint(current_player_id) < 0) {
                    return false;
                }
            } else {
                // (GS)
                // We do not show tutorial to spectators
                if (this.isSpectator) {
                    return false;
                }
            }

            if (tutorial_id < 0 || tutorial_id >= 256) {
                console.error('Invalid tutorial id: ' + tutorial_id);
                return false;
            } else {
                // Valid tutorial id

                var section = Math.floor(tutorial_id / 64);
                var bit_nbr = tutorial_id % 64;
                var place = 1 << bit_nbr;

                if (typeof this.tutorial != 'undefined') {
                    // MS
                    var tutorial = this.tutorial;
                } else {
                    // GS
                    var tutorial = this.metasite_tutorial;
                }
                if (tutorial[section] & place) {
                    // Never seen

                    if (bMarkAsSeen) {
                        // Mark as seen locally
                        tutorial[section] = tutorial[section] & ~place;
                        this.ajaxcall('/table/table/markTutorialAsSeen.html', { id: tutorial_id }, this, function (
                            result
                        ) {});
                    }

                    return true;
                } else {
                    // Already seen
                    return false;
                }
            }
        },

        highligthElementwaitForPopinToClose: function () {
            if (dojo.query('.standard_popin').length > 0) {
                setTimeout(dojo.hitch(this, 'highligthElementwaitForPopinToClose'), 1000);
            } else {
                this.bHighlightPopinTimeoutInProgress = false;

                // No more popin: we can go!
                this.onElementTutorialNext();
            }
        },

        highlightElementTutorial: function (element_id, text, optional_additional_class) {
            if (typeof optional_additional_class == 'undefined') {
                optional_additional_class = '';
            }

            if ($('tutorial-overlay')) {
                // An element is already highlighted => queue this one

                this.tutorialHighlightedQueue.push({
                    id: element_id,
                    text: text,
                    optclass: optional_additional_class,
                });
            } else if (dojo.query('.standard_popin').length > 0) {
                // A popin dialog is in the way => waiting from the popin to close

                this.tutorialHighlightedQueue.push({
                    id: element_id,
                    text: text,
                    optclass: optional_additional_class,
                });

                if (
                    typeof this.bHighlightPopinTimeoutInProgress == 'undefined' ||
                    this.bHighlightPopinTimeoutInProgress == false
                ) {
                    this.highligthElementwaitForPopinToClose();
                    this.bHighlightPopinTimeoutInProgress = true;
                }
            } else {
                // place overlay only when needed else it will block the whole page
                dojo.place('<div id="tutorial-overlay" class="tutorial-overlay"></div>', 'ebd-body', 'first');
                dojo.connect($('tutorial-overlay'), 'onclick', this, 'onElementTutorialNext');

                // IMPORTANT: the highlighting of the element is not going to work if any of the parent of the given element has
                //  a "z-index" property defined

                var fadeInArgs = {
                    node: 'tutorial-overlay',
                    duration: 1000, // Note: must be long enough so the "smooth" scroll is over. Otherwise the tooltip may be out of the screen
                };

                // callback on end of fadeIn :
                // trigger fadeOut then on end of fadeOut
                // remove overlay and class to put div on top
                var _this = this;
                this.highlightFadeInInProgress = true;
                fadeInArgs.onEnd = dojo.hitch(this, function () {
                    this.highlightFadeInInProgress = false;
                    if ($('newArchiveComment')) {
                        dojo.destroy('newArchiveComment');
                    }
                    if (dijit.byId('currentTutorialDialog')) {
                        dijit.byId('currentTutorialDialog').destroy();
                    }

                    var html =
                        "<div id='newArchiveComment' class='newArchiveComment'>\
                                    <div class='archiveComment_before'><p class='archiveComment_before_inner'><i class='fa fa-graduation-cap'></i></p></div>\
                                    <div id='newArchiveCommentTextDisplay'>" +
                        this.applyCommentMarkup(text) +
                        "</div>\
                                    <div id='newArchiveCommentDisplayControls'>" +
                        "<a href='#' id='newArchiveCommentNext' class='bgabutton bgabutton_blue'>" +
                        __('lang_mainsite', 'Continue') +
                        '</a>\
                                    </div>\
                                </div>';

                    this.currentTutorialDialog = new dijit.TooltipDialog({
                        id: 'currentTutorialDialog',
                        content: html,
                        closable: true,
                    });

                    if (element_id !== null && $(element_id)) {
                        dijit.popup.open({
                            popup: this.currentTutorialDialog,
                            around: $(element_id),
                            orient: ['below', 'above', 'after', 'before'],
                        });
                    } else {
                        // Screen center
                        var whole_screen = dojo.position('ebd-body');

                        var centered_x = whole_screen.w / 2 - 430 / 2;

                        dijit.popup.open({
                            popup: this.currentTutorialDialog,
                            x: centered_x,
                            y: 180,
                            orient: ['below', 'above', 'after', 'before'],
                        });

                        dojo.query('.dijitTooltipConnector').style('display', 'none');
                    }

                    if ($('newArchiveCommentNext')) {
                        dojo.connect($('newArchiveCommentNext'), 'onclick', _this, 'onElementTutorialNext');
                    }
                });

                if (element_id != null) {
                    // The element must be inside the current view
                    var screen = dojo.window.getBox();
                    var element_coords = dojo.position(element_id);

                    var bScrollingIsNotGood = false;
                    if (element_coords.y < 0) {
                        // Element is above current scrolling
                        bScrollingIsNotGood = true;
                    } else if (element_coords.y + element_coords.h > screen.h) {
                        bScrollingIsNotGood = true;
                    }

                    if (bScrollingIsNotGood) {
                        window.scrollBy({
                            top: element_coords.y - 200,
                            behavior: 'smooth',
                        });
                    }

                    dojo.addClass(element_id, 'above-overlay');
                    this.current_hightlighted_additional_class = optional_additional_class;
                    if (optional_additional_class != '') {
                        dojo.addClass(element_id, optional_additional_class);
                    }

                    if (dojo.style(element_id, 'position') == 'static') {
                        // The z-index is not going to work if we do not add the "relative" position
                        dojo.addClass(element_id, 'above-overlay-relative');
                    }
                }

                dojo.fadeIn(fadeInArgs).play();
            }
        },

        onElementTutorialNext: function (evt) {
            if (typeof evt != 'undefined') {
                dojo.stopEvent(evt);
            }

            if (typeof this.highlightFadeInInProgress != 'undefined' && this.highlightFadeInInProgress) {
                // A fadein (or fadeout) is already in progress, so do not do anything
                return;
            }

            if (this.currentTutorialDialog !== null) {
                dijit.popup.close(this.currentTutorialDialog);
                this.currentTutorialDialog = null;
            }

            if ($('tutorial-overlay')) {
                var fadeOutArgs = {
                    node: 'tutorial-overlay',
                    duration: 500,
                };

                this.highlightFadeInInProgress = true;

                fadeOutArgs.onEnd = dojo.hitch(this, function () {
                    this.highlightFadeInInProgress = false;

                    dojo.destroy('tutorial-overlay');
                    if (this.current_hightlighted_additional_class != '') {
                        dojo.query('.above-overlay').removeClass(this.current_hightlighted_additional_class);
                    }

                    dojo.query('.above-overlay').removeClass('above-overlay');
                    dojo.query('.above-overlay-relative').removeClass('above-overlay-relative');

                    if (this.tutorialHighlightedQueue.length > 0) {
                        var next = this.tutorialHighlightedQueue.shift();

                        this.highlightElementTutorial(next.id, next.text, next.optclass);
                    }
                });

                dojo.fadeOut(fadeOutArgs).play();
            } else {
                if (this.tutorialHighlightedQueue.length > 0) {
                    var next = this.tutorialHighlightedQueue.shift();

                    this.highlightElementTutorial(next.id, next.text, next.optclass);
                }
            }
        },

        websiteWindowVisibilityChange: function (evt) {
            var hidden = 'hidden';
            var v = 'visible',
                h = 'hidden',
                evtMap = {
                    focus: v,
                    focusin: v,
                    pageshow: v,
                    blur: h,
                    focusout: h,
                    pagehide: h,
                };

            evt = evt || window.event;
            if (evt.type in evtMap) {
                this.window_visibility = evtMap[evt.type];
            } else {
                this.window_visibility = document[hidden] ? 'hidden' : 'visible';
            }

            // DEPRECATED: we not more ACK messages when they are "visible": we ACK messages when there is an interaction with the chat window.
            //            if( this.window_visibility == 'visible' && this.msg_to_ack_when_visible.length > 0 )
            //            {
            //                // ACK the chatmessages that were hidden
            //                this.ajaxcall( '/table/table/chatack.html', {  list:this.msg_to_ack_when_visible.join(';')  }, this, function( result ) {
            //                }, function( is_error) {}, 'get'  );
            //
            //                this.msg_to_ack_when_visible = [];
            //            }
        },

        ackUnreadMessage: function (chatwindow_id, option) {
            var chatwindow_type = chatwindow_id.split('_')[0];
            var chatwindow_type_id = chatwindow_id.split('_')[1];

            // Option to force to unsubscribe to channel while ACK for the latest messages read
            // (used to leave table chat after games)
            var bUnsub = false;
            if (typeof option != 'undefined' && option == 'unsub') {
                if (chatwindow_type == 'table') {
                    bUnsub = true;
                }
            }

            if (chatwindow_type == 'privatechat' || chatwindow_type == 'table') {
                if (dojo.query('#chatwindowlogs_zone_' + chatwindow_id + ' .newmessage').length > 0 || bUnsub) {
                    // Get the ID of all the newmessage(s)

                    var msg_ids = [];
                    dojo.query('#chatwindowlogs_zone_' + chatwindow_id + ' .newmessage .roundedboxinner').forEach(
                        function (node) {
                            // newmessage_X_<id>
                            msg_ids.push(node.id.substr(13));
                        }
                    );

                    if (chatwindow_type == 'privatechat') {
                        // We ACK messages because the messages has been seen (using the "popup" feature)
                        var other_player_id = chatwindow_type_id;
                        this.ackMessagesWithPlayer(other_player_id, msg_ids);
                    } else if (chatwindow_type == 'table') {
                        var table_id = chatwindow_type_id;
                        this.ackMessagesOnTable(table_id, msg_ids, bUnsub);
                    }

                    dojo.query('#chatwindowlogs_zone_' + chatwindow_id + ' .newmessage').removeClass('newmessage');
                }
            }
        },

        ackMessagesWithPlayer: function (player_id, msg_ids) {
            this.ajaxcall(
                '/table/table/chatack.html',
                { player: player_id, list: msg_ids.join(';') },
                this,
                function (result) {
                    svelte.stores.discussions.ackMessagesWithPlayer( player_id );
                },
                function (is_error) {},
                'get'
            );
        },
        ackMessagesOnTable: function (table_id, msg_ids, bUnsub) {
            var args = { table: table_id, list: msg_ids.join(';') };

            if (bUnsub) {
                args.bUnsub = bUnsub;
            }

            this.ajaxcall(
                '/table/table/chatack.html',
                args,
                this,
                function (result) {},
                function (is_error) {},
                'get'
            );
        },
        // Receive a signal that a player has received one of our private message
        onAckMsg: function (notif) {
            for (var i in notif.args.msgs) {
                var msg_id = notif.args.msgs[i];

                if ($('privmsg_read_' + msg_id)) {
                    dojo.removeClass('privmsg_read_' + msg_id, 'message_unread');
                    dojo.addClass('privmsg_read_' + msg_id, 'message_read');
                }
            }
        },

        initMonitoringWindowVisibilityChange: function () {
            // Check if window is on
            var hidden = 'hidden';

            // Standards:
            if (hidden in document) {
                dojo.connect(document, 'visibilitychange', this, 'websiteWindowVisibilityChange');
            } else if ((hidden = 'mozHidden') in document) {
                dojo.connect(document, 'mozvisibilitychange', this, 'websiteWindowVisibilityChange');
            } else if ((hidden = 'webkitHidden') in document) {
                dojo.connect(document, 'webkitvisibilitychange', this, 'websiteWindowVisibilityChange');
            } else if ((hidden = 'msHidden') in document) {
                dojo.connect(document, 'msvisibilitychange', this, 'websiteWindowVisibilityChange');
            } // IE 9 and lower:
            else if ('onfocusin' in document) {
                dojo.connect(document, 'onfocusin', this, 'websiteWindowVisibilityChange');
                dojo.connect(document, 'onfocusout', this, 'websiteWindowVisibilityChange');
            } else {
                dojo.connect(window, 'onpageshow', this, 'websiteWindowVisibilityChange');
                dojo.connect(window, 'onpagehide', this, 'websiteWindowVisibilityChange');
                dojo.connect(window, 'onfocus', this, 'websiteWindowVisibilityChange');
                dojo.connect(window, 'onblur', this, 'websiteWindowVisibilityChange');
            }

            // set the initial state (but only if browser supports the Page Visibility API)
            if (document[hidden] !== undefined) {
                this.websiteWindowVisibilityChange({ type: document[hidden] ? 'blur' : 'focus' });
            }
        },

        playingHoursToLocal: function (playingHoursString, bArrayResult) {
            if (playingHoursString.indexOf(':00') == -1) {
                return playingHoursString;
            } // Format is invalid

            var cet_time = toint(playingHoursString.substr(0, playingHoursString.indexOf(':')));

            var local_time = cet_time + this.timezoneDelta;

            if (typeof bArrayResult != 'undefined' && bArrayResult) {
                return {
                    start_hour: (local_time % 24) + ':00',
                    end_hour: ((local_time + 12) % 24) + ':00',
                };
            } else {
                return (local_time % 24) + ':00 &rarr; ' + ((local_time + 12) % 24) + ':00';
            }
        },

        showSplashedPlayerNotifications: function (notifs) {
            console.log('showSplashedPlayerNotifications');
            console.log(notifs);

            if (typeof this.splashNotifToDisplay == 'undefined') {
                this.splashNotifToDisplay = [];
            }

            for (var i in notifs) {
                var notif = notifs[i];

                if ($('splash_trophy_' + notif.id)) {
                    // This splash notif is displayed at now already => no need to push it again
                } else {
                    this.splashNotifToDisplay.push(notif);
                }
            }

            if (dojo.style('splashedNotifications_overlay', 'display') == 'none') {
                // No notif display at now => launch the display!
                this.displayNextSplashNotif();
            } else {
                // A notif is displayed at now => displayNextSplashNotif will be trigger on the next "Continue"
            }
        },

        displayNextSplashNotif: function () {
            var notif = this.splashNotifToDisplay.shift();
            console.log(notif);

            var nbr_remaining = this.splashNotifToDisplay.length;

            if (typeof notif == 'undefined') {
                dojo.fadeOut({
                    node: 'splashedNotifications_overlay',
                    duration: 500,
                    onEnd: function () {
                        dojo.style('splashedNotifications_overlay', 'display', 'none');
                    },
                }).play();

                return;
            }

            if (this.splashNotifRead) {
                if (this.splashNotifRead[notif.id]) {
                    // This one has been read already => skip it
                    this.displayNextSplashNotif();
                    return;
                }
            }

            //alert( 'displaying '+notif.id);

            // There is at least a notif to splash

            var delay_before_anim = 500;

            if (dojo.style('splashedNotifications_overlay', 'display') == 'none') {
                // Display the overlay

                dojo.style('splashedNotifications_overlay', 'display', 'block');

                dojo.fadeIn({
                    node: 'splashedNotifications_overlay',
                    duration: 1000,
                }).play();
                delay_before_anim = 1000;
            }

            if (
                toint(notif.news_type) == 16 ||
                toint(notif.news_type) == 21 ||
                toint(notif.news_type) == 17 ||
                toint(notif.news_type) == 30
            ) {
                // new trophy received!
                // Animation to show the winning trophy

                var award_type_id = notif.args[3];

                if (toint(award_type_id) > 1000) {
                    var tgroup = notif.args[17];
                    var prestigeclass = notif.args[18];

                    // Tournament trophy
                    notif.base_img = getStaticAssetUrl('img/awards/' + award_type_id + '_' + prestigeclass + '.png');

                    var armsdir = Math.floor(tgroup / 1000);
                    notif.addimg =
                        '<img src="' +
                        g_themeurl +
                        '../../data/grouparms/' +
                        armsdir +
                        '/group_' +
                        tgroup +
                        '.png?h=t' +
                        '"/>';

                    notif.trophy_name =
                        notif.jargs.championship_name +
                        ' ' +
                        notif.jargs.tournament_name +
                        ': ' +
                        __('lang_mainsite', notif.trophy_name);
                } else {
                    notif.base_img = getStaticAssetUrl('img/awards/' + award_type_id + '.png');
                    notif.addimg = '';
                    notif.trophy_name = __('lang_mainsite', notif.trophy_name);
                    notif.trophy_name = notif.trophy_name.replace('%s', format_number(notif.trophy_name_arg));
                    notif.trophy_descr = __('lang_mainsite', notif.trophy_descr);
                    notif.trophy_descr = notif.trophy_descr.replace('%s', format_number(notif.trophy_name_arg));
                }

                notif.shadow_img = getStaticAssetUrl('img/awards/award_shadow.png');

                notif.game_name = '';
                if (typeof notif.jargs.game_name != 'undefined') {
                    notif.game_name = __('lang_mainsite', notif.jargs.game_name + '_displayed');
                    notif.trophy_descr = ''; // Note: no space to put the game name + the description
                } else {
                    // When game name is not defined, we display description
                }

                notif.continuelbl = __('lang_mainsite', 'Continue');
                notif.prestige = format_number(notif.args[16]);

                if (nbr_remaining > 0) {
                    notif.skiplbl = dojo.string.substitute(_('Skip ${nbr} more'), { nbr: nbr_remaining });
                } else {
                    notif.skiplbl = '';
                }

                var jstpl_newTrophyWin =
                    '<div id="splash_trophy_${id}" class="splash_block">\
                        <div id="splash_background_${id}" class="splash_background"></div>\
                        <div id="splash_central_${id}" class="splash_central">\
                            <div class="trophyimg_wrap">\
                                <div id="splash_trophy_imgwrap_${id}" class="trophyimg_image">\
                                    <img class="trophyimg_shadow"  src=\'${shadow_img}\'"></img>\
                                    <div id="splash_trophyimg_${id}" class="trophyimg trophyimg_xlarge" style="background-image: url(\'${base_img}\')">${addimg}</div>\
                                </div>\
                                <div id="trophy_prestige_${id}" class="trophy_prestige"><div class="xp_container" style="font-size:14px;">+${prestige} XP<div class="arrowback"></div><div class="arrow"></div><div class="arrowbackl"></div><div class="arrowl"></div></div></div>\
                            </div>\
                            <div class="splash_intro">' +
                    __('lang_mainsite', 'You get a new trophy') +
                    '</div>\
                            <div class="splash_gamename gamename">${game_name}</div>\
                            <div class="splash_trophyname">${trophy_name}</div>\
                            <div class="splash_descr">${trophy_descr}</div>\
                        </div>\
                        <div id="continue_btn_${id}" class="bgabutton bgabutton_always_big bgabutton_blue">${continuelbl}</div>\
                        <a id="skip_wrap_${id}" class="skip_wrap no-underline" href="#">${skiplbl}</a>\
                    </div>';

                dojo.place(dojo.string.substitute(jstpl_newTrophyWin, notif), splashedNotifications_overlay);

                dojo.style('splash_central_' + notif.id, 'opacity', 0);
                dojo.style('continue_btn_' + notif.id, 'opacity', 0);
                dojo.style('skip_wrap_' + notif.id, 'opacity', 0);
                dojo.style('splash_background_' + notif.id, 'left', '100%');
                dojo.style('trophy_prestige_' + notif.id, 'opacity', 0);

                dojo.fx
                    .chain([
                        dojo.animateProperty({
                            delay: delay_before_anim,
                            node: 'splash_background_' + notif.id,
                            properties: {
                                left: 0,
                                unit: '%',
                            },
                            onEnd: function () {
                                playSound('new_trophy');
                            },
                        }),
                        dojo.fadeIn({ node: 'splash_central_' + notif.id, duration: 700 }),
                        dojo.fadeIn({ node: 'trophy_prestige_' + notif.id, duration: 700 }),
                        dojo.fx.combine(
                            [
                                dojo.fadeIn({ node: 'continue_btn_' + notif.id, duration: 700 }),
                                dojo.fadeIn({ node: 'skip_wrap_' + notif.id, duration: 700 })
                            ]
                        )
                    ])
                    .play();

                dojo.connect($('continue_btn_' + notif.id), 'onclick', this, 'onDisplayNextSplashNotif');
                dojo.connect($('skip_wrap_' + notif.id), 'onclick', this, 'onDisplayNextSplashNotif');
            } else if (toint(notif.news_type) == 28) {
                // Animation to display Arena points win / loss

                console.log(notif);

                var game_id = notif.args[1];
                notif.game_name = __('lang_mainsite', notif.jargs.game_name + '_displayed');
                notif.continuelbl = __('lang_mainsite', 'Continue');

                var initial_points_raw = notif.args[10];
                var final_points_raw = notif.args[11];

                var initial_points = this.arenaPointsDetails(initial_points_raw / 10000, notif.jargs.league_nbr);
                var final_points = this.arenaPointsDetails(final_points_raw / 10000, notif.jargs.league_nbr);

                var jstpl_newTrophyWin =
                    '<div id="splash_trophy_${id}" class="splash_block splash_arena_points">' +
                    '<div id="splash_background_arena" class="splash_background"></div>' +
                    '<div id="splash_central_arena" class="splash_central">' +
                    '<div id="splash_trophy_imgwrap_arena" class="leagueimg_image">' +
                    '<img class="trophyimg_shadow"  src=\'${shadow_img}\'"></img>' +
                    '<div id="splash_trophyimg_arena" class="trophyimg trophyimg_xlarge" style="background-image: url(\'${base_img}\')"></div>' +
                    '</div>' +
                    '<div id="splash_arena_bar">' +
                    '</div>' +
                    '<div class="splash_intro">${game_name} ' +
                    ' ${league_name}</div>' +
                    '<div class="progressbar progressbar_arena arena_${league_id} progressbar_nolabel">' +
                    '<div id="arena_bar" class="progressbar_bar">' +
                    '<div id="progressbar_arena_width" class="progressbar_content"  style="${arenabarpcent}">' +
                    '<div id="arena_bar_container" class="arena_container">${arena_points_html}</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div id="arena_bar_bottom_infos" class="progressbar_bottom_infos">${arena_bottom_infos}</div>' +
                    '<div id="arena_world_rank_wrap" style="display:none;">' +
                    __('lang_mainsite', 'World rank') +
                    ': <span id="arena_world_rank"><i class="fa fa-spinner fa-spin" aria-hidden="true"></i></span></div>' +
                    '</div>' +
                    '<div id="continue_btn_${id}" class="bgabutton bgabutton_always_big bgabutton_blue">${continuelbl}</div>' +
                    '</div>';

                notif.shadow_img = getStaticAssetUrl('img/awards/award_shadow.png');
                notif.base_img = getStaticAssetUrl('img/awards/' + (100 + initial_points.league) + '.png');
                notif.league_name = initial_points.league_name;
                notif.league_id = initial_points.league;

                var html = this.arenaPointsHtml(initial_points);
                notif.arena_points_html = html.bar_content;
                notif.arena_bottom_infos = html.bottom_infos;
                notif.arenabarpcent = html.bar_pcent;

                //                alert( initial_points_raw );
                //                alert( final_points_raw);

                if (toint(final_points_raw) <= toint(initial_points_raw)) {
                    // We are losing points
                    var target_arena_points = final_points.points;
                    var initial_arena_points = initial_points.points;
                } else {
                    // We are gaining points
                    var target_arena_points = final_points.points;
                    var initial_arena_points = initial_points.points;

                    if (final_points.league > initial_points.league) {
                        // There is a league promotion to manage
                        target_arena_points = 10;
                    }
                }

                dojo.place(dojo.string.substitute(jstpl_newTrophyWin, notif), splashedNotifications_overlay);

                dojo.style('splash_central_arena', 'opacity', 0);
                dojo.style('continue_btn_' + notif.id, 'opacity', 0);
                dojo.style('splash_background_arena', 'left', '100%');
                //dojo.style("trophy_prestige_arena", "opacity", 0);

                var transform;
                dojo.forEach(['transform', 'WebkitTransform', 'msTransform', 'MozTransform', 'OTransform'], function (
                    name
                ) {
                    if (typeof dojo.body().style[name] != 'undefined') {
                        transform = name;
                    }
                });
                this.transform = transform;

                var animChain = [
                    dojo.animateProperty({
                        delay: delay_before_anim,
                        node: 'splash_background_arena',
                        properties: {
                            left: 0,
                            unit: '%',
                        },
                    }),
                    dojo.fadeIn({ node: 'splash_central_arena', duration: 700 }),
                ];

                if (initial_points.league == 5) {
                    // Elite league animation
                    var final_html = this.arenaPointsHtml(final_points);

                    if (final_points.arelo != initial_points.arelo) {
                        var points_variation = '';
                        if (final_points.arelo > initial_points.arelo) {
                            var diff = final_points.arelo - initial_points.arelo;
                            points_variation = '+' + Math.round(diff) + ' ' + __('lang_mainsite', 'points');
                        } else {
                            var diff = final_points.arelo - initial_points.arelo;
                            points_variation = Math.round(diff) + ' ' + __('lang_mainsite', 'points');
                        }

                        var anim = new dojo.Animation({
                            curve: [initial_points.arelo, final_points.arelo],
                            duration: 1000,
                            onBegin: function () {
                                playSound('elochange');
                            },
                            onAnimate: dojo.hitch(this, function (v) {
                                $('arena_bar_container').innerHTML = Math.round(v) + ' ' + __('lang_mainsite', 'points');

                                var bar_width =
                                    html.bar_pcent_number +
                                    ((final_html.bar_pcent_number - html.bar_pcent_number) *
                                        (v - initial_points.arelo)) /
                                        (final_points.arelo - initial_points.arelo);
                                $('progressbar_arena_width').style['width'] = bar_width + '%';
                            }),
                            onEnd: function () {
                                $('arena_bar').innerHTML +=
                                    '<div class="arena_container_bar_details">' + points_variation + '</div>';
                            },
                        });

                        animChain.push(anim);
                    }

                    var animArgs = {
                        transform: transform,
                        node: $('arena_world_rank_wrap'),
                    };

                    var anim = new dojo.Animation({
                        curve: [20, 1],
                        delay: 300,
                        onBegin: dojo.hitch(animArgs, function () {
                            dojo.style('arena_world_rank_wrap', 'display', 'block');
                        }),
                        onAnimate: dojo.hitch(animArgs, function (v) {
                            this.node.style[this.transform] = 'scale(' + v + ')';
                        }),
                        onEnd: function () {
                            playSound('gain_arena');
                        },
                        duration: 500,
                    });

                    animChain.push(anim);

                    this.ajaxcall(
                        '/lobby/lobby/getArenaWorldRank.html',
                        { game: game_id, arelo: final_points.arelo },
                        this,
                        dojo.hitch(this, function (result) {
                            $('arena_world_rank').innerHTML = this.getRankString(result.rank);
                        })
                    );
                }
                if (target_arena_points > initial_arena_points) {
                    // Here, we must start adding the additional Arena points
                    if (soundManager.loadSound) {
                        soundManager.loadSound('gain_arena'); // Preloading the sound
                    }

                    for (var i = initial_arena_points; i < target_arena_points; i++) {
                        dojo.query('.arena_point_wrap_' + i + ' .arena_shadow').style('opacity', 1);

                        var point_node = dojo.query('.arena_point_wrap_' + i + ' .arena_colored')[0];
                        var animArgs = {
                            transform: transform,
                            node: point_node,
                        };

                        var anim = new dojo.Animation({
                            curve: [20, 1],
                            onBegin: dojo.hitch(animArgs, function () {
                                this.node.style['opacity'] = 1;
                            }),
                            onAnimate: dojo.hitch(animArgs, function (v) {
                                this.node.style[this.transform] = 'scale(' + v + ')';
                            }),
                            onEnd: function () {
                                playSound('gain_arena');

                                var remain_points = dojo.query('.splash_block .remain_arena_points')[0];
                                if (remain_points) {
                                    remain_points.innerHTML = toint(remain_points.innerHTML) - 1;

                                    if (toint(remain_points.innerHTML) == 0) {
                                        dojo.query('.progressbar_bottom_infos')[0].innerHTML =
                                            '<i class="fa fa-check"></i> ' + __('lang_mainsite', 'Completed!');
                                    }
                                }
                            },
                            duration: 500,
                        });

                        animChain.push(anim);
                    }
                } else if (target_arena_points < initial_arena_points) {
                    // Here, we must start losing Arena points
                    if (soundManager.loadSound) {
                        soundManager.loadSound('lose_arena'); // Preloading the sound
                    }

                    for (var i = initial_arena_points; i > target_arena_points; i--) {
                        dojo.query('.arena_point_wrap_' + (i - 1) + ' .arena_white').style('opacity', 1);
                        dojo.query('.arena_point_wrap_' + (i - 1) + ' .arena_shadow').style('opacity', 0);

                        var point_node = dojo.query('.arena_point_wrap_' + (i - 1) + ' .arena_colored')[0];
                        var anim = this.slideToObjectPos(point_node, point_node.parentNode, 0, 500);
                        dojo.connect(anim, 'onEnd', function (node) {
                            dojo.destroy(node);
                            playSound('lose_arena');

                            var remain_points = dojo.query('.splash_block .remain_arena_points')[0];
                            if (remain_points) {
                                remain_points.innerHTML = toint(remain_points.innerHTML) + 1;
                            }
                        });

                        animChain.push(anim);
                    }
                }

                animChain.push(
                    dojo.fadeIn({
                        node: 'continue_btn_' + notif.id,
                        duration: 700,
                    })
                );
                dojo.fx.chain(animChain).play();

                dojo.connect($('continue_btn_' + notif.id), 'onclick', this, 'onDisplayNextSplashNotif');
            } else if (toint(notif.news_type) == 31) {
                dojo.style('splashedNotifications_overlay', 'display', 'none');

                var penalty_id = notif.args[20];
                setTimeout(function () {
                    gotourl('penalty?id=' + penalty_id + '&n=' + notif.id);
                }, 500);
            } else if (toint(notif.news_type) == 32) {
                dojo.style('splashedNotifications_overlay', 'display', 'none');

                var karma_limit = notif.args[21];
                setTimeout(function () {
                    gotourl('karmalimit?limit=' + karma_limit + '&n=' + notif.id);
                }, 500);
            } else {
                console.error('Unknow notification to splashed reveived: ' + notif.news_type);
                this.displayNextSplashNotif();
            }
        },

        onNewsRead: function (notif_id) {
            if ($('splash_trophy_' + notif_id)) {
                if (dojo.hasClass('splash_trophy_' + notif_id, 'to_be_destroyed')) {
                    // Already in destruction => nothing to do
                    //alert(' in destruction '+notif_id);
                } else {
                    //alert('destroying '+notif_id);
                    this.fadeOutAndDestroy('splash_trophy_' + notif_id);
                    this.displayNextSplashNotif();
                }
            } else {
                if (!this.splashNotifRead) {
                    this.splashNotifRead = {};
                }

                this.splashNotifRead[notif_id] = true; // So we can skip it in the future
            }
        },

        onDisplayNextSplashNotif: function (evt) {
            dojo.stopEvent(evt);

            var parts = evt.currentTarget.id.split('_');
            var notif_id = parts[2];

            // Signal that we've seen this
            if (parts[0] == 'continue') {
                var args = { id: notif_id };
                this.ajaxcall('/message/board/markread.html', args, this, function () {});
            } else if (parts[0] == 'skip') {
                var notif_to_mark_read = notif_id + ';';

                for (var i in this.splashNotifToDisplay) {
                    notif_to_mark_read += this.splashNotifToDisplay[i].id + ';';
                }

                this.ajaxcall('/message/board/markreads.html', { ids: notif_to_mark_read }, this, function () {});

                this.splashNotifToDisplay = [];
            }

            dojo.addClass('splash_trophy_' + notif_id, 'to_be_destroyed');
            this.fadeOutAndDestroy('splash_trophy_' + notif_id);
            this.displayNextSplashNotif();
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////:
        ////      Browser inactivity management

        inactivityTimerIncrement: function () {
            this.browser_inactivity_time += 1; // +1 minute

            if (this.browser_inactivity_time > 120 && this.bInactiveBrowser == false) {
                // 2 hours inactive
                this.bInactiveBrowser = true;

                // Close media chat if any
                if (typeof bgaConfig != 'undefined' && bgaConfig.webrtcEnabled && this.room !== null) {
                    this.doLeaveRoom(); // Ok not to have a callback as there is no immediate redirection, so this will correctly execute without being blocked by the browser because of a redirection too quickly after
                }

                // Close socketio connexion
                if (this.socket) {
                    this.socket.close();

                    this.infoDialog(
                        __('lang_mainsite', 'Please click the button below to continue.'),
                        __('lang_mainsite', 'Are you still there?'),
                        function () {
                            window.location.reload();
                        },
                        true
                    );
                }
            }
        },
        resetInactivityTimer: function () {
            this.browser_inactivity_time = 0;
        },

        onForceBrowserReload: function ( notif ) {
            var delay = Math.floor(Math.random() * notif.args.spread); // We spread the reloads randomly over the given number of seconds to avoid ddosing ourselves
            console.log('Forcing browser reload in ' + delay + ' seconds');
            setTimeout(dojo.hitch(this, 'doForceBrowserReload'), delay*1000);
        },

        doForceBrowserReload: function () {
            // Close socketio connexion
            if (this.socket) {
                this.socket.close();

                this.warningDialog(
                    __('lang_mainsite', 'Due to a BGA upgrade, we have to ask you to reload this page to continue.'),
                    function () {
                        window.location.reload();
                    }
                );
            }
        },

        // Use by admins to control if a player browser respond
        onDebugPing: function () {
            var version = '_';
            if ($('bga_release_id')) {
                version = $('bga_release_id').innerHTML;
            }

            this.ajaxcall('/table/table/debugPing.html', { bgaversion: version }, this, function (result) {});
        },

        onNewRequestToken: function ( notif ) {
            if (typeof notif.args.request_token != 'undefined' && typeof bgaConfig.requestToken != 'undefined') {
                console.log('onNewRequestToken: refreshing requestToken');
                bgaConfig.requestToken = notif.args.request_token;
            }
        },

        ///////////////////////////////////////////////////////////////////////////////////////////::
        /////////////// SOUND MUTE/VOLUME MANAGEMENT ///////////////////////////

        onMuteSound: function (playTac = true) {
            var mute = localStorage.getItem('sound_muted');

            if (mute == 1) {
                soundManager.bMuteSound = true;
                if ($('toggleSound_icon') !== null) {
                    dojo.removeClass('toggleSound_icon', 'fa-volume-up');
                    dojo.addClass('toggleSound_icon', 'fa-volume-off');
                }

                if ($('soundVolumeControl') !== null) {
                    $('soundVolumeControl').value = 0;
                }
            } else {
                soundManager.bMuteSound = false;
                if ($('toggleSound_icon') !== null) {
                    dojo.addClass('toggleSound_icon', 'fa-volume-up');
                    dojo.removeClass('toggleSound_icon', 'fa-volume-off');
                }

                if ($('soundVolumeControl') !== null) {
                    $('soundVolumeControl').value = soundManager.volume * 100;
                }
                if (playTac) {
                    playSound('tac'); // Play a sound for feedback
                }
            }
        },

        onSetSoundVolume: function (playTac = true) {
            var volume = localStorage.getItem('sound_volume');

            soundManager.volume = volume / 100; // audio tag volume range 0.0–1.0

            this.onMuteSound(playTac);
        },

        onToggleSound: function (evt) {
            evt.preventDefault();
            svelte.stores.userVolume.update((vol) => {
                vol.volumeMuted = !vol.volumeMuted
                return vol
            })
        },

        onDisplaySoundControls: function (evt) {
            clearTimeout(this.hideSoundControlsTimer);
            this.displaySoundControlsTimer = setTimeout(dojo.hitch(this, 'displaySoundControls'), 200);
        },

        displaySoundControls: function (evt) {
            // Display sound controls
            if (dojo.hasClass('soundControls', 'soundControlsHidden')) {
                dojo.removeClass('soundControls', 'soundControlsHidden');
            }
        },

        onHideSoundControls: function (evt) {
            clearTimeout(this.displaySoundControlsTimer);
            this.hideSoundControlsTimer = setTimeout(dojo.hitch(this, 'hideSoundControls'), 200);
        },

        hideSoundControls: function () {
            // Hide sound controls
            if ($('soundControls') !== null &&
                !dojo.hasClass('soundControls', 'stickySoundControls') &&
                !dojo.hasClass('soundControls', 'soundControlsHidden')
            ) {
                dojo.addClass('soundControls', 'soundControlsHidden');
            }
        },

        onStickSoundControls: function (evt) {
            clearTimeout(this.hideSoundControlsTimer);
        },

        onUnstickSoundControls: function (evt) {
            this.onHideSoundControls(evt);
        },

        onSoundVolumeControl: function (evt) {

            if ($('soundVolumeControl') !== null) {
                var volume = $('soundVolumeControl').value;
                $('soundVolumeControl').blur(); // We don't want the slider to keep the focus as moving the slider otherwise than with the mouse is not managed
                svelte.stores.userVolume.update((vol) => {
                    vol.volume = +volume
                    return vol
                })
                    //this.ajaxcall('/web/test/volume.html', {toggle:false,volume:volume}, this, function (result) {});
            }
        },

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////// GAMES AND MEDIA CHAT EVALUATION/RATING FRAMEWORK ///////////////////////////////////////////////////////////

        displayRatingContent: function (type, rating) {
            // Starting point of the game evaluation phase: show the 5 stars rating dialog to evaluation the game

            this.rating_step1 = new ebg.popindialog();
            this.rating_step1.create('rating_step1');

            if (type == 'video') {
                this.rating_step1.setTitle(__('lang_mainsite', 'Rate this BGA video chat'));
            } else if (type == 'audio') {
                this.rating_step1.setTitle(__('lang_mainsite', 'Rate this BGA audio chat'));
            } else if (type == 'support') {
                this.rating_step1.setTitle(__('lang_mainsite', 'Rate your conversation with BGA'));
            } else {
                this.rating_step1.setTitle(__('lang_mainsite', 'Rate this BGA game adaptation'));
            }

            this.playerRating = rating;

            var html = "<div id='rating_step1'>";
            html += '<div class="stars_list">';
            if (type == 'support') {
                html += '<a href="#" id="rating_1" class="fa fa-5x rating_star">&#128544;</a> ';
                html += '<a href="#" id="rating_2" class="fa fa-5x rating_star">&#128577;</a> ';
                html += '<a href="#" id="rating_3" class="fa fa-5x rating_star">&#128528;</a> ';
                html += '<a href="#" id="rating_4" class="fa fa-5x rating_star">&#128515;</a> ';
                html += '<a href="#" id="rating_5" class="fa fa-5x rating_star">&#129321;</a> ';
            } else {
                for (var i = 1; i <= 5; i++) {
                    html += '<i id="rating_' + i + '" class="fa fa-star-o fa-5x rating_star"></i>';
                }
            }
            html += '</div>';

            html += '<div id="rating_explanation">&nbsp;</div>';

            html += "<div id='rating_skip'>";
            if (type == 'support') {
                html +=
                    "<a href='#' class='bgabutton bgabutton_blue' id='confirm_rating'>" +
                    __('lang_mainsite', 'Confirm') +
                    '</a>';
            } else {
                html +=
                    "<a href='#' class='bgabutton bgabutton_gray' id='skip_rating'>" +
                    __('lang_mainsite', 'Skip') +
                    '</a>';
            }
            html += '</div>';

            html += '</div>';

            this.rating_step1.setContent(html);
            this.rating_step1.show();

            var ratingEnterListener = 'onGameRatingEnter';
            if (type === 'video') {
                ratingEnterListener = 'onVideoRatingEnter';
            } else if (type === 'audio') {
                ratingEnterListener = 'onAudioRatingEnter';
            } else if (type === 'support') {
                ratingEnterListener = 'onSupportRatingEnter';
            }

            if (type !== 'support') {
                dojo.query('.rating_star').connect('onmouseenter', this, ratingEnterListener);
                dojo.query('.rating_star').connect('onmouseleave', this, 'onRatingLeave');
            }
            var onRatingClickListener = 'onGameRatingClick';
            if (type === 'audio') {
                onRatingClickListener = 'onAudioRatingClick';
            } else if (type === 'video') {
                onRatingClickListener = 'onVideoRatingClick';
            } else if (type === 'support') {
                onRatingClickListener = 'onSupportRatingClick';
            }
            dojo.query('.rating_star').connect('onclick', this, onRatingClickListener);

            if (type == 'support') {
                this.processRatingEnter(this.playerRating.rating, 'support');

                dojo.connect($('confirm_rating'), 'onclick', this, function () {
                    this.rating_step1.hide();
                    this.sendRating(type);

                    // We don't go further (no more steps) for the moment we just want to register the rating, not anything more.
                    // We redirect the player to the welcome page
                    // Satisfied! back to welcome with message
                    this.showMessage(_("Thanks for your feeback! Let's go back to games!"), 'info');
                    gotourl('welcome');
                });
            } else {
                dojo.connect($('skip_rating'), 'onclick', this, function () {
                    this.rating_step1.hide();
                    this.sendRating(type);
                });
            }

            // Send the rating to the server

            // If rating < 5 => try to see what's wrong
        },

        sendRating: function (type) {
            var callUri = '/table/table/rateGame.html';
            if (type == 'audio' || type == 'video') {
                this.mediaChatRating = false; // Do not ask to rate again
                callUri = '/videochat/videochat/rateChat.html';
            }
            if (type == 'support') {
                callUri = '/support/support/rateSupport.html';
            }

            this.ajaxcall(callUri, this.playerRating, this, function (result) {});
        },

        onGameRatingEnter: function (evt) {
            // rating_<i>
            var star_id = evt.currentTarget.id.substr(7);

            this.processRatingEnter(star_id, 'game');
        },

        onVideoRatingEnter: function (evt) {
            // rating_<i>
            var star_id = evt.currentTarget.id.substr(7);

            this.processRatingEnter(star_id, 'video');
        },

        onAudioRatingEnter: function (evt) {
            // rating_<i>
            var star_id = evt.currentTarget.id.substr(7);

            this.processRatingEnter(star_id, 'audio');
        },
        onSupportRatingEnter: function (evt) {
            // rating_<i>
            var star_id = evt.currentTarget.id.substr(7);

            this.processRatingEnter(star_id, 'support');
        },

        processRatingEnter: function (star_id, type) {
            if (type == 'support') {
                dojo.query('.rating_star').style('opacity', '0.5');
                dojo.style('rating_' + star_id, 'opacity', '1');
            } else {
                for (var i = 1; i <= star_id; i++) {
                    dojo.removeClass('rating_' + i, 'fa-star-o');
                    dojo.addClass('rating_' + i, 'fa-star');
                }
                for (; i <= 5; i++) {
                    dojo.removeClass('rating_' + i, 'fa-star');
                    dojo.addClass('rating_' + i, 'fa-star-o');
                }
            }

            if (toint(star_id) == 1) {
                if (type == 'game')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The game adaptation is unplayable');
                if (type == 'video')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The video chat is unusable');
                if (type == 'audio')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The audio chat is unusable');
                if (type == 'support')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'My experience has been bad. BGA should do better.'
                    );
            } else if (toint(star_id) == 2) {
                if (type == 'game')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'I can play but there are some major problems'
                    );
                if (type == 'video')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'I can use the video chat but there are some major problems'
                    );
                if (type == 'audio')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'I can use the audio chat but there are some major problems'
                    );
                if (type == 'support')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'I am disappointed, I expected a better support.'
                    );
            } else if (toint(star_id) == 3) {
                if (type == 'game')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'Acceptable but could be way better');
                if (type == 'video')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'Acceptable but could be way better');
                if (type == 'audio')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'Acceptable but could be way better');
                if (type == 'support')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'My experience has been standard. Nothing special.'
                    );
            } else if (toint(star_id) == 4) {
                if (type == 'game')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'The game adaptation is good, but some details must be fixed'
                    );
                if (type == 'video')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'The video chat is good, but some minor issues should be fixed'
                    );
                if (type == 'audio')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'The audio chat is good, but some minor issues should be fixed'
                    );
                if (type == 'support')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'Really good experience, thank you!');
            } else if (toint(star_id) == 5) {
                if (type == 'game')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The game adaptation is PERFECT');
                if (type == 'video')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The video chat is EXCELLENT');
                if (type == 'audio')
                    $('rating_explanation').innerHTML = __('lang_mainsite', 'The audio chat is EXCELLENT');
                if (type == 'support')
                    $('rating_explanation').innerHTML = __(
                        'lang_mainsite',
                        'My experience has been stellar! A big hug to the team!'
                    );
            }
        },

        onRatingLeave: function (evt) {
            var star_id = evt.currentTarget.id.substr(11);

            for (var i = 1; i <= 5; i++) {
                dojo.removeClass('rating_' + i, 'fa-star');
                dojo.addClass('rating_' + i, 'fa-star-o');
            }
            $('rating_explanation').innerHTML = '&nbsp;';
        },

        onVideoRatingClick: function (evt) {
            this.completeRatingClick(evt, 'video');
        },

        onAudioRatingClick: function (evt) {
            this.completeRatingClick(evt, 'audio');
        },

        onGameRatingClick: function (evt) {
            this.completeRatingClick(evt, 'game');
        },

        onSupportRatingClick: function (evt) {
            // rating_<i>
            var star_id = evt.currentTarget.id.substr(7);
            this.playerRating.rating = star_id;

            this.processRatingEnter(star_id, 'support');
        },

        completeRatingClick: function (evt, type) {
            console.log(evt.currentTarget.id.substr(7));
            var star_id = evt.currentTarget.id.substr(7);

            this.playerRating.rating = star_id;
            this.sendRating(type);

            this.rating_step1.hide();

            if (star_id == 5) {
                if (type === 'game') {
                    if (this.gamecanapprove) {
                        // Alpha game + reviewer with 3 games played now -> jump to step 4 (propose to approve)
                        this.showGameRatingDialog_step4();
                    } else if (this.gameisalpha) {
                        // We have a perfect rating for an alpha game but the reviewer cannot approve yet -> we stop there
                        this.showMessage(_('Thanks for your feedback!'), 'info');
                    } else {
                        // Jump to step 3
                        this.showRatingDialog_step3(type);
                    }
                } else {
                    this.showMessage(_('Thanks for your feedback!'), 'info');
                }
            } else {
                // Jump to step 2
                this.showRatingDialog_step2(type);
            }
        },

        showRatingDialog_step2: function (type) {
            // 2nd step: ask what is the main issue with the current game adaptation

            this.rating_step2 = new ebg.popindialog();
            this.rating_step2.create('rating_step2');

            this.rating_step2.setTitle(__('lang_mainsite', 'What is the main thing we must improve?'));

            var html = "<div id='rating_step2'>";

            if (type == 'game') {
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_bugs'><i class='fa fa-bug'></i> " +
                    __('lang_mainsite', 'Fix the bugs!') +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_ux'><i class='fa fa fa-hand-o-up'></i> " +
                    __('lang_mainsite', 'Improve the interface') +
                    '</a></p>';

                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_expansion'><i class='fa fa fa-puzzle-piece'></i> " +
                    __('lang_mainsite', 'Add game expansions') +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_dislike'><i class='fa fa fa-meh-o'></i> " +
                    __('lang_mainsite', 'Nothing: I just dislike the game itself') +
                    '</a></p>';
            }
            if (type == 'audio' || type == 'video') {
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_quality'><i class='fa fa-bar-chart'></i> " +
                    __('lang_mainsite', 'Audio or video quality could be better') +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_ux'><i class='fa fa fa-hand-o-up'></i> " +
                    __('lang_mainsite', 'Improve the interface') +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_someonemissing'><i class='fa fa-user-times'></i> " +
                    __('lang_mainsite', 'It worked but someone was missing') +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_didntwork'><i class='fa fa fa-bug'></i> " +
                    __('lang_mainsite', "Sorry, it didn't work at all") +
                    '</a></p>';
                html +=
                    "<p class='issue_wrap'><a href='#' class='rating_issue bgabutton bgabutton_gray' id='issue_dislike'><i class='fa fa fa-meh-o'></i> " +
                    __('lang_mainsite', 'Nothing: I just disliked the experience') +
                    '</a></p>';
            }

            html += "<div id='rating_skip'>";
            html +=
                "<a href='#' class='bgabutton bgabutton_gray' id='skip_rating_2'>" +
                __('lang_mainsite', 'Skip') +
                '</a>';
            html += '</div>';

            html += '</div>';

            this.rating_step2.setContent(html);
            this.rating_step2.show();

            var onClickIssueListener = 'onGameRatingClickIssue';
            if (type === 'audio') {
                onClickIssueListener = 'onAudioRatingClickIssue';
            } else if (type === 'video') {
                onClickIssueListener = 'onVideoRatingClickIssue';
            }

            dojo.query('.rating_issue').connect('onclick', this, onClickIssueListener);

            dojo.connect($('skip_rating_2'), 'onclick', this, function () {
                this.rating_step2.hide();
                this.sendRating(type);
                if (type === 'game') {
                    this.showMessage(_('Thanks for helping us to make this game adaptation better!'), 'info');
                } else {
                    this.showMessage(_('Thanks for helping us to make the audio/video chat better!'), 'info');
                }
            });
        },

        onAudioRatingClickIssue: function (evt) {
            this.completeRatingClickIssue(evt, 'audio');
        },

        onVideoRatingClickIssue: function (evt) {
            this.completeRatingClickIssue(evt, 'video');
        },

        onGameRatingClickIssue: function (evt) {
            this.completeRatingClickIssue(evt, 'game');
        },

        completeRatingClickIssue: function (evt, type) {
            var issue = evt.currentTarget.id.substr(6);

            this.playerRating.issue = issue;
            this.sendRating(type);

            this.rating_step2.hide();
            if (type == 'game') {
                this.showRatingDialog_step3(type);
            } else {
                this.showMessage(_('Thanks for your feedback!'), 'info');
            }
        },

        showRatingDialog_step3: function (type) {
            // 3rd step: free text

            this.rating_step3 = new ebg.popindialog();
            this.rating_step3.create('rating_step3');
            if (type === 'support') {
                this.rating_step3.setTitle(__('lang_mainsite', 'One last thing: any message for our team?'));
            } else if (type == 'game' && this.gameisalpha) {
                this.rating_step3.setTitle(__('lang_mainsite', 'Do you have any other feedback to give?'));
            } else { 
                this.rating_step3.setTitle(__('lang_mainsite', 'One last thing: any message for the developer?'));
            }

            var html = "<div id='rating_step3'>";

            if (type == 'game' && this.gameisalpha) {
                // For alpha games, we don't want players to use the free message to report bugs, so we replace it by a button to make a report
                html += "<div style='text-align:center'>";
                html += "<br />";
                html += __('lang_mainsite', "Did you run into an issue while playing?");
                html += "<br />";
                html +=
                    "<a href='/bug?id=0&table="+this.table_id+"' class='bgabutton bgabutton_blue'>" +
                    __('lang_mainsite', 'Report a bug') +
                    '</a>';
                html += "<br />";
                html += __('lang_mainsite', "Do you have an idea to improve the adaptation?");
                html += "<br />";
                html +=
                    "<a href='/bug?id=0&table="+this.table_id+"&suggest' class='bgabutton bgabutton_blue'>" +
                    __('lang_mainsite', 'Make a suggestion') +
                    '</a>';
                html += "<br />";
                if (this.game_group != '') {
                    html += __('lang_mainsite', "Or you would like to discuss something with the community?");
                    html += "<br />";
                    html +=
                        "<a href='/group?id="+this.game_group+"' class='bgabutton bgabutton_blue'>" +
                        __('lang_mainsite', 'Discuss with the group') +
                        '</a>';
                    html += "<br />";
                }
                html += '</div>';
            } else {
                // Free message box
                html += "<p><textarea id='rating_comment'></textarea></p>";
                html += "<div style='text-align:center'>";
                html +=
                    "<a href='#' class='bgabutton bgabutton_blue' id='rating_post_comment'>" +
                    __('lang_mainsite', 'Send message') +
                    '</a>';
                html += '</div>';
            }

            html += "<div id='rating_skip'>";
            html +=
                "<a href='#' class='bgabutton bgabutton_gray' id='skip_rating_3'>" +
                __('lang_mainsite', 'Skip') +
                '</a>';
            html += '</div>';

            if (type == 'game' && !this.gameisalpha) {
                // We add a link to make a bug/suggestion report as an alternative to the message
                html += "<div id='rating_alternative'>";
                html += __('lang_mainsite', "You may alternatively want to <a href='%s'>report a bug</a>").replace(
                    '%s',
                    '/bug?id=0&table=' + this.table_id
                );
                html += '</div>';
            }

            html += '</div>';

            this.rating_step3.setContent(html);
            this.rating_step3.show();

            var message = __('lang_mainsite', 'Thanks for helping us to make this game adaptation better!');
            if (type == 'audio' || type == 'video') {
                message = __('lang_mainsite', 'Thanks for helping us to make the audio/video chat better!');
            }
            if (type == 'support') {
                message = __('lang_mainsite', 'Thanks for helping us to improve our player support!');
            }

            if ($('rating_post_comment') !== null) {
                dojo.connect($('rating_post_comment'), 'onclick', this, function () {
                    this.playerRating.text = $('rating_comment').value;

                    this.rating_step3.hide();
                    this.sendRating(type);

                    this.showMessage(_(message), 'info');
                });
            }

            if ($('skip_rating_3') !== null) {
                dojo.connect($('skip_rating_3'), 'onclick', this, function () {
                    this.rating_step3.hide();
                    this.sendRating(type);
                    this.showMessage(_(message), 'info');
                });
            }
        },

        showGameRatingDialog_step4: function () {
            // 4th step: alpha game approval

            this.rating_step4 = new ebg.popindialog();
            this.rating_step4.create('rating_step4');
            this.rating_step4.setTitle(__('lang_mainsite', 'You are a reviewer!'));

            var html = "<div id='rating_step4'>";

            html +=
                '<p>' +
                __('lang_mainsite', 'You have given a 5 star rating. Do you want to approve this game for beta?') +
                '</p>';
            html += "<div style='text-align:center'>";
            html +=
                "<a href='#' class='bgabutton bgabutton_blue' id='rating_go_approve'>" +
                __('lang_mainsite', "Ok, let's go!") +
                '</a>';
            html += '</div>';

            html += "<div id='rating_skip'>";
            html +=
                "<a href='#' class='bgabutton bgabutton_gray' id='skip_rating_4'>" +
                __('lang_mainsite', 'Skip') +
                '</a>';
            html += '</div>';

            html += '</div>';

            this.rating_step4.setContent(html);
            this.rating_step4.show();

            dojo.connect($('rating_go_approve'), 'onclick', this, function () {
                this.rating_step4.hide();

                // Redirect to reviewer page for approval
                window.location = '/reviewer?game=' + this.game_name + '&approve';
            });

            dojo.connect($('skip_rating_4'), 'onclick', this, function () {
                this.rating_step4.hide();

                // Jump to step 3
                this.showRatingDialog_step3('game');
            });
        },

        recordMediaStats: function (player, startStop) {
            if (!this.room) {
                return;
            }

            this.ajaxcall(
                '/videochat/videochat/recordStat.html',
                {
                    player: player,
                    room: this.room,
                    startStop: startStop,
                    media: this.mediaConstraints.video ? 'video' : 'audio',
                },
                this,
                function (result) {
                    console.log('ebg.webrtc', 'recordMediaStats result: ', result);
                },
                function (is_error) {}
            );
        },
    });
});
