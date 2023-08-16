/* Chatinput: a chat input with extra functionalities */

define("ebg/chatinput", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.chatinput", null, {
        constructor: function(){
            this.page = null;
            this.container_id = null;
            this.post_url = '';
            this.default_content = '';
            this.input_div = null;
            this.baseparams = {};
            this.detachType = null;
            this.detachId = null;
            this.detachTypeGame = null;
            this.callbackBeforeChat = null;
            this.callbackAfterChat = null;
            this.callbackAfterChatError = null;

            // X is writing now feature
            this.writingNowChannel = null;
            this.bWritingNow = false;
            this.writingNowTimeout = null;
            this.writingNowTimeoutDelay = 8000; // 8 seconds
            this.lastTimeStartWriting = null;
            
            this.max_height = 100;
            this.bIncreaseHeightToTop=true;
        },
        create: function( page, container_id, post_url, default_content )
        {
            console.log( "Chatinput creation" );

            this.page = page;
            this.container_id = container_id;
            this.post_url = post_url;
            this.default_content = default_content;
            
            if( ! $(this.container_id) )
            {   return false;   }
            
            dojo.empty( this.container_id );

            var input_id = this.container_id+'_input';
            
            var detachurl = "onclick='window.open(\"/?detachChatType="+this.detachType+"&detachChatId="+this.detachId+"\", \"notif"+this.detachType+this.detachId+"\", \"scrollbars=yes,width=280px,height=500px\" );return false;'";

            if( this.detachType == 'playtable' )
            {
                // Specific case: game view
                detachurl = "onclick='window.open(\"/"+this.detachTypeGame+"?detachChatType="+this.detachType+"&table="+this.detachId+"\", \"notif"+this.detachType+this.detachId+"\", \"scrollbars=yes,width=280px,height=500px\" );return false;'";
            }
            
//            dojo.place( "<div class='chatinputctrl'><input type='text' id='"+input_id+"' class='chatinput' value='' maxlength='300' autocomplete='off'/><div id='chatinputdetach_"+this.container_id+"' class='icon20 icon20_detach chatinputdetach' "+detachurl+" ></div></div>", $( this.container_id ) );
            dojo.place( "<div class='chatinputctrl'><textarea id='"+input_id+"' class='chatinput' value='' style='overflow:hidden;resize: none;' rows='1' maxlength='300'  style='resize:none'></textarea></div>", $( this.container_id ) );
            // Note: we used to add "autocomplete='off' here, to avoid auto-suggest when cliquing on the chat input. However, users are complaining that this turn off the spellchecker (especially on mobile)

            this.input_div = $( input_id );
            
            dojo.connect( this.input_div, "onkeyup", this, "onChatInputKeyUp" );
            dojo.connect( this.input_div, "onkeypress", this, "onChatInputKeyPress" );

            dojo.connect( this.input_div, "onfocus", this, "onChatInputFocus" );
//            dojo.connect( this.input_div, "onblur", this, "onChatInputBlur" );
            this.input_div.placeholder = default_content;   
            
        },
        
        destroy: function()
        {
            if( $(this.container_id) )
            {   dojo.empty( this.container_id );    }
        },
        
        sendMessage: function()
        {
            var params = dojo.clone( this.baseparams );
            params.msg = this.input_div.value;

            if( this.callbackBeforeChat !== null )
            {
                if( ! this.callbackBeforeChat( params, this.post_url ) )
                {   return; } // Cancel chat input
            }

            if( typeof this.post_url_bis != 'undefined' )
            {
                // We don't want notif because the notif will be sent by the post_url_bis action anyway
                params.no_notif = 1;
            }

            this.page.ajaxcall( this.post_url, params, this, function( result ){
                this.input_div.value='';  

                this.readaptChatHeight();
                
                if( this.callbackAfterChat !== null )
                {
                    this.callbackAfterChat( params );
                }                    
                              
            }, function( isError ){
                if( isError )
                {
                    if( this.callbackAfterChatError !== null )
                    {
                        this.callbackAfterChatError( params );
                    }                    
                }                
            }, "post" );
        
            if( typeof this.post_url_bis != 'undefined' )
            {
                // Note: used with chat_on_gs_side (ex: werewolves) to log the chat on MS side too
                delete params.no_notif;
                this.page.ajaxcall( this.post_url_bis, params, this, function( result ){
                }, function( isError ){
                }, "post" );                
            }
        },

         onChatInputKeyPress: function( evt )
         {
            if( evt.keyCode == dojo.keys.ENTER )
            {
                // This way, the new line do not appear into the textarea
                dojo.stopEvent( evt );
            }         
         },
        
         onChatInputKeyUp: function( evt )
         {
            if( evt.keyCode == dojo.keys.ENTER )
            {
                dojo.stopEvent( evt );
                this.input_div.value = this.input_div.value.replace(/(\r\n|\n|\r)/gm, "");

                console.log( 'Sending chat message...' );
                this.sendMessage();

                // No more writing (message sent)
                this.lastTimeStartWriting = null;
                

                return true;
            }
            
            // We are writing right now!
            var now = Math.floor(Date.now() / 1000);
            
            if( this.lastTimeStartWriting === null ||   now >= this.lastTimeStartWriting+5 )
            {
                // If we didn't signal this "start writing" during the last 5 seconds, signal it (or signal it again)
                if( typeof this.page.socket != 'undefined' )
                {
                    this.page.socket.emit( 'startWriting', this.writingNowChannel );
                }
                this.lastTimeStartWriting = now;
            }
            
            // Adapt the textarea height to the text
            this.readaptChatHeight();
            
            return false;
         },
         
         readaptChatHeight: function()
         {
            var previous_top = dojo.style( this.input_div, 'top' );
            var previous_height = dojo.style( this.input_div, 'height' );
            dojo.style( this.input_div, 'height', "0px" );
            var new_height = Math.max( 20, Math.min( this.input_div.scrollHeight+1, this.max_height) ); // Note: min = 20 px
            dojo.style( this.input_div, 'height', new_height + "px" );

            if( this.bIncreaseHeightToTop )
            {
                var delta = new_height - previous_height;
                var new_top = previous_top - delta;
                
                dojo.style( this.input_div, 'top', new_top + 'px' );
            }         
         },
         
         
         onChatInputFocus: function( evt )
         {
            console.log( "chat input gains focus" );
            
            // Note: this method may be overrided by chatinput users
  
// DEPRECATED : now we are using "placeholder" HTML5 attribute          
//            if( this.input_div.value == this.default_content )
//            {   this.input_div.value = '';  }
         },
         
         onChatInputBlur: function( evt )
         {
            console.log( "chat input loose focus" );
// DEPRECATED : now we are using "placeholder" HTML5 attribute          
//            if( this.input_div.value == '' )
//            {   this.input_div.value = this.default_content;  }
         },
         
         addContentToInput: function( text )
         {
// DEPRECATED : now we are using "placeholder" HTML5 attribute          
//            if( this.input_div.value == this.default_content )
//            {   this.input_div.value = '';  }

            this.input_div.value += text;         
         }
  }); 
});
