/* Player location: to enter his own location */

define("ebg/playerlocation", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.playerlocation", null, {
        constructor: function(){
            this.page = null;
            this.board_div = null;
            this.board_div_id = null;
            this.board_uid = '_';      // In case 2 boards in on the same page, board uid must be specified (1 caracter ONLY)

            this.template = '<div id="current_localization" style="display:${my_position_visibility}">'+
                '${my_city}: ${position} <a href="#" id="modifycity" class="smalltext">[${LB_CHANGE}]</a>'+
            '</div>'+
            '<div id="current_localization_teasing" style="display:${MY_POSITION_TEASING}">'+
                '<div>${POSITION_TEASING}</div>'+
                '${MY_CITY}: <input type="text" id="cityinput"  size="30" value="${INITIAL_CITY}"></input> <a href="#" class="bgabutton bgabutton_blue" id="savecity"><span>${LB_OK}</span></a>'+
            '</div>'+
            '<form id="profileinfos" name="profileinfos" method="post">'+
                '<input type="hidden" name="city" id="city" value=""></input>'+
                '<input type="hidden" name="lat" id="lat" value="0"></input>'+
                '<input type="hidden" name="lon" id="lon" value="0"></input>'+
                '<input type="hidden" name="loc_city" id="loc_city" value=""></input>'+
                '<input type="hidden" name="loc_area1" id="loc_area1" value=""></input>'+
                '<input type="hidden" name="loc_area2" id="loc_area2" value=""></input>'+
                '<input type="hidden" name="loc_country" id="loc_country" value=""></input>'+
                '<input type="hidden" name="loc_cityprivacy" id="loc_cityprivacy" value=""></input>'+
            '</form>';
            
            this.teasing = '';
            this.googleApiLoaded = false;
            this.jtpl_citychoice = "<input type='radio' name='cityChoice' id='cityChoiceLink_${id}' class='cityChoiceLink' ${checked}>${description}</input><br/>";
            this.locationDialog = null;
            this.cityChoiceResult = null;
            this.callback_url = '';

        },
        create: function( page, board_div_id, teasing, bLoadGoogleApi, callback_url )
        {
            this.page = page;
            this.board_div = $( board_div_id );
            this.board_div_id = board_div_id;
            this.teasing = teasing;
            this.callback_url = callback_url;
            
            var args = {
                my_city: _("My city"),
                my_position_visibility: ( $('initial_position').innerHTML != '' ? 'block' : 'none' ),
                position: $('initial_position').innerHTML,
                LB_CHANGE: _("LB_CHANGE"),
                POSITION_TEASING: this.teasing,
                MY_POSITION_TEASING: ( $('initial_position').innerHTML != '' ? 'none' : 'block' ),
                MY_CITY: _('My city'),
                INITIAL_CITY: $('initial_city').innerHTML,
                LB_OK: _("LB_OK")
            };
            
            var bConnectedUser = false;
            
            if( $('upperrightmenu_loggedin') )
            {
                if( dojo.style( 'upperrightmenu_loggedin', 'display' ) != 'none' )
                {   bConnectedUser = true;  }
            }
            else if( $('disconnected_player_menu' ) )
            {
                if( dojo.style( 'disconnected_player_menu' ) != 'none' )
                {   bConnectedUser = true;  }
            }
            
            if( bConnectedUser ) // only for connected users
            {
                dojo.place( dojo.string.substitute( this.template, args ), this.board_div );

                dojo.connect( $('savecity'), 'onclick', this, 'onSaveCity' );
                dojo.connect( $('modifycity'), 'onclick', this, 'onModifyCity' );

                if( bLoadGoogleApi )
                {
                    // Load Google javascript API
                    var script = document.createElement("script");
                    script.type = "text/javascript";
                    var lang_code = dojoConfig.locale.substr(0,2);
                    script.src = "https://maps.googleapis.com/maps/api/js?key=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&sensor=false&callback=initGoogleApi&language="+lang_code;

                    initGoogleApi = dojo.hitch( this, function() {
                        this.googleApiLoaded = true;
                    } );
                    document.body.appendChild(script); 
                }            
            }            
        },
        
        onModifyCity: function( evt )
        {
            dojo.stopEvent( evt );
            dojo.style( 'current_localization', 'display', 'none' );
            dojo.style( 'current_localization_teasing', 'display', 'block' );

        },        
        onSaveCity: function( evt )
        {
            dojo.stopEvent( evt );
            var city = $('cityinput').value;
            var country = $('country').value;
            if( city != '' )
            {
                // Query Google to validate city & geolocate
                if( typeof google !='undefined' && typeof google.maps != 'undefined' && typeof google.maps.Geocoder!='undefined' )
                {
                    // Google Maps API has been loaded => perform the request
                    geocoder = new google.maps.Geocoder();
                    geocoder.geocode( { 'address': city,
                                        'language': dojoConfig.locale.substr( 0,2 ),
                                        'region': country }, dojo.hitch( this, function(results, status) {
                      if (status == google.maps.GeocoderStatus.OK) {

                        this.cityChoiceResult = results;
                      
                        if( $('locationDialog_content') )
                        {   dojo.destroy( 'locationDialog_content' );   }
                      
                        this.locationDialog = new ebg.popindialog();
                        this.locationDialog.create( 'locationDialog' );
                        this.locationDialog.setTitle( _("Please confirm your city") );
                        this.locationDialog.setMaxWidth( 500 );
                      
                        var html = "<div id='locationDialog_content'>";
                        
                        for( var i in results )
                        {
                            var result = results[i];
                            var description = getLocationDescriptionFromResult( result );
                            
                            html += dojo.string.substitute( this.jtpl_citychoice, {
                                id: i,
                                description: description,
                                checked: ( toint(i)==0 ? "checked='checked'" : "" )
                            } );
                        }
                        
                        html += "<br/>";
                        html += "<input type='checkbox' id='cityprivacy' checked='checked'></input> "+_('Show my city to other players')+' ("'+$('cityinput').value+'")';
                        html += "<br/>";
                        
                        html += "<br/><div style='text-align:center'><a id='validCityChoice' class='button'><span>"+_("Ok")+"</span></a></div>";
                        html += "</div>";   // locationDialog_content

                        this.locationDialog.setContent( html );
                        this.locationDialog.show();
                        
                        dojo.connect( $( 'validCityChoice' ), 'onclick', this, 'onCityChoiceConfirm' );
                        
                        //map.setCenter(results[0].geometry.location);
                      }
                      else if( status == google.maps.GeocoderStatus.ZERO_RESULTS )
                      {
                        this.showMessage( "Sorry, we couldn't found your city", "error" );
                      }
                      else {
                        this.showMessage( "Google Maps error: "+status, 'error' );
                      }
                    } ) );
                }
                else
                {
                    this.page.showMessage( _("Failed to load Google Maps"), 'error' );
                }
            }
      },

      onCityChoiceConfirm: function( evt )
      {
            dojo.stopEvent( evt );
            
            var link_id = 0;
            dojo.query( '.cityChoiceLink' ).forEach( function( node ) {
                if( node.checked )
                {
                    // cityChoiceLink_<id>
                    link_id = node.id.substr( 15 );
                }
            } );
            
            var result = this.cityChoiceResult[ link_id ];
            
            var lat = parseFloat( result.geometry.location.lat() );
            var lon = parseFloat( result.geometry.location.lng() );

            $('lon').value = lon;
            $('lat').value = lat;
            
            var description = analyseLocationDescriptionFromResult( result );
            $('loc_city').value = description.city;
            $('loc_area1').value = description.area1;
            $('loc_area2').value = description.area2;
            $('loc_country').value = description.country;
            $('city').value = $('cityinput').value;
            $('loc_cityprivacy').value = ( $('cityprivacy').checked ? 0 : 1 );
            
            this.locationDialog.destroy();
            
            // Now, save the preferences (with coordinates)
            if( typeof mainsite != 'undefined' )
            {
                // On metasite
                this.page.ajaxcall( '/player/profile/updateCity.html', {form_id: 'profileinfos'}, this, function()
                    {
                        this.page.showMessage( __('lang_mainsite','Profile informations updated !'), 'info' );
                        mainsite.gotourl_forcereload( this.callback_url );
                    },  function( isError ){},
                        "post" );              


            }
            else
            {
                // On gameserver
                this.page.ajaxcall( '/table/table/updateCity.html', {form_id: 'profileinfos'}, this, function()
                    {
                        this.page.showMessage( __('lang_mainsite','Profile informations updated !'), 'info' );
                        location.reload();
                    },  function( isError ){},
                        "post" );              
            }
        },               
    });
});
