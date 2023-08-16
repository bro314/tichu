/* eBoardGames common features */

define("ebg/core/common", [
    "dojo",
    "dojo/date"
], function( dojo ){

getStaticAssetUrl = function( filepath )
{
    var matchpath = './' + filepath;

    if (g_staticassets === null) {
        console.error( 'Error: g_staticassets is null', filepath );
        return g_themeurl + filepath;
    }
    
    var found = g_staticassets.find(function(element) { return element.file == matchpath; });

    if (typeof found != 'undefined') {
        return g_themeurl.substr(0, g_themeurl.length - 12) + found.version + '/' + filepath;
    } else {
        return g_themeurl + filepath;
    }
};

// End a synchronous notification
endnotif = function()
{
    dojo.publish( "notifEnd", null );
};

bga_format = function( string, replacements ) {
    for (const key in replacements) {
        let escapedKey = key;
        if (key.length !== 1) {
            console.warn("bga_format punctuation characters must be 1 character");
            continue;
        }
        const brackets = {
            '{': '}',
            '[': ']',
            '(': ')',
        };
        const keyLeft = key;
        const keyRight = brackets[key] || key;
        const escape = (k) => {
            if (['-', '[', ']', '{', '}', '(', ')', '*', '+', '?', '.', ',', '\\', '^', '$', '|', '#', ' '].includes(k)) {
                return '\\' + k;
            }
            return k;
        };
        // Wrap all instances of {key}something{key} with a span
        const regex = new RegExp(`${escape(keyLeft)}(.*?)${escape(keyRight)}`, "g");
        let replacer = replacements[key];
        if (typeof replacer != "function") {
            const clazz = replacer;
            replacer = text => `<span class="${clazz}">${text}</span>`;
        }
        string = string.replace(regex, (match, p) => replacer(p));
    }
    return string;
};

// Format a relative time (ex: 2mn)
// NB: this function should not be used to compose strings as it would create untranslatable results for some languages. See time_ago_format function if needed.
time_format = function( mn )
{
    if( mn < 60 )
    {    return mn+' mn'; }
    else if( mn < 75 )  // 1h -> 1h15 = 1h
    {    return '1h'; }
    else if( mn < 105 )     // 1h15 => 1h45 => 1h30
    {    return '1h30'; }
    else
    {
        var h = Math.round( mn/60 );
        if( h < 24 )
        {    return h+' h'; }
        else
        {
            var d = Math.round( h/24 );
            if( d == 1 )
            {    return ' ' + __('lang_mainsite','one day');	}
            else
            {
                if( d < 60 )
                {
                    return d + ' ' + __('lang_mainsite','days');	
                }
                else if( d < 366 )
                {
                    var m = Math.round( d/30.5 ); // Note : approximate
                    return m + ' ' + __('lang_mainsite','months');	                
                }
                else
                {
                    var y = Math.round( d/365.25 ); // Note : approximate
                    if( y == 1 )
                    {
                        return __('lang_mainsite','one year');	                                    
                    }
                    else
                    {
                        return y + ' ' + __('lang_mainsite','years');	                
                    }
                }

            }
        }
    }
};

// Format a relative past time (ex: 2mn ago)
time_ago_format = function( mn )
{
    if (isNaN(mn)) return '';
    
    const locale = dojoConfig.locale == 'zh' ? 'zh-tw' : dojoConfig.locale;

    if (! Intl || ! Intl.RelativeTimeFormat) {
        // If not able to show relative time, show a locale formatted non-relative datetime
        return new Date(new Date() - 1000 * 60 * mn).toLocaleString();

    }

    const rtf = new Intl.RelativeTimeFormat(locale, { style: 'long' });
    
    if( mn < 60 )
    {    return rtf.format(-1 * mn, 'minute'); }
    else if( mn < 75 )  // 1h -> 1h15 = 1h
    {    return rtf.format(-1, 'hour'); }
    else if( mn < 105 )     // 1h15 => 1h45 => 1h30
    {    return __('lang_mainsite', '${hour}h${mn} ago').replace('${hour}', '1').replace('${mn}', '30'); }
    else
    {
        var h = Math.round( mn/60 );
        if( h < 24 )
        {    return rtf.format(-1 * h, 'hour'); }
        else
        {
            var d = Math.round( h/24 );
            if( d < 60 )
            {
                return rtf.format(-1 * d, 'day');
            }
            else if( d < 366 )
            {
                var m = Math.round( d/30.5 ); // Note : approximate
                return rtf.format(-1 * m, 'month');
            }
            else
            {
                var y = Math.round( d/365.25 ); // Note : approximate
                return rtf.format(-1 * y, 'year');
            }
        }
    }
};

// Format a complete date:
// _ if this date is close to current date, format date in a relative format
// _ otherwiser, format date in a common format
// if bExact = false, give an imprecise information (to increase readability)
// bDayOnly = true: display only the day (note: works only in exact mode)
// if bDisplayTimeZone = true: display also the timezone next to the time
date_format = function( timestamp, bExact, bDayOnly, bDisplayTimeZone )
{
    var now = new Date();
    var date = new Date( timestamp*1000 );
    
    if( typeof bDisplayTimeZone == 'undefined' )
    {   bDisplayTimeZone = false;   }

    // Should we use ISO?
    var bFormatDateUseIso = false;
    if (typeof globalUserInfos != 'undefined' && typeof globalUserInfos.date_use_iso != 'undefined')
        bFormatDateUseIso = globalUserInfos.date_use_iso;

    var timezone = '';
    if( bDisplayTimeZone )
    {
        timezone = ' ('+mainsite.timezone.replace('_',' ')+')';
    }
    
    var diff = ( Math.abs( now.getTime() - date.getTime() ) ) / 1000;
    var bFuture = ( date.getTime() >= now.getTime() );
    
    if( typeof bDayOnly == 'undefined' )
    {   bDayOnly = false;   }
    
    if( bDayOnly )
    {
        // Simple case: display only the date
        return dojo.string.substitute( ( bFormatDateUseIso ? '${Y}-${M}-${D}' : __('lang_mainsite','${M}/${D}/${Y}') ), {
            M: zeroFill( date.getMonth()+1, 2 ),
            D: zeroFill( date.getDate(), 2 ),
            Y: 1900+date.getYear()
        } );    
    }
    else
    {    
        if( diff < 3600 )   // +/- 1 hour around now
        {
            var mn = Math.round( diff/60 );
        
            if( bFuture )
            {   return dojo.string.substitute( __('lang_mainsite', 'in ${mn} min'), { mn:mn } );    }
            else
            {   return dojo.string.substitute( __('lang_mainsite', '${mn} min ago'), { mn:mn } );    }
        }
        else if( diff < 4*3600 )    // +/- 4 hours around now
        {
            if( bExact )
            {   
                // Exact: display "2h43"
                var hour = Math.floor( diff/3600 );
                var mn = zeroFill( Math.round( (diff-(3600*hour))/60 ), 2 );
                if( bFuture )
                {   return dojo.string.substitute( __('lang_mainsite', 'in ${hour}h${mn}'), { hour:hour, mn:mn } );    }
                else
                {   return dojo.string.substitute( __('lang_mainsite', '${hour}h${mn} ago'), { hour:hour, mn:mn } );    }
            }
            else
            {
                // No exact: display "X hours"
                var hour = Math.round( diff/3600 );
                if( bFuture )
                {   
                    if( hour == 1 )
                    {   return __('lang_mainsite', 'in one hour' );  }
                    else
                    {   return dojo.string.substitute( __('lang_mainsite', 'in ${hour} hours'), { hour:hour } );    }
                }
                else
                {   
                    if( hour == 1 )
                    {   return __('lang_mainsite', 'one hour ago' );  }
                    else
                    {   return dojo.string.substitute( __('lang_mainsite', '${hour} hours ago'), { hour:hour } );    }
                }
            }
        }
        else
        {
            // The time will be displayed in absolute format (hh:mm).
            // Should the date be displayed in relative format ?
            if( date.getYear()==now.getYear() && date.getMonth()==now.getMonth() && date.getDate()==now.getDate() )
            {
                // This is "today"
                return dojo.string.substitute( __('lang_mainsite','today at ${H}:${m}'), {
                    H: zeroFill( date.getHours(), 2 ),
                    m: zeroFill( date.getMinutes(), 2 )
                } )+timezone;        
            }
            var tomorrow = dojo.date.add( now, "day", 1 );
            if( date.getYear()==tomorrow.getYear() && date.getMonth()==tomorrow.getMonth() && date.getDate()==tomorrow.getDate() )
            {
                // This is "tomorrow"
                return dojo.string.substitute( __('lang_mainsite','tomorrow at ${H}:${m}'), {
                    H: zeroFill( date.getHours(), 2 ),
                    m: zeroFill( date.getMinutes(), 2 )
                } )+timezone;        
            }
            var yesterday = dojo.date.add( now, "day", -1 );
            if( date.getYear()==yesterday.getYear() && date.getMonth()==yesterday.getMonth() && date.getDate()==yesterday.getDate() )
            {
                // This is "tomorrow"
                return dojo.string.substitute( __('lang_mainsite','yesterday at ${H}:${m}'), {
                    H: zeroFill( date.getHours(), 2 ),
                    m: zeroFill( date.getMinutes(), 2 )
                } )+timezone;        
            }
        }
        
        // Default case: display a complete date
        return dojo.string.substitute( bFormatDateUseIso ? __('lang_mainsite','${Y}-${M}-${D} at ${H}:${m}') : __('lang_mainsite','${M}/${D}/${Y} at ${H}:${m}'), {
            M: zeroFill( date.getMonth()+1, 2 ),
            D: zeroFill( date.getDate(), 2 ),
            Y: 1900+date.getYear(),
            H: zeroFill( date.getHours(), 2 ),
            m: zeroFill( date.getMinutes(), 2 )
        } )+timezone;
    }
};

date_format_simple = function( timestamp )
{
    // Default case: display a complete date
    var date = new Date( timestamp*1000 );

    // Should we use ISO?
    var bFormatDateUseIso = false;
    if (typeof globalUserInfos != 'undefined' && typeof globalUserInfos.date_use_iso != 'undefined')
        bFormatDateUseIso = globalUserInfos.date_use_iso;
    
    return dojo.string.substitute( bFormatDateUseIso ? __('lang_mainsite','${Y}-${M}-${D} at ${H}:${m}') : __('lang_mainsite','${M}/${D}/${Y} at ${H}:${m}'), {
        M: zeroFill( date.getMonth()+1, 2 ),
        D: zeroFill( date.getDate(), 2 ),
        Y: 1900+date.getYear(),
        H: zeroFill( date.getHours(), 2 ),
        m: zeroFill( date.getMinutes(), 2 )
    } );
};

// Display time only (HH:mm)
daytime_format = function( timestamp )
{
    var date = new Date( timestamp*1000 );
    return dojo.string.substitute( '${H}:${m}', {
        H: zeroFill( date.getHours(), 2 ),
        m: zeroFill( date.getMinutes(), 2 )
    } );
};

isset = function(variable) {
   return (typeof variable != 'undefined');
 };
 
toint = function( variable )
{
    if( variable === null )
    {   return null;    }
    return parseInt( variable, 10 );
};
tofloat = function( variable )
{
    if( variable === null )
    {   return null;    }
    return parseFloat( variable );
};
 
 
zeroFill = function( number, width )
{
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number;
};

ucFirst = function (string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
};

format_number = function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

playSound = function( soundId )
{
    if( soundManager.flashMedia && soundManager.flashMedia.doPlay && ( typeof soundManager.flashMedia.doPlay == 'function' ) )
    {
        if( soundManager.bMuteSound )
        {   return; }
    
        try {
            if (typeof soundManager.volume != 'undefined') {
                soundManager.doPlay({id:soundId,volume:soundManager.volume});
            } else {
                soundManager.doPlay({id:soundId});
            }
        }
        catch( e )
        {
            // Catch exception (sound does not exists)
        }
    }
    if( soundManager.html5 )
    {    soundManager.doPlay({id:soundId});      }
};
playSoundFile = function( soundId )  // Note: HTML5 only
{
    if( soundManager.html5 )
    {    soundManager.doPlayFile( soundId );      }
};
stopSound = function( soundId )
{
    if( soundManager.flashMedia && soundManager.flashMedia.doPlay && ( typeof soundManager.flashMedia.doPlay == 'function' ) )
    {
        try {    
            soundManager.stop({id:soundId});      
        }
        catch( e )
        {
            // Catch exception (sound does not exists)
        }
    }
    if( soundManager.html5 )
    {    soundManager.stop({id:soundId});      }
};

_ = function( label )
{
  //  console.log( 'function _() with label '+label+', g_i18n = '+g_i18n );
    if( typeof g_i18n == 'undefined' ) 
    {
        console.error( "Try to use a translated string in JS object declaration : impossible => string is NOT translated" );
        console.error( "String not translated : "+label );
        return label;
    }

    return g_i18n.getSimpleTranslation( label );
};

__ = function( bundle, label )
{
    if( typeof g_i18n == 'undefined' ) 
    {
        console.error( "Try to use a translated string in JS object declaration : impossible => string is NOT translated" );
        console.error( "String not translated : "+label );
        return label;
    }
    return g_i18n.getTranslation( bundle, label );
};  

// Google maps utilities
getLocationDescriptionFromResult = function( result )
{
    var description = '';
    for( var c in result.address_components )
    {
       // alert( result.address_component.long_name ); 
       if( description != '' )
       {    description += ', ';    }
       description += result.address_components[c].long_name     
    }        
    return description;
};

analyseLocationDescriptionFromResult = function( result )
{
    var description = {city:'',area1:'',area2:'',country:''};
    for( var c in result.address_components )
    {
       for( var i in result.address_components[c].types )
       {
           if( result.address_components[c].types[i] == 'administrative_area_level_1' )
           {
                description.area1 = result.address_components[c].long_name;
           }
           else if( result.address_components[c].types[i] == 'administrative_area_level_2' )
           {
                description.area2 = result.address_components[c].long_name;
           }
           else if( result.address_components[c].types[i] == 'locality' )
           {
                description.city = result.address_components[c].long_name;
           }
           else if( result.address_components[c].types[i] == 'country' )
           {
                description.country = result.address_components[c].short_name;
           }
       }
    }        
    return description;
};

id_to_path = function( id )
{
    return Math.floor(id/1000000000)+'/'+Math.floor(id/1000000)+'/'+Math.floor(id/1000);
};

playerDeviceToIcon = function( device ) 
{
    return ( device=='desktop' ) ? 'circle' : ( ( device=='tablet') ? 'tablet' : 'mobile' );
}


/* 
 * Original script by Josh Fraser (http://www.onlineaspect.com)
 * Continued by Jon Nylander, (jon at pageloom dot com)
 * According to both of us, you are absolutely free to do whatever 
 * you want with this code.
 * 
 * This code is  maintained at bitbucket.org as jsTimezoneDetect.
 */
 

/**
 * Namespace to hold all the code for timezone detection.
 */
jzTimezoneDetector = {};

jzTimezoneDetector.HEMISPHERE_SOUTH = 'SOUTH';
jzTimezoneDetector.HEMISPHERE_NORTH = 'NORTH';
jzTimezoneDetector.HEMISPHERE_UNKNOWN = 'N/A';
jzTimezoneDetector.olson = {};

/**
 * A simple object containing information of utc_offset, which olson timezone key to use, 
 * and if the timezone cares about daylight savings or not.
 * 
 * @constructor
 * @param {string} offset - for example '-11:00'
 * @param {string} olson_tz - the olson Identifier, such as "America/Denver"
 * @param {boolean} uses_dst - flag for whether the time zone somehow cares about daylight savings.
 */
jzTimezoneDetector.TimeZone = function (offset, olson_tz, uses_dst) {
	this.utc_offset = offset;
	this.olson_tz = olson_tz;
	this.uses_dst = uses_dst;
};

/**
 * Prints out the result.
 * But before it does that, it calls this.ambiguity_check.
 */
jzTimezoneDetector.TimeZone.prototype.display = function() {
	this.ambiguity_check();
	var response_text = '<b>UTC-offset</b>: ' + this.utc_offset + '<br/>';
	response_text += '<b>Zoneinfo key</b>: ' + this.olson_tz + '<br/>';
	response_text += '<b>Zone uses DST</b>: ' + (this.uses_dst ? 'yes' : 'no') + '<br/>';
	
	return response_text;
};

/**
 * Checks if a timezone has possible ambiguities. I.e timezones that are similar.
 * 
 * If the preliminary scan determines that we're in America/Denver. We double check
 * here that we're really there and not in America/Mazatlan.
 * 
 * This is done by checking known dates for when daylight savings start for different
 * timezones.
 */
jzTimezoneDetector.TimeZone.prototype.ambiguity_check = function() {
	var local_ambiguity_list = jzTimezoneDetector.olson.ambiguity_list[this.olson_tz];
	
	if (typeof(local_ambiguity_list) == 'undefined') {
		return;
	}
	
	var length = local_ambiguity_list.length;
	
	for (var i = 0; i < length; i++) {
		var tz = local_ambiguity_list[i];

		if (jzTimezoneDetector.date_is_dst(jzTimezoneDetector.olson.dst_start_dates[tz])) {
			this.olson_tz = tz;
			return;
		}	
	}
};

/**
 * Checks whether a given date is in daylight savings time.
 * 
 * If the date supplied is after june, we assume that we're checking
 * for southern hemisphere DST.
 * 
 * @param {Date} date
 * @returns {boolean}
 */
jzTimezoneDetector.date_is_dst = function (date) {
	var base_offset = ( (date.getMonth() > 5 ? jzTimezoneDetector.get_june_offset() : jzTimezoneDetector.get_january_offset()) );
	
	var date_offset = jzTimezoneDetector.get_date_offset(date);
	
	return toint( (base_offset - date_offset) ) !== 0;
};

/** 
 * Gets the offset in minutes from UTC for a certain date.
 * 
 * @param date
 * @returns {number}
 */
jzTimezoneDetector.get_date_offset = function (date) {
	return -date.getTimezoneOffset();
};

/**
 * This function does some basic calculations to create information about 
 * the user's timezone.
 * 
 * Returns a primitive object on the format
 * {'utc_offset' : -9, 'dst': 1, hemisphere' : 'north'}
 * where dst is 1 if the region uses daylight savings.
 * 
 * @returns {Object}  
 */
jzTimezoneDetector.get_timezone_info = function () {
	var january_offset = jzTimezoneDetector.get_january_offset();
	
	var june_offset = jzTimezoneDetector.get_june_offset();
	
	var diff = january_offset - june_offset;

	if (diff < 0) {
	    return {'utc_offset' : january_offset,
                'dst':	1,
                'hemisphere' : jzTimezoneDetector.HEMISPHERE_NORTH};
	}
	else if (diff > 0) {
        return {'utc_offset' : june_offset,
                'dst' : 1,
                'hemisphere' : jzTimezoneDetector.HEMISPHERE_SOUTH};
	}

    return {'utc_offset' : january_offset, 
            'dst': 0, 
            'hemisphere' : jzTimezoneDetector.HEMISPHERE_UNKNOWN};
};

jzTimezoneDetector.get_january_offset = function () {
	return jzTimezoneDetector.get_date_offset(new Date(2011, 0, 1, 0, 0, 0, 0));
};

jzTimezoneDetector.get_june_offset = function () {
	return jzTimezoneDetector.get_date_offset(new Date(2011, 5, 1, 0, 0, 0, 0));
};

/**
 * Uses get_timezone_info() to formulate a key to use in the olson.timezones dictionary.
 * 
 * Returns a primitive object on the format:
 * {'timezone': TimeZone, 'key' : 'the key used to find the TimeZone object'}
 * 
 * @returns Object 
 */
jzTimezoneDetector.determine_timezone = function () {
	var timezone_key_info = jzTimezoneDetector.get_timezone_info();
	
	var hemisphere_suffix = '';
		
	if (timezone_key_info.hemisphere == jzTimezoneDetector.HEMISPHERE_SOUTH) {
		hemisphere_suffix = ',s';
	}
	
	var tz_key = timezone_key_info.utc_offset + ',' + timezone_key_info.dst + hemisphere_suffix;
	
	return {'timezone' : jzTimezoneDetector.olson.timezones[tz_key], 'key' : tz_key};
};

/**
 * The keys in this dictionary are comma separated as such:
 * 
 * First the offset compared to UTC time in minutes.
 *  
 * Then a flag which is 0 if the timezone does not take daylight savings into account and 1 if it does.
 * 
 * Thirdly an optional 's' signifies that the timezone is in the southern hemisphere, only interesting for timezones with DST.
 * 
 * The values of the dictionary are TimeZone objects.
 */
jzTimezoneDetector.olson.timezones = {
    '-720,0'   : new jzTimezoneDetector.TimeZone('-12:00','Etc/GMT+12', false),
    '-660,0'   : new jzTimezoneDetector.TimeZone('-11:00','Pacific/Pago_Pago', false),
    '-600,1'   : new jzTimezoneDetector.TimeZone('-11:00','America/Adak',true),
    '-660,1,s' : new jzTimezoneDetector.TimeZone('-11:00','Pacific/Apia', true),
    '-600,0'   : new jzTimezoneDetector.TimeZone('-10:00','Pacific/Honolulu', false),
    '-570,0'   : new jzTimezoneDetector.TimeZone('-10:30','Pacific/Marquesas',false),
    '-540,0'   : new jzTimezoneDetector.TimeZone('-09:00','Pacific/Gambier',false),
    '-540,1'   : new jzTimezoneDetector.TimeZone('-09:00','America/Anchorage', true),
    '-480,1'   : new jzTimezoneDetector.TimeZone('-08:00','America/Los_Angeles', true),
    '-480,0'   : new jzTimezoneDetector.TimeZone('-08:00','Pacific/Pitcairn',false),
    '-420,0'   : new jzTimezoneDetector.TimeZone('-07:00','America/Phoenix', false),
    '-420,1'   : new jzTimezoneDetector.TimeZone('-07:00','America/Denver', true),
    '-360,0'   : new jzTimezoneDetector.TimeZone('-06:00','America/Guatemala', false),
    '-360,1'   : new jzTimezoneDetector.TimeZone('-06:00','America/Chicago', true),
    '-360,1,s' : new jzTimezoneDetector.TimeZone('-06:00','Pacific/Easter',true),
    '-300,0'   : new jzTimezoneDetector.TimeZone('-05:00','America/Bogota', false),
    '-300,1'   : new jzTimezoneDetector.TimeZone('-05:00','America/New_York', true),
    '-270,0'   : new jzTimezoneDetector.TimeZone('-04:30','America/Caracas', false),
    '-240,1'   : new jzTimezoneDetector.TimeZone('-04:00','America/Halifax', true),
    '-240,0'   : new jzTimezoneDetector.TimeZone('-04:00','America/Santo_Domingo', false),
    '-240,1,s' : new jzTimezoneDetector.TimeZone('-04:00','America/Asuncion', true),
    '-210,1'   : new jzTimezoneDetector.TimeZone('-03:30','America/St_Johns', true),
    '-180,1'   : new jzTimezoneDetector.TimeZone('-03:00','America/Godthab', true),
    '-180,0'   : new jzTimezoneDetector.TimeZone('-03:00','America/Argentina/Buenos_Aires', false),
    '-180,1,s' : new jzTimezoneDetector.TimeZone('-03:00','America/Montevideo', true),
    '-120,0'   : new jzTimezoneDetector.TimeZone('-02:00','America/Noronha', false),
    '-120,1'   : new jzTimezoneDetector.TimeZone('-02:00','Etc/GMT+2', true),
    '-60,1'    : new jzTimezoneDetector.TimeZone('-01:00','Atlantic/Azores', true),
    '-60,0'    : new jzTimezoneDetector.TimeZone('-01:00','Atlantic/Cape_Verde', false),
    '0,0'      : new jzTimezoneDetector.TimeZone('00:00','Etc/UTC', false),
    '0,1'      : new jzTimezoneDetector.TimeZone('00:00','Europe/London', true),
    '60,1'     : new jzTimezoneDetector.TimeZone('+01:00','Europe/Berlin', true),
    '60,0'     : new jzTimezoneDetector.TimeZone('+01:00','Africa/Lagos', false),
    '60,1,s'   : new jzTimezoneDetector.TimeZone('+01:00','Africa/Windhoek',true),
    '120,1'    : new jzTimezoneDetector.TimeZone('+02:00','Asia/Beirut', true),
    '120,0'    : new jzTimezoneDetector.TimeZone('+02:00','Africa/Johannesburg', false),
    '180,1'    : new jzTimezoneDetector.TimeZone('+03:00','Europe/Moscow', true),
    '180,0'    : new jzTimezoneDetector.TimeZone('+03:00','Asia/Baghdad', false),
    '210,1'    : new jzTimezoneDetector.TimeZone('+03:30','Asia/Tehran', true),
    '240,0'    : new jzTimezoneDetector.TimeZone('+04:00','Asia/Dubai', false),
    '240,1'    : new jzTimezoneDetector.TimeZone('+04:00','Asia/Yerevan', true),
    '270,0'    : new jzTimezoneDetector.TimeZone('+04:30','Asia/Kabul', false),
    '300,1'    : new jzTimezoneDetector.TimeZone('+05:00','Asia/Yekaterinburg', true),
    '300,0'    : new jzTimezoneDetector.TimeZone('+05:00','Asia/Karachi', false),
    '330,0'    : new jzTimezoneDetector.TimeZone('+05:30','Asia/Kolkata', false),
    '345,0'    : new jzTimezoneDetector.TimeZone('+05:45','Asia/Kathmandu', false),
    '360,0'    : new jzTimezoneDetector.TimeZone('+06:00','Asia/Dhaka', false),
    '360,1'    : new jzTimezoneDetector.TimeZone('+06:00','Asia/Omsk', true),
    '390,0'    : new jzTimezoneDetector.TimeZone('+06:30','Asia/Rangoon', false),
    '420,1'    : new jzTimezoneDetector.TimeZone('+07:00','Asia/Krasnoyarsk', true),
    '420,0'    : new jzTimezoneDetector.TimeZone('+07:00','Asia/Jakarta', false),
    '480,0'    : new jzTimezoneDetector.TimeZone('+08:00','Asia/Shanghai', false),
    '480,1'    : new jzTimezoneDetector.TimeZone('+08:00','Asia/Irkutsk', true),
    '525,0'    : new jzTimezoneDetector.TimeZone('+08:45','Australia/Eucla', true),
    '525,1,s'  : new jzTimezoneDetector.TimeZone('+08:45','Australia/Eucla', true),
    '540,1'    : new jzTimezoneDetector.TimeZone('+09:00','Asia/Yakutsk', true),
    '540,0'    : new jzTimezoneDetector.TimeZone('+09:00','Asia/Tokyo', false),
    '570,0'    : new jzTimezoneDetector.TimeZone('+09:30','Australia/Darwin', false),
    '570,1,s'  : new jzTimezoneDetector.TimeZone('+09:30','Australia/Adelaide', true),
    '600,0'    : new jzTimezoneDetector.TimeZone('+10:00','Australia/Brisbane', false),
    '600,1'    : new jzTimezoneDetector.TimeZone('+10:00','Asia/Vladivostok', true),
    '600,1,s'  : new jzTimezoneDetector.TimeZone('+10:00','Australia/Sydney', true),
    '630,1,s'  : new jzTimezoneDetector.TimeZone('+10:30','Australia/Lord_Howe', true),
    '660,1'    : new jzTimezoneDetector.TimeZone('+11:00','Asia/Kamchatka', true),
    '660,0'    : new jzTimezoneDetector.TimeZone('+11:00','Pacific/Noumea', false),
    '690,0'    : new jzTimezoneDetector.TimeZone('+11:30','Pacific/Norfolk', false),
    '720,1,s'  : new jzTimezoneDetector.TimeZone('+12:00','Pacific/Auckland', true),
    '720,0'    : new jzTimezoneDetector.TimeZone('+12:00','Pacific/Tarawa', false),
    '765,1,s'  : new jzTimezoneDetector.TimeZone('+12:45','Pacific/Chatham', true),
    '780,0'    : new jzTimezoneDetector.TimeZone('+13:00','Pacific/Tongatapu', false),
    '840,0'    : new jzTimezoneDetector.TimeZone('+14:00','Pacific/Kiritimati', false)
};

/**
 * This object contains information on when daylight savings starts for
 * different timezones.
 * 
 * The list is short for a reason. Often we do not have to be very specific
 * to single out the correct timezone. But when we do, this list comes in
 * handy.
 * 
 * Each value is a date denoting when daylight savings starts for that timezone.
 */
jzTimezoneDetector.olson.dst_start_dates = {
    'America/Denver' : new Date(2011, 2, 13, 3, 0, 0, 0),
    'America/Mazatlan' : new Date(2011, 3, 3, 3, 0, 0, 0),
    'America/Chicago' : new Date(2011, 2, 13, 3, 0, 0, 0),
    'America/Mexico_City' : new Date(2011, 3, 3, 3, 0, 0, 0),
    'Atlantic/Stanley' : new Date(2011, 8, 4, 7, 0, 0, 0),
    'America/Asuncion' : new Date(2011, 9, 2, 3, 0, 0, 0),
    'America/Santiago' : new Date(2011, 9, 9, 3, 0, 0, 0),
    'America/Campo_Grande' : new Date(2011, 9, 16, 5, 0, 0, 0),
    'America/Montevideo' : new Date(2011, 9, 2, 3, 0, 0, 0),
    'America/Sao_Paulo' : new Date(2011, 9, 16, 5, 0, 0, 0),
    'America/Los_Angeles' : new Date(2011, 2, 13, 8, 0, 0, 0),
    'America/Santa_Isabel' : new Date(2011, 3, 5, 8, 0, 0, 0),
    'America/Havana' : new Date(2011, 2, 13, 2, 0, 0, 0),
    'America/New_York' : new Date(2011, 2, 13, 7, 0, 0, 0),
    'Asia/Gaza' : new Date(2011, 2, 26, 23, 0, 0, 0),
    'Asia/Beirut' : new Date(2011, 2, 27, 1, 0, 0, 0),
    'Europe/Minsk' : new Date(2011, 2, 27, 3, 0, 0, 0),
    'Europe/Istanbul' : new Date(2011, 2, 27, 7, 0, 0, 0),
    'Asia/Damascus' : new Date(2011, 3, 1, 2, 0, 0, 0),
    'Asia/Jerusalem' : new Date(2011, 3, 1, 6, 0, 0, 0),
    'Africa/Cairo' : new Date(2011, 3, 29, 4, 0, 0, 0),
    'Asia/Yerevan' : new Date(2011, 2, 27, 4, 0, 0, 0),
    'Asia/Baku'    : new Date(2011, 2, 27, 8, 0, 0, 0),
    'Pacific/Auckland' : new Date(2011, 8, 26, 7, 0, 0, 0),
    'Pacific/Fiji' : new Date(2010, 11, 29, 23, 0, 0, 0),
    'America/Halifax' : new Date(2011, 2, 13, 6, 0, 0, 0),
    'America/Goose_Bay' : new Date(2011, 2, 13, 2, 1, 0, 0),
    'America/Miquelon' : new Date(2011, 2, 13, 5, 0, 0, 0),
    'America/Godthab' : new Date(2011, 2, 27, 1, 0, 0, 0)
};

/**
 * The keys in this object are timezones that we know may be ambiguous after
 * a preliminary scan through the olson_tz object.
 * 
 * The array of timezones to compare must be in the order that daylight savings
 * starts for the regions.
 */
jzTimezoneDetector.olson.ambiguity_list = {
    'America/Denver' : ['America/Denver','America/Mazatlan'],
    'America/Chicago' : ['America/Chicago','America/Mexico_City'],
    'America/Asuncion' : ['Atlantic/Stanley', 'America/Asuncion', 'America/Santiago','America/Campo_Grande'],
    'America/Montevideo' : ['America/Montevideo', 'America/Sao_Paulo'],
    'Asia/Beirut' : ['Asia/Gaza','Asia/Beirut', 'Europe/Minsk', 'Europe/Istanbul', 'Asia/Damascus', 'Asia/Jerusalem','Africa/Cairo'],
    'Asia/Yerevan' : ['Asia/Yerevan', 'Asia/Baku'],
    'Pacific/Auckland' : ['Pacific/Auckland', 'Pacific/Fiji'],
    'America/Los_Angeles' : ['America/Los_Angeles', 'America/Santa_Isabel'],
    'America/New_York' : ['America/Havana','America/New_York'],
    'America/Halifax' : ['America/Goose_Bay','America/Halifax'],
    'America/Godthab' : ['America/Miquelon', 'America/Godthab']
};

return {};

});

// See http://blog.vishalon.net/index.php/javascript-getting-and-setting-caret-position-in-textarea/
setCaretPosition = function(ctrl, pos){
	if(ctrl.setSelectionRange)
	{
		ctrl.focus();
		ctrl.setSelectionRange(pos,pos);
	}
	else if (ctrl.createTextRange) {
		var range = ctrl.createTextRange();
		range.collapse(true);
		range.moveEnd('character', pos);
		range.moveStart('character', pos);
		range.select();
	}
};


playerDeviceToIcon = function( device ) {

    return ( device=='desktop' ) ? 'circle' : ( ( device=='tablet') ? 'tablet' : 'mobile' );

};

replaceAll = function( str, from, to ) {

    var searchstring = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return str.replace(new RegExp(searchstring, 'g'), to );

};

array_unique = function(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
};

extractDomain = function (url) {
    var domain;
    //d get domain
    if (url.indexOf("://") > -1) {
        domain =    url.split('/')[0]+'/'+url.split('/')[1]+'/'+url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    return domain;
};


cookieConsentInit = function() {

    // Cookie consent (https://www.osano.com/cookieconsent)
    // See https://cookieconsent.insites.com/
    // Copy/pasted from http://cdnjs.cloudflare.com/ajax/libs/cookieconsent2/3.0.3/cookieconsent.min.js
    // See also CSS in 999_external.css

    !function(e){if(!e.hasInitialised){var t={escapeRegExp:function(e){return e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,"\\$&")},hasClass:function(e,t){var i=" ";return 1===e.nodeType&&(i+e.className+i).replace(/[\n\t]/g,i).indexOf(i+t+i)>=0},addClass:function(e,t){e.className+=" "+t},removeClass:function(e,t){var i=new RegExp("\\b"+this.escapeRegExp(t)+"\\b");e.className=e.className.replace(i,"")},interpolateString:function(e,t){var i=/{{([a-z][a-z0-9\-_]*)}}/gi;return e.replace(i,function(e){return t(arguments[1])||""})},getCookie:function(e){var t="; "+document.cookie,i=t.split("; "+e+"=");return 2!=i.length?void 0:i.pop().split(";").shift()},setCookie:function(e,t,i,n,o){var s=new Date;s.setDate(s.getDate()+(i||365));var r=[e+"="+t,"expires="+s.toUTCString(),"path="+(o||"/")];n&&r.push("domain="+n),document.cookie=r.join(";")},deepExtend:function(e,t){for(var i in t)t.hasOwnProperty(i)&&(i in e&&this.isPlainObject(e[i])&&this.isPlainObject(t[i])?this.deepExtend(e[i],t[i]):e[i]=t[i]);return e},throttle:function(e,t){var i=!1;return function(){i||(e.apply(this,arguments),i=!0,setTimeout(function(){i=!1},t))}},hash:function(e){var t,i,n,o=0;if(0===e.length)return o;for(t=0,n=e.length;t<n;++t)i=e.charCodeAt(t),o=(o<<5)-o+i,o|=0;return o},normaliseHex:function(e){return"#"==e[0]&&(e=e.substr(1)),3==e.length&&(e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]),e},getContrast:function(e){e=this.normaliseHex(e);var t=parseInt(e.substr(0,2),16),i=parseInt(e.substr(2,2),16),n=parseInt(e.substr(4,2),16),o=(299*t+587*i+114*n)/1e3;return o>=128?"#000":"#fff"},getLuminance:function(e){var t=parseInt(this.normaliseHex(e),16),i=38,n=(t>>16)+i,o=(t>>8&255)+i,s=(255&t)+i,r=(16777216+65536*(n<255?n<1?0:n:255)+256*(o<255?o<1?0:o:255)+(s<255?s<1?0:s:255)).toString(16).slice(1);return"#"+r},isMobile:function(){return/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)},isPlainObject:function(e){return"object"==typeof e&&null!==e&&e.constructor==Object}};e.status={deny:"deny",allow:"allow",dismiss:"dismiss"},e.transitionEnd=function(){var e=document.createElement("div"),t={t:"transitionend",OT:"oTransitionEnd",msT:"MSTransitionEnd",MozT:"transitionend",WebkitT:"webkitTransitionEnd"};for(var i in t)if(t.hasOwnProperty(i)&&"undefined"!=typeof e.style[i+"ransition"])return t[i];return""}(),e.hasTransition=!!e.transitionEnd;var i=Object.keys(e.status).map(t.escapeRegExp);e.customStyles={},e.Popup=function(){function n(){this.initialise.apply(this,arguments)}function o(e){this.openingTimeout=null,t.removeClass(e,"cc-invisible")}function s(t){t.style.display="none",t.removeEventListener(e.transitionEnd,this.afterTransition),this.afterTransition=null}function r(){var t=this.options.onInitialise.bind(this);if(!window.navigator.cookieEnabled)return t(e.status.deny),!0;if(window.CookiesOK||window.navigator.CookiesOK)return t(e.status.allow),!0;var i=Object.keys(e.status),n=this.getStatus(),o=i.indexOf(n)>=0;return o&&t(n),o}function a(){var e=this.options.position.split("-"),t=[];return e.forEach(function(e){t.push("cc-"+e)}),t}function c(){var e=this.options,i="top"==e.position||"bottom"==e.position?"banner":"floating";t.isMobile()&&(i="floating");var n=["cc-"+i,"cc-type-"+e.type,"cc-theme-"+e.theme];e["static"]&&n.push("cc-static"),n.push.apply(n,a.call(this));p.call(this,this.options.palette);return this.customStyleSelector&&n.push(this.customStyleSelector),n}function l(){var e={},i=this.options;i.showLink||(i.elements.link="",i.elements.messagelink=i.elements.message),Object.keys(i.elements).forEach(function(n){e[n]=t.interpolateString(i.elements[n],function(e){var t=i.content[e];return e&&"string"==typeof t&&t.length?t:""})});var n=i.compliance[i.type];n||(n=i.compliance.info),e.compliance=t.interpolateString(n,function(t){return e[t]});var o=i.layouts[i.layout];return o||(o=i.layouts.basic),t.interpolateString(o,function(t){return e[t]})}function u(i){var n=this.options,o=document.createElement("div"),s=n.container&&1===n.container.nodeType?n.container:document.body;o.innerHTML=i;var r=o.children[0];return r.style.display="none",t.hasClass(r,"cc-window")&&e.hasTransition&&t.addClass(r,"cc-invisible"),this.onButtonClick=h.bind(this),r.addEventListener("click",this.onButtonClick),n.autoAttach&&(s.firstChild?s.insertBefore(r,s.firstChild):s.appendChild(r)),r}function h(n){var o=n.target;if(t.hasClass(o,"cc-btn")){var s=o.className.match(new RegExp("\\bcc-("+i.join("|")+")\\b")),r=s&&s[1]||!1;r&&(this.setStatus(r),this.close(!0))}t.hasClass(o,"cc-close")&&(this.setStatus(e.status.dismiss),this.close(!0)),t.hasClass(o,"cc-revoke")&&this.revokeChoice()}function p(e){var i=t.hash(JSON.stringify(e)),n="cc-color-override-"+i,o=t.isPlainObject(e);return this.customStyleSelector=o?n:null,o&&d(i,e,"."+n),o}function d(i,n,o){if(e.customStyles[i])return void++e.customStyles[i].references;var s={},r=n.popup,a=n.button,c=n.highlight;r&&(r.text=r.text?r.text:t.getContrast(r.background),r.link=r.link?r.link:r.text,s[o+".cc-window"]=["color: "+r.text,"background-color: "+r.background],s[o+".cc-revoke"]=["color: "+r.text,"background-color: "+r.background],s[o+" .cc-link,"+o+" .cc-link:active,"+o+" .cc-link:visited"]=["color: "+r.link],a&&(a.text=a.text?a.text:t.getContrast(a.background),a.border=a.border?a.border:"transparent",s[o+" .cc-btn"]=["color: "+a.text,"border-color: "+a.border,"background-color: "+a.background],"transparent"!=a.background&&(s[o+" .cc-btn:hover, "+o+" .cc-btn:focus"]=["background-color: "+v(a.background)]),c?(c.text=c.text?c.text:t.getContrast(c.background),c.border=c.border?c.border:"transparent",s[o+" .cc-highlight .cc-btn:first-child"]=[]/*["color: "+c.text,"border-color: "+c.border,"background-color: "+c.background]*/):s[o+" .cc-highlight .cc-btn:first-child"]=[]/*["color: "+r.text]*/));var l=document.createElement("style");document.head.appendChild(l),e.customStyles[i]={references:1,element:l.sheet};var u=-1;for(var h in s)s.hasOwnProperty(h)&&l.sheet.insertRule(h+"{"+s[h].join(";")+"}",++u)}function v(e){return e=t.normaliseHex(e),"000000"==e?"#222":t.getLuminance(e)}function f(i){if(t.isPlainObject(i)){var n=t.hash(JSON.stringify(i)),o=e.customStyles[n];if(o&&!--o.references){var s=o.element.ownerNode;s&&s.parentNode&&s.parentNode.removeChild(s),e.customStyles[n]=null}}}function m(e,t){for(var i=0,n=e.length;i<n;++i){var o=e[i];if(o instanceof RegExp&&o.test(t)||"string"==typeof o&&o.length&&o===t)return!0}return!1}function b(){var t=this.setStatus.bind(this),i=this.options.dismissOnTimeout;"number"==typeof i&&i>=0&&(this.dismissTimeout=window.setTimeout(function(){t(e.status.dismiss)},Math.floor(i)));var n=this.options.dismissOnScroll;if("number"==typeof n&&n>=0){var o=function(i){window.pageYOffset>Math.floor(n)&&(t(e.status.dismiss),window.removeEventListener("scroll",o),this.onWindowScroll=null)};this.onWindowScroll=o,window.addEventListener("scroll",o)}}function y(){if("info"!=this.options.type&&(this.options.revokable=!0),t.isMobile()&&(this.options.animateRevokable=!1),this.options.revokable){var e=a.call(this);this.options.animateRevokable&&e.push("cc-animate"),this.customStyleSelector&&e.push(this.customStyleSelector);var i=this.options.revokeBtn.replace("{{classes}}",e.join(" "));this.revokeBtn=u.call(this,i);var n=this.revokeBtn;if(this.options.animateRevokable){var o=t.throttle(function(e){var i=!1,o=20,s=window.innerHeight-20;t.hasClass(n,"cc-top")&&e.clientY<o&&(i=!0),t.hasClass(n,"cc-bottom")&&e.clientY>s&&(i=!0),i?t.hasClass(n,"cc-active")||t.addClass(n,"cc-active"):t.hasClass(n,"cc-active")&&t.removeClass(n,"cc-active")},200);this.onMouseMove=o,window.addEventListener("mousemove",o)}}}var g={enabled:!0,container:null,cookie:{name:"cookieconsent_status",path:"/",domain:"",expiryDays:365},onPopupOpen:function(){},onPopupClose:function(){},onInitialise:function(e){},onStatusChange:function(e,t){},onRevokeChoice:function(){},content:{header:"Cookies used on the website!",message:"This website uses cookies to ensure you get the best experience on our website.",dismiss:"Got it!",allow:"Allow cookies",deny:"Decline",link:"Learn more",href:"http://cookiesandyou.com",close:"&#x274c;"},elements:{header:'<span class="cc-header">{{header}}</span>&nbsp;',message:'<span id="cookieconsent:desc" class="cc-message">{{message}}</span>',messagelink:'<span id="cookieconsent:desc" class="cc-message">{{message}} <a aria-label="learn more about cookies" role=button tabindex="0" class="cc-link" href="{{href}}" target="_blank">{{link}}</a></span>',dismiss:'<a aria-label="dismiss cookie message" role=button tabindex="0" class="cc-btn cc-dismiss">{{dismiss}}</a>',allow:'<a aria-label="allow cookies" role=button tabindex="0"  class="cc-btn cc-allow">{{allow}}</a>',deny:'<a aria-label="deny cookies" role=button tabindex="0" class="cc-btn cc-deny">{{deny}}</a>',link:'<a aria-label="learn more about cookies" role=button tabindex="0" class="cc-link" href="{{href}}" target="_blank">{{link}}</a>',close:'<span aria-label="dismiss cookie message" role=button tabindex="0" class="cc-close">{{close}}</span>'},window:'<div role="dialog" aria-live="polite" aria-label="cookieconsent" aria-describedby="cookieconsent:desc" class="cc-window {{classes}}"><!--googleoff: all-->{{children}}<!--googleon: all--></div>',revokeBtn:'<div class="cc-revoke {{classes}}">Cookie Policy</div>',compliance:{info:'<div class="cc-compliance">{{dismiss}}</div>',"opt-in":'<div class="cc-compliance cc-highlight">{{dismiss}}{{allow}}</div>',"opt-out":'<div class="cc-compliance cc-highlight">{{deny}}{{dismiss}}</div>'},type:"info",layouts:{basic:"{{messagelink}}{{compliance}}","basic-close":"{{messagelink}}{{compliance}}{{close}}","basic-header":"{{header}}{{message}}{{link}}{{compliance}}"},layout:"basic",position:"bottom",theme:"block","static":!1,palette:null,revokable:!1,animateRevokable:!0,showLink:!0,dismissOnScroll:!1,dismissOnTimeout:!1,autoOpen:!0,autoAttach:!0,whitelistPage:[],blacklistPage:[],overrideHTML:null};return n.prototype.initialise=function(e){this.options&&this.destroy(),t.deepExtend(this.options={},g),t.isPlainObject(e)&&t.deepExtend(this.options,e),r.call(this)&&(this.options.enabled=!1),m(this.options.blacklistPage,location.pathname)&&(this.options.enabled=!1),m(this.options.whitelistPage,location.pathname)&&(this.options.enabled=!0);var i=this.options.window.replace("{{classes}}",c.call(this).join(" ")).replace("{{children}}",l.call(this)),n=this.options.overrideHTML;if("string"==typeof n&&n.length&&(i=n),this.options["static"]){var o=u.call(this,'<div class="cc-grower">'+i+"</div>");o.style.display="",this.element=o.firstChild,this.element.style.display="none",t.addClass(this.element,"cc-invisible")}else this.element=u.call(this,i);b.call(this),y.call(this),this.options.autoOpen&&this.autoOpen()},n.prototype.destroy=function(){this.onButtonClick&&this.element&&(this.element.removeEventListener("click",this.onButtonClick),this.onButtonClick=null),this.dismissTimeout&&(clearTimeout(this.dismissTimeout),this.dismissTimeout=null),this.onWindowScroll&&(window.removeEventListener("scroll",this.onWindowScroll),this.onWindowScroll=null),this.onMouseMove&&(window.removeEventListener("mousemove",this.onMouseMove),this.onMouseMove=null),this.element&&this.element.parentNode&&this.element.parentNode.removeChild(this.element),this.element=null,this.revokeBtn&&this.revokeBtn.parentNode&&this.revokeBtn.parentNode.removeChild(this.revokeBtn),this.revokeBtn=null,f(this.options.palette),this.options=null},n.prototype.open=function(t){if(this.element)return this.isOpen()||(e.hasTransition?this.fadeIn():this.element.style.display="",this.options.revokable&&this.toggleRevokeButton(),this.options.onPopupOpen.call(this)),this},n.prototype.close=function(t){if(this.element)return this.isOpen()&&(e.hasTransition?this.fadeOut():this.element.style.display="none",t&&this.options.revokable&&this.toggleRevokeButton(!0),this.options.onPopupClose.call(this)),this},n.prototype.fadeIn=function(){var i=this.element;if(e.hasTransition&&i&&(this.afterTransition&&s.call(this,i),t.hasClass(i,"cc-invisible"))){if(i.style.display="",this.options["static"]){var n=this.element.clientHeight;this.element.parentNode.style.maxHeight=n+"px"}var r=20;this.openingTimeout=setTimeout(o.bind(this,i),r)}},n.prototype.fadeOut=function(){var i=this.element;e.hasTransition&&i&&(this.openingTimeout&&(clearTimeout(this.openingTimeout),o.bind(this,i)),t.hasClass(i,"cc-invisible")||(this.options["static"]&&(this.element.parentNode.style.maxHeight=""),this.afterTransition=s.bind(this,i),i.addEventListener(e.transitionEnd,this.afterTransition),t.addClass(i,"cc-invisible")))},n.prototype.isOpen=function(){return this.element&&""==this.element.style.display&&(!e.hasTransition||!t.hasClass(this.element,"cc-invisible"))},n.prototype.toggleRevokeButton=function(e){this.revokeBtn&&(this.revokeBtn.style.display=e?"":"none")},n.prototype.revokeChoice=function(e){this.options.enabled=!0,this.clearStatus(),this.options.onRevokeChoice.call(this),e||this.autoOpen()},n.prototype.hasAnswered=function(t){return Object.keys(e.status).indexOf(this.getStatus())>=0},n.prototype.hasConsented=function(t){var i=this.getStatus();return i==e.status.allow||i==e.status.dismiss},n.prototype.autoOpen=function(e){!this.hasAnswered()&&this.options.enabled&&this.open()},n.prototype.setStatus=function(i){var n=this.options.cookie,o=t.getCookie(n.name),s=Object.keys(e.status).indexOf(o)>=0;Object.keys(e.status).indexOf(i)>=0?(t.setCookie(n.name,i,n.expiryDays,n.domain,n.path),this.options.onStatusChange.call(this,i,s)):this.clearStatus()},n.prototype.getStatus=function(){return t.getCookie(this.options.cookie.name)},n.prototype.clearStatus=function(){var e=this.options.cookie;t.setCookie(e.name,"",-1,e.domain,e.path)},n}(),e.Location=function(){function e(e){t.deepExtend(this.options={},s),t.isPlainObject(e)&&t.deepExtend(this.options,e),this.currentServiceIndex=-1}function i(e,t,i){var n,o=document.createElement("script");o.type="text/"+(e.type||"javascript"),o.src=e.src||e,o.async=!1,o.onreadystatechange=o.onload=function(){var e=o.readyState;clearTimeout(n),t.done||e&&!/loaded|complete/.test(e)||(t.done=!0,t(),o.onreadystatechange=o.onload=null)},document.body.appendChild(o),n=setTimeout(function(){t.done=!0,t(),o.onreadystatechange=o.onload=null},i)}function n(e,t,i,n,o){var s=new(window.XMLHttpRequest||window.ActiveXObject)("MSXML2.XMLHTTP.3.0");if(s.open(n?"POST":"GET",e,1),s.setRequestHeader("X-Requested-With","XMLHttpRequest"),s.setRequestHeader("Content-type","application/x-www-form-urlencoded"),Array.isArray(o))for(var r=0,a=o.length;r<a;++r){var c=o[r].split(":",2);s.setRequestHeader(c[0].replace(/^\s+|\s+$/g,""),c[1].replace(/^\s+|\s+$/g,""))}"function"==typeof t&&(s.onreadystatechange=function(){s.readyState>3&&t(s)}),s.send(n)}function o(e){return new Error("Error ["+(e.code||"UNKNOWN")+"]: "+e.error)}var s={timeout:5e3,services:["freegeoip","ipinfo","maxmind"],serviceDefinitions:{freegeoip:function(){return{url:"//freegeoip.net/json/?callback={callback}",isScript:!0,callback:function(e,t){try{var i=JSON.parse(t);return i.error?o(i):{code:i.country_code}}catch(n){return o({error:"Invalid response ("+n+")"})}}}},ipinfo:function(){return{url:"//ipinfo.io",headers:["Accept: application/json"],callback:function(e,t){try{var i=JSON.parse(t);return i.error?o(i):{code:i.country}}catch(n){return o({error:"Invalid response ("+n+")"})}}}},ipinfodb:function(e){return{url:"//api.ipinfodb.com/v3/ip-country/?key={api_key}&format=json&callback={callback}",isScript:!0,callback:function(e,t){try{var i=JSON.parse(t);return"ERROR"==i.statusCode?o({error:i.statusMessage}):{code:i.countryCode}}catch(n){return o({error:"Invalid response ("+n+")"})}}}},maxmind:function(){return{url:"//js.maxmind.com/js/apis/geoip2/v2.1/geoip2.js",isScript:!0,callback:function(e){return window.geoip2?void geoip2.country(function(t){try{e({code:t.country.iso_code})}catch(i){e(o(i))}},function(t){e(o(t))}):void e(new Error("Unexpected response format. The downloaded script should have exported `geoip2` to the global scope"))}}}}};return e.prototype.getNextService=function(){var e;do e=this.getServiceByIdx(++this.currentServiceIndex);while(this.currentServiceIndex<this.options.services.length&&!e);return e},e.prototype.getServiceByIdx=function(e){var i=this.options.services[e];if("function"==typeof i){var n=i();return n.name&&t.deepExtend(n,this.options.serviceDefinitions[n.name](n)),n}return"string"==typeof i?this.options.serviceDefinitions[i]():t.isPlainObject(i)?this.options.serviceDefinitions[i.name](i):null},e.prototype.locate=function(e,t){var i=this.getNextService();return i?(this.callbackComplete=e,this.callbackError=t,void this.runService(i,this.runNextServiceOnError.bind(this))):void t(new Error("No services to run"))},e.prototype.setupUrl=function(e){var t=this.getCurrentServiceOpts();return e.url.replace(/\{(.*?)\}/g,function(i,n){if("callback"===n){var o="callback"+Date.now();return window[o]=function(t){e.__JSONP_DATA=JSON.stringify(t)},o}if(n in t.interpolateUrl)return t.interpolateUrl[n]})},e.prototype.runService=function(e,t){var o=this;if(e&&e.url&&e.callback){var s=e.isScript?i:n,r=this.setupUrl(e);s(r,function(i){var n=i?i.responseText:"";e.__JSONP_DATA&&(n=e.__JSONP_DATA,delete e.__JSONP_DATA),o.runServiceCallback.call(o,t,e,n)},this.options.timeout,e.data,e.headers)}},e.prototype.runServiceCallback=function(e,t,i){var n=this,o=function(t){s||n.onServiceResult.call(n,e,t)},s=t.callback(o,i);s&&this.onServiceResult.call(this,e,s)},e.prototype.onServiceResult=function(e,t){t instanceof Error||t&&t.error?e.call(this,t,null):e.call(this,null,t)},e.prototype.runNextServiceOnError=function(e,t){if(e){this.logError(e);var i=this.getNextService();i?this.runService(i,this.runNextServiceOnError.bind(this)):this.completeService.call(this,this.callbackError,new Error("All services failed"))}else this.completeService.call(this,this.callbackComplete,t)},e.prototype.getCurrentServiceOpts=function(){var e=this.options.services[this.currentServiceIndex];return"string"==typeof e?{name:e}:"function"==typeof e?e():t.isPlainObject(e)?e:{}},e.prototype.completeService=function(e,t){this.currentServiceIndex=-1,e&&e(t)},e.prototype.logError=function(e){var t=this.currentServiceIndex,i=this.getServiceByIdx(t);console.error("The service["+t+"] ("+i.url+") responded with the following error",e)},e}(),e.Law=function(){function e(e){this.initialise.apply(this,arguments)}var i={regionalLaw:!0,hasLaw:["AT","BE","BG","HR","CZ","CY","DK","EE","FI","FR","DE","EL","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","SK","SI","ES","SE","GB","UK"],revokable:["HR","CY","DK","EE","FR","DE","LV","LT","NL","PT","ES"],explicitAction:["HR","IT","ES"]};return e.prototype.initialise=function(e){t.deepExtend(this.options={},i),t.isPlainObject(e)&&t.deepExtend(this.options,e)},e.prototype.get=function(e){var t=this.options;return{hasLaw:t.hasLaw.indexOf(e)>=0,revokable:t.revokable.indexOf(e)>=0,explicitAction:t.explicitAction.indexOf(e)>=0}},e.prototype.applyLaw=function(e,t){var i=this.get(t);return i.hasLaw||(e.enabled=!1),this.options.regionalLaw&&(i.revokable&&(e.revokable=!0),i.explicitAction&&(e.dismissOnScroll=!1,e.dismissOnTimeout=!1)),e},e}(),e.initialise=function(t,i,n){var o=new e.Law(t.law);i||(i=function(){}),n||(n=function(){}),e.getCountryCode(t,function(n){delete t.law,delete t.location,n.code&&(t=o.applyLaw(t,n.code)),i(new e.Popup(t))},function(i){delete t.law,delete t.location,n(i,new e.Popup(t))})},e.getCountryCode=function(t,i,n){if(t.law&&t.law.countryCode)return void i({code:t.law.countryCode});if(t.location){var o=new e.Location(t.location);return void o.locate(function(e){i(e||{})},n)}i({})},e.utils=t,e.hasInitialised=!0,window.cookieconsent=e}}(window.cookieconsent||{});
    
};


removeAccents = function(str) {

  var defaultDiacriticsRemovalMap = [
    {'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
    {'base':'AA','letters':/[\uA732]/g},
    {'base':'AE','letters':/[\u00C6\u01FC\u01E2]/g},
    {'base':'AO','letters':/[\uA734]/g},
    {'base':'AU','letters':/[\uA736]/g},
    {'base':'AV','letters':/[\uA738\uA73A]/g},
    {'base':'AY','letters':/[\uA73C]/g},
    {'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
    {'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
    {'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
    {'base':'DZ','letters':/[\u01F1\u01C4]/g},
    {'base':'Dz','letters':/[\u01F2\u01C5]/g},
    {'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
    {'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
    {'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
    {'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
    {'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
    {'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
    {'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
    {'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
    {'base':'LJ','letters':/[\u01C7]/g},
    {'base':'Lj','letters':/[\u01C8]/g},
    {'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
    {'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
    {'base':'NJ','letters':/[\u01CA]/g},
    {'base':'Nj','letters':/[\u01CB]/g},
    {'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
    {'base':'OI','letters':/[\u01A2]/g},
    {'base':'OO','letters':/[\uA74E]/g},
    {'base':'OU','letters':/[\u0222]/g},
    {'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
    {'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
    {'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
    {'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
    {'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
    {'base':'TZ','letters':/[\uA728]/g},
    {'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
    {'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
    {'base':'VY','letters':/[\uA760]/g},
    {'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
    {'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
    {'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
    {'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
    {'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
    {'base':'aa','letters':/[\uA733]/g},
    {'base':'ae','letters':/[\u00E6\u01FD\u01E3]/g},
    {'base':'ao','letters':/[\uA735]/g},
    {'base':'au','letters':/[\uA737]/g},
    {'base':'av','letters':/[\uA739\uA73B]/g},
    {'base':'ay','letters':/[\uA73D]/g},
    {'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
    {'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
    {'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
    {'base':'dz','letters':/[\u01F3\u01C6]/g},
    {'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
    {'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
    {'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
    {'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
    {'base':'hv','letters':/[\u0195]/g},
    {'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
    {'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
    {'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
    {'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
    {'base':'lj','letters':/[\u01C9]/g},
    {'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
    {'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
    {'base':'nj','letters':/[\u01CC]/g},
    {'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
    {'base':'oi','letters':/[\u01A3]/g},
    {'base':'ou','letters':/[\u0223]/g},
    {'base':'oo','letters':/[\uA74F]/g},
    {'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
    {'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
    {'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
    {'base':'s','letters':/[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
    {'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
    {'base':'tz','letters':/[\uA729]/g},
    {'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
    {'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
    {'base':'vy','letters':/[\uA761]/g},
    {'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
    {'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
    {'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
    {'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
  ];

  for(var i=0; i<defaultDiacriticsRemovalMap.length; i++) {
    str = str.replace(defaultDiacriticsRemovalMap[i].letters, defaultDiacriticsRemovalMap[i].base);
  }

  return str;

}

getPlayerAvatar = function (player_id, player_avatar, size) {
    // Cannot work without player_avatar, set to 'none' in case of.
    if (!player_avatar) {
        player_avatar = '000000';
    }

    // If empty/invalid player id, consider "no avatar"
    if (!(/^[1-9]\d*$/.test(player_id))) {
        player_id = 0;
        player_avatar = '000000';
    }

    // Set a default size
    if (!size) {
        size = 50
    }

    // If player_avatar starts with "_def_nnn" it's a reference to a default avatar.
    var matches = player_avatar.match(/^_def_(\d+)$/)
    if (matches) {
        var avatar_id = matches[1];
        // Padding avatars with 0 on the left (up to 4)
        if (avatar_id.length < 4) {
            avatar_id  = ("0000" + avatar_id).slice(-4)
        }
        var sizeMap = {32 : '_32', 50 : '_50', 92 : '_92', 184 : ''};
        var sizeSuffix = sizeMap[size] || '';
        return g_themeurl+'../../data/avatar/defaults/default-'+avatar_id+sizeSuffix+'.jpg'
    }

    // If player_avatar is "000000" or "x00000", it's a reference to the "no avatar" image.
    if (player_id === 0 || player_avatar == '000000' || player_avatar == 'x00000') {
        return g_themeurl + '../../data/avatar/default_' + size + '.jpg'
    }

    // Otherwise, it's a custom (uploaded) avatar; $player_avatar is then used as a cache buster.
    return g_themeurl + '../../data/avatar/' + id_to_path(player_id) + '/' + player_id + '_' + size +'.jpg?h=' + player_avatar
}

getGroupAvatar = function (group_id, group_avatar, group_type, size) {
    if (!(/^[1-9]\d*$/.test(group_id))) {
        group_id = 0;
        group_avatar = '000000';
    }

    // Set a default size
    if (! size) {
        size = 50
    }

    if (! group_avatar || group_avatar == '000000') {
        // Default avatar
        // 'normal','friend','tournament','event','gamesession','gameguru'
        if (group_type == 'tournament') {
            return g_themeurl + '../../data/grouparms/noimage_tournament_' + size + '.png';
        }
        return g_themeurl + '../../data/grouparms/noimage_ ' + size + '.jpg';
    } else {
        const dir = Math.floor( group_id/1000 );
        return g_themeurl + '../../data/grouparms/'+dir+'/group_' + group_id + '_' + size + '.jpg?h=' + group_avatar;
    }
}

getMediaUrl = function (gameName, mediaType, size = null, key = 'default', timestamp = null) {
    let cacheBuster = '';
    if (timestamp) {
        cacheBuster = "?h=" + timestamp;
    }

    let extension = "png";
    if (["banner", "display"].includes(mediaType)) {
        extension = "jpg";
    }
    let sizeSuffix = "";
    if (size) {
        sizeSuffix = "_" + size;
    }
    if (!key) {
        key = 'default';
    }
    if (key === 'default' && mediaType === 'box') {
        // Backwards compatability for old box images
        key = 'en';
    }
    return g_themeurl + "../../data/gamemedia/" + gameName + "/" + mediaType + "/" + key + sizeSuffix + "." + extension + cacheBuster;
}

// GA - GTM: push data to the dataLayer
analyticsPush = function ( dataArray ) {
    if (dataLayer)
    {
        dataLayer.push( dataArray );
    }
}
