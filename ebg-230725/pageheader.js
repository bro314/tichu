/* Expandable section */

define("ebg/pageheader", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.pageheader", null, {
        constructor: function(){
            this.page = null;
            this.div_id = null;
            this.adaptsubtrigger= null;
            this.bDisableAdaptMenu = false;
            this.bUpdateQueryString = false;
        },
        create: function( page, target_div, buttons, bAllByDefault, bUpdateQueryString )
        {
            this.page = page;
            this.div_id = target_div;
            this.buttons = buttons;
            this.bAllByDefault = bAllByDefault;
            if (typeof bUpdateQueryString == 'undefined') {
                this.bUpdateQueryString = true;
            } else {
                this.bUpdateQueryString = bUpdateQueryString;
            }

            if( ! bAllByDefault )
            {
                this.hideAllSections();
            }
            
            for( var i in buttons )
            {
                var button = buttons[i];
                dojo.connect( $( button.btn ), 'onclick', this, 'onClickButton' );

                if( typeof button.defaults != 'undefined' && button.defaults )
                {
                    this.showSection( button.section, button.btn );
                }
            }
            
            dojo.query( '#'+target_div+' h2' ).connect( 'onclick', this, 'onClickHeader' );

            this.adaptsubtrigger = dojo.connect(window, "onresize", this, dojo.hitch( this, 'adaptSubmenu' ));
            this.adaptSubmenu();            
        },
        
        destroy: function()
        {
            if( this.adaptsubtrigger !== null )
            {

                dojo.disconnect( this.adaptsubtrigger );
                this.adaptsubtrigger = null;
            }
        },
        
        adaptSubmenu: function()
        {
            // Check if there is enough width for our submenu

            if( this.bDisableAdaptMenu )
            {   return; }

            if( $( this.div_id ) )
            {
                dojo.removeClass( this.div_id, 'pageheader_menu_smallwidth' );
                var y = null;
                var bOneMenuItemNotFit = false;

                dojo.query( '#'+this.div_id+' .pageheader_menuitem' ).forEach( function( node ) {

                    if( dojo.style( node, 'display' ) != 'none' )
                    {
                        var pos = dojo.position( node );

                        // Or if one menu item is on an additional line
                        if( y === null )
                        {
                            y = pos.y;
                        }
                        else
                        {
                            if( Math.abs( y - pos.y ) > 10 )
                            {
                                bOneMenuItemNotFit = true;
                            }
                        }
                    }
                } );
             
                if( bOneMenuItemNotFit )
                {
                    dojo.addClass( this.div_id, 'pageheader_menu_smallwidth' );
                }            
            }
        },
        
        getSelected: function()
        {
            var items = dojo.query( '#'+this.div_id+' .pageheader_menuitemselected' );
            if( items.length != 1 )
            {   return null ;   }
            else
            {
                return items[0].id;
            }
        
        },

        getNumberSelected: function()
        {
            var items = dojo.query( '#'+this.div_id+' .pageheader_menuitemselected' );

            return items.length;
        },
        
        
        hideAllSections: function()
        {
            for( var i in this.buttons )
            {
                dojo.query( '#'+this.div_id+' .pageheader_menuitemselected' ).removeClass( 'pageheader_menuitemselected' );
                if( typeof this.buttons[i].section == 'object' )
                {
                    for( var j in this.buttons[i].section )
                    {
                        if( $( this.buttons[i].section[j] ) )
                        {                    
                            dojo.style( this.buttons[i].section[j], 'display', 'none' );            
                        }
                        else
                        {
                            console.error( "pageheader coulnd find : "+this.buttons[i].section[j] );
                        }
                    }
                }
                else
                {
                    if( $(this.buttons[i].section) )
                    {
                        dojo.style( this.buttons[i].section, 'display', 'none' );                            
                    }
                    else
                    {
                        console.error( "pageheader: "+this.buttons[i].section+" does not exists" );
                    }
                }
            }
            
            // Hide sections which are not in any sections
            dojo.query( '#'+this.div_id+' .pageheader_hide_if_not_active' ).style( 'display', 'none' );
        },
        
        
        
        showDefault: function()
        {
            if( this.bAllByDefault )
            {
                // Show everything
                for( var i in this.buttons )
                {
                    var button = this.buttons[i];
                    if( typeof button.section == 'object' )
                    {
                        for( var i in button.section )
                        {
                            if( $( button.section[i] ) )
                            {
                                dojo.style( button.section[i], 'display', 'block' );
                            }
                            else
                            {
                                console.error( "pageheader coulnd find : "+button.section[i] );
                            }
                        }
                    }
                    else
                    {
                        dojo.style( button.section, 'display', 'block' );
                    }
                }  

                dojo.query( '#'+this.div_id+' .pageheader_menuitemselected' ).removeClass( 'pageheader_menuitemselected' );
                dojo.query( '#'+this.div_id+' .pageheader_hide_if_not_active' ).style( 'display', 'block' );
                
                this.updateQueryString( '' );
            }
            else
            {
                this.hideAllSections();
                for( var i in this.buttons )
                {
                    var button = this.buttons[i];

                    if( typeof button.defaults != 'undefined' )
                    {
                        this.showSection( button.section, button.btn );
                    }
                }        
            }        
        },
        

        showSection: function( section, btn )
        {
            if( typeof section != 'undefined' && section !== null && $(section) )
            {
                if( typeof section == 'object' )
                {
                    for( var i in section )
                    {
                        dojo.style( section[i], 'display', 'block' );   
                    }
                }
                else
                {
                    dojo.style( section, 'display', 'block' );   
                }
            }

            dojo.addClass( btn, 'pageheader_menuitemselected' );   

            this.updateQueryString( btn );

            this.onSectionChanged();
        },
        
        // To be linked
        onSectionChanged: function()
        {// Write nothing here
        },
        
        onClickButton: function( evt )
        {
            dojo.stopEvent( evt );
            this.showSectionFromButton( evt.currentTarget.id );
        },
        
        showSectionFromButton: function( button_id )
        {
            for( var i in this.buttons )
            {
                var button = this.buttons[i];
                if( button.btn == button_id )
                {
                    // Active it !
                    this.hideAllSections();
                    this.showSection( button.section, button.btn );
                    
                    if( typeof button.onShow != 'undefined' )
                    {
                    	button.onShow();
                    }
                    if( typeof button.onHide != 'undefined' )
                    {
                    	button.onHide();
                    }
                }
            }
        
        },
        
        onClickHeader: function( evt )
        {
//            dojo.stopEvent( evt );    // We don't stop this event to let the possibility to have a link on header
            this.showDefault();
        },
        
        updateQueryString: function( btn )
        {
            if (!this.bUpdateQueryString) {
                return;
            }
            
            var querystring = '';
            var currentUrl = window.location.search;
            var parts = currentUrl.split("?");
            if( parts.length >= 2 && parts[1].length>0 )
            {
                for( var i=1; i<parts.length; i++ )
                {
                    if( i>1 )
                    {
                        querystring += '%3F';// Replace all '?' in query string by URL equivalent '%3F' (this makes queryToObject method crazy ...)
                    }
                    querystring += parts[i];
                }
                module = parts[0];
            }
            else
            {    module = currentUrl;		}

            var args = dojo.queryToObject( querystring );
            
            // pageheader_<urlpart>
            if( btn === '' || this.getNumberSelected() !== 1 )
            {
                args.section=null;
                delete args.section;
            }
            else
            {
                args.section = btn.substr( 11 );
            }
            
            querystring = dojo.objectToQuery( args );
            
            var url = module;
            if( querystring != '' )
            {
                url += '?'+querystring ;
            }

            
            if( window.location.search != url && typeof mainsite !== 'undefined' )
            {
                mainsite.disableNextHashChange = true;
                history.pushState(null, '', window.location.pathname+url);
            }        
        },        

    });       
});
