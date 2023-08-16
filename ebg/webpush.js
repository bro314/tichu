/* Webpush

BGA implementation of a js helper for web push notification functionnality.
https://developers.google.com/web/fundamentals/push-notifications/

*/

define("ebg/webpush", [
    "dojo","dojo/_base/declare"
],
function (dojo, declare) {
    return declare("ebg.webpush", null, {
        constructor: function( ajaxcall_callback ){
            console.log('Init web push notifications');
            
			this.ajaxcall_callback = ajaxcall_callback;

            this.serviceWorkerRegistered = false;
            this.permissionAlreadyGranted = false;
            this.permissionGranted = false;
            this.pushSubscription = null;
            
            var l_url_fragment = '/data/themereleases/';
            var l_version = g_themeurl.substr(g_themeurl.indexOf(l_url_fragment) + l_url_fragment.length, 11);
            
            this.l_serviceworker_url = "/theme/js/bgaserviceworker.js"; // We cannot use a version cachebreaker as it would register another webworker with each version

            this.browser = '';
            if( dojo.isChrome )
            {   this.browser = 'Google Chrome v'+dojo.isChrome;  }
            else if( dojo.isIE )
            {   this.browser = 'Internet Explorer v'+dojo.isIE;  }
            else if( dojo.isFF )
            {   this.browser = 'Mozilla Firefox v'+dojo.isFF;  }
            else if( dojo.isSafari )
            {   this.browser = 'Safari v'+dojo.isSafari;  }
            else if( dojo.isMozilla )
            {   this.browser = 'Mozilla v'+dojo.isMozilla;  }
            else if( dojo.isOpera )
            {   this.browser = 'Opera v'+dojo.isOpera;  }
        },

        init: function()
	    {
            if (!this.isSupported())
            {   
                return Promise.reject(new Error('Web push is not supported'));
            }

            if (this.isAuthorized()) {
                this.permissionAlreadyGranted = true;
            }

            return this.registerServiceWorker()
                .then(dojo.hitch(this, function() { return this.askPermission(); }))
                .then(dojo.hitch(this, function() { return this.subscribeUserToPush(); }))
                .then(dojo.hitch(this, function( pushSubscription ) { return this.savePushSubscription( pushSubscription ); }));
        },

        refresh: function()
	    {
            if (!this.isSupported())
            {   
                return Promise.reject(new Error('Web push is not supported'));
            }

            var l_current_domain = location.href.split('/')[2];
            var l_desired_domain = g_sitecore.domain;
            var l_desired_scope = 'https://' + l_desired_domain + '/';

            console.log('Service worker: current domain, desired domain and desired scope: ', l_current_domain, l_desired_domain, l_desired_scope);

            // Unregister obsolete service workers if any are found on outdated sub domains
            try {
                navigator.serviceWorker.getRegistrations().then(

                    dojo.hitch(this, function(registrations) {

                        var alreadyInstalled = false;
                        for (var i = 0; i < registrations.length; ++i) {
                            var registration = registrations[i];
                            console.log('Service worker found with scope ' + registration.scope);
                            
                            if (registration.scope != l_desired_scope) {
                                registration.unregister();
                                console.log('Unregistering service worker with scope ' + registration.scope);
                            } else {
                                console.log('Service worker is already installed for domain ' + l_current_domain);
                                alreadyInstalled = true;
                            }
                        }

                        // Install service worker on desired domain if it's not present
                        if (!alreadyInstalled && l_current_domain == l_desired_domain) {
                            console.log('Installing service worker for domain ' + l_current_domain);
                            this.registerServiceWorker();
                        }

                    }));
            }
            catch( error )
            {
                console.error( "Exception unregistering obsolete service workers: "+error.message );
            }
        },

        revoke: function()
	    {
            // There is no good way to revoke endpoints from the client side
            // https://blog.pushpad.xyz/2016/05/the-push-api-and-its-wild-unsubscription-mechanism/
            
            /*if (!this.isSupported)
            {
                return Promise.reject(new Error('Web push is not supported'));
            }

            if (Notification.permission !== "granted")
            {
                return Promise.resolve(true); // Permission not granted, nothing to do
            }

            return this.registerServiceWorker()
                .then(dojo.hitch(this, function() { return this.askPermission(); }))
                .then(dojo.hitch(this, function() { return this.subscribeUserToPush(); }))
                .then(dojo.hitch(this, function() { return this.deletePushSubscription(); }));*/
        },

		isSupported: function()
	    {
            if (typeof Promise === "undefined" || Promise.toString().indexOf("[native code]") === -1) {
                console.log("This browser does not support native promises");
                return false;
            }
            
			if (!('serviceWorker' in navigator)) {
                // Service Worker isn't supported on this browser, disable or hide UI.
                console.log("This browser does not support service workers");
                return false;
            }

            if (!('PushManager' in window)) {
                // Push isn't supported on this browser, disable or hide UI.
                console.log("This browser does not support web push");
                return false;
            }

            if (!("Notification" in window)) {
                // Desktop notification isn't supported on this browser, disable or hide UI.
                console.log("This browser does not support desktop notification");
                return false;
            }

            return true;
	    },

        isAuthorized: function()
	    {
            return Notification.permission == 'granted';
        },

	    registerServiceWorker: function()
	    {
            return navigator.serviceWorker.register( this.l_serviceworker_url, {scope: '../../'} )
              .then(function(registration) {
                this.serviceWorkerRegistered = true;
                console.log('Service worker successfully registered.');
                registration.update(); // Make sure the service worker updates itself with the latest version available
                return registration;
              })
              .then(null, function(err) {
                this.serviceWorkerRegistered = false;
                console.error('Unable to register service worker.', err);
              });
		},
		
		askPermission: function()
	    {
			return new Promise(function(resolve, reject) {
                var permissionResult = Notification.requestPermission(function(result) {
                  resolve(result);
                });

                if (permissionResult) {
                  permissionResult.then(resolve, reject);
                }
              })
              .then(function(permissionResult) {
                if (permissionResult === 'granted') {
                  this.permissionGranted = true;
                  console.log('We have been granted permission.');
                } else {
                  this.permissionGranted = false;
                  console.error('We weren\'t granted permission.');
                }
              });
		},

        subscribeUserToPush: function()
	    {
            return navigator.serviceWorker.register( this.l_serviceworker_url, {scope: '../../'} )
              .then(function(registration) {

                // Local function to correctly encode the key to a Uint8Array from https://gist.github.com/malko/ff77f0af005f684c44639e4061fa8019
                function urlBase64ToUint8Array(base64String) {
                  var padding = '='.repeat((4 - base64String.length % 4) % 4);
                  var base64 = (base64String + padding)
                    .replace(/\-/g, '+')
                    .replace(/_/g, '/');

                  var rawData = window.atob(base64);
                  var outputArray = new Uint8Array(rawData.length);

                  for (var i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                  }
                  return outputArray;
                }
                  
                var subscribeOptions = {
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(
                    'BKh3NNRk5O5wx1_qS_TlvqadCSZ_GmdwpYYfsVMurznZ03mn0wgvh-lK84IMaljkLFfYEQpxN_e4mwrUwYAfbwU'
                  )
                };

                return registration.pushManager.subscribe(subscribeOptions);
              })
              .then(function(pushSubscription) {
                console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
                return pushSubscription;
              });
        },

        savePushSubscription: function( pushSubscription )
	    {
            this.pushSubscription = JSON.parse(JSON.stringify(pushSubscription));
            
            // Save the result to database
            this.ajaxcall_callback( "/player/profile/savePushSubscription.html", {
                                        isnewbrowser: !this.permissionAlreadyGranted,
                                        browser: this.browser,
                                        endpoint: this.pushSubscription.endpoint,
                                        auth: this.pushSubscription.keys.auth,
                                        p256dh: this.pushSubscription.keys.p256dh, lock: false }, this, function( result ) {}, function( is_error) {}, 'post' );
        }

    });
});
