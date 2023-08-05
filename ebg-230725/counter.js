/* Counter: a number which is animated when changing its value */

define("ebg/counter", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.counter", null, {
        constructor: function(){
            this.span = null;
            this.current_value = 0;
            this.target_value = 0;
            this.speed = 100;   // Duration between two value
        },
        create: function( target_span )
        {
            if( typeof target_span == 'string' )
            {   target_span = $(target_span);   }
            this.span = target_span;
            this.span.innerHTML = this.current_value;
        },
        getValue: function()
        {
            return this.target_value;
        },
        setValue: function( value )
        {
            this.current_value = toint( value );
            this.target_value = toint( value );
            this.span.innerHTML = this.current_value;
        },
        // Animate counter to specified value
        toValue: function( value )
        {
            this.target_value = toint( value );
//            console.log( 'toValue' );
            
            if( this.current_value != this.target_value )
            {
                dojo.addClass( this.span, 'counter_in_progress' );     
            }   
            setTimeout( dojo.hitch( this, this.makeCounterProgress ), this.speed);
        },
        
        incValue: function( increment )
        {
            this.toValue( parseInt( this.target_value, 10 ) + parseInt( toint( increment ), 10 ) );
            return this.target_value;
        },
        
        disable: function()
        {
            this.span.innerHTML = '-';
        },
        
        // Private
        // make the counter progress
        makeCounterProgress: function()
        {
//            console.log( this.current_value+'->'+this.target_value );

            if( this.current_value == this.target_value )
            {
                setTimeout( dojo.hitch( this, this.finishCounterMove ), 1000 );
                return;    
            }
        
            var increment = Math.ceil( Math.abs( this.target_value - this.current_value ) / 5 );
            
        
            if( this.current_value < this.target_value )
            {    
                this.current_value+= increment;  
            }
            else
            {    this.current_value-=increment;  }
                
            
            this.span.innerHTML = this.current_value;
            
            setTimeout( dojo.hitch( this, this.makeCounterProgress ), this.speed);
        },
        finishCounterMove: function()
        {
            if( this.current_value == this.target_value )
            {
                dojo.removeClass( this.span, 'counter_in_progress' );     
            }        
        }
   });
});
