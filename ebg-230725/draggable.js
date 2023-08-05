/* Draggable: a draggable element */

define("ebg/draggable", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.draggable", null, {
        constructor: function(){
            this.page = null;
            this.item_id = null;
            this.item_div = null;
            
            this.mouse_x_origin = null;
            this.mouse_y_origin = null;
            this.element_x_origin = null;
            this.element_y_origin = null;
            this.is_dragging = false;
            this.is_disabled = false;

            this.dragging_handler = null;
            this.dragging_handler_touch = null;
            
            this.bUseAutomaticZIndex = true;
            this.automatic_z_index = false;
            
            this.bGrid = false;
            this.bSnap = false;
            this.snapCallback = null;
            this.gridSize = 10;
            
            this.draggedThisTime = false;

            this.zoomFactorOriginalElement = 1; // Must be set to a different value if the element or its parent is CSS-zoomed, so the drag can be ok
            
            this.parentRotation = 0;
            
            this.event_handlers = [];
        },
        
        // Note: surface_item_id specify the item to be clicked to start the dragging. If null, same item than item_id
        create: function( page, item_id, surface_item_id )
        {
            this.page = page;
            this.item_id = item_id;
            this.item_div = $( item_id );
            
            // Event
            if( surface_item_id )
            {
                this.event_handlers.push( dojo.connect( $( surface_item_id ), 'onmousedown', this, 'onMouseDown' ) );
                this.event_handlers.push( dojo.connect( $( surface_item_id ), 'ontouchstart', this, 'onMouseDown' ) );
                dojo.style( $( surface_item_id ), 'cursor', 'move' );
            }
            else
            {
                this.event_handlers.push( dojo.connect( this.item_div, 'onmousedown', this, 'onMouseDown' ) );
                this.event_handlers.push( dojo.connect( this.item_div, 'ontouchstart', this, 'onMouseDown' ) );
                dojo.style( this.item_div, 'cursor', 'move' );
            }
            this.event_handlers.push( dojo.connect( $('ebd-body'), "onmouseup", this, "onMouseUp" ) );            
            this.event_handlers.push( dojo.connect( $('ebd-body'), "ontouchend", this, "onMouseUp" ) );
        },
        
        destroy: function()
        {
            for( var i in this.event_handlers )
            {
                dojo.disconnect( this.event_handlers[i] );
            }
        },
        
        // Note : this is NOT possible to use this without a surface
        changeDraggableItem: function( item_id )
        {
            this.item_id = item_id;
            this.item_div = $( item_id );
        },
        
        onMouseDown: function( evt )
        {
            console.log( 'Start dragging' );

            // Note :
            // _ We must STOP this event, otherwise it is transmitted to parent element, and if parent element can be dragged it is dragged with this element, which is not great.
            // _ Previously, we were NOT STOPPING this element for the reason : "// transmit the event, so that we allow the selection of the element in parallel of the possibility to drag it"
            // _ This reason seems obsolete, as we can select the elements with no issue, so we removed the comment and stop the event.
            dojo.stopEvent( evt );        

            if (this.is_disabled) return;
            
            this.mouse_x_origin = evt.pageX;
            this.mouse_y_origin = evt.pageY;
            
            this.element_x_origin = dojo.style( this.item_div, 'left' );
            this.element_y_origin = dojo.style( this.item_div, 'top' );
            
            this.is_dragging = true;
            
            this.parentRotation = this.page.getAbsRotationAngle( this.item_div.parentNode );

            if( this.dragging_handler )
            {   dojo.disconnect( this.dragging_handler );   }
            if( this.dragging_handler_touch )
            {   dojo.disconnect( this.dragging_handler_touch );   }
            this.dragging_handler = dojo.connect( $('ebd-body'), "onmousemove", this, "onMouseMove" );
            this.dragging_handler_touch = dojo.connect( $('ebd-body'), "ontouchmove", this, "onMouseMove" );

            // Compute zoom level associated to the moving item (to adjust its movement during scroll)
            var zoom = 1;
            var current = this.item_div;
            while( current.parentNode )
            {
                var currentZoom = dojo.style( current, 'zoom' );
                if( typeof currentZoom == 'number' || typeof currentZoom == 'string' )
                {
                    zoom *= currentZoom;
                }

                var transform = dojo.style( current, 'transform' );

                if( transform != 'none' )
                {
                    if( transform.substr(0, 7) == 'matrix(')
                    {
                        //var scale_factor = transform.substr( 7 ).split(',')[0];
                        // Correct computation for scale factor https://math.stackexchange.com/questions/13150/extracting-rotation-scale-values-from-2d-transformation-matrix
                        var mtx_a = transform.substr( 7 ).split(',')[0];
                        var mtx_c = transform.substr( 7 ).split(',')[2];
                        var scale_factor = Math.sqrt(mtx_a * mtx_a + mtx_c * mtx_c);
                        
                        if( scale_factor > 0.0001 ) // Chrome changes rotate into a matrix with tiny values instead of zero, such as matrix(6.12323e-17, 1, -1, 6.12323e-17, 0, 0)
                        {
                            zoom *= scale_factor;
                        }
                    }
                }

                current = current.parentNode;

                if(( current.id && current.id=='game_play_area') || current.tagName === 'BODY')
                {
                    // Stop it: we don't consider zoom applied by framework to the reste of the interface, as it is taken into account using this.page.gameinterface_zoomFactor
                    break;
                }
            }
            this.zoomFactorOriginalElement = zoom;

            this.draggedThisTime = false;
            this.onStartDragging( this.item_id, this.element_x_origin, this.element_y_origin );
            
        },
        
        onMouseUp: function( evt )
        {
            // dojo.stopEvent( evt ); Fix for multiple draggable/resizable objects on the same page - since the event is on the body, we must not block the event so that other draggables/resizables also get it
            if (this.is_disabled) return;
            
            if( this.is_dragging === true )
            {
                var vector_abs = {
                    x: evt.pageX - this.mouse_x_origin,
                    y: evt.pageY - this.mouse_y_origin
                };
                
                var vector = this.page.vector_rotate( vector_abs, this.parentRotation );
            
                if( typeof this.page.gameinterface_zoomFactor != 'undefined' )
                {
                    vector.x = vector.x / this.page.gameinterface_zoomFactor;
                    vector.y = vector.y / this.page.gameinterface_zoomFactor;
                }

                if( this.zoomFactorOriginalElement != 1 )
                {
                    vector.x = vector.x / this.zoomFactorOriginalElement;
                    vector.y = vector.y / this.zoomFactorOriginalElement;
                }

                var x = vector.x + this.element_x_origin;
                var y = vector.y + this.element_y_origin;

                if( this.bGrid )
                {   x = Math.round( x/this.gridSize ) * this.gridSize;    }
                if( this.bGrid )
                {   y = Math.round( y/this.gridSize ) * this.gridSize;    }


                this.is_dragging = false;
                dojo.disconnect( this.dragging_handler );
                dojo.disconnect( this.dragging_handler_touch );

                dojo.removeClass( this.item_div, 'dragging_in_progress' );

                console.log( "stop dragging" );
                //document.title = 'stopped...'+Math.round(x)+','+Math.round(y);
                this.onEndDragging( this.item_id, x, y, this.draggedThisTime );
                
                this.dragging_handler = null;
                this.dragging_handler_touch = null;

                if( this.automatic_z_index )
                {
                    // Restore initial z index
                    dojo.style( this.item_id, 'zIndex', 'auto' );
                    this.automatic_z_index = false;
                }

                var bAmostNoDrag = ( Math.abs( x - this.element_x_origin ) < 10 ) && ( Math.abs( y - this.element_y_origin ) < 10 );

                console.log( 'dragged from '+this.element_x_origin+','+this.element_y_origin+' to '+x+','+y );
                if( bAmostNoDrag )
                {
                    console.log( "=> almost no drag" );
                }

                if( bAmostNoDrag )
                {
                    if( evt.type == 'touchend' )
                    {
                        // The item has not been dragged, and has been touch on a touch screen
                        // => to make it coherent with the mouse click on desktop, we must trigger a click on the item
                        // Ex: on Hanabi, allow you to select a card on touchscreen even this is draggable item
                        this.item_div.click();


                    }
                }
            }
        },
        
        onMouseMove: function( evt )
        {
            if (this.is_disabled) return;
            
            if( this.is_dragging === true )
            {
                var vector_abs = {
                    x: evt.pageX - this.mouse_x_origin,
                    y: evt.pageY - this.mouse_y_origin
                };
                
                var vector = this.page.vector_rotate( vector_abs, this.parentRotation );


                if( typeof this.page.gameinterface_zoomFactor != 'undefined' )
                {
                    vector.x = vector.x / this.page.gameinterface_zoomFactor;
                    vector.y = vector.y / this.page.gameinterface_zoomFactor;
                }

                if( this.zoomFactorOriginalElement != 1 )
                {
                    vector.x = vector.x / this.zoomFactorOriginalElement;
                    vector.y = vector.y / this.zoomFactorOriginalElement;
                }


                var x = vector.x + this.element_x_origin;
                var y = vector.y + this.element_y_origin;

                //document.title = 'draggin...'+Math.round(x)+','+Math.round(y);
                //document.title = this.page.gameinterface_zoomFactor+' / '+this.zoomFactorOriginalElement;

                if( this.bSnap && this.parentRotation==0 ) // Note : there's no use with snapping when the item has rotated
                {   
                    var coords = this.snapCallback( x, y );
                    x = coords.x;
                    y = coords.y;
                }
                else if( this.bGrid )
                {   
                    y = Math.round( y/this.gridSize ) * this.gridSize;    
                    x = Math.round( x/this.gridSize ) * this.gridSize;    
                }
                
                dojo.style( this.item_div, "left", x+"px" );
                dojo.style( this.item_div, "top", y+"px" );
                
                if( this.draggedThisTime == false )
                {
                    dojo.addClass( this.item_div, 'dragging_in_progress' );
                    this.draggedThisTime = true;

                    if( this.bUseAutomaticZIndex && ( dojo.style( this.item_id, 'zIndex' ) == 'auto' ) )
                    {
                        this.automatic_z_index = true;
                        dojo.style( this.item_id, 'zIndex', 1000 );
                    }
                }
                this.onDragging( this.item_id, x, y, x - this.element_x_origin, y - this.element_y_origin );
                
                dojo.stopEvent( evt );
            }
        },
        
        disable: function( cursorType )
        {
            this.is_disabled = true;
            
            if (this.item_div) {
                if (cursorType) {
                    dojo.style( this.item_div, 'cursor', cursorType );
                } else {
                    dojo.style( this.item_div, 'cursor', 'default' );
                }
            }
        },
        
        enable: function( )
        {
            this.is_disabled = false;
            
            if (this.item_div) {
                dojo.style( this.item_div, 'cursor', 'move' );
            }
        },
        
        // Hook functions for controls clients
        onStartDragging: function( item_id, left, top )
        {
        },
        onEndDragging: function( item_id, left, top, bDragged )
        {
        },
        onDragging: function( item_id, left, top, dx, dy )
        {
        }
        
    });
});
