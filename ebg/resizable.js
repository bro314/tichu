/* Resizable: a resizable element; resizing is done by dragging from the bottom right */

define("ebg/resizable", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.resizable", null, {
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
            
            this.element_w_origin = null;
            this.element_h_origin = null;

            this.dragging_handler = null;
            
            this.width_resize = true;
            this.height_resize = true;
            this.resize_parent = false;
            
            this.automatic_z_index = true;
        },
        
        // Note: surface_item_id specify the item to be clicked to start the dragging. If null, same item than item_id
        create: function( page, item_id, surface_item_id, width_resize, height_resize, resize_parent )
        {
            this.page = page;
            this.item_id = item_id;
            this.item_div = $( item_id );
            
            if (width_resize === false) {
				this.width_resize = false;
			}
			if (height_resize === false) {
				this.height_resize = false;
			}
			if (resize_parent === true) {
				this.resize_parent = true;
			}
            
            // Event
            if( surface_item_id )
            {
                dojo.connect( $( surface_item_id ), 'onmousedown', this, 'onMouseDown' );
            }
            else
            {
                dojo.connect( this.item_div, 'onmousedown', this, 'onMouseDown' );
            }
            dojo.connect( $('ebd-body'), "onmouseup", this, "onMouseUp" );
        },
        
        onMouseDown: function( evt )
        {
            console.log( 'Start dragging' );
            dojo.stopEvent( evt );         
            if (this.is_disabled) return;
            
            var box = dojo.marginBox( this.item_div );  // Cannot use dojo.position because of override in core.js causing recursion error
            this.element_w_origin = box.w;
            this.element_h_origin = box.h;
            
            this.mouse_x_origin = evt.pageX;
            this.mouse_y_origin = evt.pageY;
            
            var element_coords = dojo.marginBox( this.item_div );
            console.log( element_coords );
            this.element_x_origin = element_coords.l;
            this.element_y_origin = element_coords.t;
            
            this.is_dragging = true;

            if( this.dragging_handler )
            {   dojo.disconnect( this.dragging_handler );   }
            this.dragging_handler = dojo.connect( $('ebd-body'), "onmousemove", this, "onMouseMove" );

            this.onStartDragging( this.item_id, this.element_x_origin, this.element_y_origin );
            
            if( dojo.style( this.item_id, 'zIndex' ) == 'auto' )
            {
                this.automatic_z_index = true;
                dojo.style( this.item_id, 'zIndex', 1000 );
            }
        },
        
        onMouseUp: function( evt )
        {
            // dojo.stopEvent( evt ); Fix for multiple draggable/resizable objects on the same page - since the event is on the body, we must not block the event so that other draggables/resizables also get it
            
            if (this.is_disabled) return;
            
            if( this.is_dragging === true )
            {
                var x = evt.pageX - this.mouse_x_origin + this.element_x_origin;
                var y = evt.pageY - this.mouse_y_origin + this.element_y_origin;

                this.is_dragging = false;
                dojo.disconnect( this.dragging_handler );
                console.log( "stop dragging" );
                this.onEndDragging( this.item_id, x, y );

                if( this.automatic_z_index )
                {
                    dojo.style( this.item_id, 'zIndex', 'auto' );
                }
            }
        },
        
        onMouseMove: function( evt )
        {
            evt.preventDefault();
            if (this.is_disabled) return;
            
            if( this.is_dragging === true )
            {
				if (this.width_resize) {
					var deltax = evt.pageX - this.mouse_x_origin;
					dojo.style( this.item_div, "width", (this.element_w_origin + deltax)+"px" );
				}
				if (this.height_resize) {
					var deltay = evt.pageY - this.mouse_y_origin;
					dojo.style( this.item_div, "height", (this.element_h_origin + deltay)+"px" );
				}
				
				if (this.resize_parent && this.item_div.parentNode) {
					var box = dojo.marginBox( this.item_div );  // Cannot use dojo.position because of override in core.js causing recursion error
					dojo.style( this.item_div.parentNode, "width", box.w+"px" );
					dojo.style( this.item_div.parentNode, "height", box.h+"px" );
				}
				                
                this.onDragging( this.item_id, deltax, deltay );
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
        onEndDragging: function( item_id, left, top )
        {
        },
        onDragging: function( item_id, left, top )
        {
        }
        
    });
});
