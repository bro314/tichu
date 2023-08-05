/* Stock

A stock is an accumulation of game items of the same kind, with extra functionnalities.
Each stock manage a certain number of item "types", that you can add in the stock and remove from the stock.
Stock items are stock control's children and their life is manage directly by stock control (so you don't have to).
Selection functions are provided
 
*/

define("ebg/stock", [
    "dojo", "dojo/_base/declare"
], function( dojo, declare )
{

return declare("ebg.stock", null, {
        constructor: function(){
            this.page = null;
            this.container_div = null;
            this.item_height = null;
            this.item_width = null;
            this.backgroundSize = null;
            
            this.item_type = {};
            this.items = [];
            this.item_selected = {};
            
            this.next_item_id = 1;
            this.control_name = null;
            
            this.selectable = 2;    // Note: selectable = 0: no stock item can be selected
                                    //                    1: 1 stock item can be selected
                                    //                    2: several stock items can be selected

            this.selectionApparance = 'border';         //  _ border: the selected item are bordered with a red line
                                                        //  _ disappear: the selected item disapear from the display (and can't be unselected)
                                                        //  _ class: the class 'stockitem_selected' is added/removed to/from the selected/unselected item (can be overloaded in the game css; by default, 2px red border)
            this.apparenceBorderWidth = '1px';
            this.selectionClass = 'stockitem_selected'
            this.extraClasses = '';

            this.centerItems = false;
            
            this.item_margin = 5;     
            this.autowidth = false;
            this.order_items = true;
            this.horizontal_overlap = 0;
            this.vertical_overlap = 0;
            this.use_vertical_overlap_as_offset = true;
            
            this.onItemCreate = null;
            this.onItemDelete = null;

            this.jstpl_stock_item =  '<div id="${id}" class="stockitem ${extra_classes}" style="top:${top}px;left:${left}px;width:${width}px;height:${height}px;${position};background-image:url(\'${image}\');${additional_style}"></div>';
            
            this.image_items_per_row = null; // If not null, items in global image are in several rows 
            this.image_in_vertical_row = false; // If true, items images row are vertical 
            
            this.hResize = null;

            this.duration = 1000;
        },
        create: function( page, container_div, item_width, item_height )
        {
            console.log( "Create stock control" );
            
            if( typeof container_div == 'string' )
            {
                console.error( "stock::create: second argument must be a HTML object and not a string" );
            }

            if( typeof item_width == 'undefined'  )
            {
                console.error( "stock::create: item_width is undefined" );
            }

            if( typeof item_height == 'undefined'  )
            {
                console.error( "stock::create: item_height is undefined" );
            }

            
            this.page = page;
            this.container_div = container_div;
            this.item_width = item_width;
            this.item_height = item_height;
            this.control_name = container_div.id;
            
            if( dojo.style( this.container_div, "position" ) != 'absolute' )    // Note: if "absolute" positionning, no need to position "relative"
            {   dojo.style( this.container_div, "position", "relative" );   }
            
            this.hResize = dojo.connect(window, "onresize", this, dojo.hitch( this, function(evt){ this.updateDisplay(); } ));

            page.registerEbgControl( this );
        },
        
        destroy: function()
        {
            if( this.hResize !== null )
            {
                dojo.disconnect( this.hResize );
            }
            
            this.items = {};
            
            this.page = null;
            this.container_div = null;
            this.control_name = null;            
        },
        
        // Return item number
        count: function()
        {
            return this.items.length;
        },
        
        // Add a new type of item manageable by this stock
        // (Note: most of the time, all items are on the same image, side by side. image_position specify the position of this item in this aggregation)
        addItemType: function( type, weight, image, image_position )
        {
            if( ! image_position )
            {   image_position = 0; }
            this.item_type[ type ] = { weight: toint(weight), image: image, image_position: image_position };
        },
        
        // Add to stock an item of the specified type
        addToStock: function( type, from )
        {
            var id = this.next_item_id;
            this.next_item_id ++;
            
            this.addToStockWithId( type, id, from );
        },
        
        addToStockWithId: function( type, id, from, specificLocation )
        {
            var newitem = { id: id, type: type };
            console.log( newitem );
            
            var bPushAtTheEnd = true;
            
            if( typeof specificLocation != 'undefined' )
            {
                if( specificLocation == ':first' )
                {
                    bPushAtTheEnd = false;                
                }
                else
                {
                    newitem.loc = specificLocation;
                }                
            }
            
            // If item exists in DOM, destroys it immediately (happens when removing/adding an item with the same id, for ex during a replacement)
            if( $( this.getItemDivId( id ) ) )
            {
				// Check if item still exists in the this.items list
                for( var i in this.items )
                {
                    var item = this.items[ i ];
                    if( item.id == id )
                    {
                        this._removeFromStockItemInPosition( i );
                    }   
                }
                dojo.destroy( this.getItemDivId( id ) );
            }

            if( bPushAtTheEnd )
            {
                this.items.push( newitem );
            }
            else
            {
                this.items.unshift( newitem );
            }

            if( this.order_items )
            {
                var sort_function = function(a,b) { 
                                        if( a.type>b.type ) {   return 1;   }
                                        else if( a.type<b.type ) {   return -1;   }
                                        else { return 0; }
                                     };
                this.sortItems();
            }
            
            this.updateDisplay( from );        
        },
        
        // Remove from stock an item of the specified type
        // If "to" is specified: move item to this position before destroying it
        // Return false if no item was found
        removeFromStock: function( type, to, noupdate )
        {
            for( var i in this.items )
            {
                var item = this.items[ i ];
                if( item.type == type )
                {
                    this._removeFromStockItemInPosition( i, to, noupdate );
                    return true;
                }   
            }
            return false;
        },

        // Remove from stock an item of the specified type
        // If "to" is specified: move item to this position before destroying it
        removeFromStockById: function( id, to, noupdate )
        {
            for( var i in this.items )
            {
                var item = this.items[ i ];
                if( item.id == id )
                {
                    this._removeFromStockItemInPosition( i, to, noupdate );
                    return true;
                }   
            }
            
            return false;
        },

        // Internal method to remove an item at a specific position
        // If "to" is specified: move item to this position before destroying it
        _removeFromStockItemInPosition: function( i, to, noupdate )
        {
			var destroyElementFromStock = function ( node ) { dojo.destroy( node ); };
            var item = this.items[ i ];
            
            // Item deletion hook (allow user to perform some additional item delete operation)
            if( this.onItemDelete )
            {   this.onItemDelete( this.getItemDivId( item.id ), item.type, item.id );  }
            
            this.items.splice( i, 1 );

            // Trigger immediately the disappearance of corresponding item
            var item_id = this.getItemDivId( item.id );
            this.unselectItem( item.id );
            item_div = $( item_id );
            if(typeof to != 'undefined')
            {
                var anim = dojo.fx.chain([
                    
                    this.page.slideToObject( item_div, to ),
                    
                    dojo.fadeOut( { node:  item_div,
                                    onEnd: destroyElementFromStock
                              } )
                ]).play();
            }
            else
            {
                dojo.fadeOut( { node:  item_div,
                                onEnd: destroyElementFromStock
                              } ).play();
            }
            dojo.addClass( item_div, 'to_be_destroyed' );

            if (noupdate !== true) {
                this.updateDisplay();
            }
        },
        
        // Remove all items
        removeAll: function()
        {
            console.log( "removeAll" );
            
            for( var i in this.items )
            {
				var item = this.items[ i ];
            	
            	// Item deletion hook (allow user to perform some additional item delete operation)
				if( this.onItemDelete )
				{   this.onItemDelete( this.getItemDivId( item.id ), item.type, item.id );  }
            }
            
            this.items = [];
            this.item_selected = {};
            
            this.next_item_id = 1;
            
            dojo.empty( this.control_name );
        },
        
        removeAllTo: function( to )
        {
            var ids = [];
            for( var i in this.items )
            {
                ids.push( this.items[i].id );
            }        
            for( var i in ids )
            {
               this.removeFromStockById( ids[i], to, true );
            }
            this.updateDisplay();
        },
        
        // Return the list of item types in the stock now
        getPresentTypeList: function()
        {
            var result = {};
            for( var i in this.items )
            {
                var item = this.items[ i ];
                result[ item.type ] = 1;
            }            
            return result;
        },
        
        // Get item div id from its id
        getItemDivId: function( id )
        {
            return this.control_name+'_item_'+id;
        },
        
        // Update the display completely
        // (if 'from' is defined: moves new items from this location)
        updateDisplay: function( from )
        {
          //  console.log( "stock::updateDisplay" );
            if( ! $(this.control_name) )
            {   return; }   // Stock object has been removed
            
            var controlCoords = dojo.marginBox( this.control_name );

            var item_visible_width = this.item_width;
            var item_visible_width_lastitemlost = 0;
            var itemIndex = 'auto';
            if( this.horizontal_overlap != 0 )
            {
                item_visible_width = Math.round( this.item_width*this.horizontal_overlap/100 );
                item_visible_width_lastitemlost = this.item_width - item_visible_width;
                itemIndex = 1;
            }
            var vertical_overlap_px = 0;
            if( this.vertical_overlap != 0 )
            {
                vertical_overlap_px = Math.round( this.item_height*this.vertical_overlap/100 ) * (this.use_vertical_overlap_as_offset ? 1 : -1);
            }
          //  console.log( controlCoords );
            
            var control_width = controlCoords.w;
            if( this.autowidth )
            {
                var parentControlCoords = dojo.marginBox( $('page-content') );
                control_width = parentControlCoords.w;
                console.log( "autowidth with width="+control_width );
            }

            var currentTop = 0;
            var currentLeft = 0;
            var nbrLines = 0;
            var perLines = Math.max( 1, Math.floor( (control_width-item_visible_width_lastitemlost) / ( item_visible_width + this.item_margin ) ) );
            var lastLine = 0;
            var control_new_width = 0;
            var n=0;
        
            for( var i in this.items )
            {
                var item = this.items[ i ];
                var item_id = this.getItemDivId( item.id );
                if( itemIndex != 'auto' )
                {   itemIndex++;    }
              //  console.log( "item: "+item_id );

                if( typeof item.loc == 'undefined' )
                {                
                    var itemLine = Math.floor( n/perLines );
                    lastLine = Math.max( lastLine, itemLine );
     
                    currentTop = lastLine * ( this.item_height+vertical_overlap_px + this.item_margin );
                    currentLeft = ( n-lastLine*perLines )*( item_visible_width + this.item_margin );                    
                    control_new_width = Math.max( control_new_width, currentLeft + item_visible_width );

                    if( this.vertical_overlap != 0 && n%2==0 && this.use_vertical_overlap_as_offset)
                    {
                        // Vertical overlap for odd cards
                        currentTop += vertical_overlap_px;
                    }
                    
                    // Centering if asked
                    if (this.centerItems) {
						var nbr_in_line = (itemLine == Math.floor( this.count()/perLines ) ? this.count() % perLines : perLines);
						currentLeft += (control_width - nbr_in_line * (item_visible_width + this.item_margin)) / 2;
					}

                    n++; 
                }
                else
                {
                    // Item should be displayed at a specific location
                }                 

                var item_div = $( item_id );
                if( item_div )
                {
                    if( typeof item.loc == 'undefined' )
                    {
                        // Item already exists => move it to its new location
                        dojo.fx.slideTo( {  node: item_div,
                                            top: currentTop,
                                            left: currentLeft,
                                            duration: this.duration,
                                            unit: "px" } ).play();
                    }
                    else
                    {
                        this.page.slideToObject( item_div, item.loc, this.duration ).play();                        
                    }
                    
                    if( itemIndex != 'auto' )
                    {
                        dojo.style( item_div, 'zIndex', itemIndex );
                    }
                }
                else
                {
                    // Item does not exist => create it
                  //  console.log( "create item" );
                    var type = this.item_type[ item.type ];
                    if( ! type )
                    {
                        console.error( "Stock control: Unknow type: "+type );
                    }
                    if( typeof item_id == 'undefined'  )
                    {
                        console.error( "Stock control: Undefined item id" );
                    }
                    else if( typeof item_id == 'object' )
                    {
                        console.error( "Stock control: Item id with 'object' type" );
                        console.error( item_id );
                    }
                    
                    additional_style = '';
                    if( this.backgroundSize !== null )
                    {   additional_style += 'background-size:'+this.backgroundSize; }
                    
                    var item_html = dojo.trim( dojo.string.substitute( this.jstpl_stock_item, {
                                                                                            id: item_id,
                                                                                            width: this.item_width,
                                                                                            height: this.item_height,
                                                                                            top: currentTop,
                                                                                            left: currentLeft,
                                                                                            image: type.image,
                                                                                            position: ( itemIndex=='auto' ) ? '' : ( 'z-index:'+itemIndex ),
                                                                                            extra_classes: this.extraClasses,
                                                                                            additional_style: additional_style
                                                                                        } ) );

                    dojo.place( item_html, this.control_name );

                    item_div = $( item_id );

                    if( typeof item.loc != 'undefined' )
                    {
                        this.page.placeOnObject( item_div, item.loc );
                    }

                    if( this.selectable == 0 )
                    {
                        dojo.addClass( item_div, 'stockitem_unselectable' );
                    }
                    

                    dojo.connect( item_div, "onclick", this, 'onClickOnItem' );
                    
                    if( toint( type.image_position ) !== 0 )
                    {
                        var img_dx=0;
                        var img_dy=0;
                        if( this.image_items_per_row )
                        {
                            // Several rows
                            var row = Math.floor( type.image_position / this.image_items_per_row );
                            if( ! this.image_in_vertical_row )
                            {
                                img_dx = ( type.image_position - ( row*this.image_items_per_row ) ) * 100;
                                img_dy = row * 100;
                            }
                            else
                            {
                                img_dy = ( type.image_position - ( row*this.image_items_per_row ) ) * 100;
                                img_dx = row * 100;
                            }
                            dojo.style( item_div, "backgroundPosition", "-"+img_dx+"% -"+img_dy+"%" );
                        }
                        else
                        {
                            // All in one row
                            img_dx = type.image_position * 100;
                            dojo.style( item_div, "backgroundPosition", "-"+img_dx+"% 0%" );
                        }
                    
                    }
                    
                    // Item creation hook (allow user to perform some additional item creation operation)
                    if( this.onItemCreate )
                    {   this.onItemCreate( item_div, item.type, item_id );  }
                    
                    if(typeof from != 'undefined')
                    {
                        this.page.placeOnObject( item_div, from );

                        if( typeof item.loc == 'undefined' )
                        {
                            var anim = dojo.fx.slideTo( {  node: item_div,
                                                top: currentTop,
                                                left: currentLeft,
                                                duration: this.duration,
                                                unit: "px" } );
                                                
                            anim = this.page.transformSlideAnimTo3d( anim, item_div, this.duration, null );
                            anim.play();

                        }
                        else
                        {
                            this.page.slideToObject( item_div, item.loc, this.duration ).play();
                        }
                    }
                    else
                    {                    
                        dojo.style( item_div, "opacity", 0 );
                        dojo.fadeIn( {node:  item_div } ).play();
                    }
                }
               
            }
            
            var control_height = (lastLine+1) * ( this.item_height + vertical_overlap_px + this.item_margin );
            dojo.style( this.control_name, 'height', control_height+'px' );
            
            if( this.autowidth )
            {
                if( control_new_width>0 )
                {
                    control_new_width += ( this.item_width - item_visible_width );
                }
                dojo.style( this.control_name, 'width', control_new_width+'px' );
            }
        },
        
        // public method to replace all items to their normal place (for ex, after an item dragging)
        resetItemsPosition: function()
        {
            console.log( 'resetItemsPosition' );
            this.updateDisplay();
        },


        //////////////////////////////////////////
        // Items reordering
        
        // Change items weight according to newWeights (item_type_id => new_weight)
        changeItemsWeight: function( newWeights )
        {
            console.log( 'changeItemsWeight' );
            console.log( newWeights );
            for( var type in newWeights )
            {
                var newWeight = newWeights[ type ];
                if( this.item_type[ type ] )
                {
                    this.item_type[ type ].weight = newWeight;
                }
                else
                {   console.error( 'unknow item type'+ type );  }
            }
            
            this.sortItems();
            this.updateDisplay();
        },
        
        sortItems: function()
        {
            var sort_function = dojo.hitch( this, function(a,b) { 
                                        if( this.item_type[a.type].weight > this.item_type[b.type].weight ) {   return 1;   }
                                        else if( this.item_type[a.type].weight < this.item_type[b.type].weight ) {   return -1;   }
                                        else { return 0; }
                                     } );
            this.items.sort( sort_function );       
        },        
        
        //////////////////////////////////////////
        // Items selection / unselection
        
        setSelectionMode: function( mode )
        {
            if( mode != this.selectable ) // ..so we do not unselect all when there is nothing to do
            {
                this.unselectAll();
                this.selectable = mode;     // this.selectable declaration to see values
                
                // Adjust cursor display when the stock items are not selectable
                if (mode == 0) {
				    dojo.query('#'+this.control_name+' .stockitem').addClass('stockitem_unselectable'); // Current items
			    } else {
				    dojo.query('#'+this.control_name+' .stockitem_unselectable').removeClass('stockitem_unselectable'); // Current items
			    }
            }
        },
        
        // Mode => see constructor
        setSelectionAppearance: function( mode )
        {
            this.unselectAll();
            this.selectionApparance = mode;
        },
        
        isSelected: function( id )
        {
            if( this.item_selected[ id ] )
            {
                if( this.item_selected[ id ] == 1 )
                {    return true;       }
            }
            return false;
        },
        
        // Select item with specified id (raw method)
        selectItem: function( id )
        {
            console.log( "Selected item "+id );
            var item_div = $( this.getItemDivId( id ) );
            
            if( this.selectionApparance == 'border' )
            {    dojo.style( item_div, 'borderWidth', this.apparenceBorderWidth );  }
            else if( this.selectionApparance == 'disappear' )
            {    dojo.fadeOut( { node: item_div } ).play();     }
            else if( this.selectionApparance == 'class' )
            {    dojo.addClass( item_div, this.selectionClass );     }
            
            this.item_selected[ id ] = 1;
        },
        
        // Unselect item with specified id (raw method)
        unselectItem: function( id )
        {
            console.log( "Unselect item "+id );
            var item_div = $( this.getItemDivId( id ) );
            
            if( this.selectionApparance == 'border' )
            {    dojo.style( item_div, 'borderWidth', '0px' );  }
            else if( this.selectionApparance == 'disappear' )
            {    dojo.fadeIn( { node: item_div } ).play();      }
            else if( this.selectionApparance == 'class' )
            {    dojo.removeClass( item_div, this.selectionClass );     }
            
            this.item_selected[ id ] = 0;            
        },
        
        selectAll: function()
        {
			var bOneItemChanges = false;
			
            for( var i in this.items )
            {
            	if (!this.isSelected( this.items[ i ].id ) ) {
            		this.selectItem( this.items[ i ].id );            		
            		bOneItemChanges = true;
            	}
            }
            
            if( bOneItemChanges )
            {
                this.onChangeSelection( this.control_name );                    
            }
        },
        
        unselectAll: function()
        {
            var bOneItemChanges = false;
            for( var i in this.items )
            {   
                if( this.isSelected( this.items[i].id ) )
                {
                    this.unselectItem( this.items[i].id );
                    bOneItemChanges = true;
                }
            }          
            
            if( bOneItemChanges )
            {
                this.onChangeSelection( this.control_name );                    
            }
        },
        
        // User clicks on a stock item
        onClickOnItem: function( evt )
        {
            console.log( "onClickOnItem" );
            evt.stopPropagation();
            if( this.selectable !== 0 )
            {
                var prefix_length = ( this.control_name+'_item_' ).length;
                var item_id = evt.currentTarget.id.substr( prefix_length );
                
                if( this.isSelected( item_id ) )
                {    this.unselectItem( item_id );  }
                else
                {
                    if( this.selectable === 1 )
                    {   this.unselectAll(); }                    
                    this.selectItem( item_id );
                }
                    
                this.onChangeSelection( this.control_name, item_id );                        
            }
        },
        
        // Called every time there is a change in the selection
        onChangeSelection: function( control_name, item_id )
        {
            // (to be connected to client methods)
        },
        
        // Get selected items
        getSelectedItems: function( )
        {
            var result = [];
            for( var i in this.items )
            {
                var item = this.items[ i ];
                if( this.isSelected( item.id ) )
                {    result.push( item );  }
            }
            return result;
        },

        // Get unselected items
        getUnselectedItems: function( )
        {
            var result = [];
            for( var i in this.items )
            {
                var item = this.items[ i ];
                if( ! this.isSelected( item.id ) )
                {    result.push( item );  }
            }
            return result;
        },

        
        // Get number of items
        getItemNumber: function()
        {
            return this.items.length;
        },
        
        getAllItems: function()
        {
            var result = [];
            for( var i in this.items )
            {
                result.push( this.items[ i ] );
            }
            return result;        
        },
        
        getItemsByType: function( type )
        {
            var result = [];
            for( var i in this.items )
            {
				if (this.items[ i ].type === type) {
					result.push( this.items[ i ] );
				}
            }
            return result;        
        },
        
        getFirstItemOfType: function( type )
        {
            for( var i in this.items )
            {
				if (this.items[ i ].type === type) {
					return this.items[ i ];
				}
            }
            return null;        
        },
        
        getItemsByWeight: function( weight )
        {
            var result = [];
            for( var i in this.items )
            {
				if (this.item_type[this.items[ i ].type].weight === weight) {
					result.push( this.items[ i ] );
				}
            }
            return result;        
        },
        
        getFirstItemWithWeight: function( weight )
        {
            for( var i in this.items )
            {
				if (this.item_type[this.items[ i ].type].weight === weight) {
					return this.items[ i ];
				}
            }
            return null;        
        },
        
        // Get an item 
        getItemById: function( item_id )
        {   
            for( var i in this.items )
            {
            	if (this.items[ i ].id == item_id) {
            		return this.items[ i ];
            	}
            }
            return null;
        },
        
        // Get type of an item 
        getItemTypeById: function( item_id )
        {   
            for( var i in this.items )
            {
            	if (this.items[ i ].id == item_id) {
            		return this.items[ i ].type;
            	}
            }
            return null;
        },
        
        // Get weight of an item 
        getItemWeightById: function( item_id )
        {
            for( var i in this.items )
            {
            	if (this.items[ i ].id == item_id) {
            		return this.item_type[this.items[ i ].type].weight;
            	}
            }
            return null;
        },
        
        // Select/unselect by type
        selectItemsByType: function( type )
        {   
            for( var i in this.items )
            {
            	if (this.items[ i ].type == type && !this.isSelected( this.items[ i ].id ) ) {
            		this.selectItem( this.items[ i ].id );
            	}
            }
        },
        
        unselectItemsByType: function( type )
        {   
        	for( var i in this.items )
            {
            	if (this.items[ i ].type == type && this.isSelected( this.items[ i ].id ) ) {
            		this.unselectItem( this.items[ i ].id );
            	}
            }           
        },
        
        /// Overlap: overlap cards in order to save space
        setOverlap: function( horizontal_percent, vertical_percent )
        {
            this.horizontal_overlap = horizontal_percent;
            
            if( typeof vertical_percent == 'undefined' )
            {
                this.vertical_overlap = 0;
            }
            else
            {
                this.vertical_overlap = vertical_percent;
            }
            
            this.updateDisplay();
        },
        
        // Change the size of all items
        // Possible only if all items come from the same background image
        resizeItems: function( width, height, backgroundWidth, backgroundHeight )
        {
            this.item_height = height;
            this.item_width = width;

            dojo.query('#'+this.control_name+' .stockitem').style( 'width', width+'px' );
            dojo.query('#'+this.control_name+' .stockitem').style( 'height', height+'px' );

            if( typeof backgroundWidth != 'undefined' && typeof backgroundHeight != 'undefined' )
            {
                dojo.query('#'+this.control_name+' .stockitem').style( 'backgroundSize', backgroundWidth+'px '+backgroundHeight+'px' );
            
                this.backgroundSize = backgroundWidth+'px '+backgroundHeight+'px';    
            }
            
            this.updateDisplay();
        },
        
    });
        

});
