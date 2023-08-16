// e board game core stuff

define("ebg/core/core", [
    "dojo", "dojo/_base/declare",
    "svelte/index",
    "ebg/core/common",
    "dojo/string",
    "dojo/fx",
    "dojo/fx/easing",
    "dojo/parser",
    "dojo/io/iframe",
    "dijit/Tooltip",
    "dojox/uuid/generateRandomUuid",
    "dijit/Dialog",
    "ebg/core/i18n",
    "ebg/webrtc",
    "ebg/webpush",
    "ebg/draggable",
    "ebg/resizable",
    "ebg/popindialog"
],
function (dojo, declare, svelte) {


    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////// Dojo legacy 
    ////////////////////////////////////////////////////////////////////////////////////////////////
    
    
    // Dijit.dialog legacy
    dojo.extend(dijit.Dialog, {  
    
        attr: function( subject, content ) {
            this.set( subject, content );
        },
        set: function( subject, content ) {
            if( subject == 'content' )
            {
	        	this.thisDlg = new ebg.popindialog();
	        	this.thisDlg.bCloseIsHiding = true;
                this.thisDlg.create( 'dialog_'+this.id, $('main-content') !== null ? 'main-content' : 'left-side' );
                this.thisDlg.setTitle( this.title );
                
                if (this.onHide) {
                    this.thisDlg.onHide = dojo.hitch(this, this.onHide);
                }

                this.thisDlg.setContent( content );
            }
        },      	
	    show: function(){
	        if( typeof this.thisDlg != 'undefined' )
	        {
                this.thisDlg.show();
            }
	    },
	    hide: function() {
	        if( typeof this.thisDlg != 'undefined' )
	        {
	            this.thisDlg.hide();
	        }
	    },
	    destroyRecursive: function() {
	        if( typeof this.thisDlg != 'undefined' )
	        {
    	        this.thisDlg.destroy(false);	    
            }
	    },
	    destroy: function() {
	        if( typeof this.thisDlg != 'undefined' )
	        {
    	        this.thisDlg.destroy(false);	    
            }
	    },
	        
    });  

    ////////////// (end Dojo legacy strap) /////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////

    return declare("ebg.core.core", null, {
        constructor: function(){
                console.log('ebg.core.core constructor');
                
                this.subscriptions = [];
                this.comet_subscriptions = [];
                this.unload_in_progress = false;
                this.bCancelAllAjax = false;    // If true: all ajax requests in progress are cancelled
                this.tooltips = {};             // Current tooltip object instanciate on the page
                this.tooltipsInfos = {};
                this.bHideTooltips = false;
                
                this.screenMinWidth=0;  // Disabled
                this.currentZoom=1;
                this.mozScale = 1;  // Note: fix dojo.position when using Mozilla scale
                this.rotateToPosition = {};
                
                // Array of current dojo connections
                this.connections = [];
                
                this.instantaneousMode = false; // If set to yes, all move (ex: slides) must be instantaneous
                
                // RTC chat
				this.webrtc = null;
				this.webrtcmsg_ntf_handle = null;
				this.room = null;
				this.already_accepted_room = null;
				this.rtc_mode = 0;
				this.mediaConstraints = {'video':false, 'audio':false};
				
				// Define some regexp for managing masculine/feminine/neutral form changes (mainly his/her for English)
				this.gameMasculinePlayers = [];
				this.gameFemininePlayers = [];
			    this.gameNeutralPlayers = [];
			    
                this.emoticons = { // Note: make sure the canonical code is the first one to appear
			                ':)'  : 'smile',
			                ':-)' : 'smile',
			                ':D'  : 'bigsmile',
			                ':-D'  : 'bigsmile',
			                ':('  : 'unsmile',
			                ':-('  : 'unsmile',
			                ';)': 'blink',
			                ';-)': 'blink',
			                ':/': 'bad',
			                ':-/': 'bad',
			                ':s': 'bad',
			                ':-s': 'bad',			
			                ':P': 'mischievous',
			                ':-P': 'mischievous',
			                ':p': 'mischievous',
			                ':-p': 'mischievous',
			                ':$': 'blushing',
			                ':-$': 'blushing',
			                ':o': 'surprised',
			                ':-o': 'surprised',
			                ':O': 'shocked',
			                ':-O': 'shocked',
			                'o_o': 'shocked',
			                'O_O': 'shocked',
			                '8)': 'sunglass',
			                '8-)': 'sunglass'
		                  };
		        
		        this.defaultTooltipPosition = ['above','below', 'after', 'before'];

                // Web push notifications
                this.webpush = null;
        },


        // Make an AJAX call to the game server, with all associated features:
        // _ alert user that a request is in progress
        // _ signal errors
        // _ csrf token management as a custom header
        //
        // The expected result of this request is on JSON format
        //
        // callback: function to callback with the result when result is available
        // callback_anycase: function to always callback even in case of error. Parameter "is_error" is true in case of callback after an error
        // method: 'post' or 'get' ('get' is the default)
        //
        // Note: if "lock: true" is passed as a parameter, manage an interface locking process during the request
        //
        ajaxcall: function( url, params, obj_callback, callback, callback_anycase, method )
        {
            g_sitecore.ajaxcall_running ++;
            g_sitecore.updateAjaxCallStatus();
         
            if( typeof params != 'object' )
            {
                console.error("ajaxcall : params should be an object. param =");
                console.error( params );
            }
            
            // Reserved arguments
            if( typeof params.action != 'undefined' )
            {
                console.error( "ajaxcall : sorry you cannot use 'action' argument (reserved)" );
                this.showMessage( "Ajaxcall : sorry you cannot use 'action' argument (reserved keyword)",'error' );
                return ;
            }
            if( typeof params.module != 'undefined' )
            {
                console.error( "ajaxcall : sorry you cannot use 'module' argument (reserved)" );
                this.showMessage( "Ajaxcall : sorry you cannot use 'module' argument (reserved keyword)",'error' );
                return ;
            }
            if( typeof params['class'] != 'undefined' )
            {
                console.error( "ajaxcall : sorry you cannot use 'class' argument (reserved)" );
                this.showMessage( "Ajaxcall : sorry you cannot use 'class' argument (reserved keyword)",'error' );
                return ;
            }

            
            if( params.lock )
            {
                var paramType = null;           // Default: any notification is unlocking
                if( params.lock == 'table' )    // Waiting for a table notification to unlock
                {   paramType = 'table';    }
                else if( params.lock == 'player' )    // Waiting for a player notification to unlock
                {   paramType = 'player';    }
                
                params.lock = dojox.uuid.generateRandomUuid();   
                dojo.publish( "lockInterface", [{ status: 'outgoing', uuid: params.lock, type: paramType }] ); 
            }
                               
            // Successful response.
            var onLoad = dojo.hitch( this, function(response, ioArgs) {

                if( response && response.status == 1 )
                {
                   console.log( "ajaxcall sucess (response.status=1)" );
                   console.log( ioArgs );

                    if( typeof response.profilingd != 'undefined' )
                    {
                        // Profiling infos => to append in the display
                        $('ajax_call_profiling').innerHTML += response.profilingd;
                    }


                   if( ioArgs.args.content.lock )  // If this request is followed by an interface locking process
                   {   dojo.publish( "lockInterface", [{ status: 'recorded', uuid: ioArgs.args.content.lock }] );     }               

                   // Specific parameter returned in all ajaxcall on GS for turn based games 
                   if( typeof response.data == 'object' && response.data !== null && typeof response.data.data == 'object' && response.data.data !== null && typeof response.data.data.tbyt != 'undefined' )
                   {   this.number_of_tb_table_its_your_turn = response.data.data.tbyt;                       }

                   if( !this.bCancelAllAjax )
                   {
                       try {
                       
                           var callback_hitched = dojo.hitch( obj_callback, callback )( response.data );
                                                                 
                           if( (typeof callback_anycase != 'undefined') )
                           {     dojo.hitch(  obj_callback, callback_anycase )( false );    }

                        }
                        catch( error )
                        {
                            console.error( "Exception during callback "+callback+" after a call to URL "+url );
                            console.error( "Exception message : "+error.message );
                            console.error( "URL = "+url );
                            console.error( "Ajaxcall params :" );
                            console.error( params );
                            console.error( "Ajaxcall result :" );
                            console.error( response );
                            
                            error.message = "Error during callback from url "+url+". "+error.message;
                            
                            throw error;
                        }
                   }
                } 
                else
                {
                   var expected_error_msg='';
                   
                   if( response === null )
                   {
                       this.showMessage( __('lang_mainsite', "Ajaxcall error: empty answer" ), "error" );
                       this.showMessage( __('lang_mainsite',"If your game interface seems unstable, press F5 or <a href='javascript:location.reload(true)'>click here</a>" ), 'info' );                        
                       console.error( "Ajaxcall error: empty answer from "+url );

                       if (!params.noerrortracking)
                       {
                           analyticsPush({
                                'errorURL': url ? url : '',
                                'errorCode':'',
                                'errorExpected':'',
                                'event':'page_error'
                           });
                       }
                   }
                   else
                   {
                       if (!params.noerrortracking)
                       {
                           analyticsPush({
                                'errorURL': url ? url : '',
                                'errorCode': response.code ? response.code : '',
                                'errorExpected': response.expected ? response.expected : '',
                                'event':'page_error'
                           });
                       }

                       if( response.code == 800 )   // FEX_visitor_not_allowed: Visitor not allowed
                       {
                           // Signal the failure in order user can be redirected
                           dojo.publish( 'signalVisitorNotAllowed' );
                       }
                       else if( response.code == 801 )  // FEX_premium_requested: Premium account only
                       {
                           // Specific case: redirect user to page 'premium'
                           console.log( "Not allowed to free account, redirecting ..." );
                           this.showMessage( response.error, 'error' );
                           if( typeof gotourl != 'undefined' )
                           {
                              // On metasite
                              gotourl( 'premium?src=notallowed' );
                           }
                           else if( typeof this.metasiteurl != 'undefined' )
                           {
                              // On gameserver
                              setTimeout( dojo.hitch( this, function() {
                                  document.location.href = this.metasiteurl+"/premium?src=redirect";
                              } ), 2000 );
                           }
                       }
                       else if( response.code == 806 )  // FEX_invalid_request_token: this browser or tab uses an invalid CSRF token
                       {
                           console.log( "Invalid request token, display disconnected popup" );
                           this.infoDialog(
                                __('lang_mainsite', 'Please click the button below to continue.'),
                                __('lang_mainsite', 'Update needed!'),
                                function () {
                                    window.location.reload();
                                },
                                true
                            );
                       }
                       else if (response.code == 114) // FEX_REGISTER_ERR14: User must register an email
                       {
                         if( typeof gotourl != 'undefined' )
                         {
                           // On metasite
                           gotourl('account?page=newuser')
                           this.showMessage( response.error, "error" );
                         }
                         else if( typeof this.metasiteurl != 'undefined' )
                         {
                           // On gameserver
                           this.showMessage( response.error, "error" );
                           setTimeout( dojo.hitch( this, function() {
                             document.location.href = this.metasiteurl+"/account?page=newuser";
                           } ), 2000 );
                         }
                       }
                       else
                       {
                            if( toint( response.expected ) === 0 )
                            {
                               // Unexpected error message: display it for debug
                               this.showMessage( __('lang_mainsite', "Unexpected error: " ) + response.error, "error" );
                               this.showMessage( __('lang_mainsite',"If your game interface seems unstable, press F5 or <a href='javascript:location.reload(true)'>click here</a>" ), 'info' );                        
                               console.error( "Unexpected error:  " + response.error );
                            }
                            else
                            {
                                // Simple expected error message for user : diplay it
                               this.showMessage( response.error, "error" );
                               expected_error_msg = response.error;
                            }
                       }           
                       
                    }
                                            
                    if( ioArgs.args.content.lock )  // If this request is followed by an interface locking process
                    {   dojo.publish( "lockInterface", [{ status: 'updated', uuid: ioArgs.args.content.lock }] );     }               

                    if( !this.bCancelAllAjax )
                    {
                       // In any case, we call the callback_anycase
                       if( (typeof callback_anycase != 'undefined') )
                       {    dojo.hitch(  obj_callback, callback_anycase )( true, expected_error_msg, ( response===null ? 0 : response.code ) );            }
                    }
                }
            });
            
            
            // The ERROR function will be called in an error cases:
            // _ network error
            // _ response format error
            //
            var onError = dojo.hitch( this, function( error, ioArgs) {

              if( ioArgs.xhr )
              {
                  if( ioArgs.xhr.status == 200 )
                  {
                        var response = ioArgs.xhr.responseText;
                        response = response.replace(/^\s+/g,'').replace(/\s+$/g,'');   // "trim" equivalent

                        if( response[0] != '{' )
                        {
                            // This is the usual PHP error syntax: display PHP error for debug purpose
                            // (not supposed to happend in production)
                            this.showMessage( __('lang_mainsite',"Server syntax error: " ) + ioArgs.xhr.responseText, "error" );
//                            this.showMessage( __('lang_mainsite',"Server syntax error: " ) + error+' '+ioArgs.xhr.responseText, "error" );
                            this.showMessage( __('lang_mainsite',"If your game interface seems unstable, press F5 or <a href='javascript:location.reload(true)'>click here</a>" ), 'info' );                        
                            console.error( "Server syntax error: " + url + ' '+ error +' / '+ ioArgs.xhr.responseText );

                            if (!params.noerrortracking) // We don't track in-game errors
                            {
                               analyticsPush({
                                    'errorURL': url ? url : '',
                                    'errorCode':'Server syntax error',
                                    'errorExpected':0,
                                    'event':'page_error'
                               });
                            }
                        }
                        else
                        {
                            this.showMessage( __('lang_mainsite', "Client error: ") + error + ". During "+ioArgs.args.url+" Received: "+ioArgs.xhr.responseText, "only_to_log" );
                            this.showMessage( __('lang_mainsite',"If your game interface seems unstable, press F5 or <a href='javascript:location.reload(true)'>click here</a>" ), 'only_to_log' );                        
                            console.error( "Error during callback error: " +  url + ' / ' + error );
                            console.error( ioArgs );

                            if (!params.noerrortracking) // We don't track in-game errors
                            {
                               analyticsPush({
                                    'errorURL': url ? url : '',
                                    'errorCode':'Client error',
                                    'errorExpected':0,
                                    'event':'page_error'
                               });
                            }
                        }
                    }
                    else
                    {
                        console.error( "HTTP code "+ioArgs.xhr.status + " "+url  );
                        this.displayUserHttpError( ioArgs.xhr.status );

                        if (!params.noerrortracking) // We don't track in-game errors
                        {
                           analyticsPush({
                                'errorURL': url ? url : '',
                                'errorCode':'HTTP'+ioArgs.xhr.status,
                                'errorExpected':0,
                                'event':'page_error'
                           });
                        }
                    }
                }
                else
                {
                    // In some case (ex: iframe post, there is no ioArgs.xhr => display error directly
                    console.error( "Server error: " + error );
                    
                    if( typeof ioArgs.error != 'undefined' )
                    {
                        this.showMessage( ioArgs.error.toString(), "error" );
                    }

                    if (!params.table) // We don't track in-game errors
                    {
                       analyticsPush({
                            'errorURL': url ? url : '',
                            'errorCode':'Server error',
                            'errorExpected':0,
                            'event':'page_error'
                       });
                    }
                }
                 
                console.log( error );
                console.log( ioArgs );

                if( ioArgs.args.content.lock )  // If this request is followed by an interface locking process
                {   dojo.publish( "lockInterface", [{ status: 'updated', uuid: ioArgs.args.content.lock }] );     }               

                if( ! this.bCancelAllAjax )
                {
                    if( (typeof callback_anycase != 'undefined') )
                    {    dojo.hitch(  obj_callback, callback_anycase )( true );     }                
                }
            });
            
            // The HANDLE function will be called anytime, whether the
            // request succeed or failed 
            var onHandle = dojo.hitch( this, function( response, ioargs ) {
                g_sitecore.ajaxcall_running --;
                g_sitecore.updateAjaxCallStatus();
            });

            var form = null;
            

            // Debug
            if( $('debug_output') )
            {
                var n = url.lastIndexOf('/');
                var cleanurl = url.substring(n + 1);
                var cleanparams = dojo.clone( params );
                if( cleanparams.lock )
                {   delete cleanparams.lock;    }

                var output = '<div>> <b>'+cleanurl + '</b>?' +dojo.objectToQuery( cleanparams )+'</div>';
                dojo.place( output, 'debug_output', 'first' );
            }
            
            if( method != 'post' && method != 'iframe' )
            {
                dojo.xhrGet( {
                    url: url, 
                    handleAs: 'json',
                    preventCache: true,
                    content: params,
                    headers: { 'X-Request-Token': bgaConfig.requestToken },
                    load: onLoad,
                    error: onError,
                    handle: onHandle,
                    timeout: 20000
                });
            }
            else if( method == 'post' )
            {
                if( typeof params.form_id != 'undefined' )
                {
                    if( params.form_id !== null )
                    {
                        // params should be taken from a form
                        console.log( "loading form "+params.form_id );
                        form = params.form_id;
                    }
                }
                            
                dojo.xhrPost( {
                    url: url, 
                    handleAs: 'json',
                    preventCache: true,
                    content: params,
                    headers: { 'X-Request-Token': bgaConfig.requestToken },
                    form: form,
                    load: onLoad,
                    error: onError,
                    handle: onHandle,
                    timeout: 20000
                });
            }
            else if( method == 'iframe' )
            {
                if( params.form_id !== null )
                {
                    // params should be taken from a form
                    // NB: in this case, the request_token cannot be passed as a request header and should be included as a form parameter
                    console.log( "loading form "+params.form_id );
                    form = params.form_id;
                }
            
                console.log( "sending datas through iframe !" );
                dojo.io.iframe.send( {
                    url: url, 
                    handleAs: 'json',
                    preventCache: true,
                    content: params,
                    form: form,
                    load: onLoad,
                    error: onError,
                    handle: onHandle,
                    timeout: 20000
                });
            
            }
        },
        
        // This second AJAX method is specific to the case where data to return is not JSON but HTML.
        // The method loads request's response to "div_target"
        //
        ajaxpageload: function( url, params, div_target, obj_callback, callback )
        {
            g_sitecore.ajaxcall_running ++;
            g_sitecore.updateAjaxCallStatus();

            var xhrGetPromise = dojo.xhrGet( {
                url: url, 
                handleAs: 'text',
                preventCache: true,
                content: params,
                timeout: 20000,

                // Successful response.
                load: dojo.hitch( this, function(response, ioArgs) {
                    if (window.URL) {
                        var responseUrl = new URL(ioArgs.xhr.responseURL);
                        var requestUrl = new URL(ioArgs.url, window.location.href);
                        if (responseUrl.pathname != requestUrl.pathname) {
                            // If response url doesn't match, we need to do another pageload to get the right module
                            gotourl(responseUrl.pathname+responseUrl.search+responseUrl.hash);
                            return;
                        }
                    }

                    console.log( "ajaxpageload sucess" );
                    dojo.empty( div_target );   
                    dojo.place( response, div_target );   

                    if( $('bga_fatal_error' ) )
                    {
                        // There was a fatal error signaled in the HTML (exception launch on server side)

                        if( toint( $('bga_fatal_error_code').innerHTML ) == 800 )
                        {   // Exception "not allowed to visitor"
                            // Signal the failure in order user can be redirected
                            dojo.publish( 'signalVisitorNotAllowed' );
                        }
                        else if( toint( $('bga_fatal_error_code').innerHTML ) == 802 )  // User limited to a specific page
                        {
                           if ( 
                                url.indexOf( 'preferences?section' ) != -1 
                             || url.substr(-'preferences'.length) === 'preferences' 
                             || url.substr(-'support'.length) === 'support' 
                             || url.substr(-'contact'.length) === 'contact' 
                            )
                           {
                               // Exception: access to these pages should never be blocked
                           }
                           else
                           {
                               // Specific case: redirect user to a specific page they are currently limited to
                               console.log( "User limited to a specific page, redirecting ..." );
                               var errortxt = $('bga_fatal_error_descr').innerHTML;
                               // "User limited to page:xxxx"
                               var parts = errortxt.split(':');
                               gotourl( parts[1] );
                           }
                       }
                   }
                    else
                    {
    		            dojo.hitch( obj_callback, callback )( response.data );
    		        }
                }),

                // The ERROR function will be called in an error case.
                error: dojo.hitch( this, function( error, ioArgs) {

                    if( error.message == 'Request canceled' )
                    {
                        console.log( "ajaxpageload request has been cancelled by user");
                        return; // Nothing more to do
                    }
                
                    if( ioArgs.xhr.status == 200 )
                    {
                        var response = ioArgs.xhr.responseText;
                        response = response.replace(/^\s+/g,'').replace(/\s+$/g,'');   // "trim" equivalent

                        if( response[0] != '<' )
                        {
                            // This is the usual PHP error syntax: display PHP error for debug purpose
                            // (not supposed to happend in production)
                            this.showMessage( "Server syntax error: "+ioArgs.xhr.responseText, "error" );
                        }
                        else
                        {
                            this.showMessage( "Callback error: " + error, "error" );
                            console.error( "Callback error: " + error );
                        }
                    }
                    else
                    {
                        console.error( "HTTP code "+ioArgs.xhr.status + " "+url  );
                        this.displayUserHttpError( ioArgs.xhr.status );
                    }
                    console.error("Error during ajaxpageload. HTTP status code: ", ioArgs.xhr.status);
                // !! Logging full response can lead to very slow response time during error !!!!
//                    console.log( response );
                    console.log( ioArgs );
                   }),
                
                // The HANDLE function will be called anyway
                handle: dojo.hitch( this, function( error, ioArgs) {
                    g_sitecore.ajaxcall_running --;
                    g_sitecore.updateAjaxCallStatus();
                   })
            }); 
            
            return xhrGetPromise;
        },
        
        // Display to user a comprehensible message depending on HTTP error returned
        displayUserHttpError: function( http_err_code )
        {
            if( g_sitecore.page_is_unloading )
            {   return; }   // If page is unloading, there can be a lot of unsignificants http errors
            else
            {        
                http_err_code = toint( http_err_code );
                var msg = '';
                switch( http_err_code )
                {
                    case 404:
                        msg = __('lang_mainsite',"The requested page was not found");
                        break;
                    case 500:
                        msg = __('lang_mainsite',"The server reported an error.");
                        break;
                    case 407:
                        msg = __('lang_mainsite',"You need to authenticate with a proxy.");
                        break;
                    case 0:
                        msg = __('lang_mainsite',"Unable to contact the server. Are you connected ?");
                        break;
                    default:
                        msg = __('lang_mainsite',"Unknown network error") +" ("+http_err_code+")";
                        break;
                }
                this.showMessage( msg, "error" ); 
            }
        },
        
        cancelAjaxCall: function()
        {
            this.bCancelAllAjax = true;
        },
        
         // Return an HTML block based on given template and arguments
        format_block: function( template_id, args )
        {
            return dojo.trim( dojo.string.substitute( dojo.eval( template_id ), args ) );   /* jslint-skip */
        },        
        format_string: function( string, args )
        {
            return dojo.trim( dojo.string.substitute( string, args ) );
        },
        // Format a string based on basic string and log argument (with translations)
        // (recursive in case of a sub-log object)
        format_string_recursive: function( string, args )
        {
            //console.log( "Formating string "+string+" with args:" );
            //console.log( args );
            
            if( string === null )
            {
                console.error( "format_string_recursive called with a null string with args:" );
                console.error( args );
                
                return 'null_tr_string';
            }
            
            var output = '';
            if( string != '' )
            {
                // Translate log (client translation)
                var tr_log = this.clienttranslate_string( string );
                
                if( tr_log === null )
                {
					this.showMessage( "Missing translation for `"+string+"`", "error" );
					console.error( "Missing translation for `"+string+"`", "error" );
					return '';
                }
                
                var i;
                var argname;
                // Eventually, translate arguments
                if( typeof args.i18n != 'undefined' )
                {
                    console.log( 'some translations to apply' );
                    for( i in args.i18n )
                    {
                        argname = args.i18n[ i ];
                        console.log( 'translating '+argname );
                        args[ argname ] = this.clienttranslate_string( args[ argname ] );
                    }
                }
                
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
                                console.log( 'Sublog found: '+argname );
                                args[argname] = this.format_string_recursive( args[argname].log, args[argname].args );
                            }
                        }
                    }
                }

				try {
					output = dojo.string.substitute( tr_log, args );
				} catch (e) {
                    if( typeof this.prevent_error_rentry == 'undefined')
                    { this.prevent_error_rentry = 0;  }
                    this.prevent_error_rentry ++;

                    if( this.prevent_error_rentry >= 10 )
                    {
                        console.error( "Preventing error rentry => ABORTING");
                    }
                    else
                    {
                        this.showMessage( "Invalid or missing substitution argument for log message: " + tr_log, "error" );
                    }

                    this.prevent_error_rentry --;

					console.error( "Invalid or missing substitution argument for log message: " + tr_log, "error" );
					output = tr_log;
				}
            }

            // Apply regexps for managing masculine/feminine/neutral forms (for strings containing the name of the players, otherwise we don't know the gender to apply)
            // NB: we have to be careful do not apply any replacement to chat messages!
            if ((typeof args.type == 'undefined' || (args.type != 'chatmessage' && args.type != 'tablechat' && args.type != 'privatechat' && args.type != 'groupchat'))
                    && (typeof args.message == 'undefined' || string != '${player_name} ${message}')
                    && (typeof args.text == 'undefined' || string != '${player_name} ${text}'))
            {
                output = this.applyGenderRegexps( output );
            }
            
            return output;
        },
        applyGenderRegexps: function( output, gender )
        {
            var genderRegexps = bgaConfig.genderRegexps[dojo.config.locale.substr( 0, 2 )];
            if (typeof genderRegexps != 'undefined') {
                // We have some regexps for this language

                var masculineRegexps = genderRegexps['forMasculine'];
                if (typeof masculineRegexps != 'undefined') {
                    var bProcess = false;

                    if (typeof gender != 'undefined' && parseInt(gender) == 1) { // Masculine
                        // If we have a matching gender in argument, process this regexp
                        bProcess = true;
                    } else  {
                        // Otherwise, check if the string matches a player with this gender
                        for (var i = 0; i < this.gameMasculinePlayers.length; i++) {
                            if (output.match( new RegExp( '>'+this.gameMasculinePlayers[i]+'<') )) {
                                bProcess = true;
                            }
                        }
                    }

                    if (bProcess) {
                        var patterns = Object.keys(masculineRegexps);
                        var replacements = Object.values(masculineRegexps);
                        
                        for (var j = 0; j < patterns.length; j++) {
                            output = output.replace( new RegExp( replaceAll(patterns[j],'~',''), 'g' ), replacements[j] );
                        }
                    }
                }

                var feminineRegexps = genderRegexps['forFeminine'];
                if (typeof feminineRegexps != 'undefined') {
                    var bProcess = false;

                    if (typeof gender != 'undefined' && parseInt(gender) == 0) { // Feminine
                        // If we have a matching gender in argument, process these regexps
                        bProcess = true;
                    } else  {
                        // Otherwise, check if the string matches a player with this gender
                        for (var i = 0; i < this.gameFemininePlayers.length; i++) {
                            if (output.match( new RegExp( '>'+this.gameFemininePlayers[i]+'<') )) {
                                bProcess = true;
                            }
                        }
                    }

                    if (bProcess) {
                        var patterns = Object.keys(feminineRegexps);
                        var replacements = Object.values(feminineRegexps);
                        
                        for (var j = 0; j < patterns.length; j++) {
                            output = output.replace( new RegExp( replaceAll(patterns[j],'~',''), 'g' ), replacements[j] );
                        }
                    }
                }

                var neutralRegexps = genderRegexps['forNeutral'];
                if (typeof neutralRegexps != 'undefined') {
                    var bProcess = false;
                    
                    if (typeof gender != 'undefined' && gender === null) { // Neutral/other
                        // If we have a matching gender in argument, process these regexps
                        bProcess = true;
                    } else  {
                        // Otherwise, check if the string matches a player with this gender
                        for (var i = 0; i < this.gameNeutralPlayers.length; i++) {
                            if (output.match( new RegExp( '>'+this.gameNeutralPlayers[i]+'<') )) {
                                bProcess = true; 
                            }
                        }
                    }

                    if (bProcess) {
                        var patterns = Object.keys(neutralRegexps);
                        var replacements = Object.values(neutralRegexps);
                        
                        for (var j = 0; j < patterns.length; j++) {
                            output = output.replace( new RegExp( replaceAll(patterns[j],'~',''), 'g' ), replacements[j] );
                        }
                    }
                }
            }

            return output;
        },        
        clienttranslate_string: function( string )
        {
            // Try first with current context
            var transl = _( string );
            if( transl == string )
            {    return  __('lang_mainsite', string );   }    // If not, get the general bundle
            else
            {    return transl; }
        },
        // Translate all client targets on current page 
        translate_client_targets: function( args, bundle )
        {
            console.log( 'translate_client_targets' );
            dojo.query( '.clienttranslatetarget' ).forEach( dojo.hitch( this, function( node ) {
                console.log( 'translating client target: '+node.innerHTML );
                var string = node.innerHTML;
                if( typeof bundle !== undefined )
                {
                    string = __( bundle, string );
                }
                else
                {
                    string = _( string );                
                }
                node.innerHTML = dojo.string.substitute( string, args );
            } ) );
        },
        register_subs: function( subscription_handle )
        {
            this.subscriptions.push( subscription_handle );
        },
        register_cometd_subs: function( subscription_id )
        {
            this.comet_subscriptions.push( subscription_id );
            return subscription_id;        
        },       
        unsubscribe_all: function()
        {
            console.log( "unsubscribe_all" );
            console.log( this.subscriptions );
            console.log( this.comet_subscriptions );
            
            var sub = null;
            
            while( this.subscriptions.length > 0 )
            {
                sub = this.subscriptions.shift();
                dojo.unsubscribe( sub );
            }
            while( this.comet_subscriptions.length > 0 )
            {
                sub_id = this.comet_subscriptions.shift();
                g_sitecore.unsubscribeCometdChannel( sub_id );
            }
            
        },
        
        // Show an information message during few seconds on page head
        showMessage: function( msg, type )
        {
            g_sitecore.showMessage( msg, type );
        },
        
        // For a game, change the min width to this specific value
        // (default = 980)
        // If the screen is smaller than the given width, the whole interface
        // is zoomed in order everything can fit
        adaptScreenToMinWidth: function( min_width )
        {
            this.interface_min_width = min_width;
            return ; // The reset is // DEPRECATED : no more in use ! => replaced by "zoomFactor" in gameui.js

			//~ // Override dojo.position to account for zooming
			//~ //dojo.oldPosition = dojo.position;
            //~ //dojo.position = dojo.hitch( this, 'getObjPosition' );
			
            //~ if( this.screenMinWidth == 0 )
            //~ {
                //~ dojo.connect(window, "onresize", this, dojo.hitch( this, 'adaptScreenToMinWidthWorker' ));
            //~ }
            //~ this.screenMinWidth = min_width;
            
            //~ if( typeof gameui != 'undefined' )
            //~ {
                //~ gameui.interface_min_width = min_width-240;
            //~ }
            //~ //dojo.style( 'overall-content', 'minWidth', this.screenMinWidth+'px' );

            //~ this.adaptScreenToMinWidthWorker();
        },
        adaptScreenToMinWidthWorker: function() // DEPRECATED : no more in use !
        {
            var screenSize = dojo.position( 'ebd-body' );

            if (dojo.isMozilla)
            {
                console.error( "BGA Screen adaptation NOT SUPPORTED FOR MOZILLA BASED BROWSER" );
            
/*                var realSize = screenSize.w/this.currentZoom;
		        if( realSize <=this.screenMinWidth )
		        {
		            this.currentZoom = (realSize)/this.screenMinWidth;
                }			
                else
                {
                    this.currentZoom = 1;
                }			
                this.mozScale = this.currentZoom;
            
                dojo.style( 'ebd-body', 'MozTransform',  'scale(' + this.currentZoom + ')');
                dojo.style( 'ebd-body', 'MozTransformOrigin',  '0 0');   
                */             
            }
            else
            {
		        var realSize = screenSize.w*this.currentZoom;
		        var realMinWidth = this.screenMinWidth;
		        if( dojo.hasClass( "ebd-body", "game_interface" ) && dojo.hasClass( "ebd-body", "mobile_version" ) )
		        {
		            realMinWidth -= 240;    // players panels are now on top
		        }

		        if( realSize <= realMinWidth )
		        {
		            this.currentZoom = (realSize)/realMinWidth;
                }			
                else
                {
                    this.currentZoom = 1;
                }		
                
                dojo.style( 'ebd-body', 'zoom', this.currentZoom );                
            }        
        },
        
        // Replace dojo.position => take into account Mozilla 'scale'
        // Must be used in conjonction with adaptScreenToMinWidth
        getObjPosition: function( obj )
        {
            var res = dojo.oldPosition( obj );
            
            if( this.mozScale != 1 )
            {
                res.x /= this.mozScale;
                res.y /= this.mozScale;
                return res;
            }
            else
            {   return res; }
        },
          
        // Place an object on another one
        // Note: if it does not work check that:
        //  1°) mobile_obj has a position:absolute or position:relative
        //  2°) a fixed mobile_obj parent has a position absolute or relative
        placeOnObject: function( mobile_obj, target_obj )
        {
            //console.log( 'placeOnObject' );
            
            if( mobile_obj === null )
            {   console.error( 'placeOnObject: mobile obj is null' );   }
            if( target_obj === null )
            {   console.error( 'placeOnObject: target obj is null' );   }

            if( typeof mobile_obj == 'string' )
            {  var mobile_obj_dom = $( mobile_obj );    }
            else
            {   var mobile_obj_dom = mobile_obj;    }

            var disabled3d = this.disable3dIfNeeded();

            
            var tgt = dojo.position( target_obj );
            var src = dojo.position( mobile_obj );
                       
            // Current mobile object relative coordinates
            var left = dojo.style( mobile_obj, 'left' );
            var top = dojo.style( mobile_obj, 'top' );

            var vector_abs = {
                x: tgt.x-src.x + (tgt.w-src.w)/2,
                y: tgt.y-src.y + (tgt.h-src.h)/2
            };
            
            var mobile_obj_parent_alpha = this.getAbsRotationAngle( mobile_obj_dom.parentNode );
            var vector = this.vector_rotate( vector_abs, mobile_obj_parent_alpha );

            left = left+vector.x;
            top = top+ vector.y;
            

            // Move to new location and fade in
            dojo.style( mobile_obj, 'top', top + 'px' );
            dojo.style( mobile_obj, 'left', left + 'px' );

            this.enable3dIfNeeded( disabled3d );
        },
        
        // Place an object on another one with a delta
        // Note: if it does not work check that:
        //  1°) mobile_obj has a position:absolute or position:relative
        //  2°) a fixed mobile_obj parent has a position absolute or relative
        placeOnObjectPos: function( mobile_obj, target_obj, target_x, target_y )
        {
            console.log( 'placeOnObject' );
            
            if( mobile_obj === null )
            {   console.error( 'placeOnObject: mobile obj is null' );   }
            if( target_obj === null )
            {   console.error( 'placeOnObject: target obj is null' );   }

            if( typeof mobile_obj == 'string' )
            {  var mobile_obj_dom = $( mobile_obj );    }
            else
            {   var mobile_obj_dom = mobile_obj;    }

            var disabled3d = this.disable3dIfNeeded();
            
            var tgt = dojo.position( target_obj );
            var src = dojo.position( mobile_obj );

                       
            // Current mobile object relative coordinates
            var left = dojo.style( mobile_obj, 'left' );
            var top = dojo.style( mobile_obj, 'top' );

            var vector_abs = {
                x: tgt.x-src.x + (tgt.w-src.w)/2 + target_x,
                y: tgt.y-src.y + (tgt.h-src.h)/2 + target_y
            };

            var mobile_obj_parent_alpha = this.getAbsRotationAngle( mobile_obj_dom.parentNode );
            var vector = this.vector_rotate( vector_abs, mobile_obj_parent_alpha );

            left = left+vector.x;
            top = top+ vector.y;

            // Move to new location and fade in
            dojo.style( mobile_obj, 'top', top + 'px' );
            dojo.style( mobile_obj, 'left', left + 'px' );

            this.enable3dIfNeeded( disabled3d );
        },     
        

        disable3dIfNeeded: function()
        {
            if( dojo.hasClass( 'ebd-body', 'mode_3d' ) )
            {
                // We need to remove 3D transitions during the move, otherwise changing the view position is not instantanous and unuseful
                dojo.removeClass( 'ebd-body', 'enableTransitions' );
            
                var save = $('game_play_area').style.transform;
                dojo.removeClass( 'ebd-body', 'mode_3d' );
                dojo.style( 'game_play_area', 'transform', "rotatex("+0+"deg) translate("+0+"px,"+0+"px) rotateZ("+0+"deg)" );
                
                return save;
            }
            
            return null;        
        },
        enable3dIfNeeded: function( save )
        {
            if( save !== null )
            {
                dojo.style( 'game_play_area', 'transform', save );
                dojo.addClass( 'ebd-body', 'mode_3d' );
            }
        },

        getComputedTranslateZ: function(obj)
        {
            // https://stackoverflow.com/questions/21912684/how-to-get-value-of-translatex-and-translatey
            if(!window.getComputedStyle)
            {   
                return;
            }
            var style = getComputedStyle(obj);
            var transform = style.transform || style.webkitTransform || style.mozTransform;
            var mat = transform.match(/^matrix3d\((.+)\)$/);
            return mat ? ~~(mat[1].split(', ')[14]) : 0;
            // ~~ casts the value into a number
        },

        transformSlideAnimTo3d: function( anim, mobile_obj, duration, delay, dx, dy )
        {
            if( dojo.hasClass( 'ebd-body', 'mode_3d' ) )
            {
                if( typeof dx == 'undefined' || typeof dy == 'undefined' )
                {
                    var jump_height = 50;
                }
                else
                {
                    var distance = Math.sqrt( dx*dx + dy*dy );
                    
                    // Jump height vary from 20  to 80 
                    jump_height = Math.max( 20, Math.min( 80,  Math.round( distance / 2 ) ) );
                }
                
                var jump_start = this.getComputedTranslateZ( mobile_obj );
            
                if( typeof duration == 'undefined' || duration === null )
                {   duration = 500; }
                if( typeof delay == 'undefined' || delay === null )
                {   delay = 0; }
                if( typeof mobile_obj == 'string' )
                {   mobile_obj = $( mobile_obj );   }
            
                // Adding translateZ before and after the move
	            var animUp = new dojo.Animation({
		                curve: [jump_start, jump_start+jump_height],
                        delay: delay,
                        duration: duration/2,
		                onAnimate: dojo.hitch( this, function (v) {
			                mobile_obj.style.transform = 'translateZ(' + v + 'px)';
		                } )
	                });
	            var animDown = new dojo.Animation({
		                curve: [jump_start+jump_height, jump_start],
                        delay: delay + duration/2,
                        duration: duration/2,
		                onAnimate: dojo.hitch( this, function (v) {
			                mobile_obj.style.transform = 'translateZ(' + v + 'px)';
		                } )
	                });
                
                var anim3d = dojo.fx.combine([
                    anim,
	                animUp,
	                animDown
                ]);
                return anim3d;        
            }
            else
            {   return anim;    }
        },
               
        // Return an animation that is moving (slide) a DOM object over another one
        slideToObject: function( mobile_obj, target_obj, duration, delay )
        {
            if( mobile_obj === null )
            {   console.error( 'slideToObject: mobile obj is null' );   }
            if( target_obj === null )
            {   console.error( 'slideToObject: target obj is null' );   }

            if( typeof mobile_obj == 'string' )
            {  var mobile_obj_dom = $( mobile_obj );    }
            else
            {   var mobile_obj_dom = mobile_obj;    }

            var disabled3d = this.disable3dIfNeeded();

            var tgt = dojo.position( target_obj );
            var src = dojo.position( mobile_obj );
    
            if( typeof duration == 'undefined' )
            {    duration = 500;    }
            if( typeof delay == 'undefined' )
            {    delay = 0;    }
            
            if( this.instantaneousMode )
            {   
                delay=Math.min( 1, delay );
                duration=Math.min( 1, duration );
            }
            
            // Current mobile object relative coordinates
            var left = dojo.style( mobile_obj, 'left' );
            var top = dojo.style( mobile_obj, 'top' );

            var vector_abs = {
                x: tgt.x-src.x + (tgt.w-src.w)/2,
                y: tgt.y-src.y + (tgt.h-src.h)/2 
            };

            var mobile_obj_parent_alpha = this.getAbsRotationAngle( mobile_obj_dom.parentNode );
            var vector = this.vector_rotate( vector_abs, mobile_obj_parent_alpha );

            left = left+vector.x;
            top = top+ vector.y;

            
//            console.log( 'src: left='+toint( src.x )+', top='+toint( src.y ) +"\n"+
//                   'target: left='+toint( tgt.x )+', top='+toint( tgt.y ) +"\n"+
//                   'result: left='+toint( left )+', top='+toint( top ) );


            this.enable3dIfNeeded( disabled3d );

            var anim = dojo.fx.slideTo( {  node: mobile_obj,
                                top: top,
                                left: left ,
                                delay: delay,
                                duration: duration,
                                unit: "px" } );

            if( disabled3d !== null )
            {
                anim = this.transformSlideAnimTo3d( anim, mobile_obj_dom, duration, delay, vector.x, vector.y );
            }
            return anim;
              
        },
        
        // Return an animation that is moving (slide) a DOM object over another one at the given coordinates
        slideToObjectPos: function( mobile_obj, target_obj, target_x, target_y, duration, delay )
        {
            if( mobile_obj === null )
            {   console.error( 'slideToObjectPos: mobile obj is null' );   }
            if( target_obj === null )
            {   console.error( 'slideToObjectPos: target obj is null' );   }
            if( target_x === null )
            {   console.error( 'slideToObjectPos: target x is null' );   }
            if( target_y === null )
            {   console.error( 'slideToObjectPos: target y is null' );   }

            if( typeof mobile_obj == 'string' )
            {  var mobile_obj_dom = $( mobile_obj );    }
            else
            {   var mobile_obj_dom = mobile_obj;    }

            var disabled3d = this.disable3dIfNeeded();

            var tgt = dojo.position( target_obj );
            var src = dojo.position( mobile_obj );
            
            if( typeof duration == 'undefined' )
            {    duration = 500;    }
            if( typeof delay == 'undefined' )
            {    delay = 0;    }

            if( this.instantaneousMode )
            {   
                delay=Math.min( 1, delay );
                duration=Math.min( 1, duration );
            }

            // Current mobile object relative coordinates
            var left = dojo.style( mobile_obj, 'left' );
            var top = dojo.style( mobile_obj, 'top' );

            var vector_abs = {
                x: tgt.x-src.x + toint( target_x ),
                y: tgt.y-src.y + toint( target_y ) 
            };

            var mobile_obj_parent_alpha = this.getAbsRotationAngle( mobile_obj_dom.parentNode );
            var vector = this.vector_rotate( vector_abs, mobile_obj_parent_alpha );

            left = left+vector.x;
            top = top+ vector.y;

            this.enable3dIfNeeded( disabled3d );

            // Move to new location and fade in
            var anim = dojo.fx.slideTo( {  node: mobile_obj,
                                top: top,
                                left: left ,
                                delay: delay,
                                duration: duration,
                                easing: dojo.fx.easing.cubicInOut,
                                unit: "px" } );

            if( disabled3d !== null )
            {
                anim = this.transformSlideAnimTo3d( anim, mobile_obj_dom, duration, delay, vector.x, vector.y );
            }

            return anim;              
        },
        
        // Return an animation that is moving (slide) a DOM object over another one at the given coordinates determined by pct of the target object
        slideToObjectPctPos: function( mobile_obj, target_obj, pct_x, pct_y, duration, delay )
        {
			if( target_obj === null )
            {   console.error( 'slideToObjectPctPos: target obj is null' );   }
            
            var tgt = dojo.position( target_obj );
            
            var x = Math.round(tgt.w * pct_x/100);
            var y = Math.round(tgt.h * pct_y/100);
			
			return this.slideToObjectPos( mobile_obj, target_obj, x, y, duration, delay );
		},
        
        toRadians: function (angle)
        {
          return angle * (Math.PI / 180);
        },
        vector_rotate: function( coords, angle )
        {
            if( angle == 0 )
                return coords;
                
            var rad = -this.toRadians( angle );
            return {
                x: coords.x*Math.cos( rad ) - coords.y*Math.sin( rad ),
                y: coords.x*Math.sin( rad ) + coords.y*Math.cos( rad )
            };
        },
        
        // Attach mobile_obj to a new parent, keeping its absolute position in the screen constant.
        // !! mobile_obj is no longer valid after that (a new corresponding mobile_obj is returned)
        attachToNewParent: function( mobile_obj, new_parent, position )
        {
            //console.log( "attachToNewParent" );
            
            if( typeof mobile_obj == 'string' )
            {   mobile_obj = $( mobile_obj );   }
            if( typeof new_parent == 'string' )
            {   new_parent = $( new_parent );   }
            if( typeof position == 'undefined' )
            {   position = 'last';  }

            if( mobile_obj === null )
            {   console.error( 'attachToNewParent: mobile obj is null' );   }
            if( new_parent === null )
            {   console.error( 'attachToNewParent: new_parent is null' );   }

            var disabled3d = this.disable3dIfNeeded();


            var tgt = dojo.position( mobile_obj );
            var alpha_mobile_original = this.getAbsRotationAngle( mobile_obj );

            var my_new_mobile = dojo.clone( mobile_obj );
            dojo.destroy( mobile_obj );
            dojo.place( my_new_mobile, new_parent, position );

            var src = dojo.position( my_new_mobile );
            var left = dojo.style( my_new_mobile, 'left' );
            var top = dojo.style( my_new_mobile, 'top' );
            var alpha_mobile_new = this.getAbsRotationAngle( my_new_mobile );

            var alpha_new_parent = this.getAbsRotationAngle( new_parent );
            
            // The vector we have to move our mobile object, in absolute coordinates
            var vector_abs = {
                x: tgt.x-src.x + (tgt.w-src.w)/2,
                y: tgt.y-src.y + (tgt.h-src.h)/2
            };
            
            var vector = this.vector_rotate( vector_abs, alpha_new_parent );

            left = left + vector.x;
            top = top + vector.y;

            dojo.style( my_new_mobile, 'top', top + 'px' );
            dojo.style( my_new_mobile, 'left', left + 'px' );

            if( alpha_mobile_new != alpha_mobile_original )
            {
                // We must rotate the new element to make sure its absolute rotation angle do not change
                this.rotateInstantDelta( my_new_mobile, alpha_mobile_original - alpha_mobile_new );
            }

            this.enable3dIfNeeded( disabled3d );
            
            return my_new_mobile;
        },       
        
        attachToNewParentNoReplace: function( mobile_obj, new_parent, position )
        {
            //console.log( "attachToNewParentNoReplace" );
            
            if( typeof mobile_obj == 'string' )
            {   mobile_obj = $( mobile_obj );   }
            if( typeof new_parent == 'string' )
            {   new_parent = $( new_parent );   }
            if( typeof position == 'undefined' )
            {   position = 'last';  }

            if( mobile_obj === null )
            {   console.error( 'attachToNewParent: mobile obj is null' );   }
            if( new_parent === null )
            {   console.error( 'attachToNewParent: new_parent is null' );   }

            var my_new_mobile = dojo.clone( mobile_obj );
            dojo.destroy( mobile_obj );
            dojo.place( my_new_mobile, new_parent, position );

            return my_new_mobile;
        },       
       
        // Create a temporary object and slide it from a point to another one, then destroy it
        slideTemporaryObject: function( mobile_obj_html, mobile_obj_parent, from, to, duration, delay )
        {
            console.log( 'slideTemporaryObject' );
            var obj = dojo.place( mobile_obj_html, mobile_obj_parent );
            dojo.style( obj, 'position', 'absolute' );
            dojo.style( obj, 'left', '0px' );
            dojo.style( obj, 'top', '0px' );
            this.placeOnObject( obj, from );

/*
            // 3D test : do not activate
		    var animation = new dojo.Animation({
			    curve: [0, 50, 0],
			    onAnimate: dojo.hitch( this, function (v) {
				    obj.style.transform = 'translateZ(' + v + 'px)';
			    } )
		    });
		    
		    animation.play();                
*/

            var anim = this.slideToObject( obj, to, duration, delay );
            var destroyOnEnd = function( node ) { console.log( "destroying" ); console.log( node ); dojo.destroy( node );   };
            dojo.connect( anim, 'onEnd', destroyOnEnd );
            anim.play();
            return anim;
        },
        
        // Slide an existing object to a destination, then destroy it
        slideToObjectAndDestroy: function( mobile_obj, target_obj, duration, delay )
        {
        	dojo.style( mobile_obj, 'zIndex', 100 );
        	
	        var anim = this.slideToObject( mobile_obj, target_obj, duration, delay );
	        dojo.connect( anim, 'onEnd', function( node ) { console.log( "destroying" ); console.log( node ); dojo.destroy( node );   } );
	        anim.play();
        },
        
        // Destroy an existing node with a smooth fadeout
        fadeOutAndDestroy: function( node, duration, delay )
        {
            if( typeof duration == 'undefined' )
            {    duration = 500;    }
            if( typeof delay == 'undefined' )
            {    delay = 0;    }

            if( this.instantaneousMode )
            {   
                duration=Math.min( 1, duration );
            }
                        
            var anim = dojo.fadeOut( { node: node, duration: duration, delay: delay } );
            var destroyOnEnd = function( node ) { console.log( "destroying" ); console.log( node ); dojo.destroy( node );   };
            dojo.connect( anim, 'onEnd', destroyOnEnd );
            anim.play();
        },
        
        rotateInstantTo: function( node, degree )
        {
            if( typeof node == 'string' )
            {
                node = $(node);
            }        

            degree = tofloat( degree );

            var old = 0;
            if( typeof this.rotateToPosition[ node.id ] != 'undefined' )
            {
                old = this.rotateToPosition[ node.id ];
            }
            
            if( degree == old )
            {   return; }

        
			var transform;
            dojo.forEach(
                ['transform', 'WebkitTransform', 'msTransform',
                 'MozTransform', 'OTransform'],
                function (name) {
                    if (typeof dojo.body().style[name] != 'undefined') {
                        transform = name;
                    }
                });			
            this.transform=transform;
            
            dojo.style( node, this.transform, 'rotate(' + degree + 'deg)' );

            this.rotateToPosition[ node.id ]  = degree;
        },
        
        rotateInstantDelta: function( node, degree )
        {
            if( typeof node == 'string' )
            {
                node = $(node);
            }
            
            degree = tofloat( degree );

            if( typeof this.rotateToPosition[ node.id ] != 'undefined' )
            {
                this.rotateInstantTo( node, this.rotateToPosition[ node.id ] + degree );
            }        
            else
            {
                this.rotateInstantTo( node, degree );
            }
        },
        
        rotateTo: function( node, degree )
        {
            if( typeof node == 'string' )
            {
                node = $(node);
            }
            
            degree = tofloat( degree );
        
			var transform;
            dojo.forEach(
                ['transform', 'WebkitTransform', 'msTransform',
                 'MozTransform', 'OTransform'],
                function (name) {
                    if (typeof dojo.body().style[name] != 'undefined') {
                        transform = name;
                    }
                });			
            this.transform=transform;
            
            var old = 0;
            if( typeof this.rotateToPosition[ node.id ] != 'undefined' )
            {
                old = this.rotateToPosition[ node.id ];
            }
            
            if( degree == old )
            {   return; }
            
            // Make sure the object turns with in the nearest direction
            while( degree > old+180 )
            {   degree -= 360;  }
            while( degree < old-180 )
            {   degree += 360;  }

            this.rotateToPosition[ node.id ]  = degree;

		    var animation = new dojo.Animation({
			    curve: [old, degree],
			    onAnimate: dojo.hitch( this, function (v) {
				    node.style[this.transform] = 'rotate(' + v + 'deg)';
			    } )
		    });
		    
		    animation.play();                
        },
        
        // Return absolute angle of a node, taken into account all parents
        getAbsRotationAngle: function( node )
        {
            var result = 0;

            if( typeof node == 'string' )
            {
                node = $(node);
            }
            
            if( node === null )
                return 0;

            // This node rotation
            if( typeof node.id != 'undefined' )
            {
                if( typeof this.rotateToPosition[ node.id ] != 'undefined' )
                {
                    result = this.rotateToPosition[ node.id ];
                }
                
                if( typeof node.id == 'overall-content' )
                {
                    // End of the story
                    return 0;
                }
            }
            
            // ... plus its ancestors
            if( typeof node.parentNode != 'undefined' )
            {
                return result + this.getAbsRotationAngle( node.parentNode );
            }
            else
            {
                return 0;
            }
        },
        
        /////////////////////////////////////////////
        // Class event & style management
        
        addStyleToClass: function( cssClassName, cssProperty, propertyValue )
        {
        	console.log( '#### addStyleToClass' );
        	
            var queueEntries = dojo.query( '.' + cssClassName );
            for(var i=0; i<queueEntries.length; i++) {
            	dojo.style( queueEntries[i], cssProperty, propertyValue);            	
            }
        },
        
        /**
         * Utility to connect and disconnect a single element to/from an event.
         */ 
        connect: function(element, event, handler)
        {
        	if(element == null) return;
        	this.connections.push({
        		element: element,
        		event: event,
        		handle: dojo.connect(element, event, this, handler)
        	});
        },
        
        disconnect: function( element, event )
        {
        	dojo.forEach(this.connections, function(connection) {
        		if(connection.element == element && connection.event == event)
        			dojo.disconnect(connection.handle);
        	});
        },

        /**
         * Utility to connect an event to all elements of the same css class.
         */
        connectClass: function(className, event, handler)
        {
            this.connectQuery("."+className, event, handler)
        },

        /**
         * Utility to connect an event to all elements of the query selector
         */
        connectQuery: function(selector, event, handler)
        {
            var list= dojo.query(selector);
            for(var i=0;i<list.length;i++) {
                var element = list[i];
                this.connections.push({ 
                    element: element, 
                    event: event,
                    handle: dojo.connect(element, event, this, handler)
                });
            }
        },

        // Deprecated, keep for compatibility
        addEventToClass: function(className, event, handler)
        {
            this.connectClass( className, event, handler);
        },
        
        /**
         * Utility to remove all registered events.
         */
        disconnectAll: function()
        {
        	dojo.forEach(this.connections, function(connection) {        		
        		dojo.disconnect(connection.handle);
        	});
        	this.connections = [];
        },
        
        /////////////////////////////////////////////////
        //// Counter helpers
        
        updateCounters: function( counters )
        {
            console.log( '#### Utility : updateCounters' );

            if ( typeof counters == 'undefined' ) {
            	return;
            }
            
            for( var counter_name in counters )
            {
                var counter = counters[counter_name];
                
                // Counter must exist in the gamedatas (or it could be someone else's hidden counter)
                if (this.gamedatas.counters[counter_name] && counter.counter_value != null) {
                	this.setCounter(counter.counter_name, counter.counter_value);                	
                } else {
                	console.log( '#### Utility : setCounter ' + counter_name + ' not updated as it is not in the gamedata' );
                }
            }
        },
                
        setCounter: function( counter_name, new_value )
        {
            console.log( '#### Utility : setCounter ' + counter_name + ' = ' + new_value );

            // Update game data
            var counter = this.gamedatas.counters[counter_name];
            counter.counter_value = new_value;

            // Visual effect
            $(counter.counter_name).innerHTML = counter.counter_value;
        },

        incCounter: function( counter_name, delta )
        {
            console.log( '#### Utility : incCounter ' + counter_name + ' += ' + delta );

            // Update game data
            var counter = this.gamedatas.counters[counter_name];
            counter.counter_value = parseInt(counter.counter_value) + parseInt(delta);

            // Visual effect
            $(counter.counter_name).innerHTML = counter.counter_value;          
        },

        decrCounter: function( counter_name, delta )
        {
            console.log( '#### Utility : decrCounter ' + counter_name + ' -= ' + delta );

            // Update game data
            var counter = this.gamedatas.counters[counter_name];
            counter.counter_value = parseInt(counter.counter_value) - parseInt(delta);
             
            if (counter.counter_value < 0) {
                counter.counter_value = 0;
            }

            // Visual effect
            $(counter.counter_name).innerHTML = counter.counter_value;
        },
        
        /////////////////////////////////////////////
        // Tooltips

        getHtmlFromTooltipinfos : function( help, action )
        {
            var html = '<div class="midSizeDialog">';

            if( help != '' )
            {
                html += "<img class='imgtext' src='"+getStaticAssetUrl("img/layout/help_info.png")+"' alt='info' /> <span class='tooltiptext'>"+help+"</span>";
                if( action != '' )
                {    html += "<br/>";   }
            }
            if( action != '' )
            {
                html += "<img class='imgtext' src='"+getStaticAssetUrl("img/layout/help_click.png")+"' alt='action' /> <span class='tooltiptext'>"+action+"</span>";            
            }
            
            html += '</div>';

            return html;
        },
        
        addTooltip: function( id, help, action, delay )
        {
            //console.log( 'addTooltip :' + id );
        
            if( typeof id != 'string' )
            {   console.error( 'Call addTooltip with an id that is not a string !' ); }
        
            if( this.tooltips[ id ] )
            {
                this.tooltips[ id ].destroy();
            }
                        
            var showDelay = 400;
            if( typeof delay !== 'undefined' )
            {   showDelay = delay;  }
        
            this.tooltips[ id ] = new dijit.Tooltip({
                 connectId: [ id ],
                 label: this.getHtmlFromTooltipinfos( help, action ),
                 showDelay: showDelay
              });

            if ( this.bHideTooltips )
            {
                // Define onShow callback to autohide tooltip immediately (Hide tooltips)
                this.tooltips[id].onShow = dojo.hitch(this.tooltips[id], function() { this.close(); });
            }

            dojo.connect( $( id ), 'onclick', this.tooltips[ id ], 'close' );
            
            // Starting dojo 1.10, tooltip does not disapear when mouse is on tooltip => for consistency we must make tooltip disapear in such a case
            this.tooltipsInfos[ id ] = {
                hideOnHoverEvt: null
            };
            dojo.connect( this.tooltips[id],'_onHover', dojo.hitch( this, function() {

                    if( ( this.tooltipsInfos[ id ].hideOnHoverEvt === null ) && $('dijit__MasterTooltip_0' ) )
                    {
                        this.tooltipsInfos[ id ].hideOnHoverEvt = dojo.connect( $('dijit__MasterTooltip_0'), 'onmouseenter', this.tooltips[ id ] , 'close' );
                    }
            } ) );
            
        },
        
        addTooltipHtml: function( id, html, delay )
        {
            //console.log( 'addTooltipHtml :' + id );
        
            html = '<div class="midSizeDialog">'+html+'</div>';
        
            if( this.tooltips[ id ] )
            {
                this.tooltips[ id ].destroy();
            }
                        
            var showDelay = 400;
            if( typeof delay !== 'undefined' )
            {   showDelay = delay;  }
        
            this.tooltips[ id ] = new dijit.Tooltip({
                 connectId: [ id ],
                 label: html,
                 position: this.defaultTooltipPosition,
                 showDelay: showDelay
              });

            if ( this.bHideTooltips )
            {
                // Define onShow callback to autohide tooltip immediately (Hide tooltips)
                this.tooltips[id].onShow = dojo.hitch(this.tooltips[id], function() { this.close(); });
            }

            dojo.connect( $( id ), 'onclick', this.tooltips[ id ], 'close' );

            // Starting dojo 1.10, tooltip does not disapear when mouse is on tooltip => for consistency we must make tooltip disapear in such a case
            this.tooltipsInfos[ id ] = {
                hideOnHoverEvt: null
            };
            dojo.connect( this.tooltips[id],'_onHover', dojo.hitch( this, function() {

                    if( ( this.tooltipsInfos[ id ].hideOnHoverEvt === null ) && $('dijit__MasterTooltip_0' ) )
                    {
                        this.tooltipsInfos[ id ].hideOnHoverEvt = dojo.connect( $('dijit__MasterTooltip_0'), 'onmouseenter', this.tooltips[ id ] , 'close' );
                    }
            } ) );

        },
        
        removeTooltip: function( id )
        {
        	//console.log( 'removeTooltip :' + id );
            
            if( this.tooltips[ id ] )
            {
                this.tooltips[ id ].destroy();
            }
        },
        
        switchDisplayTooltips: function( mode )
        {
            console.log( 'switchDisplayTooltips' );
            this.bHideTooltips = (mode != 0);
            if( this.bHideTooltips )
            {
                // Define onShow callback on all tooltips to make them autohide when they show (Hide tooltips)
                for (var i in this.tooltips) {
                    this.tooltips[i].onShow = dojo.hitch(this.tooltips[i], function() { this.close(); });
                }
            }
            else
            {
                // Define onShow callback as empty (show tooltips)
                for (var i in this.tooltips) {
                    this.tooltips[i].onShow = function() {};
                }
            }
        },
        
        // Note: all concerned nodes must have IDs to get tooltips
        addTooltipToClass: function( cssclass, help, action, delay )
        {
            //console.log( 'addTooltipToClass' );
            
            if( cssclass[0] == '.')
            {
                // make it fault tolerant with leading '.'
                cssclass = cssclass.substr(1);
            }

            var queueEntries = dojo.query( '.'+cssclass );

            for(var i=0; i<queueEntries.length; i++) {
                if( queueEntries[i].id == '' )
                {
                    // Add an id to this element so we can add it a tooltip
                    queueEntries[i].id = dojox.uuid.generateRandomUuid();
                }

                this.addTooltip( queueEntries[i].id, help, action, delay);
            }
        },
        
        // Note: all concerned nodes must have IDs to get tooltips
        addTooltipHtmlToClass: function( cssclass, html, delay )
        {
            //console.log( 'addTooltipHtmlToClass' );

            if( cssclass[0] == '.')
            {
                // make it fault tolerant with leading '.'
                cssclass = cssclass.substr(1);
            }

            var queueEntries = dojo.query( '.'+cssclass );

            for(var i=0; i<queueEntries.length; i++) {
                if( queueEntries[i].id != '' )
                {
                      this.addTooltipHtml( queueEntries[i].id, html, delay);
                }
                else
                {
                    console.error( "Add tooltip to an element with no id during addTooltipToClass "+cssclass );
                }
            }
        },

        applyCommentMarkup: function( text )
        {
            text = text.replace(/\*(.*?)\*/g, "<b>$1</b>");  
            text = replaceAll( text, '---', "<hr/>");  
            text = replaceAll( text, '[red]', "<span style='color:red'>");  
            text = replaceAll( text, '[/red]', "</span>");  
            text = replaceAll( text, '[green]', "<span style='color:green'>");  
            text = replaceAll( text, '[/green]', "</span>");  
            text = replaceAll( text, '[blue]', "<span style='color:blue'>");  
            text = replaceAll( text, '[/blue]', "</span>");  
            text = replaceAll( text, '!!!', "<i class='fa  fa-exclamation-triangle'></i>" );
            text = replaceAll( text, '[tip]', "<i class='fa  fa-lightbulb-o'></i>");  

            return text;      
        },


        /////////////////////////////////////////////
        // Custom dialogs
        confirmationDialog: function( text, callback, callback_cancel, callback_parameter )
        {
            console.log( 'confirmationDialog' );
            
            if( typeof callback_parameter == 'undefined' )
            {   callback_parameter = null;  }

            if( typeof this.confirmationDialogUid == 'undefined' )
            {   this.confirmationDialogUid = 0; }
            if( typeof this.confirmationDialogUid_called == 'undefined' )
            {   this.confirmationDialogUid_called = 0; }
            this.confirmationDialogUid++;
            
            var confDlg = new ebg.popindialog();
            confDlg.create( 'confirmation_dialog_'+this.confirmationDialogUid, $('main-content') !== null ? 'main-content' : 'left-side' );
            confDlg.setTitle( __('lang_mainsite','Are you sure ?') );
            confDlg.setMaxWidth( 500 );
            
            var html = "<div id='confirmation_dialog_"+this.confirmationDialogUid+"'>";
            html += text;
            html += "<br/><br/><div style='text-align: center;'>";
            html += "<a class='bgabutton bgabutton_gray' id='infirm_btn_"+this.confirmationDialogUid+"' href='#'><span>"+__('lang_mainsite', "Please, no")+"</span></a> &nbsp; ";
            html += "<a class='bgabutton bgabutton_blue' id='confirm_btn_"+this.confirmationDialogUid+"' href='#'><span>"+__('lang_mainsite', "I confirm")+"</span></a>";
            html += "</div></div>";

            confDlg.setContent( html );
            confDlg.hideCloseIcon( );
            confDlg.show();

            dojo.connect( $('confirm_btn_'+this.confirmationDialogUid), 'onclick', this, function( evt )
            {
                evt.preventDefault();
                confDlg.destroy();
                
                if( this.confirmationDialogUid_called == this.confirmationDialogUid )
                {
                    // Callback has been called already (ie: double click) => ignore
                }
                else
                {                
                    this.confirmationDialogUid_called = this.confirmationDialogUid;
                    callback( callback_parameter );
                }
            } );
            dojo.connect( $('infirm_btn_'+this.confirmationDialogUid), 'onclick', this, function( evt )
            {
                evt.preventDefault();
                confDlg.destroy();
                if ( typeof callback_cancel !== 'undefined' && callback_cancel !== null ) {

                    if( this.confirmationDialogUid_called == this.confirmationDialogUid )
                    {
                        // Callback has been called already (ie: double click) => ignore
                    }
                    else
                    {                
                        this.confirmationDialogUid_called = this.confirmationDialogUid;
                    	callback_cancel( callback_parameter );
                    }
                }
            } );
        },
        
        warningDialog: function( text, callback )
        {
            console.log( 'warningDialog' );
            
            var confDlg = new ebg.popindialog();
            confDlg.create( 'warning_dialog' );
            confDlg.setTitle( __('lang_mainsite','Warning notice') );
            
            var html = "<div id='warning_dialog'>";
            html += text;
            html += "<br/><br/><div style='text-align: center'>";
            html += "<a class='bgabutton bgabutton_blue' id='warning_btn' href='#'><span>"+__('lang_mainsite', "Duly noted!")+"</span></a>";
            html += "</div></div>";

            confDlg.setContent( html );
            confDlg.show();

            dojo.connect( $('warning_btn'), 'onclick', this, function( evt )
            {
                evt.preventDefault();
                confDlg.destroy();
                callback();
            } );          
        },

        infoDialog: function( text, title, callback, svelteDialog = false )
        {
            console.log( 'infoDialog' );
            
            if (svelteDialog) {
                svelte
                    .bgaConfirm({
                        title: title,
                        description: text,
                        noButton: false,
                        yesButton: _('Ok'),
                    }).then(callback);
            } else {
                var confDlg = new ebg.popindialog();
                confDlg.create( 'info_dialog' );
                confDlg.setTitle( title );
                
                var html = "<div id='info_dialog'>";
                html += text;
                html += "<br/><br/><div style='text-align: center'>";
                html += "<a class='bgabutton bgabutton_blue' id='info_btn' href='#'><span>"+__('lang_mainsite', "Ok")+"</span></a>";
                html += "</div></div>";

                confDlg.setContent( html );
                confDlg.show();

                dojo.connect( $('info_btn'), 'onclick', this, function( evt )
                {
                    evt.preventDefault();
                    confDlg.destroy();
                    if (typeof callback != 'undefined') callback();
                } );   
            }       
        },        

        // Choices is an object with format: "value => text to display"
        multipleChoiceDialog: function( text, choices, callback )
        {
            console.log( 'multipleChoiceDialog' );
            
            var choiceDlg = new ebg.popindialog();
            choiceDlg.create( 'multipleChoice_dialog' );
            choiceDlg.setTitle( text );
            
            var html = "<div id='multipleChoice_dialog'>";
//            html += text;
            html += "<br/><ul style='text-align:center'>";
            for( var value in choices )
            {
                html += "<li><a class='multiplechoice_btn bgabutton bgabutton_blue' id='choice_btn_"+value+"' href='#'><span>"+choices[value]+"</span></a></li>";
            }
            html += "</ul>";
            html += '<br/>';
            html += "</div>";

            choiceDlg.setContent( html );
            choiceDlg.show();

            dojo.query( '.multiplechoice_btn' ).connect( 'onclick', this, function( evt )
            {
                evt.preventDefault();
                choiceDlg.destroy();
                var value = evt.currentTarget.id.substr( 11 );
                callback( value );
            } );
        },

        askForValueDialog: function( text, callback, subtext )
        {
            console.log( 'askForValueDialog' );
            
            var choiceDlg = new ebg.popindialog();
            choiceDlg.create( 'askforvalue_dialog' );
            choiceDlg.setTitle( text );

            if( typeof subtext == 'undefined' )
            {
                subtext = '';
            }
            
            var html = "<div id='askforvalue_dialog'>";
            html += '<p>'+subtext+'</p>';
            html += "<br/><input id='choicedlg_value' type='text' style='width:100%;height:30px'>";
            html += '<br/>';
            html += "<a class='bgabutton bgabutton_blue' id='ok_btn' href='#'><span>"+__('lang_mainsite', "Ok")+"</span></a>";
            html += "</div>";

            choiceDlg.setContent( html );
            choiceDlg.show();
            $('choicedlg_value').focus();

            dojo.connect( $('ok_btn'), 'onclick', this, dojo.hitch( this, function(evt) {
                dojo.stopEvent( evt );
                choiceDlg.destroy();
                var value = $('choicedlg_value').value;
                callback( value );
            }));
        },
        
        /////////////////////////////////////////////
        // Display scoring utility function
        displayScoring: function( anchor_id, color, score, duration, dx, dy )
        {
            if( typeof duration == 'undefined' || duration == null )
            {
                duration = 1000;
            }
            
			var el = dojo.place(
				this.format_string( '<div class="scorenumber">'+(score >= 0 ? '+' : '-')+'${score_number}</div>', {
					score_id: anchor_id, score_number: Math.abs(score)
				} ), anchor_id );
	        
	        if( typeof dx != 'undefined' && typeof dy != 'undefined' && dx !== null && dy !== null )
	        {
			    this.placeOnObjectPos( el, anchor_id, dx, dy );
	        }
	        else
	        {
			    this.placeOnObject( el, anchor_id );
			}
			dojo.style( el, 'color', '#' + color );
			dojo.addClass( el, "scorenumber_anim");
			this.fadeOutAndDestroy( el, duration, 2000 );
		},

        /////////////////////////////////////////////
        // Bubbles management
        
        showBubble: function( anchor_id, text, delay, duration, custom_class )
        {
            if( typeof this.discussionTimeout == 'undefined' )
            {   this.discussionTimeout = {};    }
        
            if( typeof delay == 'undefined' )
            {   delay = 0;  }
            if( typeof duration == 'undefined' )
            {   duration = 3000;  }

            if( delay > 0 )
            {
                setTimeout( dojo.hitch( this, function() {  this.doShowBubble( anchor_id, text, custom_class ); } ), delay );
            }
            else
            {
                this.doShowBubble( anchor_id, text, custom_class );
            }

            if( this.discussionTimeout[ anchor_id ] )
            {
                clearTimeout( this.discussionTimeout[ anchor_id ] );
                delete this.discussionTimeout[ anchor_id ];
            }
            
            if( text != '' )
            {
                this.discussionTimeout[ anchor_id ] = setTimeout( dojo.hitch( this, function() {  this.doShowBubble( anchor_id, '' ); } ), delay+duration );
            }
        },
        doShowBubble: function( anchor_id, text, custom_class )
        {
            if( text == '' )
            {
                if( this.discussionTimeout[ anchor_id ] )
                {   delete this.discussionTimeout[ anchor_id ]; }
            
                // Hide
                var anim = dojo.fadeOut( { node : 'discussion_bubble_'+anchor_id, duration:100 } );
                dojo.connect( anim, 'onEnd', function() {
                    // If we remove a bubble and immediately add one, this would erase the new text at the end of the fadeOut...
                    // ... so we should not do this.
                    //$('discussion_bubble_'+anchor_id).innerHTML = '';                
                } );
                anim.play();
            }        
            else
            {
                if( ! $( 'discussion_bubble_'+anchor_id ) )
                {
                    // Must create the bubble
                    var cc = (typeof custom_class == 'undefined' ? '' : custom_class);
                    dojo.place( '<div id="discussion_bubble_'+anchor_id+'" class="discussion_bubble ' + cc + '"></div>', anchor_id );
                }
                $('discussion_bubble_'+anchor_id).innerHTML = text;
                dojo.style( 'discussion_bubble_'+anchor_id, 'display', 'block' );
                dojo.style( 'discussion_bubble_'+anchor_id, 'opacity', 0 );
                dojo.fadeIn( { node : 'discussion_bubble_'+anchor_id, duration:100 } ).play();
            }
        },            

        /////////////////////////////////////////////
        
        showClick: function( anchor_id, x, y, color )
        {
            if( typeof color == 'undefined' )
            {
                color = 'red';
            }
        
            if( typeof this.showclick_circles_no == 'undefined' )
            {
                this.showclick_circles_no = 0;
            }
            else
            {
                this.showclick_circles_no++;
            }
        
            dojo.place( '<div id="showclick_circles_'+this.showclick_circles_no+'" class="concentric-circles" style="background-color:'+color+';left:'+x+'px;top:'+y+'px"></div>', anchor_id );
            
            
            var this_circle_no = this.showclick_circles_no;
            
            setTimeout( dojo.hitch( this, function() {
                dojo.destroy( 'showclick_circles_'+this_circle_no );
            }), 2200 );
        },
        
        /////////////////////////////////////////////
        // Utilities

        getRankString: function( rank, losers_not_ranked )
        {
            if( rank === null || rank==='' )
            { return __('lang_mainsite', 'not ranked');  }
            
            rank = toint( rank );
            var rankstr = '';
            if( rank == 1 )
            {    rankstr = (typeof losers_not_ranked !== 'undefined' && losers_not_ranked) ? __('lang_mainsite', 'Winner') : __('lang_mainsite', '1st');   }
            else if( rank == 2 )
            {    rankstr = (typeof losers_not_ranked !== 'undefined' && losers_not_ranked) ? __('lang_mainsite', 'Loser') : __('lang_mainsite', '2nd');   }
            else if( rank == 3 )
            {    rankstr = (typeof losers_not_ranked !== 'undefined' && losers_not_ranked) ? __('lang_mainsite', 'Loser') : __('lang_mainsite', '3rd');   }
            else if( rank > 3 )
            {    rankstr = (typeof losers_not_ranked !== 'undefined' && losers_not_ranked) ? __('lang_mainsite', 'Loser') : rank+__('lang_mainsite', 'th');   }
                
            return rankstr;
        },
        
        getKarmaLabel: function( karma )
        {
            var karma = toint( karma );
            
            if( karma == 100 )
            {
                return {    label: _("Perfect"), css: 'exceptional' };
            }
            else if( karma >= 90 )             
            {
                return {    label: _("Excellent"), css: 'perfect' };
            }
            else if( karma >= 80 )             
            {
                return {    label: _("Very good"), css: 'verygood' };
            }
            else if( karma >= 75 )             
            {
                return {    label: _("Good"), css: 'good' };
            }
            else if( karma >= 65 )             
            {
                return {    label: _("Average"), css: 'average' };
            }
            else if( karma >= 50 )             
            {
                return {    label: _("Not good"), css: 'notgood' };
            }
            else if( karma >= 25 )             
            {
                return {    label: _("Bad"), css: 'bad' };
            }
            else if( karma >= 0 )             
            {
                return {    label: _("Very bad"), css: 'verybad' };
            }
        },
        
        getObjectLength: function( obj )
        {
            var len = 0;
            for (var k in obj)
            {  len++;   }
            return len;
        },
        
        getGameNameDisplayed: function( gamename )
        {
            var res =  __('lang_mainsite',gamename+'_displayed' );
            if( res == gamename+'_displayed' )
            {   return gamename;       }
            else
            {   return res; }
        },
        
        // Format a remaining reflexion time in seconds to something displayable
        formatReflexionTime: function( remaining )
        {
            remaining = Math.round( remaining );
            var ret = {string:'-- : --',mn:0,s:0,h:0,positive:true };            
            var positive = true;
            if( remaining < 0 )
            {
                remaining = -remaining;
                positive = false;
            }
        
            var remaining_mn = Math.floor( remaining/60 );
            var remaining_sec = remaining - 60*remaining_mn;
            if( remaining_sec < 10 )
            { remaining_sec = '0'+remaining_sec;  }
            var remaining_hour = Math.floor( remaining_mn/60 );
            var remaining_day = Math.floor( remaining_mn/(60*24) );
            remaining_mn = remaining_mn - 60*remaining_hour;
            

            ret.mn = remaining_mn;
            ret.s = remaining_sec;
            ret.h = remaining_hour;
            ret.positive = positive;
            
            if (isNaN(remaining_mn) || isNaN(remaining_sec)) {
            	ret.string = '-- : --';
            }
            else
            {   
                if( remaining_hour == 0 )
                {                     
                    if( positive )
                    {   ret.string = remaining_mn+':'+remaining_sec;  }
                    else
                    {   ret.string = '-'+remaining_mn+':'+remaining_sec;  }
                }
                else if( remaining_day < 2 )
                {
                    if( remaining_mn < 10 )
                    { remaining_mn = '0'+remaining_mn;  }
                
                    if( positive )
                    {   ret.string = remaining_hour+'h'+remaining_mn;  }
                    else
                    {   ret.string = '-'+remaining_hour+'h'+remaining_mn;  }
                }
                else
                {
                    if( positive )
                    {   ret.string = remaining_day+' '+__('lang_mainsite','days')  }
                    else
                    {   ret.string = '-'+remaining_day+' '+__('lang_mainsite','days');  }
                }
            }
            return ret;
        },        
        
        strip_tags: function (str, allowed_tags) {
            // Strips HTML and PHP tags from a string  
            // 
            // version: 909.322
            // discuss at: http://phpjs.org/functions/strip_tags    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   improved by: Luke Godfrey
            // +      input by: Pul
            // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   bugfixed by: Onno Marsman    // +      input by: Alex
            // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +      input by: Marc Palau
            // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +      input by: Brett Zamir (http://brett-zamir.me)    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   bugfixed by: Eric Nagel
            // +      input by: Bobby Drake
            // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   bugfixed by: Tomasz Wesolowski    // *     example 1: strip_tags('<p>Kevin</p> <b>van</b> <i>Zonneveld</i>', '<i><b>');
            // *     returns 1: 'Kevin <b>van</b> <i>Zonneveld</i>'
            // *     example 2: strip_tags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>', '<p>');
            // *     returns 2: '<p>Kevin van Zonneveld</p>'
            // *     example 3: strip_tags("<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>", "<a>");    // *     returns 3: '<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>'
            // *     example 4: strip_tags('1 < 5 5 > 1');
            // *     returns 4: '1 < 5 5 > 1'
            var key = '', allowed = false;
            var matches = [];    var allowed_array = [];
            var allowed_tag = '';
            var i = 0;
            var k = '';
            var html = ''; 
            var replacer = function (search, replace, str) {
                return str.split(search).join(replace);
            };
             // Build allowes tags associative array
            if (allowed_tags) {
                allowed_array = allowed_tags.match(/([a-zA-Z0-9]+)/gi);
            }
             str += '';
         
            // Match tags
            matches = str.match(/(<\/?[\S][^>]*>)/gi);
             // Go through all HTML tags
            for (key in matches) {
                if (isNaN(key)) {
                    // IE7 Hack
                    continue;        }
         
                // Save HTML tag
                html = matches[key].toString();
                 // Is tag not in allowed list? Remove from str!
                allowed = false;
         
                // Go through all allowed tags
                for (k in allowed_array) {            // Init
                    allowed_tag = allowed_array[k];
                    i = -1;
         
                    if (i) { i = html.toLowerCase().indexOf('<'+allowed_tag+'>');}            if (!i) { i = html.toLowerCase().indexOf('<'+allowed_tag+' ');}
                    if (i) { i = html.toLowerCase().indexOf('</'+allowed_tag)   ;}
         
                    // Determine
                    if (!i) {                allowed = true;
                        break;
                    }
                }
                 if (!allowed) {
                    str = replacer(html, "", str); // Custom replace. No regexing
                }
            }
             return str;
        },

        // Return true/false if this is a valid URL
        validURL: function(str) {
            var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
              '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
              '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
              '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
              '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
              '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
            return !!pattern.test(str);
          },      
        
        nl2br: function (str, is_xhtml) {
        
            // IMPORTANT FOR BGA : use FALSE for is_xhtml
        
            // Converts newlines to HTML line breaks  
            // 
            // version: 1006.1915
            // discuss at: http://phpjs.org/functions/nl2br    
            // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   improved by: Philip Peterson
            // +   improved by: Onno Marsman
            // +   improved by: Atli Þór
            // +   bugfixed by: Onno Marsman    
            // +      input by: Brett Zamir (http://brett-zamir.me)
            // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   improved by: Brett Zamir (http://brett-zamir.me)
            // +   improved by: Maximusya
            // *     example 1: nl2br('Kevin\nvan\nZonneveld');    
            // *     returns 1: 'Kevin\nvan\nZonneveld'
            // *     example 2: nl2br("\nOne\nTwo\n\nThree\n", false);
            // *     returns 2: '<br>\nOne<br>\nTwo<br>\n<br>\nThree<br>\n'
            // *     example 3: nl2br("\nOne\nTwo\n\nThree\n", true);
            // *     returns 3: '\nOne\nTwo\n\nThree\n'    
            var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '' : '<br>';
         
            return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag +'$2');
        },
        
        htmlentities: function  (string, quote_style, charset, double_encode) {
            // Convert all applicable characters to HTML entities  
            // 
            // version: 1109.2015
            // discuss at: http://phpjs.org/functions/htmlentities    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   improved by: nobbler
            // +    tweaked by: Jack
            // +   bugfixed by: Onno Marsman    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +    bugfixed by: Brett Zamir (http://brett-zamir.me)
            // +      input by: Ratheous
            // +   improved by: Rafał Kukawski (http://blog.kukawski.pl)
            // +   improved by: Dj (http://phpjs.org/functions/htmlentities:425#comment_134018)    // -    depends on: get_html_translation_table
            // *     example 1: htmlentities('Kevin & van Zonneveld');
            // *     returns 1: 'Kevin &amp; van Zonneveld'
            // *     example 2: htmlentities("foo'bar","ENT_QUOTES");
            // *     returns 2: 'foo&#039;bar'    
            var hash_map = this.get_html_translation_table('HTML_ENTITIES', quote_style),
            symbol = '';
            string = string == null ? '' : string + '';
         
            if (!hash_map) {        return false;
            }
            
            if (quote_style && quote_style === 'ENT_QUOTES') {
                hash_map["'"] = '&#039;';    }
            
            if (!!double_encode || double_encode == null) {
                for (symbol in hash_map) {
                    if (hash_map.hasOwnProperty(symbol)) {                string = string.split(symbol).join(hash_map[symbol]);
                    }
                }
            } else {
                string = string.replace(/([\s\S]*?)(&(?:#\d+|#x[\da-f]+|[a-zA-Z][\da-z]*);|$)/g, function (ignore, text, entity) {            for (symbol in hash_map) {
                        if (hash_map.hasOwnProperty(symbol)) {
                            text = text.split(symbol).join(hash_map[symbol]);
                        }
                    }            
                    return text + entity;
                });
            }
             return string;
        },
        
        html_entity_decode: function (string, quote_style) {
          // http://kevin.vanzonneveld.net
          // +   original by: john (http://www.jd-tech.net)
          // +      input by: ger
          // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
          // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
          // +   bugfixed by: Onno Marsman
          // +   improved by: marc andreu
          // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
          // +      input by: Ratheous
          // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
          // +      input by: Nick Kolosov (http://sammy.ru)
          // +   bugfixed by: Fox
          // -    depends on: get_html_translation_table
          // *     example 1: html_entity_decode('Kevin &amp; van Zonneveld');
          // *     returns 1: 'Kevin & van Zonneveld'
          // *     example 2: html_entity_decode('&amp;lt;');
          // *     returns 2: '&lt;'
          var hash_map = {},
            symbol = '',
            tmp_str = '',
            entity = '';
          tmp_str = string.toString();

          if (false === (hash_map = this.get_html_translation_table('HTML_ENTITIES', quote_style))) {
            return false;
          }

          // fix &amp; problem
          // http://phpjs.org/functions/get_html_translation_table:416#comment_97660
          delete(hash_map['&']);
          hash_map['&'] = '&amp;';

          for (symbol in hash_map) {
            entity = hash_map[symbol];
            tmp_str = tmp_str.split(entity).join(symbol);
          }
          tmp_str = tmp_str.split('&#039;').join("'");

          return tmp_str;
        },        
        
        get_html_translation_table: function (table, quote_style) {
            // Returns the internal translation table used by htmlspecialchars and htmlentities  
            // 
            // version: 1109.2015
            // discuss at: http://phpjs.org/functions/get_html_translation_table    // +   original by: Philip Peterson
            // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +   bugfixed by: noname
            // +   bugfixed by: Alex
            // +   bugfixed by: Marco    // +   bugfixed by: madipta
            // +   improved by: KELAN
            // +   improved by: Brett Zamir (http://brett-zamir.me)
            // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
            // +      input by: Frank Forte    // +   bugfixed by: T.Wild
            // +      input by: Ratheous
            // %          note: It has been decided that we're not going to add global
            // %          note: dependencies to php.js, meaning the constants are not
            // %          note: real constants, but strings instead. Integers are also supported if someone    // %          note: chooses to create the constants themselves.
            // *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
            // *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}
            var entities = {},
                hash_map = {},        decimal;
            var constMappingTable = {},
                constMappingQuoteStyle = {};
            var useTable = {},
                useQuoteStyle = {}; 
            // Translate arguments
            constMappingTable[0] = 'HTML_SPECIALCHARS';
            constMappingTable[1] = 'HTML_ENTITIES';
            constMappingQuoteStyle[0] = 'ENT_NOQUOTES';    constMappingQuoteStyle[2] = 'ENT_COMPAT';
            constMappingQuoteStyle[3] = 'ENT_QUOTES';
         
            useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
            useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT'; 
            if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
                throw new Error("Table: " + useTable + ' not supported');
                // return false;
            } 
            entities['38'] = '&amp;';
            if (useTable === 'HTML_ENTITIES') {
                entities['160'] = '&nbsp;';
                entities['161'] = '&iexcl;';        entities['162'] = '&cent;';
                entities['163'] = '&pound;';
                entities['164'] = '&curren;';
                entities['165'] = '&yen;';
                entities['166'] = '&brvbar;';        entities['167'] = '&sect;';
                entities['168'] = '&uml;';
                entities['169'] = '&copy;';
                entities['170'] = '&ordf;';
                entities['171'] = '&laquo;';        entities['172'] = '&not;';
                entities['173'] = '&shy;';
                entities['174'] = '&reg;';
                entities['175'] = '&macr;';
                entities['176'] = '&deg;';        entities['177'] = '&plusmn;';
                entities['178'] = '&sup2;';
                entities['179'] = '&sup3;';
                entities['180'] = '&acute;';
                entities['181'] = '&micro;';        entities['182'] = '&para;';
                entities['183'] = '&middot;';
                entities['184'] = '&cedil;';
                entities['185'] = '&sup1;';
                entities['186'] = '&ordm;';        entities['187'] = '&raquo;';
                entities['188'] = '&frac14;';
                entities['189'] = '&frac12;';
                entities['190'] = '&frac34;';
                entities['191'] = '&iquest;';        entities['192'] = '&Agrave;';
                entities['193'] = '&Aacute;';
                entities['194'] = '&Acirc;';
                entities['195'] = '&Atilde;';
                entities['196'] = '&Auml;';        entities['197'] = '&Aring;';
                entities['198'] = '&AElig;';
                entities['199'] = '&Ccedil;';
                entities['200'] = '&Egrave;';
                entities['201'] = '&Eacute;';        entities['202'] = '&Ecirc;';
                entities['203'] = '&Euml;';
                entities['204'] = '&Igrave;';
                entities['205'] = '&Iacute;';
                entities['206'] = '&Icirc;';        entities['207'] = '&Iuml;';
                entities['208'] = '&ETH;';
                entities['209'] = '&Ntilde;';
                entities['210'] = '&Ograve;';
                entities['211'] = '&Oacute;';        entities['212'] = '&Ocirc;';
                entities['213'] = '&Otilde;';
                entities['214'] = '&Ouml;';
                entities['215'] = '&times;';
                entities['216'] = '&Oslash;';        entities['217'] = '&Ugrave;';
                entities['218'] = '&Uacute;';
                entities['219'] = '&Ucirc;';
                entities['220'] = '&Uuml;';
                entities['221'] = '&Yacute;';        entities['222'] = '&THORN;';
                entities['223'] = '&szlig;';
                entities['224'] = '&agrave;';
                entities['225'] = '&aacute;';
                entities['226'] = '&acirc;';        entities['227'] = '&atilde;';
                entities['228'] = '&auml;';
                entities['229'] = '&aring;';
                entities['230'] = '&aelig;';
                entities['231'] = '&ccedil;';        entities['232'] = '&egrave;';
                entities['233'] = '&eacute;';
                entities['234'] = '&ecirc;';
                entities['235'] = '&euml;';
                entities['236'] = '&igrave;';        entities['237'] = '&iacute;';
                entities['238'] = '&icirc;';
                entities['239'] = '&iuml;';
                entities['240'] = '&eth;';
                entities['241'] = '&ntilde;';        entities['242'] = '&ograve;';
                entities['243'] = '&oacute;';
                entities['244'] = '&ocirc;';
                entities['245'] = '&otilde;';
                entities['246'] = '&ouml;';        entities['247'] = '&divide;';
                entities['248'] = '&oslash;';
                entities['249'] = '&ugrave;';
                entities['250'] = '&uacute;';
                entities['251'] = '&ucirc;';        entities['252'] = '&uuml;';
                entities['253'] = '&yacute;';
                entities['254'] = '&thorn;';
                entities['255'] = '&yuml;';
            } 
            if (useQuoteStyle !== 'ENT_NOQUOTES') {
                entities['34'] = '&quot;';
            }
            if (useQuoteStyle === 'ENT_QUOTES') {        entities['39'] = '&#39;';
            }
            entities['60'] = '&lt;';
            entities['62'] = '&gt;';
          
            // ascii decimals to real symbols
            for (decimal in entities) {
                if (entities.hasOwnProperty(decimal)) {
                    hash_map[String.fromCharCode(decimal)] = entities[decimal];        }
            }
         
            return hash_map;
        },
        
        ucFirst: function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        
        
        /*
        strings from common.js to translate:
        _('one day')
        _('days')
        
        */ 

        ///////////////////////////////////
        // Web push notifications

        setupWebPush: function( ) {
            if (this.webpush == null) 
                this.webpush = new ebg.webpush( dojo.hitch( this, 'ajaxcall' ) );
                
            return this.webpush.init();
        },
        
        refreshWebPushWorker: function( ) {
            if (this.webpush == null) 
                this.webpush = new ebg.webpush( dojo.hitch( this, 'ajaxcall' ) );

            if (this.webpush.isSupported()) {
                this.webpush.refresh();
            }
        },
        
        ///////////////////////////////////
        // RTC chat events & leave function
        getRTCTemplate: function( audioEnabled, videoEnabled, isRemote )
        {
			var jstpl_rtc = '<div id="rtc_container_${player_id}" class="rtc_container';
			
			if (!audioEnabled && !videoEnabled) {
				return jstpl_rtc += '"></div>';	// Empty container
			}
			
			if (videoEnabled) {
				jstpl_rtc += ' rtc_video_container">'+
						'<div id="videofeed_${player_id}_pulse"></div>'+
						( isRemote ? '<video id="videofeed_${player_id}" class="videofeed" autoplay ${muted}></video>' : '<video id="videofeed_${player_id}" class="videofeed videoflipped" autoplay ${muted}></video>' )+			
						'<div id="videofeed_${player_id}_name" class="rtc_video_name"></div>'+
						'<div id="videofeed_${player_id}_min" class="rtc_video_control rtc_video_min"></div>'+
						'<div id="videofeed_${player_id}_size" class="rtc_video_control rtc_video_size"></div>'+
						'<div id="videofeed_${player_id}_cam" class="rtc_video_control rtc_video_cam rtc_video_cam_off"></div>';
			} else if (audioEnabled) {
				jstpl_rtc += ' rtc_audio_container">'+
						'<video id="videofeed_${player_id}" class="videofeed" autoplay ${muted}></video>'; // Still needed to attach the audio stream
			}
			
			if (audioEnabled) {
				if (isRemote) {
					jstpl_rtc += '<div id="videofeed_${player_id}_spk" class="rtc_video_control rtc_video_spk rtc_video_spk_off"></div>';
				} else {
					jstpl_rtc += '<div id="videofeed_${player_id}_mic" class="rtc_video_control rtc_video_mic rtc_video_mic_off"></div>';
				}
			}
			
			jstpl_rtc += '</div>';
        
			return jstpl_rtc;
		},
		
		setupRTCEvents: function( player_id ) {
			var this_player_id = (typeof current_player_id != 'undefined' ? current_player_id : this.player_id);
			
			if (this.mediaConstraints.video !== false) {
				dojo.connect( $( 'rtc_container_' + player_id ), 'onclick', this, 'onClickRTCVideoMax' );
				dojo.connect( $( 'videofeed_' + player_id + '_min' ), 'onclick', this, 'onClickRTCVideoMin' );
				dojo.connect( $( 'videofeed_' + player_id + '_size' ), 'onclick', this, 'onClickRTCVideoSize' );
				dojo.connect( $( 'videofeed_' + player_id + '_cam' ), 'onclick', this, 'onClickRTCVideoCam' );
				
				this.addTooltip( 'videofeed_' + player_id + '_min', '', __('lang_mainsite', 'Minimize video') );
				this.addTooltip( 'videofeed_' + player_id + '_size', '', __('lang_mainsite', 'Resize video') );
				if (player_id == this_player_id) {
					this.addTooltip( 'videofeed_' + player_id + '_cam', '', __('lang_mainsite', 'Mute/Unmute your video camera') );
				} else {
					this.addTooltip( 'videofeed_' + player_id + '_cam', '', __('lang_mainsite', 'Mute/Unmute video') );
				}
				
				// Set border color if available (gameui context)
				if ( $( 'player_name_' + player_id ) ) {
					var color = dojo.getStyle( 'player_name_' + player_id, 'color' );
					dojo.setStyle( 'videofeed_' + player_id + '_pulse', 'borderColor', color );
					dojo.setStyle( 'rtc_container_' + player_id, 'borderColor', color );
					dojo.setStyle( 'rtc_container_' + player_id, 'boxShadow', '0px 0px 3px ' + color );
				}
					
				// Set player name below the video if available (gameui context)
				if ( $( 'player_name_' + player_id ) ) {
					var color = dojo.getStyle( 'player_name_' + player_id, 'color' );
					dojo.setStyle( 'videofeed_' + player_id + '_name', 'color', color );
					
					var text = '';
					var element = $( 'player_name_' + player_id );
					for (var i = 0; i < element.childNodes.length; ++i)
					  if (element.childNodes[i].nodeType === 3) // Text node
						text += element.childNodes[i].textContent;
					
					$( 'videofeed_' + player_id + '_name' ).innerHTML = text;
				}
				
				// Set player name below the video if available (table context)
				if ( $( 'emblem_' + player_id ) ) {
					var text = dojo.getAttr( $( 'emblem_' + player_id ), 'alt' );
					
					$( 'videofeed_' + player_id + '_name' ).innerHTML = text;
				}
				
				// Make the video draggable
				// On mobile, we don't make videos draggable as it breaks clickability
				if (! dojo.hasClass('ebd-body', 'mobile_version') ) {
					var draggable = new ebg.draggable();
					draggable.create( this, 'rtc_container_' + player_id );
				}
			}
			if (this.mediaConstraints.audio !== false) {
				if ( $( 'videofeed_' + player_id + '_mic' ) != null ) {
					dojo.connect( $( 'videofeed_' + player_id + '_mic' ), 'onclick', this, 'onClickRTCVideoMic' );
					this.addTooltip( 'videofeed_' + player_id + '_mic', '', __('lang_mainsite', 'Mute/Unmute your microphone') );
				}
				if ( $( 'videofeed_' + player_id + '_spk' ) != null ) {
					dojo.connect( $( 'videofeed_' + player_id + '_spk' ), 'onclick', this, 'onClickRTCVideoSpk' );
					this.addTooltip( 'videofeed_' + player_id + '_spk', '', __('lang_mainsite', 'Mute/Unmute audio') );
				}
			}
		},
		
		getRtcVideoConstraints: function( rtcMode ) {			
			var video = false;
			
			switch (parseInt(rtcMode, 10)) {
				case 2: 
					video = {
								//mandatory: { minAspectRatio: 1.333, maxAspectRatio: 1.334, maxWidth: 320, maxFrameRate: 30 },
								mandatory: { minAspectRatio: 1.333, maxAspectRatio: 1.334, maxWidth: 240, maxFrameRate: 30 },
								optional: []
							};
					break;
				//~ case 3: 
					//~ video = {
								//~ mandatory: { minAspectRatio: 1.333, maxAspectRatio: 1.334, maxWidth: 640, maxFrameRate: 30 },
								//~ optional: []
							//~ };
					//~ break;
				//~ case 4: 
					//~ video = {
								//~ mandatory: { minAspectRatio: 1.333, maxAspectRatio: 1.334, maxWidth: 960, maxFrameRate: 60 },
								//~ optional: []
							//~ };
					//~ break;
				default:
					break;
			}
			
			return video;			
		},
		
		startRTC: function() {
			console.log( 'ebg.core.core startRTC' );
			
			// Check that some media has been selected for RTC
			if (this.mediaConstraints.video === false && this.mediaConstraints.audio === false) {
				return;
			}
			
			require([
				g_themeurl + "js/webrtcadapter.js"
			], dojo.hitch( this, 'doStartRTC' ) );
		},
		
		doStartRTC: function() {
			console.log( 'ebg.core.core doStartRTC' );
			
			this.ajaxcall( "/videochat/videochat/getRTCConfig.html", { }, this,
				function( result ) {
					var player_id = (typeof current_player_id != 'undefined' ? current_player_id : this.player_id);
					
					if ( $('videofeed_' + player_id) === null ) {
						console.log( 'ebg.core.core doStartRTC: video node for local feed is unavailable. Aborting!' );
						return;
					}
					
					// Set global audio preferences (included in webrtcadapter.js)
					webrtcConfig.audioSendCodec = '';
					webrtcConfig.audioReceiveCodec = 'opus/48000';
					
					// Complete or replace the TURN/STUN server configuration
					var pcConfig = JSON.parse(JSON.stringify(webrtcConfig.pcConfig));
					if (typeof result.static_turn != 'undefined' && typeof result.static_turn['urls'] != 'undefined' && result.static_turn['urls'] !== '') {
						pcConfig.iceServers.push( result.static_turn );
					}
					if (typeof result.dynamic_iceservers != 'undefined') {
						try {
							dynamicConfig = JSON.parse(result.dynamic_iceservers);
							if (dynamicConfig.s === 'ok') {
								pcConfig = dynamicConfig.v;
							} else {
								alert('Error: failed to retrieve RTC ICE servers dynamic configuration');
							}
						} catch (e) {
							alert('Error: failed to parse RTC ICE servers dynamic configuration');
						}
					}

					// Webrtc helper
					this.webrtc = new ebg.webrtc(
											player_id,
											this.room,
											pcConfig,
											webrtcConfig.pcConstraints,
											this.mediaConstraints,
											false,
											dojo.hitch( this, 'ajaxcall' ),
											dojo.hitch( this, 'onGetUserMediaSuccess' ),
											dojo.hitch( this, 'onGetUserMediaError' ),
											dojo.hitch( this, 'onJoinRoom' ),
											dojo.hitch( this, 'onLeaveRoomImmediate' ) );

					// Local feed will be set up with options
					this.webrtc.setLocalFeed( $('videofeed_' + player_id) );
					
					// Subscribe to notification channel for webrtc signaling messages (only ONCE! Otherwise it makes things a mess by having calls multiplied - this one almost got me crazy...)
					if (this.webrtcmsg_ntf_handle === null) {
						this.webrtcmsg_ntf_handle = dojo.subscribe( 'webrtcmsg', this, "ntf_webrtcmsg" );
					}
				},
				function( is_error) { if (is_error) console.log('ebg.core.core doStartRTC', 'error getting RTC config'); } );
		},			
		
        onGetUserMediaSuccess: function()
        {
            console.log( 'ebg.core.core onGetUserMediaSuccess' );

            if (this.room === null) return; // This happened in another tab/window

            // Setup listener to clear the room on closing the tab/browser
            window.onbeforeunload = dojo.hitch(this, function( evt ) { if(this.room !== null) { this.doLeaveRoom(); } });
            
            var player_id = (typeof current_player_id != 'undefined' ? current_player_id : this.player_id);
            
            // Local feed has been set up. Update status icons.
            if ( $('videofeed_' + player_id + '_mic') != null ) {
				dojo.addClass( $('videofeed_' + player_id + '_mic'), 'rtc_video_mic_on' );
				dojo.removeClass( $('videofeed_' + player_id + '_mic'), 'rtc_video_mic_off' );
			}
			if ( $('videofeed_' + player_id + '_cam') != null ) {
				dojo.addClass( $('videofeed_' + player_id + '_cam'), 'rtc_video_cam_on' );
				dojo.removeClass( $('videofeed_' + player_id + '_cam'), 'rtc_video_cam_off' );
			}
			
            // Join room.
            this.ajaxcall( "/videochat/videochat/joinRoom.html", { room: this.room, lock: false, audio: (this.mediaConstraints.audio !== false), video: (this.mediaConstraints.video !== false) }, this,
				function( result ) {
					console.log('ebg.core.core onGetUserMediaSuccess', 'joinRoom result: ', result);

					if (result.videochat_terms_accepted == true) {
						if (!result.already_in && !result.joined) {
							if (this.room === this.already_accepted_room) {
								// Player already confirmed either because he created the room (implicit) or when accepting to leave another room to join this one: make him join directly
								this.ajaxcall( "/videochat/videochat/joinRoom.html", { room: this.room, accept: true, lock: false, audio: (this.mediaConstraints.audio !== false), video: (this.mediaConstraints.video !== false) }, this, 
											function( result ) {
												this.already_accepted_room = null; // Reset
												for (var i = 0; i < result.in_room.length; i++) {
													var player_id = result.in_room[i];
													this.onJoinRoom( player_id, false );
												}
											},
											function( is_error ) { } );
							} else {
								// "Ready to join" confirmation
								var html = '<div  class="rtc_dialog">' + '<br />';
								html += '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' 
											+ (this.mediaConstraints.video !== false ? 
													(this.room.indexOf('T') >= 0 ? __('lang_mainsite', 'A Premium user has set up a video chat session for this table!') : __('lang_mainsite', 'A Premium user has set up a video chat session with you!')) : 
													(this.room.indexOf('T') >= 0 ? __('lang_mainsite', 'A Premium user has set up an audio chat session for this table!') : __('lang_mainsite', 'A Premium user has set up an audio chat session with you!'))) 
											+ '</i></div>' + '<br /><br />';
								html += '<div style="text-align: center; font-weight: bold;">' +__('lang_mainsite', 'Do you want to join the call?') + '</div><br /><br />';
								if (this.room.indexOf('T') >= 0) {
									html += __('lang_mainsite', 'If you choose "no" then change your mind, just refresh the page (F5) to get this prompt again!');
								}
								html += '</div>';
								
								// Join now
								this.confirmationDialog( html,
									dojo.hitch( this, function() {
										if (this.room === null) return; // Canceled before confirmation
										this.ajaxcall( "/videochat/videochat/joinRoom.html", { room: this.room, accept: true, lock: false, audio: (this.mediaConstraints.audio !== false), video: (this.mediaConstraints.video !== false) }, this, 
												function( result ) {
													for (var i = 0; i < result.in_room.length; i++) {
														var player_id = result.in_room[i];
														this.onJoinRoom( player_id, false );
													}
												},
												function( is_error ) { } );
									} ),
									dojo.hitch( this, function() {
										if (this.room !== null && this.room.indexOf('T') >= 0) {
                                            this.doLeaveRoom();
										} else if (this.room !== null && this.room.indexOf('P') >= 0) {
											// Clear private chat a/v session as it has been refused on one side
											var rtc_players = this.room.substr(1).split('_');
											var other_player_id = rtc_players[0] == player_id ? rtc_players[1] : rtc_players[0];

                      if (this.mediaConstraints.video) {
                        this.ajaxcall('/table/table/startStopVideo.html',
                          {
                            target_table: null,
                            target_player: other_player_id
                          },
                          this,
                          function (result) { this.doLeaveRoom(); }
                        );
                      } else if (this.mediaConstraints.audio) {
                        this.ajaxcall('/table/table/startStopAudio.html',
                          {
                            target_table: null,
                            target_player: other_player_id
                          },
                          this,
                          function (result) { this.doLeaveRoom(); }
                        );
                      }
										}
									} )
								);
							}
						} else {
							// Already joined
							for (var i = 0; i < result.in_room.length; i++) {
								var player_id = result.in_room[i];
								this.onJoinRoom( player_id, false );
							}
						}
					} else {
						var html = '<div  class="rtc_dialog">' + '<br />';
						html += '<div style="text-align: center; border-bottom: 1px solid black; border-top: 1px solid black; padding: 5px 5px 5px 5px;"><i>' 
										+ (this.mediaConstraints.video !== false ? 
												(this.room.indexOf('T') >= 0 ? __('lang_mainsite', 'A Premium user has set up a video chat session for this table!') : __('lang_mainsite', 'A Premium user has set up a video chat session with you!')) : 
												(this.room.indexOf('T') >= 0 ? __('lang_mainsite', 'A Premium user has set up an audio chat session for this table!') : __('lang_mainsite', 'A Premium user has set up an audio chat session with you!'))) 
										+ '</i></div>' + '<br /><br />';
						html += '<b>' + __('lang_mainsite', 'You are about to enter a real time chat room on Board Game Arena for the first time.') + '</b>' + '<br /><br />';
						html += __('lang_mainsite', 'Please note that any interaction between players in a real time chat room is private to and the sole responsability of those players.') + '<br /><br />';
						html += __('lang_mainsite', 'Board Game Arena doesn\'t record real time chat activity, but you should be aware that any player in the chat room has the possibility to make such recordings. Thus, you shouldn\'t do or say anything that you wouldn\'t want on record (or on Youtube).') + '<br /><br />';
						html += __('lang_mainsite', 'You should also be aware that real time chat, be it voice or video, consumes more bandwidth than classic web browsing. It is your responsability to monitor your usage and check that it matches your contract with your internet provider so as not to incur unexpected fees.') + '<br /><br />';
						html += '<b>' + __('lang_mainsite', 'By accepting to proceed, you state that you are an adult according to the laws of your country or that you received explicit permission to use this service from an adult legally responsible for you, and you recognise and attest that Board Game Arena won\'t be liable for any inconvenience or damage directly or indirectly linked to the use of this service.') + '</b>';
						html += '</div>';
						
						this.confirmationDialog( html,
							dojo.hitch( this, function() {
								if (this.room === null) return; // Canceled before confirmation
								this.ajaxcall( "/videochat/videochat/joinRoom.html", { room: this.room, accept: true, lock: false, audio: (this.mediaConstraints.audio !== false), video: (this.mediaConstraints.video !== false) }, this, 
										function( result ) {
											for (var i = 0; i < result.in_room.length; i++) {
												var player_id = result.in_room[i];
												this.onJoinRoom( player_id, false );
											}
										},
										function( is_error ) { } );
							} ),
							dojo.hitch( this, function() {
								this.ajaxcall( "/videochat/videochat/joinRoom.html", { room: this.room, accept: false, lock: false, audio: (this.mediaConstraints.audio !== false), video: (this.mediaConstraints.video !== false) }, this, 
										function( result ) {
											this.clearRTC();
										},
										function( is_error ) { } );
							} )
						);
					}
				},
				function( is_error) { if (is_error) console.log('ebg.core.core onGetUserMediaSuccess', 'error joining room'); } );
        },
        
        onGetUserMediaError: function()
        {
            console.log( 'ebg.core.core onGetUserMediaError' );
            
            var html = '<div class="rtc_dialog">' + '<br />';
			html += '<b>' + __('lang_mainsite', 'Sorry, Board Game Arena failed to get access to your local camera/microphone...') + '</b>' + '<br /><br />';
			html += __('lang_mainsite', 'If you denied authorisation by mistake, please refresh the page to start over.') + ' ';
			
			var permissionsPage = '';
			//if (adapter.browserDetails.browser == 'firefox') {
			//	permissionsPage = 'about:permissions';
			//}
			//if (adapter.browserDetails.browser == 'chrome') {
			//	permissionsPage = 'chrome://settings/content';
			//		}
			html += __('lang_mainsite', 'If that fails, you should check your browser permissions in your browser\'s <i>%s</i> local configuration.').replace('%s', permissionsPage) + '<br /><br />';
			
			html += __('lang_mainsite', 'Otherwise, please check that your camera/microphone is correctly plugged in, and that you are using a WebRTC capable browser: ') 
			html += '<a href="http://iswebrtcreadyyet.com/" target="_blank">http://iswebrtcreadyyet.com/</a>';
			html += '</div>';
			
			this.warningDialog( html, function() {} );
        },
        
        onJoinRoom: function( player_id, signalingStarted )
        {
            console.log( 'ebg.core.core onJoinRoom', player_id, signalingStarted );
                        
            if (this.webrtc != null && !this.webrtc.isInRoom( player_id ) ) {
				this.webrtc.addToRoom( player_id );
			}
			
			// Make sure we have a container for the chat
			if (this.webrtc.room.indexOf('T') >= 0) {
				if ( $( 'rtc_container_' + player_id ) === null && ( $( 'emblem_' + player_id ) !== null || $( 'rtc_placeholder_' + player_id ) !== null ) ) {
					dojo.place( this.format_string(
									this.getRTCTemplate(this.mediaConstraints.audio, this.mediaConstraints.video, true),
									{player_id: player_id, muted: ''} ), // Video for others must not be muted in order to get their audio
								( $( 'rtc_placeholder_' + player_id ) !== null ? $( 'rtc_placeholder_' + player_id ) : $( 'table_rtc_placeholder' ) ) );
					
					// Set position if needed
					if ( $( 'emblem_' + player_id ) !== null ) {
						this.placeOnObject( $( 'rtc_container_' + player_id ), $( 'emblem_' + player_id ) );
					}
					
					this.setupRTCEvents( player_id );
					
					// Set RTC video active player effect (gameui context)
					if (typeof this.gamedatas != 'undefined' && player_id == this.gamedatas.gamestate.active_player) {
						if ( $( 'videofeed_' + player_id + '_pulse' ) ) {
							dojo.addClass( 'videofeed_' + player_id + '_pulse', 'rtc_video_pulsating' );
						}
					}
				} else {
					// At this stage, the peer joined the room but RTC connection is not yet established with the peer, so status icons should be red.
					if ( $('videofeed_' + player_id + '_mic') != null ) {
						dojo.addClass( $('videofeed_' + player_id + '_mic'), 'rtc_video_mic_off' );
						dojo.removeClass( $('videofeed_' + player_id + '_mic'), 'rtc_video_mic_on' );
					}
					if ( $('videofeed_' + player_id + '_cam') != null ) {
						dojo.addClass( $('videofeed_' + player_id + '_cam'), 'rtc_video_cam_off' );
						dojo.removeClass( $('videofeed_' + player_id + '_cam'), 'rtc_video_cam_on' );
					}
				}
			} else if (this.webrtc.room.indexOf('P') >= 0) {
				// Make sure that we have an audio/video container above the chat window
				if ( $( 'rtc_container_' + player_id ) == null && $( 'chatwindowlogs_zone_privatechat_' + player_id ) !== null) {
					dojo.place( this.format_string(
									this.getRTCTemplate(this.mediaConstraints.audio, this.mediaConstraints.video, true), 
									{player_id: player_id, muted: ''} ), // Video for others must not be muted in order to get their audio
								$( 'chatwindowlogs_privatechat_' + player_id ) );
					
					if (this.mediaConstraints.video) {
						// Set it above the chat window title bar with correct proportions
						dojo.addClass( $( 'rtc_container_' + player_id ), 'rtc_video_container_privatechat' );
					} else if (this.mediaConstraints.audio) {
						// Set it at the center left, leaving space for the mic
						dojo.style( $( 'rtc_container_' + player_id ), 'top', '-13px' );
						dojo.style( $( 'rtc_container_' + player_id ), 'left', '110px' );
					}
					
					this.setupRTCEvents( player_id );
				}
			}
			
			// Establish connection
			this.webrtc.maybeConnect( player_id, signalingStarted );
			
			// Activate audio
			if (this.webrtc.isAudioMuted) {
				this.webrtc.toggleAudioMute();				
			}
        },
        
        onClickRTCVideoMax: function( evt )
        {
			dojo.stopEvent( evt );

			var node = evt.currentTarget;
			var player_id = node.id.split('_')[2];
			
			this.maximizeRTCVideo( node, player_id );
        },
        
        maximizeRTCVideo: function( node, player_id ) {
			if (dojo.hasClass(node, 'rtc_video_container')) {
				dojo.addClass(node, 'rtc_video_container_free');
				dojo.removeClass(node, 'rtc_video_container');
				
				// Magnify video && show controls
				var privatechat = dojo.hasClass(node, 'rtc_video_container_privatechat');
					
				if (typeof privatechat == 'undefined' || !privatechat) {
					var box = dojo.marginBox( 'videofeed_' + player_id ); // Cannot use dojo.position because of override in core.js causing recursion error
					dojo.style( node, 'width', box.w + 'px' );
					dojo.style( node, 'height', box.h + 'px' );

					//var divbox = dojo.marginBox( node ); // Cannot use dojo.position because of override in core.js causing recursion error
					//dojo.style( node, 'top', Math.round(divbox.t - (box.h - 32)/2) + 'px' );
					//dojo.style( node, 'left', Math.round(divbox.l - (box.w - 32)/2) + 'px' );
				} else {
					dojo.addClass(node, 'rtc_video_container_free_privatechat');
					dojo.removeClass(node, 'rtc_video_container_privatechat');
					
					var box = dojo.marginBox( 'videofeed_' + player_id ); // Cannot use dojo.position because of override in core.js causing recursion error
					dojo.style( node, 'width', box.w + 'px' );
					dojo.style( node, 'height', box.h + 'px' );					
				}
				
				// Set z-index to be above unmaximized videos
				if ( $( 'rtc_placeholder_' + player_id ) ) {
					dojo.style( 'rtc_placeholder_' + player_id, 'zIndex', 497 );
				} else if ( $( 'rtc_container_' + player_id ) ) {
					dojo.style( 'rtc_container_' + player_id, 'zIndex', 497 );
				}
				
				// Make the video resizable through the appropriate control
				var resizable = new ebg.resizable();
				resizable.create( this, 'videofeed_' + player_id, 'videofeed_' + player_id + '_size', true, false, true );
			}
		},
        
        onClickRTCVideoMin: function( evt )
        {
			dojo.stopEvent( evt );
            
            var node = evt.currentTarget.parentNode;
            var player_id = node.id.split('_')[2];
            
            var privatechat = dojo.hasClass( $( 'rtc_container_' + player_id ).parentNode, 'chatwindowlogs' );
            var privatechat_big = dojo.hasClass(node, 'rtc_video_container_free_privatechat');            
            
            // Minify video
			dojo.addClass(node, 'rtc_video_container');
			dojo.removeClass(node, 'rtc_video_container_free');
			
			// Reset dimensions
			dojo.style( node, 'width', '' );
			dojo.style( node, 'height', '' );
			dojo.style( node, 'left', '' );
			dojo.style( node, 'top', '' );
			dojo.style( $('videofeed_' + player_id), 'width', '' );
			dojo.style( $('videofeed_' + player_id), 'height', '' );
			
			// Reset position if needed
			if ( $( 'emblem_' + player_id ) !== null && !privatechat && !privatechat_big ) {
				this.placeOnObject( $( 'rtc_container_' + player_id ), $( 'emblem_' + player_id ) );
			} else if (privatechat && !privatechat_big) {
				// Set it at the center of the chat window title bar
				dojo.style( $( 'rtc_container_' + player_id ), 'top', '-6px' );
				dojo.style( $( 'rtc_container_' + player_id ), 'left', '115px' );
			}
			
			// Reset z-index
			if ( $( 'rtc_placeholder_' + player_id ) !== null ) {
				dojo.style( 'rtc_placeholder_' + player_id, 'zIndex', '' );
			} else if ( $( 'rtc_container_' + player_id ) ) {
				dojo.style( 'rtc_container_' + player_id, 'zIndex', '' );
			}
		
			if (privatechat_big) {
				dojo.addClass(node, 'rtc_video_container_privatechat');
				dojo.removeClass(node, 'rtc_video_container_free_privatechat');				
			}
        },
        
		onClickRTCVideoSize: function( evt )
        {
			dojo.stopEvent( evt );
        },
        
        onClickRTCVideoMic: function( evt )
        {
			dojo.stopEvent( evt );
            
            var node = evt.currentTarget;
			var player_id = node.id.split('_')[1];
            
			var muted = this.webrtc.toggleAudioMute( player_id );
			if (muted) {				
				dojo.addClass( evt.currentTarget, 'rtc_video_mic_off' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_mic_on' );
			} else {
				dojo.addClass( evt.currentTarget, 'rtc_video_mic_on' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_mic_off' );
			}
        },
        
        onClickRTCVideoSpk: function( evt )
        {
			dojo.stopEvent( evt );
            
            var node = evt.currentTarget;
			var player_id = node.id.split('_')[1];
            
            var muted = this.webrtc.toggleAudioMute( player_id );
			if (muted) {				
				dojo.addClass( evt.currentTarget, 'rtc_video_spk_off' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_spk_on' );
			} else {
				dojo.addClass( evt.currentTarget, 'rtc_video_spk_on' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_spk_off' );
			}
        },
        
        onClickRTCVideoCam: function( evt )
        {
			dojo.stopEvent( evt );
			
			var node = evt.currentTarget;
			var player_id = node.id.split('_')[1];
			
			var muted = this.webrtc.toggleVideoMute( player_id );
			if (muted) {				
				dojo.addClass( evt.currentTarget, 'rtc_video_cam_off' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_cam_on' );
			} else {
				dojo.addClass( evt.currentTarget, 'rtc_video_cam_on' );
				dojo.removeClass( evt.currentTarget, 'rtc_video_cam_off' );
			}
        },
        
        onLeaveRoom: function( player_id, immediate )
        {
            console.log( 'ebg.core.core onLeaveRoom', 'Player ' + player_id + ' has left');
            
			if (this.webrtc != null && this.webrtc.isInRoom( player_id ) ) {
				
				// Destroy video chat zone for this player
				var node = $('rtc_container_' + player_id);
				
				if (immediate === true) {
					// Instantaneous (when quitting, the video must be immediately destroyed since the player zone disappears immediately)
					dojo.destroy( node );
				} else {
					// Fadeout
					var fadeOut = dojo.fadeOut( {node: node, duration: 1000, delay: 500} ); 
					dojo.connect( fadeOut, 'onEnd', function( node ) { dojo.destroy( node ); } );
					fadeOut.play();
				}
				
				this.webrtc.removeFromRoom( player_id );
			}
        },
        
        onLeaveRoomImmediate: function( player_id )
        {
			this.onLeaveRoom( player_id, true );
		},
        
        doLeaveRoom: function( leaveroom_callback )
        {
            console.log( 'ebg.core.core doLeaveRoom' );
            
            // Clear RTC first, to avoid renegociating while processing the leave room request
            this.clearRTC();
            
            if (this.room == null) {
				console.log( 'ebg.core.core doLeaveRoom: room is null. This should not happen. Clearing up RTC.' );
				return;
			}
			
			// Leave room
			this.ajaxcall( "/videochat/videochat/leaveRoom.html", { room: this.room, lock: false }, this,
				function( result ) {
					console.log('ebg.core.core doLeaveRoom', 'leaveRoom result: ', result);
					this.room = null;
					this.rtc_mode = 0;
					this.mediaConstraints = {'video':false, 'audio':false};
					if (typeof leaveroom_callback != 'undefined' ) {
						leaveroom_callback();
					}
				},
				function( is_error) { if (is_error) console.log('ebg.core.core doLeaveRoom', 'error while leaving the room'); } );
        },
        
        clearRTC: function() {
			console.log( 'ebg.core.core clearRTC' );
			
			// Free browser ressources and signal other players that this player is leaving the room
			if (this.webrtc != null) {
				this.webrtc.hangup();
			}
			
			this.webrtc = null;
			
			// Stop listening to webrtc notification channel
			dojo.unsubscribe(this.webrtcmsg_ntf_handle);
			this.webrtcmsg_ntf_handle = null;
			
			// Destroy all videos visible by this player on this page (in case he stays on the page after hanging up)
			dojo.query( '.rtc_container' ).forEach( function(node, index, arr) {
				dojo.destroy( node );
			});
			
			// Interface a/v buttons
			dojo.query( '.audiovideo_active' ).removeClass( 'audiovideo_active' ).addClass( 'audiovideo_inactive' );
		},
        
        ////////////////////////////////////////
		// RTC signaling: notifications handling
		ntf_webrtcmsg: function( notif )
	    {
	    	console.log( 'ebg.core.core ntf_webrtcmsg', notif );

			if (this.webrtc != null && typeof notif.args.message != 'undefined') {
				this.webrtc.onMessageReceived( notif.args );
			}
	    },
	    
	    /////////////////////////////////////////
	    // Add smiley to texts - Ref: https://en.wikipedia.org/wiki/List_of_emoticons
	    addSmileyToText: function( text )
	    {
	    /*
	    }
.bgasmiley_smile {	background-position: -0px -1860px;	}
.bgasmiley_unsmile {	background-position: -0px -1880px;	}
.bgasmiley_blink {	background-position: -0px -1900px;	}
.bgasmiley_bigsmile {	background-position: -0px -1920px;	}
.bgasmiley_bad {	background-position: -0px -1940px;	}
.bgasmiley_chocked {	background-position: -0px -1960px;	}
.bgasmiley_sunglass {	background-position: -0px -1980px;	}
	    */
	      
	      var emoticons = this.emoticons;
		  var patterns = [],
			 metachars = /[[\]{}()*+?.\\|^$\-,&#\s]/g;

		  // build a regex pattern for each defined property
		  for (var i in emoticons) {
			if (emoticons.hasOwnProperty(i)){ // escape metacharacters
			  patterns.push('(( +|^)'+i.replace(metachars, "\\$&")+'( +|$|\\s))');
			}
		  }
		  
//		  console.log(JSON.stringify(text));
//		  console.log(patterns.join('|'));
		  
		  // build the regular expression and replace
		  
		  

		  
		  var text = text.replace(new RegExp(patterns.join('|'),'g'), function (match) {
			var emomatch = match.trim(); // Remove extra spaces captured by the regexp
			return typeof emoticons[emomatch] != 'undefined' ?
				   match.replace(emomatch, '<div class="icon20_textalign"><div class="bgasmiley bgasmiley_'+emoticons[emomatch]+'"></div></div>') :
				   match;
		  });

          // We must perform this action TWICE, because when 2 smileys are following each other, the space is "taken" by the regexp of the first smiley and is not available for the second one
          // Example: ":) :) :)" ===> if we only do the regexp a single time, only the first and the last smiley are converted

          return text.replace(new RegExp(patterns.join('|'),'g'), function (match) {
			var emomatch = match.trim(); // Remove extra spaces captured by the regexp
			return typeof emoticons[emomatch] != 'undefined' ?
				   match.replace(emomatch, '<div class="icon20_textalign"><div class="bgasmiley bgasmiley_'+emoticons[emomatch]+'"></div></div>') :
				   match;
		  });
	    },
	    
	    getSmileyClassToCodeTable: function()
	    {
            var class_to_code = {};
            for( var i in this.emoticons )
            {
                if( typeof class_to_code[ this.emoticons[i] ] == 'undefined' )
                {
                    class_to_code[ this.emoticons[i] ] = i;
                }
            }
            return class_to_code;
        },
        
        makeClickableLinks: function( str, bOnlyBGA )
        {
            if( typeof bOnlyBGA == 'undefined' )
            {   bOnlyBGA = true;    }
            
            if( bOnlyBGA )
            {
                if( str.indexOf('boardgamearena.com')!=-1 )
                {
                    var replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*boardgamearena\.com[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
                    return this.makeBgaLinksLocalLinks( str.replace(replacePattern1, '<a class="bga-link" href="$1">$1</a>') );
                }
                else
                {   return this.makeBgaLinksLocalLinks( str ); }
            
            }
            else
            {   
                var other_services = [
                    'yucata.de',
                    'boiteajeux', 
                    'tabletopia', 
                    'happymeeple', 
                    'dominion.games', 
                    'wakan.pl', 
                    'boardspace.net',
                    'brettspielwelt.de', 
                    'littlegolem.net', 
                    'vassalengine.org', 
                    'sovranti', 
                    'interlude.games', 
                    'game-park',
                    'playwithmeeps.com' // Note: too many spams using this URL
                ];

                var other_illegal_services = [
                    'hanab.live', 
                    'hanabi.live',
                    'hanabi.cards',
                    'codenames.marplebot.com', 
                    'longwave.web.app', 
                    'setwithfriends.com', 
                    'oneword.games', 
                    'boredgames.gg', 
                    'freeboardgames.org',
                    'colonist.io',
                    'turnhero.com', 
                    'citadelsgame.herokuapp.com', 
                    'berserk-games', 
                    'tabletopsimulator.com'
                ];

                var status = 'normal';

                for( var i in other_services )
                {
                    if( str.toLowerCase().indexOf( other_services[i] ) != -1 )
                    {
                        status = 'spam';
                    }
                }
                for( var i in other_illegal_services )
                {
                    if( str.toLowerCase().indexOf( other_illegal_services[i] ) != -1 )
                    {
                        status = 'spam_illegal';
                    }
                }


                if( status == 'normal' )
                {
                    var replacePattern1 = /((^|\s)\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
                    return this.makeBgaLinksLocalLinks( str.replace(replacePattern1, '<a href="$1" class="bga-link" target="_blank">$1</a>') );
                }
                else if( status == 'spam' )
                {
                    return this.makeBgaLinksLocalLinks( str ); 
                }
                else if( status == 'spam_illegal' )
                {
                    str += "\n"+_("WARNING: this service is not approved by game designers/publishers. We strongly discourage you to use it or to promote it on BGA. Thanks!");
                    return this.makeBgaLinksLocalLinks( str ); 
                }
            }
        },
        makeBgaLinksLocalLinks: function( url )
        {
            url = url.replace( 'forum.boardgamearena.com', 'SAVE_FORUM_URL_FROM_LOCAL' );
            url = url.replace( 'doc.boardgamearena.com', 'SAVE_DOC_URL_FROM_LOCAL' );

            var replacePattern1 = /(https?):\/\/[-a-zA-Z.]*boardgamearena\.com\//gim;
            url = url.replace( replacePattern1, '/' );

            var replacePattern2 = /((https?):\/\/)[-a-zA-Z.]*.([0-9].boardgamearena\.com)/gim;
            url = url.replace( replacePattern2, '$1$3' );

            url = url.replace( 'SAVE_FORUM_URL_FROM_LOCAL', 'forum.boardgamearena.com' );
            url = url.replace( 'SAVE_DOC_URL_FROM_LOCAL', 'doc.boardgamearena.com' );

            return url;
        },
        
        ensureEbgObjectReinit: function( object )
        {
            if( typeof object == 'object' )
            {
                if( object !== null )
                {
                    if( typeof object.destroy != 'undefined' )
                    {
                        object.destroy();
                    }
                }
            }
        },
        

        getRankClassFromElo : function( elo )
        {
            elo = parseFloat( elo );
            if( elo == 1300 )
            {   return __('lang_mainsite', 'Beginner');   }
            else if( elo < 1400 )
            {   return __('lang_mainsite', 'Apprentice');   }
            else if( elo < 1500 )
            {   return __('lang_mainsite', 'Average');   }
            else if( elo < 1600 )
            {   return __('lang_mainsite', 'Good');   }
            else if( elo < 1800 )
            {   return __('lang_mainsite', 'Strong');   }
            else if( elo < 2000 )
            {   return __('lang_mainsite', 'Expert');   }
            else
            {   return __('lang_mainsite', 'Master');   }
        },
        getColorFromElo : function( elo )
        {
            elo = parseFloat( elo );
            if( elo == 1300 )
            {   return '#74bed1';   } // beginner
            else if( elo < 1400 )
            {   return '#74bed1';   } // apprentice : 1=>99
            else if( elo < 1500 )
            {   return '#84b8de';   } // average : 100 => 200
            else if( elo < 1600 )
            {   return '#94acd6';   } // good : 200 => 300
            else if( elo < 1800 )
            {   return '#9ba5d0';   } // strong : 300 => 500
            else if( elo < 2000 )
            {   return '#a99bc9';   } // expert : 500 => 700
            else
            {   return '#b593c4';   } // master : > 700
        },

        getRankClassFromEloUntranslated : function( elo )
        {
            elo = parseFloat( elo );
            if( elo == 1300 )
            {   return ('beginner');   }
            else if( elo < 1400 )
            {   return ('apprentice');   }
            else if( elo < 1500 )
            {   return ('average');   }
            else if( elo < 1600 )
            {   return ('good');   }
            else if( elo < 1800 )
            {   return ('strong');   }
            else if( elo < 2000 )
            {   return ('expert');   }
            else
            {   return ('master');   }
        },
        
        eloToBarPercentage : function( elo )
        {
            elo = parseFloat( elo );
            
            if( elo < 1400 )
            {
                // 25 first % = beginner + apprentice levels
                return ( elo - 1300 ) / 4;
            }
            else if( elo > 2100 )
            {
                return 100; // No bar above 2100
            }
            else
            {
                // Rest of the bar : other levels
                return Math.min( 100, 25 + 75 * ( ( elo-1400 ) / (2000-1400 ) ) );
            }
        },
        
        formatElo: function( elo )
        {
            return parseInt( Math.round( Math.max( 0, parseFloat( elo )-1300 ) ) );
        },
        formatEloDecimal: function( elo )
        {
            return ( Math.round((elo-1300)*100)/100 );
        },
        getEloLabel: function( elo, bMini, bRounded )
        {
            if( typeof bMini == 'undefined' )
            {   bMini = false;  }
            if( typeof bRounded == 'undefined' )
            {   bRounded = true;  }

            if( bRounded)
            {
                return '<div class="gamerank gamerank_'+ this.getRankClassFromEloUntranslated( elo ) + (bMini ? ' gamerank_mini':'') +'"><span class="icon20 icon20_rankw'+ (bMini ? 'mini':'') +'"></span> <span class="gamerank_value">'+this.formatElo( elo )+'</span></div>';
            }
            else
            {
                return '<div class="gamerank gamerank_'+ this.getRankClassFromEloUntranslated( elo ) + (bMini ? ' gamerank_mini':'') +'"><span class="icon20 icon20_rankw'+ (bMini ? 'mini':'') +'"></span> <span class="gamerank_value">'+this.formatEloDecimal( elo )+'</span></div>';
            }
        },
        getArenaLabel: function( arena_raw, worldrank )
        {
            var arena = this.arenaPointsDetails( arena_raw );

            var res = '<div class="myarena_league league_'+arena.league+'">';
            if( arena.league != 5 )
            {
                res += '<div class="arena_label">'+arena.points+'</div>';
            }
            else if( typeof worldrank != 'undefined' )
            {
                res += '<div class="arena_label">'+worldrank+'</div>';
                res += '<div class="arena_points">'+Math.round( arena.arelo )+'</div>';
            }
            res += '</div>';

            return res;
        },
       
        // Add one parameter to current URL
        // http://stackoverflow.com/questions/486896/adding-a-parameter-to-the-url-with-javascript
        insertParamIntoCurrentURL : function(key, value) {
            key = escape(key); value = escape(value);

            var kvp = document.location.search.substr(1).split('&');
            if (kvp == '') {
                document.location.search = '?' + key + '=' + value;
            }
            else {

                var i = kvp.length; var x; while (i--) {
                    x = kvp[i].split('=');

                    if (x[0] == key) {
                        x[1] = value;
                        kvp[i] = x.join('=');
                        break;
                    }
                }

                if (i < 0) { kvp[kvp.length] = [key, value].join('='); }

                //this will reload the page, it's likely better to store this until finished
                document.location.search = kvp.join('&');
            }
        },

        //////// Players achievement hex displayed (playerawards_collapsed) /////////////

        
        playerawardsCollapsedAlignement: function()
        {
            if( typeof this.onresizePlayerAwardsEvent == 'undefined')
            {
                this.onresizePlayerAwardsEvent = dojo.connect(window, "onresize", this, dojo.hitch( this, 'playerawardsCollapsedAlignement' )); 
                dojo.query( '.show_awards_details').connect( 'onclick', this, function( evt ) {
                    dojo.stopEvent( evt );
                    var parent = evt.currentTarget.parentNode;
                    while( parent !== null && !dojo.hasClass( parent, 'playerawards'))
                    {
                        parent = parent.parentNode;
                    }
                    if( parent !== null )
                    {
                        dojo.removeClass( parent, 'playerawards_collapsed');
                        dojo.destroy(evt.currentTarget );
                    }
                });
            }

            if( dojo.query( '.playerawards_collapsed' ).length == 0 )
            {
                if( typeof this.onresizePlayerAwardsEvent != 'undefined')
                {
                    dojo.disconnect( this.onresizePlayerAwardsEvent );
                    delete this.onresizePlayerAwardsEvent;
                }
            }
            else
            {
                dojo.query( '.playerawards_collapsed' ).forEach( dojo.hitch( this, 'playerawardCollapsedAlignement'));
            }



        },

        playerawardCollapsedAlignement: function( node )
        {
            var previous_y = -1;

            var bOddLine = false;

            if( node.id == '' )
            {
                console.error( "Please specity an ID to playerawards to support playerawardCollapsedAlignement");
                return ;
            }


            dojo.query( '#'+node.id+' .trophy_large' ).forEach( dojo.hitch( this, function(trophynode) {
                var coords = dojo.position( trophynode );

                if( coords.y != previous_y )
                {
                    // This is a new line!
                    bOddLine = ! bOddLine;
                    previous_y = coords.y;
                }
                dojo.removeClass( trophynode, 'oddawardline evenawardline');
                dojo.addClass( trophynode, bOddLine ? 'oddawardline' : 'evenawardline');
            } ) );
        },

        // Extract the details (league, points, and arena "arelo") from the raw arena double value
        // league_number = number of league for this game. If not set, league_promotion_shortname cannot be returned
        arenaPointsDetails: function( arena_points, league_number )
        {
            var league_to_name = {
                0: __('lang_mainsite', "Bronze league"),
                1: __('lang_mainsite', "Silver league"),
                2: __('lang_mainsite', "Gold league"),
                3: __('lang_mainsite', "Platinum league"),
                4: __('lang_mainsite', "Diamond league"),
                5: __('lang_mainsite', "Elite league")
            };

            var league_to_shortname = {
                0: __('lang_mainsite', "Bronze"),
                1: __('lang_mainsite', "Silver"),
                2: __('lang_mainsite', "Gold"),
                3: __('lang_mainsite', "Platinum"),
                4: __('lang_mainsite', "Diamond"),
                5: __('lang_mainsite', "Elite")
            };

            var league_id = toint( Math.floor( arena_points / 100 ) );

            var league_points = toint( Math.floor( arena_points % 100 ) );

            var arena_elo = 10000 * ( arena_points % 1 );

            var league_name = ( typeof league_to_name[league_id] == 'undefined' ) ? 'Error: unknow league '+league_id : league_to_name[league_id]
            var league_shortname = ( typeof league_to_shortname[league_id] == 'undefined' ) ? 'Error: unknow league '+league_id : league_to_shortname[league_id]

            var league_promotion_shortname = '?';
            if( typeof league_number != 'undefined' )
            {
                var last_league_before_elite = ( league_number - 2 ); // Note: league 4 if there are 6 leagues, league 3 if there are 5 leagues, ... league 0 if there are 2 leagues

                if( league_id == 5 )
                {
                    league_promotion_shortname = '';    // Already Elite
                }
                else if( league_id >= last_league_before_elite )
                {
                    league_promotion_shortname = league_to_shortname[5];    // Next league is always Elite
                }
                else
                {
                    league_promotion_shortname = league_to_shortname[ toint(league_id)+1];  // Next league is league N+1
                }
            }

            if( league_promotion_shortname === null )   // Security (cause null makes the JS crash)
            {   league_promotion_shortname = '?' };
            if( league_name === null )   // Security (cause null makes the JS crash)
            {   league_name = '?' };
            if( league_shortname === null )   // Security (cause null makes the JS crash)
            {   league_shortname = '?' };

            return {
                league: league_id,
                league_name: league_name,
                league_shortname: league_shortname,
                league_promotion_shortname: league_promotion_shortname,
                points: league_points,
                arelo: arena_elo
            };

        },

        // Build the HTML needed to build a Arena points bar content
        arenaPointsHtml: function( arena_points_details )
        {
            var arena_points_html = '';
            var arena_bottom_infos = '';
            var league_name = arena_points_details.league_name;
            var bar_pcent = '';
            var bar_pcent_number = '';

            var league_to_arena_points = {
                0: 10, // bronze
                1: 10, // silver
                2: 10, // gold
                3: 10, // platinum
                4: 10, // diamond
                5: 0  // elite - no max
            };

            var total_points = league_to_arena_points[ arena_points_details.league ];
            if( total_points == 0 )
            {
                // Elite => specific

                arena_points_html += Math.round( arena_points_details.arelo )+' '+_('points');

                // Bar is varing from 30% to 100% when ELO goes from 1200 to 2100
                bar_pcent = 30 + ( Math.min( 2100, Math.max( 1200,  arena_points_details.arelo ) ) - 1200 ) * 70 / ( 2100 - 1200 );
                bar_pcent_number = bar_pcent;
                bar_pcent = 'width:'+Math.round( bar_pcent )+'%';
            }
            else
            {
                var width_pcentage = Math.floor( ( 100 / total_points ) *100 ) / 100;   // Note: thus we make sure to have exactly 2 digits after points.

                for( var i = 0; i< total_points; i++ )
                {
                    if( i < arena_points_details.points )
                    {
                        arena_points_html +='<div class="arena_point_wrap arena_point_wrap_'+i+'" style="width:'+width_pcentage+'%">'+
                                                '<div class="icon32 icon_arena arena_white"  style="opacity:0;"></div>'+
                                                '<div class="icon32 icon_arena arena_shadow"></div>'+
                                                '<div class="icon32 icon_arena arena_colored"></div>'+
                                            '</div>';
                    }
                    else
                    {
                        arena_points_html +='<div class="arena_point_wrap arena_point_wrap_'+i+'" style="width:'+width_pcentage+'%">'+
                                                '<div class="icon32 icon_arena arena_white"></div>'+
                                                '<div class="icon32 icon_arena arena_shadow" style="opacity:0;"></div>'+
                                                '<div class="icon32 icon_arena arena_colored" style="opacity:0;"></div>'+
                                            '</div>';

                    }
                }

                var missing_points = total_points - arena_points_details.points;

                if( typeof arena_points_details.league_promotion_shortname == 'undefined' || arena_points_details.league_promotion_shortname===null )
                {
                    arena_points_details.league_promotion_shortname = '?';  // Security to make sure dojo.string.substitute won't fail
                }

                if( missing_points == 1 )
                {
                    arena_bottom_infos = dojo.string.substitute( _('1 point to ${league}'), { points: missing_points, league: arena_points_details.league_promotion_shortname } ).replace( '1', '<span class="remain_arena_points">1</span>');
                }
                else
                {
                    arena_bottom_infos = dojo.string.substitute( _('${points} points to ${league}'), { points: '<span class="remain_arena_points">'+missing_points+'</span>', league: arena_points_details.league_promotion_shortname } );
                }
            }

            return {
                bar_content: arena_points_html,
                bottom_infos: arena_bottom_infos,
                bar_pcent: bar_pcent,
                bar_pcent_number: bar_pcent_number
            };
        },
                        

        
    });       
    
  
    
});


