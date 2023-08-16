/* Popin dialog interface element */

define("ebg/popindialog", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.popindialog", null, {
        constructor: function(){
            this.id = null;
            this.target_id = null;
            this.container_id = 'ebd-body';
            this.resizeHandle = null;
            this.closeHandle = null;
            this.bCloseIsHiding = false;

            this.onShow = null;
            this.onHide = null;

            this.jstpl_standard_popin = '<div id="popin_${id}" class="standard_popin">'+
                                            '<h2 id="popin_${id}_title" class="standard_popin_title"></h2>'+
                                            '<a href="#" target="_blank" id="popin_${id}_help" class="standard_popin_helpicon"><i class="fa fa-question-circle-o fa-2x" aria-hidden="true"></i></a>'+
                                            '<a href="#" id="popin_${id}_close" class="standard_popin_closeicon"><i class="fa fa-times-circle fa-2x" aria-hidden="true"></i></a>'+
                                            '<div id="popin_${id}_contents" class="clear"></div>'+
                                        '</div>';
        },
        create: function( id, target_id )
        {
            this.id = id;
            this.target_id = target_id;

            if (typeof this.target_id == 'undefined') {
                // Default content anchoring for mainsite and games
                this.target_id = ($('main-content') !== null ? 'main-content' : 'left-side');
            }

            dojo.destroy( 'popin_'+this.id+'_underlay' );
            dojo.place( '<div id="popin_'+this.id+'_underlay" class="standard_popin_underlay"></div>', this.container_id );

            dojo.destroy( 'popin_'+this.id );
            dojo.place( dojo.string.substitute( this.jstpl_standard_popin, {id:this.id} ), this.container_id );
            dojo.style( 'popin_'+this.id+'_help', 'display', 'none' );

            this.closeHandle = dojo.connect( $('popin_'+this.id+'_close'), 'onclick', this, function( evt ) {
                    dojo.stopEvent( evt );
                    
                    if( this.bCloseIsHiding )
                    {
                        this.hide();
                    }
                    else
                    {
                        this.destroy();
                    }
            } );

            this.resizeHandle = dojo.connect(window, "onresize", this, 'adjustSizeAndPosition');
        },
        destroy: function( bAnimate )
        {
            if( this.id == null )
            {   return; }   // Already destroyed


            if( typeof bAnimate == 'undefined' )
            {   bAnimate = true;    }
            
            dojo.disconnect(this.resizeHandle);
            
            if( bAnimate )
            {
                if( $('popin_'+this.id) )
                {
                    var anim = dojo.fadeOut( { node: 'popin_'+this.id } );
                            
                    dojo.connect( anim, 'onEnd', this, function( node ) {
                        if( $('popin_'+this.id) )
                        {
                            dojo.destroy( 'popin_'+this.id );
                        }
                    } );
                
                    anim.play();
                }

                if( $('popin_'+this.id+'_underlay') )
                {
                    var animul = dojo.fadeOut( { node: 'popin_'+this.id+'_underlay' } );
                            
                    dojo.connect( animul, 'onEnd', this, function( node ) {
                        if( $('popin_'+this.id+'_underlay') )
                        {
                            dojo.destroy( 'popin_'+this.id+'_underlay' );
                        }
                        this.id = null;
                    } );
                    
                    animul.play();
                }
            }
            else
            {
                if( $('popin_'+this.id) )
                {
                    dojo.destroy( 'popin_'+this.id );
                }
                if( $('popin_'+this.id+'_underlay') )
                {
                    dojo.destroy( 'popin_'+this.id+'_underlay' );
                }
            }
        },

        replaceCloseCallback: function( callback )
        {
            dojo.disconnect(this.closeHandle);

            this.closeHandle = dojo.connect( $('popin_'+this.id+'_close'), 'onclick', this, callback );
        },
        
        hideCloseIcon: function( )
        {
            dojo.style( 'popin_'+this.id+'_close', 'display', 'none' ); 
        },

        setTitle: function( title )
        {
            if( this.id === null )
            {   
                console.error( "You should CREATE this popindialog first" );
                throw "You should CREATE this popindialog first";
            }
        
            $('popin_'+this.id+'_title').innerHTML = title;
        },

        setMaxWidth: function( maxwidth )
        {
            if( this.id === null )
            {   
                console.error( "You should CREATE this popindialog first" );
                throw "You should CREATE this popindialog first";
            }

            dojo.style( 'popin_'+this.id, 'maxWidth', maxwidth + 'px' );
        },

        setHelpLink: function( url ) {
            $('popin_'+this.id+'_help').href = url;
            dojo.style( 'popin_'+this.id+'_help', 'display', 'block' ); 
        },
        
        setContent: function( html )
        {
            if( this.id === null )
            {   
                console.error( "You should CREATE this popindialog first" );
                throw "You should CREATE this popindialog first";
            }

            $('popin_'+this.id+'_contents').innerHTML = html;
        },

        adjustSizeAndPosition: function() {
            if( !$('popin_'+this.id) )   // if popin no more exists
            {
                    return ;
            }

            if (dojo.style( 'popin_'+this.id, 'display') == 'none') return; // Popin is not displayed, nothing to do

            this.show( false );
        },

        show: function( bAnimate ) {

            if( this.id === null )
            {   
                console.error( "You should CREATE this popindialog first" );
                throw "You should CREATE this popindialog first";
            }
        
            if( typeof bAnimate == 'undefined' )
            {   bAnimate = true;    }
        
            // Display with opacity zero to be able to compute coordinates
            dojo.style( 'popin_'+this.id+'_underlay', 'opacity', '0' );
            dojo.style( 'popin_'+this.id+'_underlay', 'display', 'block' );
            dojo.style( 'popin_'+this.id, 'opacity', '0' );
            dojo.style( 'popin_'+this.id, 'display', 'inline-block' );
            dojo.style( 'popin_'+this.id, 'transform', '' );

            // Center vertically in the visible part of the page
            var bdy = dojo.position( this.container_id );
            var tgt = dojo.position( this.target_id );
            var src = dojo.position( 'popin_'+this.id );
            var top = dojo.style( 'popin_'+this.id, 'top' );
            var screen = dojo.window.getBox();

            var min_y = 43;
            if( typeof gameui != 'undefined' )
            {
                min_y = 65;    // On GS side
            }
            
            var new_top = Math.max(screen.t + min_y,((screen.h - src.h)/2+screen.t)); // Note: +43 is to make sure than very high popin on mobile are never placed over the menu (and therefore cannot be closed)
            
            dojo.style( 'popin_'+this.id, 'top', new_top+'px' );

            // Center horizontally relative to the container
            var new_left = tgt.x + tgt.w/2 - src.w/2;

            if( new_left < 0 )
            {
                // The popin is going to get out the left side of the screen => not good !
                // => center it horizontally with the screen, instead.
                
                new_left = Math.max(0, screen.w/2 - src.w/2);                
            }
            dojo.style( 'popin_'+this.id, 'left', new_left+'px' );

            // For the mobile version, scale the popin if its content makes it wider than its container width (can happen for instance in some games when displaying the scoring breakdown)
            if (dojo.hasClass( 'ebd-body', 'mobile_version' ) && new_left + src.w > bdy.w) {
                dojo.style( 'popin_'+this.id, 'left', '5px' ); // We keep 5px left
                
                var zoomFactor = (bdy.w / (src.w + 10)); // We keep 5px right
                dojo.style('popin_'+this.id, 'transform', 'scale('+zoomFactor+')');
                dojo.style('popin_'+this.id, 'transform-origin', 'left center');
            }

            // Set underlay div size to cover the entire body except the top bar            
            dojo.style( 'popin_'+this.id+'_underlay', 'width', (bdy.w)+'px' );
            dojo.style( 'popin_'+this.id+'_underlay', 'height', (bdy.h - min_y)+'px' );

            // Show           
            
            if( bAnimate )
            { 
                dojo.fadeIn( { node: 'popin_'+this.id+'_underlay' } ).play();
                var anim = dojo.animateProperty({
                  node:'popin_'+this.id+'_underlay',
                  properties: {
                      opacity: 0.7
                  }
                });
                dojo.connect( anim, 'onEnd', this, function( node ) {
                    var bdy = dojo.position( this.container_id );
                    // Set underlay div size to cover the entire body except the top bar (once more, in case some nodes were still loading during the fade-in)
                    dojo.style( 'popin_'+this.id+'_underlay', 'width', (bdy.w)+'px' );
                    dojo.style( 'popin_'+this.id+'_underlay', 'height', (bdy.h - min_y)+'px' );
                } );
                anim.play();            
                          
                dojo.fadeIn( { node: 'popin_'+this.id } ).play();
            }
            else
            {
                dojo.style( 'popin_'+this.id+'_underlay', 'opacity', 0.7 );
                dojo.style( 'popin_'+this.id, 'opacity', 1 );
            }

            if (this.onShow !== null) {
                this.onShow();
            }
        },
        
        hide: function( bAnimate )
        {
            if( this.id === null )
            {   
                console.error( "You should CREATE this popindialog first" );
                throw "You should CREATE this popindialog first";
            }
        
            if( typeof bAnimate == 'undefined' )
            {   bAnimate = true;    }
        

            // Show           
            
            if( bAnimate )
            {
                if( $('popin_'+this.id+'_underlay') )
                { 
                    dojo.fadeOut( { node: 'popin_'+this.id+'_underlay' } ).play();
                    var anim = dojo.animateProperty({
                      node:'popin_'+this.id+'_underlay',
                      properties: {
                          opacity: 0
                      }
                    });

                    dojo.connect( anim, 'onEnd', this, function( node ) {
                        dojo.style( 'popin_'+this.id+'_underlay', 'display', 'none' );
                        dojo.style( 'popin_'+this.id, 'display', 'none' );
                    } );                
                    anim.play();
                }

                if( $('popin_'+this.id) )
                {
                    dojo.fadeOut( { node: 'popin_'+this.id } ).play();
                }
            }
            else
            {
                if( $('popin_'+this.id+'_underlay') )
                {
                    dojo.style( 'popin_'+this.id+'_underlay', 'opacity', 0 );
                    dojo.style( 'popin_'+this.id+'_underlay', 'display', 'none' );
                }

                if( $('popin_'+this.id) )
                {
                    dojo.style( 'popin_'+this.id, 'opacity', 0 );
                    dojo.style( 'popin_'+this.id, 'display', 'none' );
                }
            }   
            
            if (this.onHide !== null) {
                this.onHide();
            }                 
        }

    });       
});
